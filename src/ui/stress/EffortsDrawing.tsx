import type { SectionResult } from '@core/sections';
import type { SectionEfforts } from '@core/stress';
import { fromSI } from '@core/units';
import { formatNumber } from '@ui/format';
import {
  effortArrows,
  project,
  rotationArc,
  type EffortArrow,
  type Pt,
  type Vec3,
} from './effortsDiagram';

/** Plus grande dimension de la section dessinée (px). */
const SIZE = 140;
/** Longueur des flèches de force (px, non à l'échelle). */
const FORCE_PX = 56;
/** Rayon des flèches courbes des moments (px). */
const CURL_PX = 15;
const PAD = 14;

const COLORS: Record<EffortArrow['key'], string> = {
  N: '#dc2626',
  Vz: '#d97706',
  My: '#7c3aed',
  T: '#059669',
};

function label(a: EffortArrow, e: SectionEfforts): string {
  switch (a.key) {
    case 'N':
      return `N = ${formatNumber(fromSI(e.N_N, 'force', 'kN'))} kN`;
    case 'Vz':
      return `Vz = ${formatNumber(fromSI(e.Vz_N, 'force', 'kN'))} kN`;
    case 'My':
      return `My = ${formatNumber(fromSI(e.My_Nm, 'moment', 'kN·m'))} kN·m`;
    case 'T':
      return `T = ${formatNumber(fromSI(e.T_Nm, 'moment', 'N·m'))} N·m`;
  }
}

const path = (pts: readonly Pt[]) =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

interface Props {
  section: SectionResult;
  efforts: SectionEfforts;
}

/**
 * Schéma en perspective cavalière des efforts intérieurs sur la coupe : tronçon de barre,
 * facette de normale +x vue de face, flèches N et Vz, flèches courbes My et T dans leur
 * sens réel (conventions dans `effortsDiagram.ts`). Flèches non à l'échelle.
 */
