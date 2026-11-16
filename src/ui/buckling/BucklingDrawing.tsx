import { BUCKLING_CASES, type BucklingCase } from '@core/buckling';
import { formatNumber } from '@ui/format';

/**
 * Allure (schématique) de la déformée de chaque cas, s ∈ [0 ; 1] depuis le pied :
 * fonctions qui respectent les conditions aux limites (déplacement et rotation nuls à un
 * encastrement, déplacement nul à une articulation), normalisées à 1.
 */
const SHAPES: Record<BucklingCase, (s: number) => number> = {
  console: (s) => 1 - Math.cos((Math.PI * s) / 2),
  biArticulee: (s) => Math.sin(Math.PI * s),
  // s²(1 − s) : maximum 4/27 en s = 2/3.
  encastreeArticulee: (s) => ((s * s * (1 - s)) / 4) * 27,
  biEncastree: (s) => (1 - Math.cos(2 * Math.PI * s)) / 2,
};

/** Conditions aux extrémités : pied, tête. */
const ENDS: Record<BucklingCase, ['encastre' | 'articule', 'encastre' | 'articule' | 'libre']> = {
  console: ['encastre', 'libre'],
  biArticulee: ['articule', 'articule'],
  encastreeArticulee: ['encastre', 'articule'],
  biEncastree: ['encastre', 'encastre'],
};

const ORDER: readonly BucklingCase[] = [
  'console',
  'biArticulee',
  'encastreeArticulee',
  'biEncastree',
];

const W = 90;
const H = 162;
const TOP = 36;
const BOTTOM = TOP + 100;

function Support({ x, y, kind, top }: { x: number; y: number; kind: string; top: boolean }) {
  const dir = top ? -1 : 1;
  if (kind === 'encastre') {
    const yy = y + dir * 3;
    return (
      <g stroke="currentColor" strokeWidth={1}>
        <line x1={x - 14} x2={x + 14} y1={yy} y2={yy} strokeWidth={2} />
        {[-12, -6, 0, 6, 12].map((dx) => (
          <line key={dx} x1={x + dx} y1={yy} x2={x + dx - 5} y2={yy + dir * 6} />
        ))}
      </g>
    );
  }
  if (kind === 'articule') {
    return (
      <g stroke="currentColor" fill="none" strokeWidth={1}>
        <circle cx={x} cy={y} r={2.5} />
        <path d={`M${x} ${y} L${x - 7} ${y + dir * 10} L${x + 7} ${y + dir * 10} Z`} />
      </g>
    );
  }
  return null;
}

/** Les quatre cas d'Euler, avec mise en évidence des cas retenus pour chaque plan. */
export function BucklingDrawing({ selected }: { selected: Partial<Record<BucklingCase, string>> }) {
  return (
    <svg
      viewBox={`0 0 ${W * ORDER.length} ${H}`}
      className="mx-auto w-full max-w-lg text-slate-700"
      role="img"
      aria-label="Longueurs de flambement des quatre cas usuels"
    >
      <defs>
        <marker id="fl-arrow" viewBox="0 0 6 6" refX="3" refY="5" markerWidth="6" markerHeight="6">
          <path d="M0 0 L6 0 L3 6 Z" fill="currentColor" />
        </marker>
      </defs>
      {ORDER.map((c, k) => {
        const cx = k * W + W / 2;
        const shape = SHAPES[c];
        const pts = Array.from({ length: 41 }, (_, j) => {
          const s = j / 40;
          return `${(cx + 14 * shape(s)).toFixed(1)},${(BOTTOM - s * (BOTTOM - TOP)).toFixed(1)}`;
        }).join(' ');
        const tag = selected[c];
        const [foot, head] = ENDS[c];
        // Tête : la console se déplace latéralement, les autres non.
        const headX = c === 'console' ? cx + 14 : cx;
        return (
          <g key={c}>
            {tag !== undefined && (
              <rect
                x={k * W + 3}
                y={2}
                width={W - 6}
                height={H - 4}
                rx={6}
                className="fill-sky-50 stroke-sky-400"
              />
            )}
            <line
              x1={cx}
              x2={cx}
              y1={TOP}
              y2={BOTTOM}
              stroke="currentColor"
              strokeDasharray="3 3"
              strokeWidth={0.8}
              opacity={0.5}
            />
            <polyline points={pts} fill="none" className="stroke-sky-700" strokeWidth={2} />
            <line
              x1={headX}
              x2={headX}
              y1={TOP - 32}
              y2={TOP - 13}
              stroke="currentColor"
              strokeWidth={1.2}
              markerEnd="url(#fl-arrow)"
            />
            <Support x={cx} y={BOTTOM} kind={foot} top={false} />
            <Support x={headX} y={TOP} kind={head} top />
            <text x={cx} y={H - 6} textAnchor="middle" fontSize={10} fill="currentColor">
              K = {formatNumber(BUCKLING_CASES[c].K)}
              {tag !== undefined ? ` (${tag})` : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
