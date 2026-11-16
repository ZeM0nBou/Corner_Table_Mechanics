import { useState } from 'react';
import { BUCKLING_CASES, type BucklingCase } from '@core/buckling';
import {
  computeSection,
  SectionGeometryError,
  type SectionResult,
  type SectionShape,
} from '@core/sections';
import { REFERENCE_MATERIALS } from '@materials/index';
import { FormulaTable, type FormulaRow } from '@ui/components/FormulaTable';
import { QuantityValue } from '@ui/components/QuantityValue';
import { NumberInput, UnitInput } from '@ui/components/UnitInput';
import { VerdictBadge } from '@ui/components/VerdictBadge';
import { formatNumber } from '@ui/format';
import { MaterialDropdown } from '@ui/materials/MaterialDropdown';
import { useCustomMaterials } from '@ui/materials/useCustomMaterials';
import { buildSectionInput, defaultDims, shapeSpec } from '@ui/sections/sectionForm';
import { SectionDrawing } from '@ui/sections/SectionDrawing';
import { SectionShapeFields, type Dims } from '@ui/sections/SectionShapeFields';
import { BucklingDrawing } from './BucklingDrawing';
import { bucklingAxes, evaluateBuckling, type BucklingEvaluation } from './bucklingModel';

const DEFAULT_MATERIAL = REFERENCE_MATERIALS.find((m) => m.id === 's235jr')?.id ?? '';
const DEFAULT_THRESHOLD = 1.5;
const DEFAULT_LENGTH_m = 3;
const DEFAULT_N_N = 100_000;

type CaseChoice = BucklingCase | 'libre';
interface PlaneState {
  choice: CaseChoice;
  /** K saisi quand `choice` vaut « libre ». */
  freeK: number | undefined;
}

const CASE_KEYS = Object.keys(BUCKLING_CASES) as BucklingCase[];

const ASSUMPTIONS = [
  'Barre droite, prismatique, chargée dans l’axe, sans défaut de rectitude ni excentricité ; matériau élastique linéaire homogène isotrope.',
  'Flambement par flexion seulement : ni flambement par torsion ou flexion-torsion, ni déversement, ni voilement local.',
  'Euler au-delà de l’élancement de transition λc = π √(2E/Re), parabole de Johnson en dessous (σcr plafonnée à Re).',
  'Coefficients K théoriques : un encastrement réel n’est jamais parfait, d’où des longueurs de flambement réelles plus grandes.',
  'Coefficient de sécurité brut n = Ncr / N, sans prise en compte des imperfections (voir EN 1993-1-1 §6.3.1 pour l’acier).',
];

const planeK = (p: PlaneState): number | undefined =>
  p.choice === 'libre' ? p.freeK : BUCKLING_CASES[p.choice].K;

type Ok = Extract<BucklingEvaluation, { kind: 'ok' }>;

function buildRows(e: Ok, threshold: number): FormulaRow[] {
  const { result, formulas, safety } = e;
  const rows: FormulaRow[] = [];
  result.axes.forEach((a, k) => {
    const f = formulas[k];
    const gov = a === result.governing ? ' — plan déterminant' : '';
    rows.push(
      {
        key: `lambda-${a.axis}`,
        label: `Élancement autour de ${a.axis}`,
        symbol: `λ${a.axis}`,
        value: <span className="font-mono tabular-nums">{formatNumber(a.slenderness)}</span>,
        detail: `K = ${formatNumber(a.K)}`,
        formula: f?.slenderness,
      },
      {
        key: `ncr-${a.axis}`,
        label: `Charge critique autour de ${a.axis}${gov}`,
        symbol: `Ncr,${a.axis}`,
        value: (
          <QuantityValue
            valueSI={a.Ncr_N}
            quantity="force"
            defaultUnit="kN"
            label={`Ncr,${a.axis}`}
          />
        ),
        detail:
          a.model === 'euler'
            ? 'Euler (barre élancée)'
            : 'Johnson (barre peu élancée : Euler surestimerait Ncr)',
        formula: f?.critical,
      },
    );
  });
  if (result.transitionSlenderness !== undefined) {
    rows.push({
      key: 'lambdac',
      label: 'Élancement de transition Euler / Johnson',
      symbol: 'λc',
      value: (
        <span className="font-mono tabular-nums">{formatNumber(result.transitionSlenderness)}</span>
      ),
      detail: 'λc = π √(2E/Re)',
    });
  }
  if (result.sigma_Pa !== undefined) {
    rows.push({
      key: 'sigma',
      label: 'Contrainte de compression N/A',
      symbol: 'σ',
      value: (
        <QuantityValue valueSI={result.sigma_Pa} quantity="stress" defaultUnit="MPa" label="σ" />
      ),
    });
  }
  if (result.safetyFactor !== undefined && safety) {
    rows.push({
      key: 'n',
      label: `Coefficient de sécurité au flambement (OK à partir de ${formatNumber(threshold)})`,
      symbol: 'n',
      value: (
        <span className="inline-flex items-center gap-2">
          <span className="font-mono tabular-nums">
            {Number.isFinite(result.safetyFactor) ? formatNumber(result.safetyFactor) : '∞'}
          </span>
          <VerdictBadge verdict={safety.verdict} />
        </span>
      ),
      formula: safety.formula,
    });
  }
  return rows;
}

