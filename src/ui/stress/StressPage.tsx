import { useState } from 'react';
import {
  computeSection,
  SectionGeometryError,
  type SectionInput,
  type SectionResult,
  type SectionShape,
} from '@core/sections';
import { fromSI } from '@core/units';
import { REFERENCE_MATERIALS } from '@materials/index';
import type { Material } from '@materials/schema';
import { FormulaTable, type FormulaRow } from '@ui/components/FormulaTable';
import { QuantityValue } from '@ui/components/QuantityValue';
import { NumberInput, UnitInput } from '@ui/components/UnitInput';
import { VerdictBadge } from '@ui/components/VerdictBadge';
import { formatNumber } from '@ui/format';
import { MaterialDropdown } from '@ui/materials/MaterialDropdown';
import { LinkNotice } from '@ui/share/LinkNotice';
import { ShareBar } from '@ui/share/ShareBar';
import type { LinkLoad } from '@ui/share/SharedPageLoader';
import { usePageMaterial } from '@ui/share/usePageMaterial';
import { buildSectionInput, defaultDims, shapeSpec } from '@ui/sections/sectionForm';
import { SectionDrawing } from '@ui/sections/SectionDrawing';
import { SectionShapeFields, type Dims } from '@ui/sections/SectionShapeFields';
import { fromSharedSection, toSharedSection } from '@ui/sections/sectionShare';
import type { SectionEfforts } from '@core/stress';
import { EffortsDrawing } from './EffortsDrawing';
import { evaluateStress, type StressEvaluation } from './stressModel';

const DEFAULT_MATERIAL = REFERENCE_MATERIALS.find((m) => m.id === 's235jr')?.id ?? '';
const DEFAULT_THRESHOLD = 1.5;

type EffortKey = 'N_N' | 'My_Nm' | 'Vz_N' | 'T_Nm';
type Efforts = Record<EffortKey, number | undefined>;

/** Exemple par défaut : flexion composée avec un peu de torsion. */
const DEFAULT_EFFORTS: Efforts = { N_N: 20_000, My_Nm: 10_000, Vz_N: 15_000, T_Nm: 200 };

/** Un champ vide compte pour zéro. */
const zeroIfEmpty = (e: Efforts): SectionEfforts => ({
  N_N: e.N_N ?? 0,
  My_Nm: e.My_Nm ?? 0,
  Vz_N: e.Vz_N ?? 0,
  T_Nm: e.T_Nm ?? 0,
});

const ASSUMPTIONS = [
  'Petites déformations, matériau élastique linéaire homogène isotrope.',
  'Sections planes restant planes (Navier-Bernoulli) ; torsion de Saint-Venant, sans gauchissement gêné.',
  'Majorant : |σ|max et τ = τV + τT sont combinées même si ces maxima ne sont pas atteints au même point.',
  'τV est la contrainte moyenne sur Av (pas de répartition de Jourawski : × 1,5 au centre d’un rectangle plein).',
  'Coefficient de sécurité brut, sans coefficient partiel. Non vérifiés : flambement, déversement, voilement local, fatigue, concentrations de contraintes.',
];

type Ok = Extract<StressEvaluation, { kind: 'ok' }>;

const point = (y_m: number, z_m: number) =>
  `en y = ${formatNumber(y_m * 1e3)} mm, z = ${formatNumber(z_m * 1e3)} mm`;

