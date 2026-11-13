import { Fragment, useState, type ReactNode } from 'react';
import {
  computeSection,
  linearMass_kg_m,
  SectionGeometryError,
  type SectionResult,
  type SectionShape,
} from '@core/sections';
import { fromSI } from '@core/units';
import { REFERENCE_MATERIALS } from '@materials/index';
import { QuantityValue } from '@ui/components/QuantityValue';
import { Tex } from '@ui/components/Tex';
import { UnitInput } from '@ui/components/UnitInput';
import { formatNumber } from '@ui/format';
import { MaterialDropdown } from '@ui/materials/MaterialDropdown';
import { useCustomMaterials } from '@ui/materials/useCustomMaterials';
import { SectionDrawing } from './SectionDrawing';
import { buildSectionInput, defaultDims, SHAPES, shapeSpec } from './sectionForm';
import { resultFormulas, type ResultFormula, type ResultKey } from './sectionFormulas';

type Dims = Record<string, number | undefined>;

function compute(shape: SectionShape, dims: Dims): { result?: SectionResult; error?: string } {
  const input = buildSectionInput(shape, dims);
  if (!input) return { error: 'Renseignez toutes les cotes avec des nombres valides.' };
  try {
    return { result: computeSection(input) };
  } catch (e) {
    if (e instanceof SectionGeometryError) return { error: e.message };
    throw e;
  }
}

interface ResultRow {
  key: ResultKey;
  label: string;
  symbol: string;
  value: ReactNode;
}

function buildRows(s: SectionResult, rho: number | undefined): ResultRow[] {
  const L = (v: number, label: string) => (
    <QuantityValue valueSI={v} quantity="length" defaultUnit="mm" label={label} />
  );
  const I = (v: number, label: string) => (
    <QuantityValue valueSI={v} quantity="secondMomentOfArea" defaultUnit="cm⁴" label={label} />
  );
  const W = (v: number, label: string) => (
    <QuantityValue valueSI={v} quantity="sectionModulus" defaultUnit="cm³" label={label} />
  );
  const Ar = (v: number, label: string) => (
    <QuantityValue valueSI={v} quantity="area" defaultUnit="cm²" label={label} />
  );
  const none = <span className="text-sm text-slate-400">non définie</span>;
  const inclined = Math.abs(s.Iyz_m4) > 1e-12 * (s.Iy_m4 + s.Iz_m4);

  const rows: ResultRow[] = [{ key: 'A', label: 'Aire', symbol: 'A', value: Ar(s.A_m2, 'A') }];
  if (rho !== undefined) {
    rows.push({
      key: 'm',
      label: 'Masse linéique',
      symbol: 'm′',
      value: (
        <QuantityValue
          valueSI={linearMass_kg_m(s.A_m2, rho)}
          quantity="linearMass"
          defaultUnit="kg/m"
          label="m′"
        />
      ),
    });
  }
  rows.push(
    {
      key: 'yG',
      label: 'Centre de gravité G, depuis O (vers la droite)',
      symbol: 'yG',
      value: L(s.yG_m, 'yG'),
    },
    {
      key: 'zG',
      label: 'Centre de gravité G, depuis O (vers le haut)',
      symbol: 'zG',
      value: L(s.zG_m, 'zG'),
    },
    { key: 'Iy', label: 'Moment quadratique autour de y', symbol: 'Iy', value: I(s.Iy_m4, 'Iy') },
    { key: 'Iz', label: 'Moment quadratique autour de z', symbol: 'Iz', value: I(s.Iz_m4, 'Iz') },
    {
      key: 'Wely',
      label: 'Module élastique (fibre extrême)',
      symbol: 'Wel,y',
      value: W(s.Wel_y_m3, 'Wel,y'),
    },
    {
      key: 'Welz',
      label: 'Module élastique (fibre extrême)',
      symbol: 'Wel,z',
      value: W(s.Wel_z_m3, 'Wel,z'),
    },
    { key: 'Wply', label: 'Module plastique', symbol: 'Wpl,y', value: W(s.Wpl_y_m3, 'Wpl,y') },
    { key: 'Wplz', label: 'Module plastique', symbol: 'Wpl,z', value: W(s.Wpl_z_m3, 'Wpl,z') },
    { key: 'iy', label: 'Rayon de giration', symbol: 'iy', value: L(s.iy_m, 'iy') },
    { key: 'iz', label: 'Rayon de giration', symbol: 'iz', value: L(s.iz_m, 'iz') },
  );
  if (inclined) {
    rows.push(
      { key: 'Iyz', label: 'Produit d’inertie', symbol: 'Iyz', value: I(s.Iyz_m4, 'Iyz') },
      {
        key: 'Iu',
        label: 'Moment quadratique principal maximal',
        symbol: 'Iu',
        value: I(s.principal.Iu_m4, 'Iu'),
      },
      {
        key: 'Iv',
        label: 'Moment quadratique principal minimal',
        symbol: 'Iv',
        value: I(s.principal.Iv_m4, 'Iv'),
      },
      {
        key: 'alpha',
        label: 'Angle de l’axe u par rapport à y',
        symbol: 'α',
        value: (
          <span className="font-mono tabular-nums">
            {formatNumber((s.principal.alpha_rad * 180) / Math.PI)}°
          </span>
        ),
      },
      {
        key: 'iv',
        label: 'Rayon de giration minimal (flambement)',
        symbol: 'iv',
        value: L(s.principal.iv_m, 'iv'),
      },
    );
  }
  rows.push(
    { key: 'J', label: 'Constante de torsion', symbol: 'J', value: I(s.J_m4, 'J') },
    {
      key: 'Avz',
      label: 'Aire de cisaillement (effort Vz)',
      symbol: 'Av,z',
      value: s.Av_z_m2 !== undefined ? Ar(s.Av_z_m2, 'Av,z') : none,
    },
    {
      key: 'Avy',
      label: 'Aire de cisaillement (effort Vy)',
      symbol: 'Av,y',
      value: s.Av_y_m2 !== undefined ? Ar(s.Av_y_m2, 'Av,y') : none,
    },
  );
  return rows;
}

