import { unitsOf, type Quantity, type UnitOf } from '@core/units';

interface UnitSelectProps<Q extends Quantity> {
  quantity: Q;
  value: UnitOf<Q>;
  onChange: (unit: UnitOf<Q>) => void;
  /** Nom accessible, ex. « Unité de E ». */
  label: string;
}

/** Sélecteur d'unité pour une grandeur donnée. */
export function UnitSelect<Q extends Quantity>({
  quantity,
  value,
  onChange,
  label,
}: UnitSelectProps<Q>) {
  const units = unitsOf(quantity);
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => {
        const unit = units.find((u) => u === e.target.value);
        if (unit !== undefined) onChange(unit);
      }}
      className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-sm text-slate-700 print:appearance-none print:border-0"
    >
      {units.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </select>
  );
}