function buildRows(e: Ok, material: Material | undefined, threshold: number): FormulaRow[] {
  const { stresses: s, check, formulas: f } = e;
  const MPa = (v: number, label: string) => (
    <QuantityValue valueSI={v} quantity="stress" defaultUnit="MPa" label={label} />
  );
  const rows: FormulaRow[] = [
    {
      key: 'sigmaN',
      label: 'Contrainte due à l’effort normal',
      symbol: 'σN',
      value: MPa(s.sigmaN_Pa, 'σN'),
      formula: f.sigmaN,
    },
    {
      key: 'traction',
      label: 'Contrainte de traction maximale',
      symbol: 'σt',
      value: MPa(s.tension.sigma_Pa, 'σt'),
      detail:
        s.tension.sigma_Pa === 0
          ? 'section entièrement comprimée'
          : point(s.tension.y_m, s.tension.z_m),
      formula: s.tension.sigma_Pa === 0 ? undefined : f.traction,
    },
    {
      key: 'compression',
      label: 'Contrainte de compression maximale',
      symbol: 'σc',
      value: MPa(Math.abs(s.compression.sigma_Pa), 'σc'),
      detail:
        s.compression.sigma_Pa === 0
          ? 'section entièrement tendue'
          : point(s.compression.y_m, s.compression.z_m),
      formula: s.compression.sigma_Pa === 0 ? undefined : f.compression,
    },
  ];
  if (s.tauV_Pa !== undefined) {
    rows.push({
      key: 'tauV',
      label: 'Cisaillement moyen dû à l’effort tranchant',
      symbol: 'τV',
      value: MPa(s.tauV_Pa, 'τV'),
      formula: f.tauV,
    });
  }
  rows.push(
    {
      key: 'tauT',
      label: 'Cisaillement maximal de torsion',
      symbol: 'τT',
      value: MPa(s.tauT_Pa, 'τT'),
      formula: f.tauT,
    },
    {
      key: 'tau',
      label: 'Cisaillement retenu (majorant)',
      symbol: 'τ',
      value: MPa(s.tau_Pa, 'τ'),
      formula: f.tau,
    },
    {
      key: 'vonMises',
      label: 'Contrainte équivalente de von Mises',
      symbol: 'σVM',
      value: MPa(s.vonMises_Pa, 'σVM'),
      formula: f.vonMises,
    },
    {
      key: 'tresca',
      label: 'Contrainte équivalente de Tresca',
      symbol: 'σT',
      value: MPa(s.tresca_Pa, 'σT'),
      detail: 'plus prudente que von Mises (au plus + 15 %)',
      formula: f.tresca,
    },
    {
      key: 'sigma1',
      label: 'Contrainte principale maximale',
      symbol: 'σ1',
      value: MPa(s.sigma1_Pa, 'σ1'),
      detail: 'critère de Rankine (matériaux fragiles)',
      formula: f.sigma1,
    },
  );
  if (check && material) {
    const ductile = check.basis.kind === 'ductile';
    rows.push(
      {
        key: 'strength',
        label: ductile
          ? `Limite élastique de ${material.name}`
          : `Résistance à la traction de ${material.name}`,
        symbol: ductile ? 'Re' : 'Rm',
        value: MPa(check.strength_Pa, ductile ? 'Re' : 'Rm'),
        detail: material.verified ? '' : 'valeur non vérifiée',
      },
      {
        key: 'n',
        label: `Coefficient de sécurité, ${ductile ? 'Re / σVM' : 'Rm / σ1'} (OK à partir de ${formatNumber(threshold)})`,
        symbol: 'n',
        value: (
          <span className="inline-flex items-center gap-2">
            <span className="font-mono tabular-nums">
              {Number.isFinite(check.safetyFactor) ? formatNumber(check.safetyFactor) : '∞'}
            </span>
            <VerdictBadge verdict={check.verdict} />
          </span>
        ),
        formula: f.n,
      },
    );
  }
  return rows;
}

