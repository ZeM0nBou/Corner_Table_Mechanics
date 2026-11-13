import { useEffect, useId, useRef, useState } from 'react';
import type { Material } from '@materials/schema';
import { MaterialPicker } from './MaterialPicker';

interface MaterialDropdownProps {
  reference: readonly Material[];
  custom: readonly Material[];
  /** Identifiant choisi, ou chaîne vide si aucun. */
  value: string;
  onChange: (id: string) => void;
  label: string;
  /** Texte du bouton quand aucun matériau n'est choisi. */
  placeholder?: string;
}

/**
 * Sélecteur de matériau compact : un bouton qui ouvre la liste (recherche,
 * familles) dans un panneau superposé, de hauteur fixe. Ouvrir ou fermer le
 * panneau ne décale pas le reste de la page.
 */
export function MaterialDropdown({
  reference,
  custom,
  value,
  onChange,
  label,
  placeholder = 'Aucun',
}: MaterialDropdownProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const selected = [...reference, ...custom].find((m) => m.id === value);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <span className="text-sm text-slate-700">{label}</span>
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-left text-sm hover:bg-slate-50"
        >
          <span className={`truncate ${selected ? '' : 'text-slate-500'}`}>
            {selected
              ? `${selected.name}${selected.condition ? ` — ${selected.condition}` : ''}`
              : placeholder}
          </span>
          <span aria-hidden="true" className="text-xs text-slate-500">
            {open ? '▲' : '▼'}
          </span>
        </button>
        {selected && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-600 hover:bg-slate-50"
            aria-label="Retirer le matériau"
            title="Retirer le matériau"
          >
            ✕
          </button>
        )}
      </div>
      {open && (
        <div
          id={panelId}
          className="absolute right-0 left-0 z-20 mt-1 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
        >
          <MaterialPicker
            reference={reference}
            custom={custom}
            value={value}
            onChange={(id) => {
              onChange(id);
              setOpen(false);
            }}
            label="Rechercher un matériau"
            listMaxHeightClass="max-h-64"
          />
        </div>
      )}
    </div>
  );
}
