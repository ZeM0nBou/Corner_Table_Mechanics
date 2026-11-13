import type { SectionResult, SectionShape } from '@core/sections';
import { fromSI } from '@core/units';
import { formatNumber } from '@ui/format';
import { sectionAnnotations, type Annotation } from './annotations';

const SIZE = 220; // plus grande dimension du dessin (px)
const M = { left: 56, right: 76, top: 40, bottom: 52 }; // marges pour cotes, axes et libellés

const mm = (x: number) => formatNumber(fromSI(x, 'length', 'mm'));

interface Props {
  section: SectionResult;
  shape: SectionShape;
  dims: Readonly<Record<string, number>>;
}

/**
 * Schéma coté de la section, à l'échelle : contour, cotes nommées (b, h, t, tw, tf, d, D)
 * avec leur valeur en mm, origine O, centre de gravité G et axes orientés y (→) et z (↑) ;
 * axes principaux u, v en pointillés si inclinés (cornière).
 */
export function SectionDrawing({ section, shape, dims }: Props) {
  const W = section.width_m;
  const H = section.height_m;
  const s = SIZE / Math.max(W, H);
  const w = W * s;
  const h = H * s;
  const vw = w + M.left + M.right;
  const vh = h + M.top + M.bottom;
  // Repère SVG : y vers la droite, z vers le haut (inversion verticale).
  const X = (y: number) => M.left + y * s;
  const Y = (z: number) => M.top + h - z * s;
  const gx = X(section.yG_m);
  const gy = Y(section.zG_m);
  // Axes : dépassent la section de 18 px, sans sortir du dessin.
  // Axes en flèches partant de G (repère), pour laisser libres les cotes à gauche et en bas.
  const yEnd = Math.min(X(W) + 18, vw - 14);
  const zEnd = Math.max(Y(H) - 12, 14);
  const { alpha_rad } = section.principal;
  const inclined = Math.abs(alpha_rad) > 1e-6 && Math.abs(Math.abs(alpha_rad) - Math.PI / 2) > 1e-6;
  const principalLength = Math.min(w, h) / 2 + 14;

  return (
    <svg
      viewBox={`0 0 ${vw} ${vh}`}
      className="h-auto w-full max-w-md text-slate-800"
      role="img"
      aria-label={`Schéma coté de la section (${mm(W)} × ${mm(H)} mm), origine O, centre de gravité G, axes y et z`}
    >
      <defs>
        {(
          [
            ['fleche-cote', 'currentColor'],
            ['fleche-axe', '#475569'],
          ] as const
        ).map(([id, color]) => (
          <marker
            key={id}
            id={id}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,1 L10,5 L0,9 z" fill={color} />
          </marker>
        ))}
      </defs>

      {/* Matière */}
      <g className="fill-sky-100 stroke-sky-700" strokeWidth={1.2}>
        {section.geometry.kind === 'rects' ? (
          section.geometry.rects.map((r, i) => (
            <rect
              key={i}
              x={X(r.y0)}
              y={Y(r.z1)}
              width={(r.y1 - r.y0) * s}
              height={(r.z1 - r.z0) * s}
            />
          ))
        ) : (
          <>
            <circle cx={gx} cy={gy} r={(section.geometry.d_m / 2) * s} />
            {section.geometry.dInner_m > 0 && (
              <circle
                cx={gx}
                cy={gy}
                r={(section.geometry.dInner_m / 2) * s}
                className="fill-white"
              />
            )}
          </>
        )}
      </g>

      {/* Axes centraux orientés : y vers la droite, z vers le haut */}
      <g stroke="#475569" strokeWidth={0.9}>
        <line x1={gx} y1={gy} x2={yEnd} y2={gy} markerEnd="url(#fleche-axe)" />
        <line x1={gx} y1={gy} x2={gx} y2={zEnd} markerEnd="url(#fleche-axe)" />
      </g>
      <text x={yEnd + 3} y={gy + 4} className="fill-slate-700 text-[12px] font-semibold italic">
        y
      </text>
      <text x={gx + 5} y={zEnd + 4} className="fill-slate-700 text-[12px] font-semibold italic">
        z
      </text>

      {/* Axes principaux inclinés (cornière) */}
      {inclined &&
        (
          [
            [alpha_rad, 'u'],
            [alpha_rad + Math.PI / 2, 'v'],
          ] as const
        ).map(([a, name]) => {
          const dx = Math.cos(a) * principalLength;
          const dy = -Math.sin(a) * principalLength;
          return (
            <g key={name}>
              <line
                x1={gx - dx}
                y1={gy - dy}
                x2={gx + dx}
                y2={gy + dy}
                stroke="#d97706"
                strokeWidth={0.9}
                strokeDasharray="4 3"
              />
              <text x={gx + dx + 3} y={gy + dy + 4} className="fill-amber-700 text-[11px] italic">
                {name}
              </text>
            </g>
          );
        })}

      {/* Origine O et centre de gravité G */}
      <circle cx={X(0)} cy={Y(0)} r={2.5} className="fill-slate-900" />
      <text x={X(0) - 12} y={Y(0) + 14} className="fill-slate-900 text-[11px] font-semibold">
        O
      </text>
      <circle cx={gx} cy={gy} r={3} className="fill-red-600" />
      {/* À gauche de G : seule direction libre (axes y, z vers +, axes u, v en diagonale). */}
      <text
        x={gx - 6}
        y={gy + 4}
        textAnchor="end"
        className="fill-red-700 text-[11px] font-semibold"
      >
        G
      </text>

      {/* Cotes */}
      {sectionAnnotations(shape, dims).map((a) => (
        <Dimension
          key={a.key}
          a={a}
          X={X}
          Y={Y}
          label={`${a.symbol} = ${mm(dims[a.key] ?? NaN)}`}
        />
      ))}

      <text x={vw - 4} y={vh - 4} textAnchor="end" className="fill-slate-400 text-[9px]">
        cotes en mm
      </text>
    </svg>
  );
}