function Results({
  rows,
  formulas,
}: {
  rows: ResultRow[];
  formulas: Partial<Record<ResultKey, ResultFormula>>;
}) {
  const [shown, setShown] = useState<ReadonlySet<ResultKey>>(new Set());
  const withFormula = rows.filter((r) => formulas[r.key] !== undefined).map((r) => r.key);
  const toggle = (k: ResultKey) =>
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <section
      aria-labelledby="resultats-section"
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 id="resultats-section" className="font-medium">
          Résultats
        </h3>
        <div
          className="no-print flex items-center gap-1 text-sm"
          role="group"
          aria-label="Affichage des formules"
        >
          <span className="mr-1 text-slate-600">Formules :</span>
          <button
            type="button"
            onClick={() => setShown(new Set(withFormula))}
            aria-pressed={shown.size === withFormula.length}
            className={`rounded-l-md border px-2.5 py-1 ${shown.size === withFormula.length ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white hover:bg-slate-100'}`}
          >
            Toutes
          </button>
          <button
            type="button"
            onClick={() => setShown(new Set())}
            aria-pressed={shown.size === 0}
            className={`-ml-px rounded-r-md border px-2.5 py-1 ${shown.size === 0 ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white hover:bg-slate-100'}`}
          >
            Aucune
          </button>
        </div>
      </div>
      <p className="mb-2 text-xs text-slate-500">
        Cliquez sur ƒ pour afficher la formule d’une ligne. Applications numériques en mm.
      </p>
      <table className="w-full">
        <tbody>
          {rows.map((r) => {
            const f = formulas[r.key];
            const open = f !== undefined && shown.has(r.key);
            return (
              <Fragment key={r.key}>
                <tr className={open ? '' : 'border-b border-slate-100'}>
                  <th
                    scope="row"
                    className="py-1.5 pr-3 text-left text-sm font-normal text-slate-600"
                  >
                    {r.label}
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

function Detail({ s, inputs }: { s: SectionResult; inputs: { label: string; value: string }[] }) {
  const mm = (x: number) => formatNumber(fromSI(x, 'length', 'mm'));
  return (
    <details className="rounded-lg border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer font-medium">Détail du calcul</summary>
      <div className="mt-3 space-y-4 text-sm">
        <div>
          <h4 className="font-medium">Données</h4>
          <ul className="mt-1 list-inside list-disc text-slate-700">
            {inputs.map((i) => (
              <li key={i.label}>
                {i.label} = {i.value}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-medium">Méthodes et sources</h4>
          <ul className="mt-1 space-y-2">
            {s.formulas.map((f) => (
              <li key={f.quantity}>
                <span className="font-medium">{f.quantity} : </span>
                <code className="rounded bg-slate-100 px-1">{f.formula}</code>
                <span className="block text-xs text-slate-500">Source : {f.source}</span>
              </li>
            ))}
          </ul>
        </div>
        {s.geometry.kind === 'rects' && (
          <div>
            <h4 className="font-medium">Décomposition en rectangles (mm, depuis O)</h4>
            <div className="overflow-x-auto">
              <table className="mt-1 text-xs tabular-nums">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="pr-3">n°</th>
                    <th className="pr-3">y₀ – y₁</th>
                    <th className="pr-3">z₀ – z₁</th>
                    <th className="pr-3">Aᵢ (mm²)</th>
                  </tr>
                </thead>
                <tbody>
                  {s.geometry.rects.map((r, i) => (
                    <tr key={i}>
                      <td className="pr-3">{i + 1}</td>
                      <td className="pr-3">
                        {mm(r.y0)} – {mm(r.y1)}
                      </td>
                      <td className="pr-3">
                        {mm(r.z0)} – {mm(r.z1)}
                      </td>
                      <td className="pr-3">{formatNumber((r.y1 - r.y0) * (r.z1 - r.z0) * 1e6)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div>
          <h4 className="font-medium">Hypothèses</h4>
          <ul className="mt-1 list-inside list-disc text-slate-700">
            {s.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}

export function SectionsPage() {
  const [shape, setShape] = useState<SectionShape>('I');
  const [dimsByShape, setDimsByShape] = useState<Partial<Record<SectionShape, Dims>>>({});
  const custom = useCustomMaterials();
  const [materialId, setMaterialId] = useState('');

  const spec = shapeSpec(shape);
  const dims = dimsByShape[shape] ?? defaultDims(shape);
  const { result, error } = compute(shape, dims);
  const material = [...REFERENCE_MATERIALS, ...custom.materials].find((m) => m.id === materialId);
  const numericDims = Object.fromEntries(spec.dims.map((d) => [d.key, dims[d.key] ?? NaN]));

  const setDim = (key: string) => (v: number | undefined) =>
    setDimsByShape((prev) => ({
      ...prev,
      [shape]: { ...(prev[shape] ?? defaultDims(shape)), [key]: v },
    }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Propriétés de sections</h2>
        <p className="mt-1 text-sm text-slate-600">
          Repère de l’EN 1993 : <i>y</i> horizontal vers la droite, <i>z</i> vertical vers le haut,{' '}
          <i>x</i> le long de la poutre. Origine O au coin inférieur gauche de la section ; Iy
          correspond à la flexion autour de l’axe horizontal (axe fort d’un profilé en I).
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Forme de la section">
        {SHAPES.map((s) => (
          <button
            key={s.shape}
            type="button"
            role="radio"
            aria-checked={s.shape === shape}
            onClick={() => setShape(s.shape)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              s.shape === shape
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white hover:bg-slate-100'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2">
          {result ? (
            <SectionDrawing section={result} shape={shape} dims={numericDims} />
          ) : (
            <p className="p-4 text-sm text-slate-500">
              Schéma indisponible : cotes incomplètes ou incohérentes.
            </p>
          )}
        </div>

        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="font-medium">Cotes</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {spec.dims.map((d) => (
              <UnitInput
                key={`${shape}-${d.key}`}
                label={d.label}
                symbol={d.symbol}
                quantity="length"
                defaultUnit="mm"
                initialSI={dims[d.key]}
                onChange={setDim(d.key)}
              />
            ))}
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <MaterialDropdown
            reference={REFERENCE_MATERIALS}
            custom={custom.materials}
            value={materialId}
            onChange={setMaterialId}
            label="Matériau (facultatif, pour la masse linéique)"
          />
        </div>
      </div>

      {result && (
        <Results
          rows={buildRows(result, material?.rho_kg_m3)}
          formulas={resultFormulas(shape, numericDims, result, material?.rho_kg_m3)}
        />
      )}

      {result && (
        <Detail
          s={result}
          inputs={[
            ...spec.dims.map((d) => ({
              label: `${d.label} ${d.symbol}`,
              value: `${formatNumber(fromSI(dims[d.key] ?? NaN, 'length', 'mm'))} mm`,
            })),
            ...(material
              ? [
                  {
                    label: `Masse volumique ρ (${material.name})`,
                    value: `${formatNumber(material.rho_kg_m3)} kg/m³`,
                  },
                ]
              : []),
          ]}
        />
      )}
    </div>
  );
}