function PlaneFields({
  axis,
  state,
  onChange,
}: {
  axis: string;
  state: PlaneState;
  onChange: (s: PlaneState) => void;
}) {
  const id = `flambement-cas-${axis}`;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="flex flex-col gap-1 text-sm text-slate-700">
        Appuis pour le flambement autour de {axis}
        <select
          id={id}
          value={state.choice}
          onChange={(e) => {
            const v = e.target.value;
            const next = CASE_KEYS.find((c) => c === v) ?? 'libre';
            onChange({ ...state, choice: next });
          }}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5"
        >
          {CASE_KEYS.map((c) => (
            <option key={c} value={c}>
              {BUCKLING_CASES[c].label} (K = {formatNumber(BUCKLING_CASES[c].K)})
            </option>
          ))}
          <option value="libre">Autre : K saisi</option>
        </select>
      </label>
      {state.choice === 'libre' && (
        <NumberInput
          label={`Coefficient de longueur de flambement autour de ${axis}`}
          symbol="K"
          initial={state.freeK}
          onChange={(v) => onChange({ ...state, freeK: v })}
          error={
            state.freeK !== undefined && !(Number.isFinite(state.freeK) && state.freeK > 0)
              ? 'Nombre positif.'
              : undefined
          }
        />
      )}
    </div>
  );
}

