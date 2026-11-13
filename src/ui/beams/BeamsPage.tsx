import { Fragment, useState, type ReactNode } from 'react';
import {
  BEAM_ASSUMPTIONS,
  beamExtrema,
  BeamModelError,
  deflection_m,
  moment_Nm,
  sampleBeam,
  shear_N,
  solveBeam,
  type BeamExtrema,
  type BeamModel,
  type BeamSample,
  type BeamSolution,
} from '@core/beams';
import { computeSection, SectionGeometryError, type SectionShape } from '@core/sections';
import { fromSI, type UnitOf } from '@core/units';
import { REFERENCE_MATERIALS } from '@materials/index';
import { Button } from '@ui/components/Button';
import { QuantityValue } from '@ui/components/QuantityValue';
import { Tex } from '@ui/components/Tex';
import { UnitInput } from '@ui/components/UnitInput';
import { UnitSelect } from '@ui/components/UnitSelect';
import { formatNumber } from '@ui/format';
import { MaterialDropdown } from '@ui/materials/MaterialDropdown';
import { useCustomMaterials } from '@ui/materials/useCustomMaterials';
import { buildSectionInput, defaultDims, SHAPES, shapeSpec } from '@ui/sections/sectionForm';
import { BeamDiagram } from './BeamDiagram';
import { BeamDrawing } from './BeamDrawing';
import {
  buildBeamModel,
  defaultForm,
  LOAD_KINDS,
  loadKindLabel,
  newLoad,
  SUPPORT_MODES,
  supportName,
  type BeamForm,
  type LoadDraft,
} from './beamForm';
import { absExtremum, GENERAL_FORMULAS, knownCase, type BeamFormula } from './beamFormulas';

type Dims = Record<string, number | undefined>;
type LengthUnit = UnitOf<'length'>;

interface Computed {
  model: BeamModel;
  solution: BeamSolution;
  extrema: BeamExtrema;
  samples: BeamSample[];
  /** Ordres de grandeur servant à ramener à zéro le bruit d'arrondi. */
  refForce_N: number;
}

function compute(form: BeamForm, EI: number | undefined): { result?: Computed; error?: string } {
  const built = buildBeamModel(form, EI);
  if (built.error !== undefined) return { error: built.error };
  try {
    const solution = solveBeam(built.model);
    const L = built.model.length_m;
    const refForce_N = built.model.loads.reduce((max, l) => {
      switch (l.kind) {
        case 'ponctuelle':
          return Math.max(max, Math.abs(l.Fz_N));
        case 'couple':
          return Math.max(max, Math.abs(l.C_Nm) / L);
        case 'repartie':
          return Math.max(
            max,
            Math.max(Math.abs(l.q1_N_m), Math.abs(l.q2_N_m)) * (l.x2_m - l.x1_m),
          );
      }
    }, 0);
    return {
      result: {
        model: built.model,
        solution,
        extrema: beamExtrema(solution),
        samples: sampleBeam(solution),
        refForce_N,
      },
    };
  } catch (e) {
    if (e instanceof BeamModelError) return { error: e.message };
    throw e;
  }
}

/** Ramène à zéro une valeur inférieure au bruit d'arrondi (1e-9 de l'ordre de grandeur). */
const snap = (v: number, ref: number) => (Math.abs(v) <= 1e-9 * ref ? 0 : v);

interface ResultRow {
  key: string;
  label: string;
  symbol: string;
  value: ReactNode;
  detail?: string;
  formula?: BeamFormula | undefined;
}

