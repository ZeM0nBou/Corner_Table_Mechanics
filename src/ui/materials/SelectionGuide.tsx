import type { Material } from '@materials/schema';
import {
  COST_INDICES,
  COST_SCALE,
  PROCESS_GROUPS,
  RATING_LABELS,
  SECTORS,
  type CostIndex,
  type Rating,
} from '@materials/selection';

const RATING_STYLES: Record<Rating, string> = {
  excellent: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  bon: 'border-sky-300 bg-sky-50 text-sky-800',
  precautions: 'border-amber-300 bg-amber-50 text-amber-900',
  deconseille: 'border-red-300 bg-red-50 text-red-800',
};

/** Indice de prix : symboles € pleins, puis grisés jusqu'à 5. */
export function CostIndicator({ index }: { index: CostIndex }) {
  return (
    <span
      role="img"
      aria-label={`Indice de prix ${index} sur 5 (${COST_SCALE[index]})`}
      title={COST_SCALE[index]}
      className="font-semibold tracking-wider"
    >
      <span className="text-slate-900">{'€'.repeat(index)}</span>
      <span className="text-slate-300">{'€'.repeat(5 - index)}</span>
    </span>
  );
}

export function RatingBadge({ rating }: { rating: Rating }) {
  return (
    <span
      className={`inline-block shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${RATING_STYLES[rating]}`}
    >
      {RATING_LABELS[rating]}
    </span>
  );
}

function hasSelection(m: Material): boolean {
  return (
    m.costIndex !== undefined ||
    m.processes !== undefined ||
    m.sectors !== undefined ||
    m.applicationNotes !== undefined ||
    m.pros !== undefined ||
    m.cons !== undefined
  );
}

function PointList({
  title,
  points,
  sign,
  tone,
}: {
  title: string;
  points: readonly string[];
  sign: string;
  tone: string;
}) {
  return (
    <div>
      <dt className="text-slate-600">{title}</dt>
      <dd className="mt-0.5">
        <ul className="space-y-0.5">
          {points.map((p) => (
            <li key={p} className="flex gap-1.5">
              <span aria-hidden="true" className={`w-3 shrink-0 font-semibold ${tone}`}>
                {sign}
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

/** Aide au choix d'un matériau : prix, secteurs, emplois, aptitude aux procédés. */
export function SelectionGuide({ material: m }: { material: Material }) {
  if (!hasSelection(m)) return null;

  return (
    <section aria-labelledby={`aide-choix-${m.id}`} className="mt-6 border-t border-slate-200 pt-4">
      <h4 id={`aide-choix-${m.id}`} className="font-medium">
        Aide au choix
      </h4>
      <p className="mt-1 text-xs text-slate-500">
        Indications qualitatives, à confirmer auprès du fournisseur ou du sous-traitant.
      </p>

      <dl className="mt-3 space-y-3 text-sm">
        {m.costIndex !== undefined && (
          <div>
            <dt className="text-slate-600">Prix indicatif</dt>
            <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              <CostIndicator index={m.costIndex as CostIndex} />
              <span className="text-slate-600">{COST_SCALE[m.costIndex as CostIndex]}</span>
              {m.costNote && <span className="w-full text-xs text-slate-500">{m.costNote}</span>}
              <span className="w-full text-xs text-slate-400">
                Échelle (demi-produit, petite quantité, distributeur) :{' '}
                {COST_INDICES.map((i) => `${'€'.repeat(i)} ${COST_SCALE[i]}`).join(' · ')}.
              </span>
            </dd>
          </div>
        )}

        {m.sectors && m.sectors.length > 0 && (
          <div>
            <dt className="text-slate-600">Secteurs d’utilisation</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {m.sectors.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                >
                  {SECTORS[s]}
                </span>
              ))}
            </dd>
          </div>
        )}

        {m.applicationNotes && (
          <div>
            <dt className="text-slate-600">Emplois typiques</dt>
            <dd className="mt-0.5">{m.applicationNotes}</dd>
          </div>
        )}

        {(m.pros || m.cons) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {m.pros && (
              <PointList title="Atouts" points={m.pros} sign="+" tone="text-emerald-700" />
            )}
            {m.cons && <PointList title="Limites" points={m.cons} sign="−" tone="text-red-700" />}
          </div>
        )}
      </dl>

      {m.processes && (
        <div className="mt-4">
          <h5 className="text-sm text-slate-600">Procédés de fabrication</h5>
          <div className="mt-2 space-y-3">
            {PROCESS_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {group.label}
                </p>
                <ul className="mt-1 divide-y divide-slate-100">
                  {group.processes.map(({ key, label }) => {
                    const aptitude = m.processes?.[key];
                    return (
                      <li
                        key={key}
                        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1.5"
                      >
                        <span className="w-44 shrink-0 text-sm">{label}</span>
                        {aptitude ? (
                          <>
                            <RatingBadge rating={aptitude.rating} />
                            {aptitude.note && (
                              <span className="min-w-0 flex-1 basis-48 text-xs text-slate-600">
                                {aptitude.note}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">non renseigné</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {m.selectionSource && (
        <p className="mt-3 text-xs text-slate-600">
          <span className="font-medium">Source : </span>
          {m.selectionSource}
        </p>
      )}
    </section>
  );
}
