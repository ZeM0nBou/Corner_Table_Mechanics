import type { BeamModel, Load } from '@core/beams';
import { supportName } from './beamForm';

const W = 640;
const H = 200;
const X0 = 48;
const X1 = W - 48;
/** Ordonnée de la fibre moyenne de la poutre. */
const Y = 104;
/** Hauteur maximale du dessin d'une charge. */
const LOAD_H = 44;

const INK = '#0f172a'; // slate-900
const MUTED = '#64748b'; // slate-500

/** Position de l'étiquette d'une charge répartie le long de son étendue, pour éviter
 *  que les étiquettes de charges superposées se chevauchent. */
const LABEL_FRACTIONS = [0.5, 0.3, 0.7, 0.15, 0.85, 0.4, 0.6] as const;

/** Apparence d'une charge sur le schéma : étiquette (texte en encre) et couleur du tracé. */
export interface LoadStyle {
  label: string;
  color: string;
}

/** Pointe de flèche triangulaire en (x, y), orientée selon l'angle (rad, repère écran). */
function Head({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  const deg = (angle * 180) / Math.PI;
  return (
    <path
      d="M0 0 L-8 -3.5 L-8 3.5 Z"
      fill={color}
      transform={`translate(${x} ${y}) rotate(${deg})`}
    />
  );
}

/** Étiquette en encre sur fond blanc, lisible au-dessus des tracés. */
function Label({
  x,
  y,
  text,
  anchor = 'start',
}: {
  x: number;
  y: number;
  text: string;
  anchor?: 'start' | 'middle';
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={12}
      fontWeight={600}
      fill={INK}
      textAnchor={anchor}
      stroke="white"
      strokeWidth={3}
      paintOrder="stroke"
    >
      {text}
    </text>
  );
}

function PointLoad({ x, down, style }: { x: number; down: boolean; style: LoadStyle }) {
  // Vers le bas : flèche au-dessus de la poutre, pointe sur la poutre.
  // Vers le haut : flèche sous la poutre, pointe sur la poutre.
  const tip = down ? Y - 3 : Y + 3;
  const tail = down ? Y - LOAD_H - 8 : Y + LOAD_H + 8;
  return (
    <g>
      <line
        x1={x}
        y1={tail}
        x2={x}
        y2={tip + (down ? -6 : 6)}
        stroke={style.color}
        strokeWidth={2.5}
      />
      <Head x={x} y={tip} angle={down ? Math.PI / 2 : -Math.PI / 2} color={style.color} />
      <Label x={x + 6} y={down ? tail + 4 : tail} text={style.label} />
    </g>
  );
}

function Couple({ x, trig, style }: { x: number; trig: boolean; style: LoadStyle }) {
  const r = 15;
  // Arc de 270° se terminant en bas ; sens trigonométrique à l'écran = balayage 0.
  const start = trig ? x + r : x - r;
  const d = `M${start} ${Y} A${r} ${r} 0 1 ${trig ? 0 : 1} ${x} ${Y + r}`;
  return (
    <g>
      <path d={d} fill="none" stroke={style.color} strokeWidth={2.5} />
      <Head x={x + (trig ? 5 : -5)} y={Y + r} angle={trig ? 0 : Math.PI} color={style.color} />
      <circle cx={x} cy={Y} r={2.5} fill={style.color} />
      <Label x={x + r + 4} y={Y - r} text={style.label} />
    </g>
  );
}

function Distributed({
  xa,
  xb,
  q1,
  q2,
  qMax,
  style,
  labelFraction,
}: {
  xa: number;
  xb: number;
  q1: number;
  q2: number;
  qMax: number;
  style: LoadStyle;
  labelFraction: number;
}) {
  // Charge vers le bas (q < 0 dans le moteur) dessinée au-dessus de la poutre.
  const h = (q: number) => (qMax === 0 ? 0 : (-q / qMax) * LOAD_H);
  const top = (x: number) => Y - 3 - h(q1 + ((q2 - q1) * (x - xa)) / (xb - xa));
  const base = Y - 3;
  const count = Math.max(2, Math.round((xb - xa) / 28) + 1);
  const arrows = Array.from({ length: count }, (_, i) => xa + ((xb - xa) * i) / (count - 1));
  const xl = xa + (xb - xa) * labelFraction;
  return (
    <g>
      <path
        d={`M${xa} ${base} L${xa} ${top(xa)} L${xb} ${top(xb)} L${xb} ${base} Z`}
        fill={style.color}
        fillOpacity={0.1}
        stroke={style.color}
        strokeWidth={2}
      />
      {arrows.map((x) => {
        const y = top(x);
        const dy = base - y;
        if (Math.abs(dy) < 12) return null;
        // La pointe touche la poutre : au-dessus (charge vers le bas) ou en dessous (vers le haut).
        const tipY = dy > 0 ? base : Y + 3;
        return (
          <g key={x}>
            <line
              x1={x}
              y1={y + (dy > 0 ? 0 : 6)}
              x2={x}
              y2={tipY + (dy > 0 ? -6 : 6)}
              stroke={style.color}
              strokeWidth={1.25}
            />
            <Head x={x} y={tipY} angle={dy > 0 ? Math.PI / 2 : -Math.PI / 2} color={style.color} />
          </g>
        );
      })}
      <Label x={xl} y={Math.min(top(xl), base) - 6} text={style.label} anchor="middle" />
    </g>
  );
}

function Pin({ x, name }: { x: number; name: string }) {
  const y = Y + 3;
  return (
    <g>
      <path
        d={`M${x} ${y} L${x - 11} ${y + 18} L${x + 11} ${y + 18} Z`}
        fill="white"
        stroke={INK}
        strokeWidth={1.5}
      />
      <line x1={x - 16} y1={y + 22} x2={x + 16} y2={y + 22} stroke={INK} strokeWidth={1.5} />
      <text x={x} y={y + 40} fontSize={13} fontStyle="italic" fill={INK} textAnchor="middle">
        {name}
      </text>
    </g>
  );
}

function Wall({ x, left, name }: { x: number; left: boolean; name: string }) {
  const dir = left ? -1 : 1;
  const hatch = Array.from({ length: 7 }, (_, i) => Y - 30 + i * 10);
  return (
    <g>
      <line x1={x} y1={Y - 32} x2={x} y2={Y + 32} stroke={INK} strokeWidth={2.5} />
      {hatch.map((y) => (
        <line key={y} x1={x} y1={y} x2={x + dir * 9} y2={y + 8} stroke={INK} strokeWidth={1} />
      ))}
      <text
        x={x + dir * 18}
        y={Y + 48}
        fontSize={13}
        fontStyle="italic"
        fill={INK}
        textAnchor="middle"
      >
        {name}
      </text>
    </g>
  );
}

interface BeamDrawingProps {
  model: BeamModel;
  /** Étiquette et couleur de chaque charge, dans l'ordre de `model.loads`. */
  styles: readonly LoadStyle[];
}

/**
 * Schéma de la poutre : appuis (A, B… dans l'ordre de la liste), charges colorées et
 * numérotées comme dans la liste de saisie, et repère. Les charges sont dessinées dans
 * leur sens réel ; leur hauteur n'est proportionnelle à l'intensité que pour les charges
 * réparties entre elles.
 */
export function BeamDrawing({ model, styles }: BeamDrawingProps) {
  const L = model.length_m;
  const sx = (x_m: number) => X0 + (x_m / L) * (X1 - X0);
  const qMax = model.loads.reduce(
    (max, l) =>
      l.kind === 'repartie' ? Math.max(max, Math.abs(l.q1_N_m), Math.abs(l.q2_N_m)) : max,
    0,
  );

  // Rang de chaque charge répartie parmi les charges réparties (position de son étiquette).
  const distributedRank = model.loads.map(
    (_, i) => model.loads.slice(0, i).filter((m) => m.kind === 'repartie').length,
  );
  const drawLoad = (load: Load, i: number) => {
    const style = styles[i] ?? { label: `${i + 1}`, color: MUTED };
    switch (load.kind) {
      case 'ponctuelle':
        return <PointLoad key={i} x={sx(load.x_m)} down={load.Fz_N <= 0} style={style} />;
      case 'couple':
        return <Couple key={i} x={sx(load.x_m)} trig={load.C_Nm >= 0} style={style} />;
      case 'repartie': {
        const rank = distributedRank[i] ?? 0;
        const fraction = LABEL_FRACTIONS[rank % LABEL_FRACTIONS.length] ?? 0.5;
        return (
          <Distributed
            key={i}
            xa={sx(load.x1_m)}
            xb={sx(load.x2_m)}
            q1={load.q1_N_m}
            q2={load.q2_N_m}
            qMax={qMax}
            style={style}
            labelFraction={fraction}
          />
        );
      }
    }
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Schéma de la poutre : ${model.supports.length} appui(s), ${model.loads.length} charge(s)`}
    >
      {/* Repère : x vers la droite, z vers le haut */}
      <g stroke={MUTED} strokeWidth={1} fill={MUTED}>
        <line x1={12} y1={H - 14} x2={36} y2={H - 14} />
        <line x1={12} y1={H - 14} x2={12} y2={H - 38} />
      </g>
      <Head x={38} y={H - 14} angle={0} color={MUTED} />
      <Head x={12} y={H - 40} angle={-Math.PI / 2} color={MUTED} />
      <text x={40} y={H - 4} fontSize={11} fontStyle="italic" fill={MUTED}>
        x
      </text>
      <text x={17} y={H - 34} fontSize={11} fontStyle="italic" fill={MUTED}>
        z
      </text>

      {model.supports.map((s, i) =>
        s.kind === 'appui' ? (
          <Pin key={i} x={sx(s.x_m)} name={supportName(i)} />
        ) : (
          <Wall key={i} x={sx(s.x_m)} left={s.x_m <= L / 2} name={supportName(i)} />
        ),
      )}
      <line x1={X0} y1={Y} x2={X1} y2={Y} stroke={INK} strokeWidth={6} strokeLinecap="butt" />
      {model.loads.map(drawLoad)}
    </svg>
  );
}