/** Ligne de cote avec flèches et libellé ; libellé à côté si la cote est trop courte. */
function Dimension({
  a,
  X,
  Y,
  label,
}: {
  a: Annotation;
  X: (y: number) => number;
  Y: (z: number) => number;
  label: string;
}) {
  const textCls = 'fill-slate-800 text-[11px]';
  if (a.kind === 'h') {
    const x1 = X(a.from);
    const x2 = X(a.to);
    const y = Y(a.at) - a.offsetPx;
    const short = x2 - x1 < 46;
    const ext = a.offsetPx !== 0; // lignes d'attache vers la matière
    return (
      <g stroke="currentColor" strokeWidth={0.8}>
        {ext && (
          <>
            <line
              x1={x1}
              y1={Y(a.at)}
              x2={x1}
              y2={y + Math.sign(a.offsetPx) * -4}
              strokeOpacity={0.5}
            />
            <line
              x1={x2}
              y1={Y(a.at)}
              x2={x2}
              y2={y + Math.sign(a.offsetPx) * -4}
              strokeOpacity={0.5}
            />
          </>
        )}
        <line
          x1={x1}
          y1={y}
          x2={x2}
          y2={y}
          markerStart="url(#fleche-cote)"
          markerEnd="url(#fleche-cote)"
        />
        <text
          x={short ? (a.labelSide === 'start' ? x1 - 6 : x2 + 6) : (x1 + x2) / 2}
          y={short ? y + 4 : a.offsetPx > 0 ? y - 5 : y + 14}
          textAnchor={short ? (a.labelSide === 'start' ? 'end' : 'start') : 'middle'}
          stroke="none"
          className={textCls}
        >
          {label}
        </text>
      </g>
    );
  }
  const y1 = Y(a.from);
  const y2 = Y(a.to);
  const x = X(a.at) + a.offsetPx;
  const short = y1 - y2 < 46;
  return (
    <g stroke="currentColor" strokeWidth={0.8}>
      <line x1={X(a.at)} y1={y1} x2={x + Math.sign(a.offsetPx) * 4} y2={y1} strokeOpacity={0.5} />
      <line x1={X(a.at)} y1={y2} x2={x + Math.sign(a.offsetPx) * 4} y2={y2} strokeOpacity={0.5} />
      <line
        x1={x}
        y1={y1}
        x2={x}
        y2={y2}
        markerStart="url(#fleche-cote)"
        markerEnd="url(#fleche-cote)"
      />
      {short ? (
        <text x={x + 5} y={(y1 + y2) / 2 + 4} stroke="none" className={textCls}>
          {label}
        </text>
      ) : (
        <text
          x={x - 6}
          y={(y1 + y2) / 2}
          textAnchor="middle"
          transform={`rotate(-90 ${x - 6} ${(y1 + y2) / 2})`}
          stroke="none"
          className={textCls}
        >
          {label}
        </text>
      )}
    </g>
  );
}
