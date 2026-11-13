import { useState } from 'react';
import { fromSI, type Quantity, type UnitOf } from '@core/units';
import { formatNumber } from '@ui/format';
import { UnitSelect } from './UnitSelect';

interface QuantityValueProps<Q extends Quantity> {
  /** Valeur en unité SI. */
  valueSI: number;
  quantity: Q;
  /** Unité d'affichage initiale. */
  defaultUnit: UnitOf<Q>;
  /** Nom de la grandeur, pour l'accessibilité (ex. « E »). */
  label: string;
}

/** Affiche une valeur SI dans une unité choisie par l'utilisateur. */
export function QuantityValue<Q extends Quantity>({
  valueSI,
  quantity,
  defaultUnit,
  label,
}: QuantityValueProps<Q>) {
  const [unit, setUnit] = useState<UnitOf<Q>>(defaultUnit);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono tabular-nums">
        {formatNumber(fromSI(valueSI, quantity, unit))}
      </span>
      <UnitSelect quantity={quantity} value={unit} onChange={setUnit} label={`Unité de ${label}`} />
    </span>
  );
}