export function BucklingPage() {
  const custom = useCustomMaterials();
  const [materialId, setMaterialId] = useState(DEFAULT_MATERIAL);
  const [manualE, setManualE] = useState<number | undefined>(undefined);
  const [shape, setShape] = useState<SectionShape>('I');
  const [dimsByShape, setDimsByShape] = useState<Partial<Record<SectionShape, Dims>>>({});
  const [length, setLength] = useState<number | undefined>(DEFAULT_LENGTH_m);
  const [planes, setPlanes] = useState<[PlaneState, PlaneState]>([
    { choice: 'biArticulee', freeK: 1 },
    { choice: 'biArticulee', freeK: 1 },
  ]);
  const [N, setN] = useState<number | undefined>(DEFAULT_N_N);
  const [threshold, setThreshold] = useState<number | undefined>(DEFAULT_THRESHOLD);

  const material = [...REFERENCE_MATERIALS, ...custom.materials].find((m) => m.id === materialId);
  const E = material?.E_Pa ?? manualE;

  const dims = dimsByShape[shape] ?? defaultDims(shape);
  const numericDims = Object.fromEntries(
    shapeSpec(shape).dims.map((d) => [d.key, dims[d.key] ?? NaN]),
  );
  let section: SectionResult | undefined;
  let sectionError: string | undefined;
  const built = buildSectionInput(shape, dims);
  if (!built) sectionError = 'Renseignez toutes les cotes de la section.';
  else {
    try {
      section = computeSection(built);
    } catch (e) {
      if (e instanceof SectionGeometryError) sectionError = e.message;
      else throw e;
    }
  }

  // Noms des plans : y et z, ou u et v pour une section sans axe de symétrie.
  const axisNames = section ? bucklingAxes(section, [1, 1]).axes.map((a) => a.axis) : ['y', 'z'];
  const thresholdOk = threshold !== undefined && Number.isFinite(threshold) && threshold >= 1;
  const evaluation = section
    ? evaluateBuckling({
        section,
        length_m: length,
        E_Pa: E,
        Re_Pa: material?.Re_Pa,
        K: [planeK(planes[0]), planeK(planes[1])],
        N_N: N,
        threshold,
      })
    : undefined;

  const selected: Partial<Record<BucklingCase, string>> = {};
  planes.forEach((p, k) => {
    if (p.choice === 'libre') return;
    const name = axisNames[k] ?? '';
    selected[p.choice] = selected[p.choice] ? `${selected[p.choice]}, ${name}` : name;
  });
  const setPlane = (k: 0 | 1) => (s: PlaneState) =>
    setPlanes((prev) => (k === 0 ? [s, prev[1]] : [prev[0], s]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Flambement</h2>
        <p className="mt-1 text-sm text-slate-600">
          Charge critique d’une barre droite comprimée : Euler pour les barres élancées, Johnson
          pour les barres peu élancées, dans deux plans avec leurs propres conditions d’appui.
        </p>
      </div>

      <section
        className="space-y-2 rounded-lg border border-slate-200 bg-white p-3"
        aria-label="Schéma du cas"
      >
        <BucklingDrawing selected={selected} />
        <p className="text-xs text-slate-600">
          Allure de la déformée des quatre cas usuels ; longueur de flambement <i>Lk</i> = <i>K</i>·
          <i>L</i>. Effort de compression <i>N</i> saisi positif. Le flambement « autour de y » est
          une flexion dans le plan vertical (axe fort d’un profilé I).
        </p>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="font-medium">Section et matériau</h3>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <SectionShapeFields
              idPrefix="flambement"
              shape={shape}
              dims={dims}
              onShapeChange={setShape}
              onDimChange={(key, v) =>
                setDimsByShape((prev) => ({
                  ...prev,
                  [shape]: { ...(prev[shape] ?? defaultDims(shape)), [key]: v },
                }))
              }
            />
            {sectionError !== undefined && (
              <p role="alert" className="text-sm text-red-700">
                {sectionError}
              </p>
            )}
          </div>
          <div className="space-y-4">
            <MaterialDropdown
              reference={REFERENCE_MATERIALS}
              custom={custom.materials}
              value={materialId}
              onChange={setMaterialId}
              label="Matériau (E, Re)"
              placeholder="Aucun : saisir E"
            />
            {material ? (
              <div className="space-y-1 text-sm text-slate-700">
                <p className="flex flex-wrap items-center gap-x-2">
                  <span>
                    Module d’Young <i className="font-serif">E</i> :
                  </span>
                  <QuantityValue
                    key={`e-${material.id}`}
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
                {material.Re_Pa !== undefined && (
                  <p className="flex flex-wrap items-center gap-x-2">
                    <span>
                      Limite élastique <i className="font-serif">Re</i> :
                    </span>
                    <QuantityValue
                      key={`re-${material.id}`}
                      valueSI={material.Re_Pa}
                      quantity="stress"
                      defaultUnit="MPa"
                      label="Re"
                    />
                  </p>
                )}
              </div>
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
            {section && (
              <div className="mx-auto w-full max-w-[14rem] rounded-md border border-slate-100 p-2">
                <SectionDrawing section={section} shape={shape} dims={numericDims} />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="font-medium">Barre, appuis et effort</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <UnitInput
            label="Longueur de la barre"
            symbol="L"
            quantity="length"
            defaultUnit="m"
            initialSI={DEFAULT_LENGTH_m}
            onChange={setLength}
          />
          <UnitInput
            label="Effort de compression (vide : Ncr seul)"
            symbol="N"
            quantity="force"
            defaultUnit="kN"
            initialSI={DEFAULT_N_N}
            onChange={setN}
          />
          <PlaneFields axis={axisNames[0] ?? 'y'} state={planes[0]} onChange={setPlane(0)} />
          <PlaneFields axis={axisNames[1] ?? 'z'} state={planes[1]} onChange={setPlane(1)} />
          <NumberInput
            label="Seuil du coefficient de sécurité"
            symbol="n"
            initial={DEFAULT_THRESHOLD}
            onChange={setThreshold}
            error={thresholdOk ? undefined : 'Au moins 1.'}
          />
        </div>
      </section>

      <section
        aria-labelledby="resultats-flambement"
        className="rounded-lg border border-slate-200 bg-white p-4"
      >
        <h3 id="resultats-flambement" className="font-medium">
          Résultats
        </h3>
        {!evaluation ? (
          <p className="mt-2 text-sm text-slate-600">Section incomplète ou incohérente.</p>
        ) : evaluation.kind === 'indisponible' ? (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {evaluation.message}
          </p>
        ) : (
          <>
            <FormulaTable rows={buildRows(evaluation, thresholdOk ? threshold : 1)} />
            {evaluation.notes.length > 0 && (
              <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-amber-800">
                {evaluation.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="hypotheses-flambement">
        <h3 id="hypotheses-flambement" className="text-sm font-medium">
          Hypothèses et limites
        </h3>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-slate-500">
          {ASSUMPTIONS.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