/** Schéma : section cotée, repère et sens positifs des efforts. */
function Convention() {
  return (
    <ul className="space-y-1 text-xs text-slate-600">
      <li>
        Repère EN 1993 : <i>x</i> le long de la barre, <i>y</i> horizontal, <i>z</i> vertical vers
        le haut ; coordonnées des points depuis le centre de gravité G.
      </li>
      <li>
        <i>N</i> &gt; 0 en traction ; <i>My</i> &gt; 0 tend la fibre inférieure (comme dans la page
        Poutres) ; <i>Vz</i> effort tranchant vertical ; <i>T</i> moment de torsion autour de{' '}
        <i>x</i>. Seules les valeurs absolues de <i>Vz</i> et <i>T</i> comptent.
      </li>
      <li>
        Schéma des efforts : coupe de normale +<i>x</i> de la partie gauche, avec les actions de la
        partie droite. <i>N</i> &gt; 0 sort de la coupe ; <i>My</i> &gt; 0 a son vecteur selon −
        <i>y</i> ; <i>Vz</i> &gt; 0 est dessiné vers le bas (comme la page Poutres, où <i>V</i> est
        la somme des forces vers le haut à gauche de la coupe) ; <i>T</i> &gt; 0 a son vecteur selon
        +<i>x</i>.
      </li>
      <li>σ &gt; 0 en traction, &lt; 0 en compression.</li>
    </ul>
  );
}

