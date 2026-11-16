import { useRef, useState, type PointerEvent } from 'react';
import type { Range } from '@core/beams';
import { fromSI, type Quantity, type UnitOf } from '@core/units';
import { UnitSelect } from '@ui/components/UnitSelect';
import { formatNumber } from '@ui/format';
import { areaPath, linearScale, linePath, niceTicks } from './diagram';

const W = 640;
const H = 190;
const LEFT = 62;
const RIGHT = 16;
const TOP = 14;
const BOTTOM = 26;

const SERIES = '#0369a1'; // sky-700
const INK = '#334155'; // slate-700
const MUTED = '#64748b'; // slate-500
const GRID = '#e2e8f0'; // slate-200
const ZERO = '#94a3b8'; // slate-400

interface BeamDiagramProps<Q extends Quantity> {
  title: string;
  symbol: string;
  quantity: Q;
  defaultUnit: UnitOf<Q>;
  /** Courbe en SI ; deux points de même abscisse marquent une discontinuité. */
  points: readonly { x_m: number; y: number }[];
  /** Valeur exacte (SI) à une abscisse, pour la lecture au survol. */
  valueAt: (x_m: number) => number;
  length_m: number;
  lengthUnit: UnitOf<'length'>;
  /** Précision sur le sens positif, affichée sous le titre. */
  note?: string;
  /** Minimum et maximum exacts (SI) et leur abscisse, affichés au-dessus et marqués sur la courbe. */
  extremes: Range;
}

/**
 * Diagramme d'une grandeur le long de la poutre (SVG, sans bibliothèque) : une seule
 * série, aire remplie jusqu'à zéro, réticule au survol ou au toucher. Au-dessus du tracé :
 * la valeur exacte au point survolé, et le minimum et le maximum avec leur abscisse
 * (aussi marqués sur la courbe).
 */