function buildRows(c: Computed, lengthUnit: LengthUnit): ResultRow[] {
  const { model, solution, extrema, refForce_N: F } = c;
  const L = model.length_m;
  const EI = model.EI_Nm2;
  const at = (x_m: number) =>
    `en x = ${formatNumber(fromSI(x_m, 'length', lengthUnit))} ${lengthUnit}`;
  const known = knownCase(model, extrema);
  const rows: ResultRow[] = [];

  solution.reactions.forEach((r, i) => {
    const name = supportName(i);
    rows.push({
      key: `R${i}`,
      label: `Réaction en ${name} (positive vers le haut)`,
      symbol: `R${name}`,
      value: (
        <QuantityValue
          valueSI={snap(r.Fz_N, F)}
          quantity="force"
          defaultUnit="kN"
          label={`R${name}`}
        />
      ),
    });
    if (r.C_Nm !== undefined) {
      rows.push({
        key: `C${i}`,
        label: `Couple d’encastrement en ${name} (sens trigonométrique)`,
        symbol: `C${name}`,
        value: (
          <QuantityValue
            valueSI={snap(r.C_Nm, F * L)}
            quantity="moment"
            defaultUnit="kN·m"
            label={`C${name}`}
          />
        ),
      });
    }
  });

  const V = absExtremum(extrema.shear_N);
  rows.push({
    key: 'V',
    label: 'Effort tranchant maximal',
    symbol: '|V|max',
    value: (
      <QuantityValue
        valueSI={Math.abs(snap(V.value, F))}
        quantity="force"
        defaultUnit="kN"
        label="V"
      />
    ),
    detail: at(V.x_m),
  });

  const M = absExtremum(extrema.moment_Nm);
  const Mv = snap(M.value, F * L);
  rows.push({
    key: 'M',
    label: 'Moment fléchissant maximal',
    symbol: '|M|max',
    value: <QuantityValue valueSI={Math.abs(Mv)} quantity="moment" defaultUnit="kN·m" label="M" />,
    detail: Mv === 0 ? '' : `${at(M.x_m)}, fibre ${Mv > 0 ? 'inférieure' : 'supérieure'} tendue`,
    formula: known?.moment,
  });

  if (EI !== undefined && extrema.deflection_m && extrema.slope_rad) {
    const w = absExtremum(extrema.deflection_m);
    const wv = snap(w.value, (F * L ** 3) / EI);
    rows.push({
      key: 'w',
      label: 'Flèche maximale',
      symbol: 'δmax',
      value: <QuantityValue valueSI={Math.abs(wv)} quantity="length" defaultUnit="mm" label="δ" />,
      detail: wv === 0 ? '' : `${at(w.x_m)}, vers le ${wv < 0 ? 'bas' : 'haut'}`,
      formula: known?.deflection,
    });
    if (wv !== 0) {
      rows.push({
        key: 'ratio',
        label: 'Rapport longueur totale / flèche',
        symbol: 'L/δ',
        value: <span className="font-mono tabular-nums">{formatNumber(L / Math.abs(wv))}</span>,
      });
    }
    const th = absExtremum(extrema.slope_rad);
    rows.push({
      key: 'theta',
      label: 'Rotation maximale',
      symbol: '|θ|max',
      value: (
        <QuantityValue
          valueSI={Math.abs(snap(th.value, (F * L ** 2) / EI))}
          quantity="angle"
          defaultUnit="mrad"
          label="θ"
        />
      ),
      detail: at(th.x_m),
    });
  }
  return rows;
}

