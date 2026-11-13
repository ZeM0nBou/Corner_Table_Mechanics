import type { ReactNode } from 'react';
import { fromSI } from '@core/units';
import type { Material } from '@materials/index';
import { QuantityValue } from '@ui/components/QuantityValue';
import { formatNumber } from '@ui/format';
import { SelectionGuide } from './SelectionGuide';

function Row({ label, symbol, children }: { label: string; symbol: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-slate-100 py-2 last:border-b-0">
      <dt className="text-sm text-slate-600">
        {label} <span className="font-serif italic text-slate-900">{symbol}</span>
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

function Missing() {
  return <span className="text-sm text-slate-400">non renseigné</span>;
}

export function UnverifiedBadge() {
  return (
    <span
      title="Valeurs non encore relues par un humain : à contrôler avant usage."
      className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"
    >
      non vérifié
    </span>
  );
}

export function CustomBadge() {
  return (
    <span
      title="Matériau créé ou importé par l'utilisateur, stocké dans ce navigateur."
      className="inline-flex items-center rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800"
    >
      personnalisé
    </span>
  );
}

interface MaterialCardProps {
  material: Material;
  isCustom?: boolean;
  /** Boutons d'action affichés sous l'en-tête. */
  actions?: ReactNode;
}

/** Fiche détaillée d'un matériau. Donner une `key` par matériau pour réinitialiser les unités. */
export function MaterialCard({ material: m, isCustom = false, actions }: MaterialCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{m.name}</h3>
          <p className="text-sm text-slate-600">
            {m.family}
            {m.standard && <> · {m.standard}</>}
            {m.condition && <> · {m.condition}</>}
          </p>
        </div>
        <div className="flex gap-1.5">
          {isCustom && <CustomBadge />}
          {!m.verified && <UnverifiedBadge />}
        </div>
      </header>
      {actions && <div className="no-print mt-3 flex flex-wrap gap-2">{actions}</div>}

      <dl className="mt-4">
        <Row label="Module d’Young" symbol="E">
          <QuantityValue valueSI={m.E_Pa} quantity="stress" defaultUnit="GPa" label="E" />
        </Row>
        <Row label="Coefficient de Poisson" symbol="ν">
          <span className="font-mono tabular-nums">{formatNumber(m.nu)}</span>
        </Row>
        <Row label="Masse volumique" symbol="ρ">
          <QuantityValue valueSI={m.rho_kg_m3} quantity="density" defaultUnit="kg/m³" label="ρ" />
        </Row>
        <Row label="Limite élastique" symbol="Re">
          {m.Re_Pa !== undefined ? (
            <QuantityValue valueSI={m.Re_Pa} quantity="stress" defaultUnit="MPa" label="Re" />
          ) : (
            <Missing />
          )}
        </Row>
        <Row label="Résistance à la rupture (min.)" symbol="Rm">
          {m.Rm_Pa !== undefined ? (
            <QuantityValue valueSI={m.Rm_Pa} quantity="stress" defaultUnit="MPa" label="Rm" />
          ) : (
            <Missing />
          )}
        </Row>
        <Row label="Allongement à rupture" symbol="A">
          {m.A_percent !== undefined ? (
            <span className="font-mono tabular-nums">{formatNumber(m.A_percent)} %</span>
          ) : (
            <Missing />
          )}
        </Row>
        <Row label="Dilatation thermique" symbol="α">
          {m.alpha_1_K !== undefined ? (
            <QuantityValue
              valueSI={m.alpha_1_K}
              quantity="thermalExpansion"
              defaultUnit="10⁻⁶/K"
              label="α"
            />
          ) : (
            <Missing />
          )}
        </Row>
        {m.thicknessRange_m && (
          <Row label="Domaine d’épaisseur" symbol="t">
            <span className="font-mono tabular-nums">
              {formatNumber(fromSI(m.thicknessRange_m[0], 'length', 'mm'))} –{' '}
              {formatNumber(fromSI(m.thicknessRange_m[1], 'length', 'mm'))} mm
            </span>
          </Row>
        )}
      </dl>

      <div className="mt-4 space-y-2 text-sm">
        <p>
          <span className="font-medium">Source : </span>
          {m.source}
        </p>
        {m.notes && (
          <p className="text-slate-600">
            <span className="font-medium text-slate-700">Notes : </span>
            {m.notes}
          </p>
        )}
      </div>

      <SelectionGuide material={m} />
    </article>
  );
}
