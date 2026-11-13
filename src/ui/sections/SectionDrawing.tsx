import type { SectionResult } from '@core/sections';
import { fromSI } from '@core/units';
import { formatNumber } from '@ui/format';

const SIZE = 240; // taille maximale du dessin (px)
const PAD = 44; // marge pour les cotes et les axes

const mm = (x: number) => formatNumber(fromSI(x, 'length', 'mm'));

/**
 * Schéma coté de la section, à l'échelle : contour, cotes hors tout b × h,
 * centre de gravité G et axes y (horizontal), z (vertical) ; pour une section
 * aux axes principaux inclinés (cornière), axes u et v en pointillés.
 */
export function SectionDrawing({ section }: { section: SectionResult }) {
  const W = section.width_m;
  const H = section.height_m;
  const s = SIZE / Math.max(W, H);
  const w = W * s;
  const h = H * s;
  const vw = w + 2 * PAD;
  const vh = h + 2 * PAD;
  // Repère SVG : y vers la droite, z vers le haut (d'où l'inversion verticale).
  const X = (y: number) => PAD + y * s;
  const Y = (z: number) => PAD + h - z * s;
  const gx = X(section.yG_m);
  const gy = Y(section.zG_m);
  const axis = Math.max(w, h) / 2 + 18;
  const { alpha_rad } = section.principal;
  const inclined = Math.abs(alpha_rad) > 1e-6 && Math.abs(Math.abs(alpha_rad) - Math.PI / 2) > 1e-6;

  return (
    <svg
      viewBox={`0 0 ${vw} ${vh}`}
      className="h-auto w-full max-w-sm text-slate-800"
      role="img"
      aria-label={`Schéma de la section : ${mm(W)} × ${mm(H)} mm, centre de gravité G`}
    >
      <defs>
        <marker
          id="fleche"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
        </marker>
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

      {/* Axes centraux y, z */}
      <g
        stroke="currentColor"
        strokeWidth={0.8}
        strokeDasharray="6 3 1 3"
        className="text-slate-500"
      >
        <line x1={gx - axis} y1={gy} x2={gx + axis} y2={gy} />
        <line x1={gx} y1={gy + axis} x2={gx} y2={gy - axis} />
      </g>
      <text x={gx + axis + 4} y={gy + 4} className="fill-slate-600 text-[11px] italic">
        y
      </text>
      <text x={gx - 4} y={gy - axis - 5} className="fill-slate-600 text-[11px] italic">
        z
      </text>

      {/* Axes principaux inclinés (cornière) */}
      {inclined && (
        <g stroke="currentColor" strokeWidth={0.8} strokeDasharray="3 3" className="text-amber-600">
          {[
            [alpha_rad, 'u'],
            [alpha_rad + Math.PI / 2, 'v'],
          ].map(([a, name]) => {
            const dx = Math.cos(a as number) * axis * 0.9;
            const dy = -Math.sin(a as number) * axis * 0.9;
            return (
              <g key={name as string}>
                <line x1={gx - dx} y1={gy - dy} x2={gx + dx} y2={gy + dy} />
                <text
                  x={gx + dx + 3}
                  y={gy + dy}
                  stroke="none"
                  className="fill-amber-700 text-[11px] italic"
                >
                  {name}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* Centre de gravité */}
      <circle cx={gx} cy={gy} r={3} className="fill-red-600" />
      <text x={gx + 5} y={gy + 13} className="fill-red-700 text-[11px] font-semibold">
        G
      </text>

      {/* Cotes hors tout */}
      <g stroke="currentColor" strokeWidth={0.8} className="text-slate-700">
        <line
          x1={X(0)}
          y1={vh - 16}
          x2={X(W)}
          y2={vh - 16}
          markerStart="url(#fleche)"
          markerEnd="url(#fleche)"
        />
        <line
          x1={16}
          y1={Y(0)}
          x2={16}
          y2={Y(H)}
          markerStart="url(#fleche)"
          markerEnd="url(#fleche)"
        />
      </g>
      <text x={PAD + w / 2} y={vh - 20} textAnchor="middle" className="fill-slate-700 text-[11px]">
        {mm(W)} mm
      </text>
      <text
        x={12}
        y={PAD + h / 2}
        textAnchor="middle"
        transform={`rotate(-90 12 ${PAD + h / 2})`}
        className="fill-slate-700 text-[11px]"
      >
        {mm(H)} mm
      </text>
    </svg>
  );
}