function Results({ rows, caseName }: { rows: ResultRow[]; caseName: string | undefined }) {
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set());
  const toggle = (k: string) =>
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <section
      aria-labelledby="resultats-poutre"
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <h3 id="resultats-poutre" className="font-medium">
        Résultats
      </h3>
      {caseName !== undefined && (
        <p className="mt-1 text-xs text-slate-500">
          Cas de table reconnu : {caseName}. Cliquez sur ƒ pour la formule fermée (application
          numérique en kN et m).
        </p>
      )}
      <table className="mt-2 w-full">
        <tbody>
          {rows.map((r) => {
            const f = r.formula;
            const open = f !== undefined && shown.has(r.key);
            return (
              <Fragment key={r.key}>
                <tr className={open ? '' : 'border-b border-slate-100'}>
                  <th
                    scope="row"
                    className="py-1.5 pr-3 text-left text-sm font-normal text-slate-600"
                  >
                    {r.label}
                    {r.detail !== undefined && r.detail !== '' && (
                      <span className="block text-xs text-slate-500">{r.detail}</span>
                    )}
                  </th>
                  <td className="py-1.5 pr-2 font-serif italic whitespace-nowrap">{r.symbol}</td>
                  <td className="py-1.5 text-right">{r.value}</td>
                  <td className="no-print w-8 py-1.5 pl-2 text-right">
                    {f && (
                      <button
                        type="button"
                        onClick={() => toggle(r.key)}
                        aria-expanded={open}
                        aria-label={`${open ? 'Masquer' : 'Afficher'} la formule de ${r.symbol}`}
                        title={`${open ? 'Masquer' : 'Afficher'} la formule`}
                        className={`rounded px-1.5 font-serif italic ${open ? 'bg-sky-100 text-sky-800' : 'text-slate-500 hover:bg-slate-100'}`}
                      >
                        ƒ
                      </button>
                    )}
                  </td>
                </tr>
                {open && (
                  <tr className="border-b border-slate-100">
                    <td colSpan={4} className="pb-3">
                      <div className="overflow-x-auto rounded-md bg-slate-50 px-3 py-2 text-sm">
                        <Tex expr={f.latex} className="block" />
                        <Tex expr={f.application} className="mt-1 block text-slate-700" />
                        <p className="mt-1.5 text-xs text-slate-500">Source : {f.source}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function Method() {
  return (
    <details className="rounded-lg border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer font-medium">
        Détail du calcul : méthode et hypothèses
      </summary>
      <div className="mt-3 space-y-3 text-sm">
        {GENERAL_FORMULAS.map((f) => (
          <div key={f.label}>
            <p className="text-slate-600">{f.label}</p>
            <div className="overflow-x-auto rounded-md bg-slate-50 px-3 py-2">
              <Tex expr={f.latex} className="block" />
            </div>
            <p className="mt-1 text-xs text-slate-500">Source : {f.source}</p>
          </div>
        ))}
        <p className="text-slate-600">
          Les réactions et les deux constantes d’intégration sont les inconnues d’un système
          linéaire : équilibre, flèche nulle à chaque appui, flèche et rotation nulles à
          l’encastrement.
        </p>
        <p className="text-xs text-slate-500">
          <span className="font-medium text-slate-600">Hypothèses : </span>
          {BEAM_ASSUMPTIONS.join(' ')}
        </p>
      </div>
    </details>
  );
}

function LoadEditor({
  load,
  index,
  onChange,
  onRemove,
}: {
  load: LoadDraft;
  index: number;
  onChange: (patch: Partial<LoadDraft>) => void;
  onRemove: () => void;
}) {
  const distributed = load.kind === 'uniforme' || load.kind === 'lineaire';
  return (
    <li className="rounded-md border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {index + 1}. {loadKindLabel(load.kind)}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="no-print rounded px-2 py-0.5 text-sm text-red-700 hover:bg-red-50"
          aria-label={`Supprimer la charge n° ${index + 1}`}
        >
          Supprimer
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {!distributed && (
          <UnitInput
            label="Position depuis la gauche"
            symbol="x"
            quantity="length"
            defaultUnit="m"
            initialSI={load.x_m}
            onChange={(v) => onChange({ x_m: v })}
          />
        )}
        {load.kind === 'ponctuelle' && (
          <UnitInput
            label="Force, positive vers le bas"
            symbol="F"
            quantity="force"
            defaultUnit="kN"
            initialSI={load.value}
            onChange={(v) => onChange({ value: v })}
          />
        )}
        {load.kind === 'couple' && (
          <UnitInput
            label="Couple, positif en sens trigonométrique"
            symbol="C"
            quantity="moment"
            defaultUnit="kN·m"
            initialSI={load.value}
            onChange={(v) => onChange({ value: v })}
          />
        )}
        {distributed && (
          <UnitInput
            label={
              load.kind === 'uniforme'
                ? 'Charge, positive vers le bas'
                : 'Charge à gauche, positive vers le bas'
            }
            symbol={load.kind === 'uniforme' ? 'q' : 'q1'}
            quantity="lineLoad"
            defaultUnit="kN/m"
            initialSI={load.value}
            onChange={(v) => onChange({ value: v })}
          />
        )}
        {load.kind === 'lineaire' && (
          <UnitInput
            label="Charge à droite, positive vers le bas"
            symbol="q2"
            quantity="lineLoad"
            defaultUnit="kN/m"
            initialSI={load.value2}
            onChange={(v) => onChange({ value2: v })}
          />
        )}
        {distributed && (
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={load.fullLength}
              onChange={(e) => onChange({ fullLength: e.target.checked })}
            />
            Sur toute la longueur de la poutre
          </label>
        )}
        {distributed && !load.fullLength && (
          <>
            <UnitInput
              label="Début, depuis la gauche"
              symbol="x1"
              quantity="length"
              defaultUnit="m"
              initialSI={load.x1_m}
              onChange={(v) => onChange({ x1_m: v })}
            />
            <UnitInput
              label="Fin, depuis la gauche"
              symbol="x2"
              quantity="length"
              defaultUnit="m"
              initialSI={load.x2_m}
              onChange={(v) => onChange({ x2_m: v })}
            />
          </>
        )}
      </div>
    </li>
  );
}

const DEFAULT_MATERIAL = REFERENCE_MATERIALS.find((m) => m.id === 's235jr')?.id ?? '';

export function BeamsPage() {
  const [form, setForm] = useState<BeamForm>(defaultForm);
  const [nextId, setNextId] = useState(2);
  const [lengthUnit, setLengthUnit] = useState<LengthUnit>('m');

  // Rigidité : E (matériau ou saisie) × I (section paramétrique ou saisie).
  const custom = useCustomMaterials();
  const [materialId, setMaterialId] = useState(DEFAULT_MATERIAL);
  const [manualE, setManualE] = useState<number | undefined>(undefined);
  const [inertiaMode, setInertiaMode] = useState<'section' | 'directe'>('section');
  const [shape, setShape] = useState<SectionShape>('I');
  const [dimsByShape, setDimsByShape] = useState<Partial<Record<SectionShape, Dims>>>({});
  const [manualI, setManualI] = useState<number | undefined>(undefined);

  const material = [...REFERENCE_MATERIALS, ...custom.materials].find((m) => m.id === materialId);
  const E = material?.E_Pa ?? manualE;

  const dims = dimsByShape[shape] ?? defaultDims(shape);
  let sectionI: number | undefined;
  let sectionError: string | undefined;
  if (inertiaMode === 'section') {
    const input = buildSectionInput(shape, dims);
    if (!input) sectionError = 'Renseignez toutes les cotes de la section.';
    else {
      try {
        sectionI = computeSection(input).Iy_m4;
      } catch (e) {
        if (e instanceof SectionGeometryError) sectionError = e.message;
        else throw e;
      }
    }
  }
  const I = inertiaMode === 'section' ? sectionI : manualI;
  const positive = (v: number | undefined): v is number =>
    v !== undefined && Number.isFinite(v) && v > 0;
  const EI = positive(E) && positive(I) ? E * I : undefined;

  const { result, error } = compute(form, EI);

  const patch = (p: Partial<BeamForm>) => setForm((f) => ({ ...f, ...p }));
  const patchLoad = (id: number) => (p: Partial<LoadDraft>) =>
    setForm((f) => ({ ...f, loads: f.loads.map((l) => (l.id === id ? { ...l, ...p } : l)) }));
  const addLoad = (kind: LoadDraft['kind']) => {
    setForm((f) => ({ ...f, loads: [...f.loads, newLoad(kind, nextId, f.length_m)] }));
    setNextId((n) => n + 1);
  };

  const refF = result?.refForce_N ?? 1;
  const L = result?.model.length_m ?? 1;
  const curve = (pick: (s: BeamSample) => number | undefined, ref: number) =>
    (result?.samples ?? []).map((s) => ({ x_m: s.x_m, y: snap(pick(s) ?? 0, ref) }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Poutres isostatiques</h2>
        <p className="mt-1 text-sm text-slate-600">
          Réactions d’appui, effort tranchant, moment fléchissant et flèche d’une poutre droite. Axe{' '}
          <i>x</i> le long de la poutre depuis l’extrémité gauche, <i>z</i> vers le haut.
        </p>
      </div>

      <section
        className="rounded-lg border border-slate-200 bg-white p-3"
        aria-label="Schéma du cas"
      >
        {result ? (
          <BeamDrawing model={result.model} />
        ) : (
          <p className="p-4 text-sm text-slate-500">
            Schéma indisponible : données incomplètes ou incohérentes.
          </p>
        )}
        <p className="mt-1 text-xs text-slate-500">
          Conventions : forces et charges saisies positives vers le bas ; couples positifs dans le
          sens trigonométrique ; réactions positives vers le haut ; moment fléchissant positif quand
          la fibre inférieure est tendue ; flèche positive vers le haut.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="font-medium">Poutre et appuis</h3>
          <UnitInput
            label="Longueur totale"
            symbol="L"
            quantity="length"
            defaultUnit="m"
            initialSI={form.length_m}
            onChange={(v) => patch({ length_m: v })}
          />
          <div className="flex flex-col gap-1" role="radiogroup" aria-label="Type d’appuis">
            {SUPPORT_MODES.map((s) => (
              <label key={s.mode} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="appuis"
                  checked={form.supportMode === s.mode}
                  onChange={() => patch({ supportMode: s.mode })}
                />
                {s.label}
              </label>
            ))}
          </div>
          {form.supportMode === 'appuis' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <UnitInput
                label="Porte-à-faux gauche (A)"
                symbol="a"
                quantity="length"
                defaultUnit="m"
                initialSI={form.overhangLeft_m}
                onChange={(v) => patch({ overhangLeft_m: v })}
              />
              <UnitInput
                label="Porte-à-faux droit (B)"
                symbol="b"
                quantity="length"
                defaultUnit="m"
                initialSI={form.overhangRight_m}
                onChange={(v) => patch({ overhangRight_m: v })}
              />
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="font-medium">Rigidité de flexion (pour la flèche)</h3>
          <MaterialDropdown
            reference={REFERENCE_MATERIALS}
            custom={custom.materials}
            value={materialId}
            onChange={setMaterialId}
            label="Matériau (module d’Young)"
            placeholder="Aucun : saisir E"
          />
          {material ? (
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-slate-700">
              <span>
                Module d’Young <i className="font-serif">E</i> :
              </span>
              <QuantityValue
                key={material.id}
                valueSI={material.E_Pa}
                quantity="stress"
                defaultUnit="GPa"
                label="E"
              />
              {!material.verified && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                  non vérifié
                </span>
              )}
            </p>
          ) : (
            <UnitInput
              label="Module d’Young"
              symbol="E"
              quantity="stress"
              defaultUnit="GPa"
              initialSI={manualE}
              onChange={setManualE}
            />
          )}
          <div
            className="flex flex-wrap gap-x-4 gap-y-1"
            role="radiogroup"
            aria-label="Origine du moment quadratique"
          >
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="inertie"
                checked={inertiaMode === 'section'}
                onChange={() => setInertiaMode('section')}
              />
              Section paramétrique
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="inertie"
                checked={inertiaMode === 'directe'}
                onChange={() => setInertiaMode('directe')}
              />
              Saisie directe de I
            </label>
          </div>
          {inertiaMode === 'section' ? (
            <>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Forme de la section
                <select
                  value={shape}
                  onChange={(e) => {
                    const next = SHAPES.find((s) => s.shape === e.target.value);
                    if (next) setShape(next.shape);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5"
                >
                  {SHAPES.map((s) => (
                    <option key={s.shape} value={s.shape}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                {shapeSpec(shape).dims.map((d) => (
                  <UnitInput
                    key={`${shape}-${d.key}`}
                    label={d.label}
                    symbol={d.symbol}
                    quantity="length"
                    defaultUnit="mm"
                    initialSI={dims[d.key]}
                    onChange={(v) =>
                      setDimsByShape((prev) => ({
                        ...prev,
                        [shape]: { ...(prev[shape] ?? defaultDims(shape)), [d.key]: v },
                      }))
                    }
                  />
                ))}
              </div>
              {sectionError !== undefined ? (
                <p role="alert" className="text-sm text-red-700">
                  {sectionError}
                </p>
              ) : (
                sectionI !== undefined && (
                  <p className="flex flex-wrap items-center gap-x-2 text-sm text-slate-700">
                    <span>
                      Moment quadratique <i className="font-serif">Iy</i> (flexion autour de l’axe
                      horizontal) :
                    </span>
                    <QuantityValue
                      valueSI={sectionI}
                      quantity="secondMomentOfArea"
                      defaultUnit="cm⁴"
                      label="Iy"
                    />
                  </p>
                )
              )}
            </>
          ) : (
            <UnitInput
              label="Moment quadratique"
              symbol="I"
              quantity="secondMomentOfArea"
              defaultUnit="cm⁴"
              initialSI={manualI}
              onChange={setManualI}
            />
          )}
          {EI === undefined && (
            <p className="text-sm text-slate-500">
              Sans E et I valides, seuls les réactions, l’effort tranchant et le moment sont
              calculés.
            </p>
          )}
        </section>
      </div>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="font-medium">Charges</h3>
        {form.loads.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune charge.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {form.loads.map((load, i) => (
              <LoadEditor
                key={load.id}
                load={load}
                index={i}
                onChange={patchLoad(load.id)}
                onRemove={() =>
                  setForm((f) => ({ ...f, loads: f.loads.filter((l) => l.id !== load.id) }))
                }
              />
            ))}
          </ul>
        )}
        <div className="no-print flex flex-wrap gap-2">
          {LOAD_KINDS.map((k) => (
            <Button key={k.kind} onClick={() => addLoad(k.kind)}>
              + {k.label}
            </Button>
          ))}
        </div>
        {error !== undefined && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </section>

      {result && (
        <>
          <Results
            rows={buildRows(result, lengthUnit)}
            caseName={knownCase(result.model, result.extrema)?.name}
          />

          <section className="space-y-3" aria-labelledby="diagrammes-poutre">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="diagrammes-poutre" className="font-medium">
                Diagrammes
              </h3>
              <span className="flex items-center gap-2 text-sm text-slate-600">
                Abscisses en
                <UnitSelect
                  quantity="length"
                  value={lengthUnit}
                  onChange={setLengthUnit}
                  label="Unité des abscisses"
                />
              </span>
            </div>
            <BeamDiagram
              title="Effort tranchant"
              symbol="V"
              quantity="force"
              defaultUnit="kN"
              points={curve((s) => s.V_N, refF)}
              valueAt={(x) => snap(shear_N(result.solution, x), refF)}
              length_m={L}
              lengthUnit={lengthUnit}
              note="somme des forces vers le haut à gauche de la coupe"
            />
            <BeamDiagram
              title="Moment fléchissant"
              symbol="M"
              quantity="moment"
              defaultUnit="kN·m"
              points={curve((s) => s.M_Nm, refF * L)}
              valueAt={(x) => snap(moment_Nm(result.solution, x), refF * L)}
              length_m={L}
              lengthUnit={lengthUnit}
              note="positif : fibre inférieure tendue"
            />
            {EI !== undefined && (
              <BeamDiagram
                title="Flèche"
                symbol="w"
                quantity="length"
                defaultUnit="mm"
                points={curve((s) => s.w_m, (refF * L ** 3) / EI)}
                valueAt={(x) => snap(deflection_m(result.solution, x), (refF * L ** 3) / EI)}
                length_m={L}
                lengthUnit={lengthUnit}
                note="positive vers le haut"
              />
            )}
          </section>

          <Method />
        </>
      )}
    </div>
  );
}
