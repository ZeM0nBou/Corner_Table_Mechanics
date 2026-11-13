import { useState, type ReactNode } from 'react';
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
import { UnitInput } from '@ui/components/UnitInput';
import { formatNumber } from '@ui/format';
import { MaterialPicker } from '@ui/materials/MaterialPicker';
import { useCustomMaterials } from '@ui/materials/useCustomMaterials';
import { SectionDrawing } from './SectionDrawing';
import { buildSectionInput, defaultDims, SHAPES, shapeSpec } from './sectionForm';

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

function Row({ label, symbol, children }: { label: string; symbol: string; children: ReactNode }) {
  return (
    <tr className="border-b border-slate-100 last:border-b-0">
      <th scope="row" className="py-1.5 pr-3 text-left text-sm font-normal text-slate-600">
        {label}
      </th>
      <td className="py-1.5 pr-3 font-serif italic">{symbol}</td>
      <td className="py-1.5 text-right">{children}</td>
    </tr>
  );
}

function Results({ s, rho }: { s: SectionResult; rho: number | undefined }) {
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
  const inclined = Math.abs(s.Iyz_m4) > 1e-12 * (s.Iy_m4 + s.Iz_m4);

  return (
    <table className="w-full">
      <tbody>
        <Row label="Aire" symbol="A">
          {Ar(s.A_m2, 'A')}
        </Row>
        {rho !== undefined && (
          <Row label="Masse linéique" symbol="m">
            <span className="font-mono tabular-nums">
              {formatNumber(linearMass_kg_m(s.A_m2, rho))} kg/m
            </span>
          </Row>
        )}
        <Row label="Centre de gravité (depuis le coin bas gauche)" symbol="yG">
          {L(s.yG_m, 'yG')}
        </Row>
        <Row label="" symbol="zG">
          {L(s.zG_m, 'zG')}
        </Row>
        <Row label="Moment quadratique (axe fort)" symbol="Iy">
          {I(s.Iy_m4, 'Iy')}
        </Row>
        <Row label="Moment quadratique (axe faible)" symbol="Iz">
          {I(s.Iz_m4, 'Iz')}
        </Row>
        <Row label="Module élastique (fibre extrême)" symbol="Wel,y">
          {W(s.Wel_y_m3, 'Wel,y')}
        </Row>
        <Row label="" symbol="Wel,z">
          {W(s.Wel_z_m3, 'Wel,z')}
        </Row>
        <Row label="Module plastique" symbol="Wpl,y">
          {W(s.Wpl_y_m3, 'Wpl,y')}
        </Row>
        <Row label="" symbol="Wpl,z">
          {W(s.Wpl_z_m3, 'Wpl,z')}
        </Row>
        <Row label="Rayon de giration" symbol="iy">
          {L(s.iy_m, 'iy')}
        </Row>
        <Row label="" symbol="iz">
          {L(s.iz_m, 'iz')}
        </Row>
        {inclined && (
          <>
            <Row label="Produit d’inertie" symbol="Iyz">
              {I(s.Iyz_m4, 'Iyz')}
            </Row>
            <Row label="Axes principaux" symbol="Iu">
              {I(s.principal.Iu_m4, 'Iu')}
            </Row>
            <Row label="" symbol="Iv">
              {I(s.principal.Iv_m4, 'Iv')}
            </Row>
            <Row label="Angle de u par rapport à y" symbol="α">
              <span className="font-mono tabular-nums">
                {formatNumber((s.principal.alpha_rad * 180) / Math.PI)}°
              </span>
            </Row>
            <Row label="Rayon de giration minimal" symbol="iv">
              {L(s.principal.iv_m, 'iv')}
            </Row>
          </>
        )}
        <Row label="Constante de torsion" symbol="J">
          {I(s.J_m4, 'J')}
        </Row>
        <Row label="Aire de cisaillement (effort Vz)" symbol="Av,z">
          {s.Av_z_m2 !== undefined ? (
            Ar(s.Av_z_m2, 'Av,z')
          ) : (
            <span className="text-sm text-slate-400">non définie</span>
          )}
        </Row>
        <Row label="Aire de cisaillement (effort Vy)" symbol="Av,y">
          {s.Av_y_m2 !== undefined ? (
            Ar(s.Av_y_m2, 'Av,y')
          ) : (
            <span className="text-sm text-slate-400">non définie</span>
          )}
        </Row>
      </tbody>
    </table>
  );
}

function Detail({ s, inputs }: { s: SectionResult; inputs: { label: string; value: string }[] }) {
  const mm = (x: number) => formatNumber(fromSI(x, 'length', 'mm'));
  return (
    <details className="rounded-lg border border-slate-200 bg-white p-4 print:block">
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
          <h4 className="font-medium">Formules et sources</h4>
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
            <h4 className="font-medium">Décomposition en rectangles (mm)</h4>
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
          Axes de l’EN 1993 : <i>y</i> horizontal, <i>z</i> vertical, <i>x</i> le long de la poutre.
          Iy correspond à la flexion autour de l’axe horizontal (axe fort d’un profilé en I).
        </p>
      </div>

      {/* 1. Schéma du cas + choix de la forme */}
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
        <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-4">
          {result ? (
            <SectionDrawing section={result} />
          ) : (
            <p className="text-sm text-slate-500">
              Schéma indisponible : cotes incomplètes ou incohérentes.
            </p>
          )}
        </div>

        {/* 2. Entrées */}
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
          <details>
            <summary className="cursor-pointer text-sm text-slate-700">
              Matériau (pour la masse linéique){material ? ` : ${material.name}` : ''}
            </summary>
            <div className="mt-2 space-y-2">
              <MaterialPicker
                reference={REFERENCE_MATERIALS}
                custom={custom.materials}
                value={materialId}
                onChange={setMaterialId}
              />
              {material && (
                <button
                  type="button"
                  onClick={() => setMaterialId('')}
                  className="text-xs text-sky-700 hover:underline"
                >
                  Retirer le matériau
                </button>
              )}
            </div>
          </details>
        </div>
      </div>

      {/* 3. Résultats */}
      {result && (
        <section
          aria-labelledby="resultats-section"
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <h3 id="resultats-section" className="mb-2 font-medium">
            Résultats
          </h3>
          <Results s={result} rho={material?.rho_kg_m3} />
        </section>
      )}

      {/* 4. Détail du calcul */}
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