export function StressPage({ link }: { link: LinkLoad<'contraintes'> }) {
  const initial = link.kind === 'ok' ? link.state : undefined;
  const initialSection = initial ? fromSharedSection(initial.section) : undefined;
  const mat = usePageMaterial(DEFAULT_MATERIAL, initial?.material);
  const { material, materialId, setMaterialId } = mat;
  const [shape, setShape] = useState<SectionShape>(initialSection?.shape ?? 'I');
  const [dimsByShape, setDimsByShape] = useState<Partial<Record<SectionShape, Dims>>>(
    initialSection?.dimsByShape ?? {},
  );
  const [efforts, setEfforts] = useState<Efforts>(initial?.efforts ?? DEFAULT_EFFORTS);
  const [threshold, setThreshold] = useState<number | undefined>(
    initial ? initial.threshold : DEFAULT_THRESHOLD,
  );

  const dims = dimsByShape[shape] ?? defaultDims(shape);
  const numericDims = Object.fromEntries(
    shapeSpec(shape).dims.map((d) => [d.key, dims[d.key] ?? NaN]),
  );
  let sectionInput: SectionInput | undefined;
  let section: SectionResult | undefined;
  let sectionError: string | undefined;
  const built = buildSectionInput(shape, dims);
  if (!built) sectionError = 'Renseignez toutes les cotes de la section.';
  else {
    try {
      section = computeSection(built);
      sectionInput = built;
    } catch (e) {
      if (e instanceof SectionGeometryError) sectionError = e.message;
      else throw e;
    }
  }

  const evaluation =
    section && sectionInput
      ? evaluateStress({
          sectionInput,
          section,
          efforts: zeroIfEmpty(efforts),
          material,
          threshold,
        })
      : undefined;
  const thresholdOk = threshold !== undefined && Number.isFinite(threshold) && threshold >= 1;
  const setEffort = (k: EffortKey) => (v: number | undefined) =>
    setEfforts((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-80">
          <h2 className="text-xl font-semibold">Contraintes</h2>
          <p className="mt-1 text-sm text-slate-600">
            Contraintes dans une section sous effort normal, flexion, effort tranchant et torsion ;
            contraintes équivalentes de von Mises et de Tresca et coefficient de sécurité.
          </p>
        </div>
        <ShareBar
          page="contraintes"
          getState={() => ({
            material: mat.shared(),
            section: toSharedSection(shape, dims),
            efforts,
            threshold,
          })}
        />
      </div>
      <LinkNotice link={link} linked={mat.linked} />

      <section
        className="grid gap-4 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-2"
        aria-label="Schéma du cas"
      >
        {section ? (
          <>
            <figure className="mx-auto w-full max-w-xs">
              <SectionDrawing section={section} shape={shape} dims={numericDims} />
            </figure>
            <figure className="mx-auto w-full max-w-xs">
              <EffortsDrawing section={section} efforts={zeroIfEmpty(efforts)} />
              <figcaption className="mt-1 text-center text-xs text-slate-500">
                Efforts sur la coupe (flèches non à l’échelle)
              </figcaption>
            </figure>
          </>
        ) : (
          <p className="p-4 text-sm text-slate-500 md:col-span-2">
            Schéma indisponible : section incohérente.
          </p>
        )}
        <div className="md:col-span-2">
          <Convention />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="font-medium">Section et matériau</h3>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <SectionShapeFields
              idPrefix="contraintes"
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
              custom={mat.customList}
              value={materialId}
              onChange={setMaterialId}
              label="Matériau (résistance)"
              placeholder="Aucun : contraintes seules"
            />
            {material && (
              <p className="flex flex-wrap items-center gap-x-2 text-sm text-slate-700">
                {material.Re_Pa !== undefined ? (
                  <>
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
                  </>
                ) : material.Rm_Pa !== undefined ? (
                  <>
                    <span>
                      Résistance à la traction <i className="font-serif">Rm</i> :
                    </span>
                    <QuantityValue
                      key={`rm-${material.id}`}
                      valueSI={material.Rm_Pa}
                      quantity="stress"
                      defaultUnit="MPa"
                      label="Rm"
                    />
                  </>
                ) : (
                  <span>Ni Re ni Rm renseignée.</span>
                )}
                {!material.verified && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                    non vérifié
                  </span>
                )}
              </p>
            )}
            <NumberInput
              label="Seuil du coefficient de sécurité"
              symbol="n"
              initial={threshold}
              onChange={setThreshold}
              error={thresholdOk ? undefined : 'Au moins 1.'}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="font-medium">Efforts dans la section</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <UnitInput
            label="Effort normal (> 0 en traction)"
            symbol="N"
            quantity="force"
            defaultUnit="kN"
            initialSI={efforts.N_N}
            onChange={setEffort('N_N')}
          />
          <UnitInput
            label="Moment fléchissant autour de y"
            symbol="My"
            quantity="moment"
            defaultUnit="kN·m"
            initialSI={efforts.My_Nm}
            onChange={setEffort('My_Nm')}
          />
          <UnitInput
            label="Effort tranchant vertical"
            symbol="Vz"
            quantity="force"
            defaultUnit="kN"
            initialSI={efforts.Vz_N}
            onChange={setEffort('Vz_N')}
          />
          <UnitInput
            label="Moment de torsion"
            symbol="T"
            quantity="moment"
            defaultUnit="N·m"
            initialSI={efforts.T_Nm}
            onChange={setEffort('T_Nm')}
          />
        </div>
        <p className="text-xs text-slate-500">Un champ vide compte pour zéro.</p>
      </section>

      <section
        aria-labelledby="resultats-contraintes"
        className="rounded-lg border border-slate-200 bg-white p-4"
      >
        <h3 id="resultats-contraintes" className="font-medium">
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
            <FormulaTable rows={buildRows(evaluation, material, thresholdOk ? threshold : 1)} />
            {evaluation.checkMessage !== undefined && (
              <p className="mt-2 text-sm text-slate-600">{evaluation.checkMessage}</p>
            )}
            {evaluation.notes.length > 0 && (
              <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-amber-800">
                {evaluation.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </>
        )}
        {section && (
          <p className="mt-3 text-xs text-slate-500">
            Section : A = {formatNumber(fromSI(section.A_m2, 'area', 'mm²'))} mm², Iy ={' '}
            {formatNumber(fromSI(section.Iy_m4, 'secondMomentOfArea', 'cm⁴'))} cm⁴, J ={' '}
            {formatNumber(fromSI(section.J_m4, 'secondMomentOfArea', 'cm⁴'))} cm⁴ (détail dans
            l’onglet Sections).
          </p>
        )}
      </section>

      <section aria-labelledby="hypotheses-contraintes">
        <h3 id="hypotheses-contraintes" className="text-sm font-medium">
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