export function BeamDiagram<Q extends Quantity>({
  title,
  symbol,
  quantity,
  defaultUnit,
  points,
  valueAt,
  length_m,
  lengthUnit,
  note,
  extremes,
}: BeamDiagramProps<Q>) {
  const [unit, setUnit] = useState<UnitOf<Q>>(defaultUnit);
  const [hover_m, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const toY = (v: number) => fromSI(v, quantity, unit);
  const toX = (x_m: number) => fromSI(x_m, 'length', lengthUnit);
  const ys = points.map((p) => toY(p.y));
  const yTicks = niceTicks(Math.min(0, ...ys), Math.max(0, ...ys), 4);
  const yMin = yTicks[0] ?? 0;
  const yMax = yTicks[yTicks.length - 1] ?? 1;
  const sx = linearScale(0, length_m, LEFT, W - RIGHT);
  const sy = linearScale(yMin, yMax, H - BOTTOM, TOP);
  const xTicks = niceTicks(0, toX(length_m), 6).filter(
    (t) => t >= 0 && t <= toX(length_m) * (1 + 1e-9),
  );
  const screen = points.map((p, i) => ({ x: sx(p.x_m), y: sy(ys[i] ?? 0) }));

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const t = Math.min(1, Math.max(0, (px - LEFT) / (W - RIGHT - LEFT)));
    setHover(t * length_m);
  };

  const hoverValue = hover_m === null ? null : toY(valueAt(hover_m));
  const hoverX = hover_m === null ? 0 : sx(hover_m);
  const fx = (x_m: number) => `${formatNumber(toX(x_m))} ${lengthUnit}`;
  const fy = (v: number) => `${formatNumber(toY(v))} ${unit}`;

  // Repères des extremums non nuls ; un seul si min et max coïncident.
  const marks = [
    { kind: 'max' as const, e: extremes.max },
    { kind: 'min' as const, e: extremes.min },
  ].filter(
    (m, i, all) =>
      m.e.value !== 0 &&
      !(i === 1 && all[0] && all[0].e.value === m.e.value && all[0].e.x_m === m.e.x_m),
  );

  return (
    <figure className="rounded-lg border border-slate-200 bg-white p-3">
      <figcaption className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {title} <i className="font-serif font-normal">{symbol}</i>
          {note !== undefined && <span className="ml-2 font-normal text-slate-500">{note}</span>}
        </span>
        <UnitSelect
          quantity={quantity}
          value={unit}
          onChange={setUnit}
          label={`Unité de ${symbol}`}
        />
      </figcaption>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-xs">
        <span className="text-slate-700" aria-live="polite">
          {hover_m !== null && hoverValue !== null ? (
            <>
              x = <span className="font-mono tabular-nums">{fx(hover_m)}</span> →{' '}
              <i className="font-serif">{symbol}</i> ={' '}
              <span className="font-mono font-semibold tabular-nums">
                {formatNumber(hoverValue)} {unit}
              </span>
            </>
          ) : (
            <span className="text-slate-400">Survolez la courbe pour lire une valeur.</span>
          )}
        </span>
        <span className="text-slate-700">
          max ={' '}
          <span className="font-mono font-semibold tabular-nums">{fy(extremes.max.value)}</span>{' '}
          <span className="text-slate-500">(x = {fx(extremes.max.x_m)})</span>
          <span className="mx-1.5 text-slate-300">|</span>
          min ={' '}
          <span className="font-mono font-semibold tabular-nums">
            {fy(extremes.min.value)}
          </span>{' '}
          <span className="text-slate-500">(x = {fx(extremes.min.x_m)})</span>
        </span>
      </div>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={`${title} le long de la poutre, de ${formatNumber(Math.min(...ys))} à ${formatNumber(Math.max(...ys))} ${unit}`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={LEFT}
              x2={W - RIGHT}
              y1={sy(t)}
              y2={sy(t)}
              stroke={t === 0 ? ZERO : GRID}
              strokeWidth={1}
            />
            <text x={LEFT - 6} y={sy(t) + 4} fontSize={11} fill={MUTED} textAnchor="end">
              {formatNumber(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => {
          const x = sx((t / toX(length_m)) * length_m);
          return (
            <g key={t}>
              <line
                x1={x}
                x2={x}
                y1={H - BOTTOM}
                y2={H - BOTTOM + 4}
                stroke={ZERO}
                strokeWidth={1}
              />
              <text x={x} y={H - 8} fontSize={11} fill={MUTED} textAnchor="middle">
                {formatNumber(t)}
              </text>
            </g>
          );
        })}
        <text x={LEFT - 14} y={H - 8} fontSize={11} fill={MUTED} textAnchor="end">
          x ({lengthUnit})
        </text>

        <path d={areaPath(screen, sy(0))} fill={SERIES} fillOpacity={0.12} />
        <path
          d={linePath(screen)}
          fill="none"
          stroke={SERIES}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {marks.map(({ kind, e }) => {
          const cx = sx(e.x_m);
          const cy = sy(toY(e.value));
          const above = kind === 'max' ? e.value >= 0 : e.value > 0;
          // Étiquette au-dessus (ou au-dessous) du repère ; sur le côté s'il n'y a pas la place.
          const vy = above ? cy - 8 : cy + 16;
          const fits = vy >= TOP + 10 && vy <= H - BOTTOM - 4;
          const toLeft = cx > W - RIGHT - 60;
          const tx = fits ? cx : cx + (toLeft ? -8 : 8);
          const ty = fits ? vy : cy + 4;
          const anchor = fits
            ? cx < LEFT + 40
              ? 'start'
              : cx > W - RIGHT - 40
                ? 'end'
                : 'middle'
            : toLeft
              ? 'end'
              : 'start';
          return (
            <g key={kind} pointerEvents="none">
              <circle cx={cx} cy={cy} r={3.5} fill="white" stroke={SERIES} strokeWidth={2} />
              <text
                x={tx}
                y={ty}
                fontSize={11}
                fontWeight={600}
                fill={INK}
                textAnchor={anchor}
                stroke="white"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {formatNumber(toY(e.value))}
              </text>
            </g>
          );
        })}

        {hover_m !== null && hoverValue !== null && (
          <g pointerEvents="none">
            <line
              x1={hoverX}
              x2={hoverX}
              y1={TOP}
              y2={H - BOTTOM}
              stroke={INK}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle
              cx={hoverX}
              cy={sy(hoverValue)}
              r={4}
              fill={SERIES}
              stroke="white"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>
    </figure>
  );
}
