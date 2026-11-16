import type { Verdict } from '@core/stress';

const VERDICT_STYLE: Record<Verdict, { icon: string; label: string; className: string }> = {
  ok: { icon: '✓', label: 'OK', className: 'bg-emerald-50 text-emerald-800 ring-emerald-300' },
  limite: { icon: '!', label: 'Limite', className: 'bg-amber-50 text-amber-900 ring-amber-300' },
  ko: { icon: '✗', label: 'KO', className: 'bg-red-50 text-red-800 ring-red-300' },
};

/** Pastille de verdict : icône et mot, jamais la couleur seule. */
export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const v = VERDICT_STYLE[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold ring-1 ${v.className}`}
    >
      <span aria-hidden="true">{v.icon}</span>
      {v.label}
    </span>
  );
}
