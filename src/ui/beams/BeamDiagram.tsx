import { useRef, useState, type PointerEvent } from 'react';
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
}

/**
 * Diagramme d'une grandeur le long de la poutre (SVG, sans bibliothèque) : une seule
 * série, aire remplie jusqu'à zéro, réticule et valeur exacte au survol ou au toucher.
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
  const readoutLeft = hoverX > (LEFT + W - RIGHT) / 2;

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
            <text
              x={hoverX + (readoutLeft ? -8 : 8)}
              y={TOP + 10}
              fontSize={12}
              fill={INK}
              textAnchor={readoutLeft ? 'end' : 'start'}
              stroke="white"
              strokeWidth={4}
              paintOrder="stroke"
            >
              x = {formatNumber(toX(hover_m))} {lengthUnit} · {symbol} = {formatNumber(hoverValue)}{' '}
              {unit}
            </text>
          </g>
        )}
      </svg>
    </figure>
  );
}
