import { useState } from 'react';
import type { BeamExtrema } from '@core/beams';
import type { SectionResult } from '@core/sections';
import { VerdictBadge } from '@ui/components/VerdictBadge';
import { fromSI, type UnitOf } from '@core/units';
import type { Material } from '@materials/schema';
import { FormulaTable, type FormulaRow } from '@ui/components/FormulaTable';
import { QuantityValue } from '@ui/components/QuantityValue';
import { NumberInput } from '@ui/components/UnitInput';
import { formatNumber } from '@ui/format';
import { evaluateCheck, type CheckEvaluation } from './beamCheckModel';

const DEFAULT_THRESHOLD = 1.5;
const DEFAULT_DEFLECTION_LIMIT = 300;
const FIBRE_LABEL = { superieure: 'fibre supérieure', inferieure: 'fibre inférieure' } as const;

function buildRows(
  e: Extract<CheckEvaluation, { kind: 'ok' }>,
  material: Material,
  threshold: number,
  at: (x_m: number) => string,
): FormulaRow[] {
  const { stresses, check, deflection, formulas: f } = e;
  const MPa = (v: number, label: string) => (
    <QuantityValue valueSI={v} quantity="stress" defaultUnit="MPa" label={label} />
  );
  const ductile = check.basis.kind === 'ductile';
  const rows: FormulaRow[] = [
    {
      key: 'traction',
      label: 'Contrainte de traction maximale',
      symbol: 'σt',
      value: MPa(stresses.tension.sigma_Pa, 'σt'),
      detail:
        stresses.tension.sigma_Pa === 0
          ? ''
          : `${at(stresses.tension.x_m)}, ${FIBRE_LABEL[stresses.tension.fibre]}`,
      formula: f.traction,
    },
    {
      key: 'compression',
      label: 'Contrainte de compression maximale',
      symbol: 'σc',
      value: MPa(Math.abs(stresses.compression.sigma_Pa), 'σc'),
      detail:
        stresses.compression.sigma_Pa === 0
          ? ''
          : `${at(stresses.compression.x_m)}, ${FIBRE_LABEL[stresses.compression.fibre]}`,
      formula: f.compression,
    },
  ];
  if (stresses.shear) {
    rows.push({
      key: 'tau',
      label: 'Contrainte de cisaillement moyenne maximale',
      symbol: 'τ',
      value: MPa(stresses.shear.tau_Pa, 'τ'),
      detail: at(stresses.shear.x_m),
      formula: f.tau,
    });
  }
  rows.push(
    {
      key: 'equivalent',
      label: ductile
        ? 'Contrainte équivalente de von Mises (majorant)'
        : 'Contrainte principale de traction (majorant)',
      symbol: ductile ? 'σeq' : 'σ1',
      value: MPa(check.equivalent_Pa, ductile ? 'σeq' : 'σ1'),
      formula: f.equivalent,
    },
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
      label: `Coefficient de sécurité (OK à partir de ${formatNumber(threshold)})`,
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
  if (deflection) {
    rows.push({
      key: 'deflection',
      label: `Flèche maximale / admissible (L/${formatNumber(deflection.limit)})`,
      symbol: 'δ/δadm',
      value: (
        <span className="inline-flex items-center gap-2">
          <span className="font-mono tabular-nums">
            {formatNumber(deflection.result.ratio * 100)} %
          </span>
          <VerdictBadge verdict={deflection.result.verdict} />
        </span>
      ),
      detail: `δadm = ${formatNumber(deflection.result.allowable_m * 1e3)} mm`,
      formula: f.deflection,
    });
  }
  return rows;
}

interface BeamCheckProps {
  length_m: number;
  extrema: BeamExtrema;
  refForce_N: number;
  /** Section paramétrique ; absente en saisie directe de I. */
  section: SectionResult | undefined;
  material: Material | undefined;
  lengthUnit: UnitOf<'length'>;
}

/**
 * Vérification de résistance (contraintes de flexion et de cisaillement, critère selon le
 * matériau, coefficient de sécurité) et de flèche, avec seuils réglables.
 * Les calculs viennent de `@core/stress` via `evaluateCheck` ; ce composant les présente.
 */
export function BeamCheck({
  length_m,
  extrema,
  refForce_N,
  section,
  material,
  lengthUnit,
}: BeamCheckProps) {
  const [threshold, setThreshold] = useState<number | undefined>(DEFAULT_THRESHOLD);
  const [limit, setLimit] = useState<number | undefined>(DEFAULT_DEFLECTION_LIMIT);
  const at = (x_m: number) =>
    `en x = ${formatNumber(fromSI(x_m, 'length', lengthUnit))} ${lengthUnit}`;

  const evaluation = evaluateCheck({
    length_m,
    extrema,
    refForce_N,
    section,
    material,
    threshold,
    deflectionLimit: limit,
  });
  const thresholdOk = threshold !== undefined && Number.isFinite(threshold) && threshold >= 1;
  const limitOk = limit !== undefined && Number.isFinite(limit) && limit > 0;

  return (
    <section
      aria-labelledby="verification-poutre"
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <h3 id="verification-poutre" className="font-medium">
        Vérification
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        La flexion tend une fibre et comprime l’autre (σ = M·z/I). Matériau ductile (Re connue) :
        von Mises comparé à Re. Matériau fragile (Rm seule, fonte grise) : traction comparée à Rm.
        Coefficient de sécurité brut, sans coefficient partiel.
      </p>
      <div className="no-print mt-3 grid max-w-md gap-4 sm:grid-cols-2">
        <NumberInput
          label="Seuil du coefficient de sécurité"
          symbol="n"
          initial={DEFAULT_THRESHOLD}
          onChange={setThreshold}
          error={thresholdOk ? undefined : 'Au moins 1.'}
        />
        <NumberInput
          label="Flèche admissible : L divisée par"
          symbol="L/…"
          initial={DEFAULT_DEFLECTION_LIMIT}
          onChange={setLimit}
          error={limitOk ? undefined : 'Nombre positif.'}
        />
      </div>
      {evaluation.kind === 'indisponible' || !material || !thresholdOk ? (
        <p className="mt-3 text-sm text-slate-600">
          {evaluation.kind === 'indisponible' ? evaluation.message : ''}
        </p>
      ) : (
        <FormulaTable rows={buildRows(evaluation, material, threshold, at)} />
      )}
      <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-slate-500">
        {evaluation.kind === 'ok' &&
          evaluation.notes.map((n) => (
            <li key={n} className="text-amber-800">
              {n}
            </li>
          ))}
        <li>
          Majorant : σ et τ maximales sont combinées même si elles ne sont pas atteintes au même
          point.
        </li>
        <li>
          τ est la contrainte moyenne sur Av ; la répartition réelle (Jourawski) donne un maximum
          plus élevé dans les sections pleines (× 1,5 pour un rectangle).
        </li>
        <li>
          Non vérifiés : déversement, voilement local, fatigue, concentrations de contraintes.
          Flèche admissible usuelle : L/150 à L/500 selon l’usage ; pour une console, L/150 est
          courant.
        </li>
      </ul>
    </section>
  );
}
