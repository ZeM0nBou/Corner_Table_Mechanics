/**
 * Géométrie du schéma des efforts de la page Contraintes (fonctions pures, testables).
 *
 * FACETTE DESSINÉE : la coupe vue de face est la facette de normale sortante +x de la partie
 * GAUCHE de la barre ; les efforts dessinés sont les actions de la partie droite sur elle.
 * Conventions de signe (identiques à `@core/beams/model.ts` et `@core/stress/combined.ts`) :
 * - N > 0 en traction : force selon +x (elle sort de la facette) ;
 * - My > 0 tend la fibre inférieure : sur cette facette, ∫σ·z dA = −My, donc le vecteur moment
 *   est selon −y ;
 * - Vz : V = somme des forces selon +z appliquées à gauche de la coupe (page Poutres) ; par
 *   équilibre de la partie gauche, la force sur la facette vaut −Vz, donc vers le BAS si Vz > 0 ;
 * - T > 0 : vecteur moment selon +x sur cette facette (règle de la main droite).
 * Le moteur de contraintes n'utilise que |Vz| et |T| : leur signe ne sert qu'au dessin.
 *
 * Projection cavalière : y vers la droite, z vers le haut (vraie grandeur dans le plan de la
 * coupe) ; x, qui pointe vers l'observateur, est dessiné en oblique vers le bas à gauche.
 */
import type { SectionEfforts } from '@core/stress';

export type Vec3 = readonly [x: number, y: number, z: number];
export interface Pt {
  x: number;
  y: number;
}

/** Angle (rad) et réduction de l'axe x fuyant de la projection cavalière. */
const OBLIQUE_ANGLE = Math.PI / 6;
const OBLIQUE_SCALE = 0.5;

/**
 * Point de l'écran (SVG, ordonnée vers le bas) d'un point (x, y, z) de l'espace, en px depuis G.
 * @param s échelle en px par unité de longueur.
 */
export function project([x, y, z]: Vec3, s: number): Pt {
  return {
    x: s * (y - OBLIQUE_SCALE * Math.cos(OBLIQUE_ANGLE) * x),
    y: s * (-z + OBLIQUE_SCALE * Math.sin(OBLIQUE_ANGLE) * x),
  };
}

export type Axis = 'x' | 'y' | 'z';

/** Force (N, Vz) ou moment (My, T) dessiné sur la facette. */
export interface EffortArrow {
  key: 'N' | 'Vz' | 'My' | 'T';
  kind: 'force' | 'moment';
  axis: Axis;
  /** Sens selon l'axe : +1 ou −1 (vecteur force ou vecteur moment). */
  sign: 1 | -1;
}

const sgn = (v: number): 1 | -1 => (v > 0 ? 1 : -1);

/**
 * Flèches à dessiner sur la facette de normale +x (voir l'en-tête pour les conventions).
 * Un effort nul (ou non fini) n'est pas dessiné.
 */
export function effortArrows(e: SectionEfforts): EffortArrow[] {
  const arrows: EffortArrow[] = [];
  const keep = (v: number) => Number.isFinite(v) && v !== 0;
  if (keep(e.N_N)) arrows.push({ key: 'N', kind: 'force', axis: 'x', sign: sgn(e.N_N) });
  if (keep(e.Vz_N)) arrows.push({ key: 'Vz', kind: 'force', axis: 'z', sign: sgn(-e.Vz_N) });
  if (keep(e.My_Nm)) arrows.push({ key: 'My', kind: 'moment', axis: 'y', sign: sgn(-e.My_Nm) });
  if (keep(e.T_Nm)) arrows.push({ key: 'T', kind: 'moment', axis: 'x', sign: sgn(e.T_Nm) });
  return arrows;
}

const UNIT: Record<Axis, Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

/**
 * Base (u, v) du plan perpendiculaire à l'axe, telle que (u, v, axe) soit directe :
 * u × v = axe. Une rotation positive autour de l'axe va de u vers v.
 */
export function rotationBasis(axis: Axis): [u: Vec3, v: Vec3] {
  switch (axis) {
    case 'x':
      return [UNIT.y, UNIT.z];
    case 'y':
      return [UNIT.z, UNIT.x];
    case 'z':
      return [UNIT.x, UNIT.y];
  }
}

/**
 * Points d'un arc de cercle (dans l'espace) autour de `axis`, centré en `center`, de rayon r,
 * parcouru dans le sens de la rotation `sign` (règle de la main droite) ; la flèche se place
 * au dernier point. L'arc couvre 270° à partir de `start` (rad, mesuré de u vers v).
 */
export function rotationArc(
  axis: Axis,
  sign: 1 | -1,
  center: Vec3,
  r: number,
  start = 0,
  steps = 36,
): Vec3[] {
  const [u, v] = rotationBasis(axis);
  const span = 1.5 * Math.PI;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const phi = start + sign * span * (i / steps);
    const c = Math.cos(phi) * r;
    const s = Math.sin(phi) * r;
    return [
      center[0] + c * u[0] + s * v[0],
      center[1] + c * u[1] + s * v[1],
      center[2] + c * u[2] + s * v[2],
    ] as const;
  });
}
