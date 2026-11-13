import { useId } from 'react';
import {
  COST_INDICES,
  COST_SCALE,
  PROCESS_GROUPS,
  RATINGS,
  RATING_LABELS,
  SECTOR_KEYS,
  SECTORS,
  type ProcessKey,
  type Rating,
} from '@materials/selection';
import type { DraftErrors, DraftField, MaterialDraft } from './materialDraft';

interface SelectionFieldsProps {
  draft: MaterialDraft;
  onChange: (patch: Partial<MaterialDraft>) => void;
  /** Marque un champ comme quitté (affichage des erreurs). */
  touch: (field: DraftField) => void;
  errors: DraftErrors;
}

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30';

function ErrorText({ id, message }: { id: string; message: string | undefined }) {
  return message === undefined ? null : (
    <p id={id} className="text-xs text-red-700">
      {message}
    </p>
  );
}

/** Saisie de l'aide au choix : prix, secteurs, emplois, procédés, source. */
export function SelectionFields({ draft, onChange, touch, errors }: SelectionFieldsProps) {
  const id = useId();

  const setProcess = (key: ProcessKey, rating: Rating | '', note?: string) => {
    const others = Object.fromEntries(
      Object.entries(draft.processes).filter(([k]) => k !== key),
    ) as MaterialDraft['processes'];
    onChange({
      processes:
        rating === ''
          ? others
          : { ...others, [key]: { rating, note: note ?? draft.processes[key]?.note ?? '' } },
    });
  };

  const toggleSector = (s: (typeof SECTOR_KEYS)[number]) =>
    onChange({
      sectors: draft.sectors.includes(s)
        ? draft.sectors.filter((x) => x !== s)
        : SECTOR_KEYS.filter((k) => k === s || draft.sectors.includes(k)),
    });

  const ratedCount = Object.keys(draft.processes).length;

  return (
    <fieldset className="rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-medium text-slate-800">
        Aide au choix (facultatif)
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-prix`} className="text-sm text-slate-700">
            Indice de prix
          </label>
          <select
            id={`${id}-prix`}
            value={draft.costIndex ?? ''}
            onChange={(e) =>
              onChange({ costIndex: e.target.value === '' ? undefined : Number(e.target.value) })
            }
            onBlur={() => touch('costIndex')}
            className={inputCls}
          >
            <option value="">— non renseigné —</option>
            {COST_INDICES.map((i) => (
              <option key={i} value={i}>
                {'€'.repeat(i)} ({COST_SCALE[i]})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-prix-note`} className="text-sm text-slate-700">
            Justification du prix
          </label>
          <input
            id={`${id}-prix-note`}
            type="text"
            value={draft.costNote}
            onChange={(e) => onChange({ costNote: e.target.value })}
            onBlur={() => touch('costNote')}
            placeholder="ex. devis fournisseur X, tôle 10 mm, 2026"
            className={inputCls}
          />
          <ErrorText id={`${id}-prix-note-err`} message={errors.costNote} />
        </div>

        <fieldset className="sm:col-span-2" onBlur={() => touch('sectors')}>
          <legend className="text-sm text-slate-700">Secteurs d’utilisation</legend>
          <div className="mt-1 grid gap-x-4 gap-y-1 sm:grid-cols-3">
            {SECTOR_KEYS.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.sectors.includes(s)}
                  onChange={() => toggleSector(s)}
                  className="h-4 w-4"
                />
                {SECTORS[s]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={`${id}-emplois`} className="text-sm text-slate-700">
            Emplois typiques
          </label>
          <textarea
            id={`${id}-emplois`}
            rows={2}
            value={draft.applicationNotes}
            onChange={(e) => onChange({ applicationNotes: e.target.value })}
            onBlur={() => touch('applicationNotes')}
            className={inputCls}
          />
          <ErrorText id={`${id}-emplois-err`} message={errors.applicationNotes} />
        </div>

        <details className="sm:col-span-2" onBlur={() => touch('processes')}>
          <summary className="cursor-pointer text-sm text-slate-700">
            Procédés de fabrication ({ratedCount} renseigné{ratedCount > 1 ? 's' : ''} sur 17)
          </summary>
          <div className="mt-2 space-y-3">
            {PROCESS_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {group.label}
                </p>
                <ul className="mt-1 space-y-2">
                  {group.processes.map(({ key, label }) => {
                    const current = draft.processes[key];
                    return (
                      <li key={key} className="grid gap-2 sm:grid-cols-[11rem_12rem_1fr]">
                        <span className="self-center text-sm">{label}</span>
                        <select
                          aria-label={`Aptitude : ${label}`}
                          value={current?.rating ?? ''}
                          onChange={(e) => setProcess(key, e.target.value as Rating | '')}
                          className={`${inputCls} py-1 text-sm`}
                        >
                          <option value="">— non renseigné —</option>
                          {RATINGS.map((r) => (
                            <option key={r} value={r}>
                              {RATING_LABELS[r]}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          aria-label={`Aide-mémoire : ${label}`}
                          value={current?.note ?? ''}
                          disabled={current === undefined}
                          onChange={(e) =>
                            current && setProcess(key, current.rating, e.target.value)
                          }
                          placeholder={current ? 'Aide-mémoire (facultatif)' : ''}
                          className={`${inputCls} py-1 text-sm disabled:bg-slate-50`}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <ErrorText id={`${id}-procedes-err`} message={errors.processes} />
        </details>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={`${id}-source`} className="text-sm text-slate-700">
            Source de ces indications
          </label>
          <input
            id={`${id}-source`}
            type="text"
            value={draft.selectionSource}
            onChange={(e) => onChange({ selectionSource: e.target.value })}
            onBlur={() => touch('selectionSource')}
            aria-invalid={errors.selectionSource !== undefined}
            aria-describedby={errors.selectionSource !== undefined ? `${id}-source-err` : undefined}
            placeholder="Obligatoire si l’une des indications ci-dessus est renseignée"
            className={`${inputCls} ${errors.selectionSource !== undefined ? 'border-red-500' : ''}`}
          />
          <ErrorText id={`${id}-source-err`} message={errors.selectionSource} />
        </div>
      </div>
    </fieldset>
  );
}
