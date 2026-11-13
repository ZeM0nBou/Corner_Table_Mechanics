import { useId, useState } from 'react';
import type { Material } from '@materials/schema';
import { buildFamilyGroups, normalizeText } from '@materials/search';

interface MaterialPickerProps {
  reference: readonly Material[];
  custom: readonly Material[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}

/**
 * Liste de choix de matériau : recherche, familles repliables, matériaux
 * personnalisés rangés dans leur famille et affichés en grisé.
 * Réutilisable dans tous les modules de calcul.
 */
export function MaterialPicker({
  reference,
  custom,
  value,
  onChange,
  label = 'Matériau',
}: MaterialPickerProps) {
  const baseId = useId();
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const searching = query.trim() !== '';
  const groups = buildFamilyGroups(reference, custom, query);
  const allFamilies = buildFamilyGroups(reference, custom).map((g) => normalizeText(g.family));

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${baseId}-recherche`} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={`${baseId}-recherche`}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher : nom, norme, état…"
        autoComplete="off"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30"
      />

      {!searching && (
        <div className="flex gap-3 text-xs">
          <button
            type="button"
            onClick={() => setCollapsed(new Set(allFamilies))}
            className="text-sky-700 hover:underline"
          >
            Tout replier
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(new Set())}
            className="text-sky-700 hover:underline"
          >
            Tout déplier
          </button>
        </div>
      )}

      <div className="max-h-[28rem] overflow-y-auto rounded-md border border-slate-200 bg-white">
        {groups.length === 0 && (
          <p className="px-3 py-4 text-sm text-slate-500">Aucun matériau ne correspond.</p>
        )}
        {groups.map((group) => {
          const key = normalizeText(group.family);
          // Pendant une recherche, toutes les familles trouvées sont dépliées.
          const open = searching || !collapsed.has(key);
          const listId = `${baseId}-${key.replace(/[^a-z0-9]+/g, '-')}`;
          return (
            <section key={key} className="border-b border-slate-100 last:border-b-0">
              <h4>
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  disabled={searching}
                  aria-expanded={open}
                  aria-controls={listId}
                  className="flex w-full items-center gap-2 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:cursor-default disabled:hover:bg-slate-50"
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block text-xs text-slate-500 transition-transform ${open ? 'rotate-90' : ''}`}
                  >
                    ▶
                  </span>
                  <span className="flex-1 first-letter:uppercase">{group.family}</span>
                  <span className="text-xs font-normal text-slate-500">{group.items.length}</span>
                </button>
              </h4>
              {open && (
                <ul id={listId}>
                  {group.items.map(({ material: m, isCustom }) => {
                    const selected = m.id === value;
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => onChange(m.id)}
                          aria-current={selected ? 'true' : undefined}
                          className={`flex w-full items-baseline gap-2 border-l-4 py-1.5 pr-3 pl-6 text-left text-sm ${
                            selected
                              ? 'border-sky-600 bg-sky-50'
                              : 'border-transparent hover:bg-slate-50'
                          } ${isCustom ? 'text-slate-500' : 'text-slate-900'}`}
                        >
                          <span className={isCustom ? 'italic' : 'font-medium'}>{m.name}</span>
                          {m.condition && (
                            <span className="min-w-0 truncate text-xs text-slate-500">
                              {m.condition}
                            </span>
                          )}
                          {isCustom && (
                            <span className="ml-auto shrink-0 rounded bg-slate-100 px-1.5 text-[0.65rem] text-slate-500">
                              perso
                            </span>
                          )}
                          {!m.verified && (
                            <span
                              title="Non vérifié"
                              aria-label="non vérifié"
                              className={`h-2 w-2 shrink-0 self-center rounded-full bg-amber-400 ${isCustom ? '' : 'ml-auto'}`}
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