export function EffortsDrawing({ section, efforts }: Props) {
  const W = section.width_m;
  const H = section.height_m;
  const s = SIZE / Math.max(W, H);
  const depth = 0.7 * Math.max(W, H); // longueur du tronçon dessiné derrière la coupe (m)
  const P = (p: Vec3) => project(p, s);
  // Coordonnées depuis G.
  const yG = section.yG_m;
  const zG = section.zG_m;
  const yMax = W - yG;
  const zMax = H - zG;

  // ---- Volume : faces vues (dessus et côté droit), puis la coupe devant.
  const faces: { key: string; d: string; front: boolean }[] = [];
  if (section.geometry.kind === 'rects') {
    const rects = section.geometry.rects
      .map((r) => ({ y0: r.y0 - yG, y1: r.y1 - yG, z0: r.z0 - zG, z1: r.z1 - zG }))
      .sort((a, b) => a.z1 - b.z1 || a.y1 - b.y1);
    rects.forEach((r, i) => {
      const top: Vec3[] = [
        [0, r.y0, r.z1],
        [0, r.y1, r.z1],
        [-depth, r.y1, r.z1],
        [-depth, r.y0, r.z1],
      ];
      const side: Vec3[] = [
        [0, r.y1, r.z0],
        [0, r.y1, r.z1],
        [-depth, r.y1, r.z1],
        [-depth, r.y1, r.z0],
      ];
      faces.push({ key: `t${i}`, d: path(top.map(P)) + ' Z', front: false });
      faces.push({ key: `s${i}`, d: path(side.map(P)) + ' Z', front: false });
    });
    rects.forEach((r, i) => {
      const front: Vec3[] = [
        [0, r.y0, r.z0],
        [0, r.y1, r.z0],
        [0, r.y1, r.z1],
        [0, r.y0, r.z1],
      ];
      faces.push({ key: `f${i}`, d: path(front.map(P)) + ' Z', front: true });
    });
  }

  /** Rond et tube : cercle arrière, bande de raccord (sans contour) et ses deux génératrices. */
  let circle: { R: number; Ri: number; back: Pt; band: string; edges: string } | undefined;
  if (section.geometry.kind === 'circle') {
    const R = (section.geometry.d_m / 2) * s;
    const back = P([-depth, 0, 0]);
    const n = Math.hypot(back.x, back.y);
    const nx = (-back.y / n) * R;
    const ny = (back.x / n) * R;
    circle = {
      R,
      Ri: (section.geometry.dInner_m / 2) * s,
      back,
      band: path([
        { x: nx, y: ny },
        { x: back.x + nx, y: back.y + ny },
        { x: back.x - nx, y: back.y - ny },
        { x: -nx, y: -ny },
      ]),
      edges: `${path([
        { x: nx, y: ny },
        { x: back.x + nx, y: back.y + ny },
      ])} ${path([
        { x: -nx, y: -ny },
        { x: back.x - nx, y: back.y - ny },
      ])}`,
    };
  }

  // ---- Efforts.
  const arrows = effortArrows(efforts);
  const forceLen = FORCE_PX / s; // en m dans le plan de la coupe
  const xLen = (2 * FORCE_PX) / (s * 0.5); // axe x fuyant (réduit de moitié)
  const yCurl = yMax + (CURL_PX + 18) / s;
  const xCurl = 0.85 * xLen;
  const curlR = CURL_PX / s;

  const drawn = arrows.map((a) => {
    const color = COLORS[a.key];
    let d: string;
    let tip: Pt;
    if (a.key === 'N') {
      const out = P([xLen * 0.45, 0, 0]);
      const pts = a.sign === 1 ? [{ x: 0, y: 0 }, out] : [out, { x: 0, y: 0 }];
      d = path(pts);
      tip = out;
    } else if (a.key === 'Vz') {
      const end = P([0, 0, a.sign * forceLen * 0.8]);
      d = path([{ x: 0, y: 0 }, end]);
      tip = end;
    } else {
      const center: Vec3 = a.key === 'My' ? [0, yCurl, 0] : [xCurl, 0, 0];
      const pts = rotationArc(
        a.axis,
        a.sign,
        center,
        curlR,
        a.key === 'My' ? Math.PI / 4 : -Math.PI / 4,
      ).map(P);
      d = path(pts);
      const c = P(center);
      tip = { x: c.x, y: c.y };
    }
    return { a, color, d, tip };
  });

  // Axes (en pointillés) : x jusqu'à la flèche courbe de T, y jusqu'à celle de My, z au-dessus.
  const axes: { name: string; from: Pt; to: Pt }[] = [
    { name: 'x', from: P([0, 0, 0]), to: P([xLen, 0, 0]) },
    { name: 'y', from: P([0, 0, 0]), to: P([0, yCurl + curlR * 1.6, 0]) },
    { name: 'z', from: P([0, 0, 0]), to: P([0, 0, zMax + 22 / s]) },
  ];

  // ---- Cadre : tous les points dessinés, plus une marge pour les libellés.
  const all: Pt[] = [
    P([0, -yG, -zG]),
    P([0, yMax, zMax]),
    P([-depth, -yG, zMax]),
    P([-depth, yMax, -zG]),
    ...axes.map((a) => a.to),
    P([0, 0, -forceLen]),
  ];
  if (circle) {
    const { R, back } = circle;
    all.push({ x: -R, y: -R }, { x: R, y: R }, { x: back.x + R, y: back.y - R });
  }
  const minX = Math.min(...all.map((p) => p.x)) - PAD - 70;
  const maxX = Math.max(...all.map((p) => p.x)) + PAD + 70;
  const minY = Math.min(...all.map((p) => p.y)) - PAD - 6;
  const maxY = Math.max(...all.map((p) => p.y)) + PAD + 18;

  const labelPos = (
    key: EffortArrow['key'],
    tip: Pt,
  ): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } => {
    switch (key) {
      case 'N':
        return { x: tip.x - 6, y: tip.y - 4, anchor: 'end' };
      case 'Vz':
        return { x: tip.x + 8, y: tip.y + (tip.y > 0 ? 4 : 10), anchor: 'start' };
      case 'My':
        return { x: tip.x, y: tip.y - CURL_PX - 8, anchor: 'middle' };
      case 'T':
        return { x: tip.x - CURL_PX - 6, y: tip.y + 4, anchor: 'end' };
    }
  };

  const description =
    arrows.length === 0 ? 'Aucun effort saisi.' : arrows.map((a) => label(a, efforts)).join(', ');

  return (
    <svg
      viewBox={`${minX.toFixed(1)} ${minY.toFixed(1)} ${(maxX - minX).toFixed(1)} ${(maxY - minY).toFixed(1)}`}
      className="h-auto w-full max-w-md text-slate-800"
      role="img"
      aria-label={`Schéma en perspective des efforts sur la coupe : ${description}`}
    >
      <defs>
        {(['axe', ...Object.keys(COLORS)] as const).map((k) => (
          <marker
            key={k}
            id={`fleche-effort-${k}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth={k === 'axe' ? 6 : 5}
            markerHeight={k === 'axe' ? 6 : 5}
            orient="auto-start-reverse"
          >
            <path
              d="M0,0 L10,5 L0,10 z"
              fill={k === 'axe' ? '#64748b' : COLORS[k as EffortArrow['key']]}
            />
          </marker>
        ))}
      </defs>

      {/* Tronçon de barre (partie gauche) et coupe */}
      <g className="stroke-sky-700" strokeWidth={0.9} strokeLinejoin="round">
        {faces
          .filter((f) => !f.front)
          .map((f) => (
            <path key={f.key} d={f.d} className="fill-sky-50" />
          ))}
        {circle && (
          <>
            <circle cx={circle.back.x} cy={circle.back.y} r={circle.R} className="fill-sky-50" />
            <path d={circle.band + ' Z'} className="fill-sky-50" stroke="none" />
            <path d={circle.edges} fill="none" />
          </>
        )}
        {faces
          .filter((f) => f.front)
          .map((f) => (
            <path key={f.key} d={f.d} className="fill-sky-200" />
          ))}
        {circle && (
          <>
            <circle cx={0} cy={0} r={circle.R} className="fill-sky-200" />
            {circle.Ri > 0 && <circle cx={0} cy={0} r={circle.Ri} className="fill-white" />}
          </>
        )}
      </g>

      {/* Axes */}
      <g stroke="#64748b" strokeWidth={0.8} strokeDasharray="3 2">
        {axes.map((a) => (
          <line
            key={a.name}
            x1={a.from.x}
            y1={a.from.y}
            x2={a.to.x}
            y2={a.to.y}
            markerEnd="url(#fleche-effort-axe)"
          />
        ))}
      </g>
      {axes.map((a) => (
        <text
          key={a.name}
          x={a.to.x + (a.name === 'x' ? -10 : a.name === 'y' ? 6 : 6)}
          y={a.to.y + (a.name === 'x' ? 10 : a.name === 'y' ? 4 : 4)}
          className="fill-slate-600 text-[11px] font-semibold italic"
        >
          {a.name}
        </text>
      ))}
      <circle cx={0} cy={0} r={2.5} className="fill-slate-900" />
      <text x={-5} y={-5} textAnchor="end" className="fill-slate-900 text-[10px] font-semibold">
        G
      </text>

      {/* Efforts */}
      {drawn.map(({ a, color, d, tip }) => {
        const l = labelPos(a.key, tip);
        return (
          <g key={a.key}>
            <path
              d={d}
              fill="none"
              stroke="white"
              strokeWidth={4}
              strokeLinecap="round"
              opacity={0.8}
            />
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={a.kind === 'force' ? 2 : 1.6}
              strokeLinecap="round"
              markerEnd={`url(#fleche-effort-${a.key})`}
            />
            <text
              x={l.x}
              y={l.y}
              textAnchor={l.anchor}
              fill={color}
              stroke="white"
              strokeWidth={3}
              paintOrder="stroke"
              className="text-[11px] font-semibold"
            >
              {label(a, efforts)}
            </text>
          </g>
        );
      })}
      {arrows.length === 0 && (
        <text x={0} y={maxY - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
          Aucun effort saisi
        </text>
      )}
    </svg>
  );
}
