import { useId } from 'react';
import { groupByFamily, type Material } from '@materials/index';

interface MaterialSelectProps {
  materials: readonly Material[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}

/** Libellé court d'un matériau dans une liste. */
function optionLabel(m: Material): string {
  const parts = [m.name];
  if (m.condition) parts.push(`— ${m.condition}`);
  if (!m.verified) parts.push('(non vérifié)');
  return parts.join(' ');
}

/** Sélecteur de matériau, groupé par famille. Réutilisable dans tous les modules. */
export function MaterialSelect({
  materials,
  value,
  onChange,
  label = 'Matériau',
}: MaterialSelectProps) {
  const id = useId();
  const groups = groupByFamily(materials);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30"
      >
        {[...groups].map(([family, items]) => (
          <optgroup key={family} label={family}>
            {items.map((m) => (
              <option key={m.id} value={m.id}>
                {optionLabel(m)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
