/**
 * Propriétés d'une section composée de rectangles (axes parallèles aux côtés).
 *
 * CONVENTION D'AXES (EN 1993-1-1 §1.7) : section dans le plan (y, z), y horizontal,
 * z vertical vers le haut, x le long de la poutre. Iy = ∫ z² dA (flexion autour de y,
 * axe « fort » des profilés en I), Iz = ∫ y² dA, Iyz = ∫ y z dA (axes centraux).
 * Les coordonnées des rectangles sont mesurées depuis le coin inférieur gauche
 * de la boîte englobante de la section. Unités SI (m, m², m³, m⁴).
 *
 * Hypothèses : rectangles sans recouvrement ; géométrie exacte de cette
 * décomposition (les congés de raccordement des profilés laminés sont ignorés).
 */

export interface Rect {
  /** Abscisses (horizontal) du rectangle, y0 < y1. */
  y0: number;
  y1: number;
  /** Cotes (vertical) du rectangle, z0 < z1. */
  z0: number;
  z1: number;
}

export interface PrincipalAxes {
  /** Moment quadratique maximal (axe principal u). */
  Iu_m4: number;
  /** Moment quadratique minimal (axe principal v). */
  Iv_m4: number;
  /** Angle de l'axe u par rapport à l'axe y, sens trigonométrique, dans ]-π/2, π/2]. */
  alpha_rad: number;
}

export interface CompositeProperties {
  A_m2: number;
  /** Centre de gravité, depuis le coin inférieur gauche de la boîte englobante. */
  yG_m: number;
  zG_m: number;
  width_m: number;
  height_m: number;
  Iy_m4: number;
  Iz_m4: number;
  /** Produit d'inertie central ∫(y−yG)(z−zG) dA ; nul si la section a un axe de symétrie. */
  Iyz_m4: number;
  /** Module élastique minimal (fibre la plus éloignée) : Wel = I / v_max. */
  Wel_y_m3: number;
  Wel_z_m3: number;
  /** Module plastique autour de l'axe neutre plastique (aire coupée en deux moitiés égales). */
  Wpl_y_m3: number;
  Wpl_z_m3: number;
  principal: PrincipalAxes;
}

const area = (r: Rect) => (r.y1 - r.y0) * (r.z1 - r.z0);

/**
 * Axes principaux d'inertie.
 *
 * Formules (cercle de Mohr des moments quadratiques) :
 *   Iu,v = (Iy + Iz)/2 ± √[((Iy − Iz)/2)² + Iyz²]
 *   α = ½ · atan2(−2 Iyz, Iy − Iz)   (angle de y vers u, u = axe de Iu maximal)
 * Source : Timoshenko & Gere, *Mechanics of Materials* (moments d'inertie, axes
 * principaux) ; Roark 8e éd., chap. 2 (propriétés des sections planes).
 * TODO: à vérifier — numéros de paragraphe.
 */
export function principalAxes(Iy: number, Iz: number, Iyz: number): PrincipalAxes {
  const mean = (Iy + Iz) / 2;
  const radius = Math.hypot((Iy - Iz) / 2, Iyz);
  let alpha = radius === 0 ? 0 : Math.atan2(-2 * Iyz, Iy - Iz) / 2;
  // Ramène l'angle dans ]-π/2, π/2] (un axe n'a pas de sens) et supprime le « -0 ».
  if (alpha <= -Math.PI / 2) alpha += Math.PI;
  return {
    Iu_m4: mean + radius,
    Iv_m4: mean - radius,
    alpha_rad: alpha === 0 ? 0 : alpha,
  };
}

/** Aire des rectangles située sous la cote `c` (selon l'axe choisi). */
function areaBelow(rects: readonly Rect[], c: number, axis: 'y' | 'z'): number {
  let a = 0;
  for (const r of rects) {
    const [lo, hi, w] = axis === 'z' ? [r.z0, r.z1, r.y1 - r.y0] : [r.y0, r.y1, r.z1 - r.z0];
    a += w * Math.min(Math.max(c - lo, 0), hi - lo);
  }
  return a;
}

/**
 * Module plastique autour d'un axe parallèle à y (axis = 'z' : distances en z) ou à z.
 *
 * Formule : Wpl = ∫ |d − dp| dA, où dp est la position de l'axe neutre plastique
 * qui partage l'aire en deux moitiés égales (matériau élastique parfaitement
 * plastique, même limite en traction et en compression).
 * Source : EN 1993-1-1 §6.2.5 (moment résistant plastique) ; Timoshenko & Gere
 * (flexion plastique). Position de dp obtenue par dichotomie (fonction monotone).
 */
function plasticModulus(rects: readonly Rect[], axis: 'y' | 'z', A: number): number {
  let lo = Math.min(...rects.map((r) => (axis === 'z' ? r.z0 : r.y0)));
  let hi = Math.max(...rects.map((r) => (axis === 'z' ? r.z1 : r.y1)));
  for (let k = 0; k < 200 && hi - lo > 0; k += 1) {
    const mid = (lo + hi) / 2;
    if (areaBelow(rects, mid, axis) < A / 2) lo = mid;
    else hi = mid;
  }
  const dp = (lo + hi) / 2;
  let W = 0;
  for (const r of rects) {
    const [a0, a1, w] = axis === 'z' ? [r.z0, r.z1, r.y1 - r.y0] : [r.y0, r.y1, r.z1 - r.z0];
    for (const [p0, p1] of [
      [a0, Math.min(a1, dp)],
      [Math.max(a0, dp), a1],
    ] as const) {
      if (p1 > p0) W += w * (p1 - p0) * Math.abs((p0 + p1) / 2 - dp);
    }
  }
  return W;
}

/**
 * Propriétés d'une section composée de rectangles.
 *
 * Formules :
 *   A = Σ Aᵢ ;  yG = Σ Aᵢ yᵢ / A ;  zG = Σ Aᵢ zᵢ / A
 *   Iy = Σ [bᵢ hᵢ³/12 + Aᵢ (zᵢ − zG)²]  (théorème de Huygens)
 *   Iz = Σ [hᵢ bᵢ³/12 + Aᵢ (yᵢ − yG)²]
 *   Iyz = Σ Aᵢ (yᵢ − yG)(zᵢ − zG)   (produit propre d'un rectangle nul)
 *   Wel,y = Iy / max(zG, h − zG) ;  Wel,z = Iz / max(yG, b − yG)
 * Source : Roark 8e éd., chap. 2 et annexe des propriétés des sections planes ;
 * Timoshenko & Gere, *Mechanics of Materials*. TODO: à vérifier — n° de tableau Roark.
 *
 * @throws RangeError si la liste est vide ou contient un rectangle dégénéré.
 */
export function compositeProperties(rects: readonly Rect[]): CompositeProperties {
  if (rects.length === 0) throw new RangeError('Section vide.');
  for (const r of rects) {
    const ok = [r.y0, r.y1, r.z0, r.z1].every(Number.isFinite) && r.y1 > r.y0 && r.z1 > r.z0;
    if (!ok) throw new RangeError('Rectangle dégénéré dans la décomposition de la section.');
  }

  const yMin = Math.min(...rects.map((r) => r.y0));
  const zMin = Math.min(...rects.map((r) => r.z0));
  const width = Math.max(...rects.map((r) => r.y1)) - yMin;
  const height = Math.max(...rects.map((r) => r.z1)) - zMin;

  const A = rects.reduce((s, r) => s + area(r), 0);
  const yG = rects.reduce((s, r) => s + area(r) * ((r.y0 + r.y1) / 2), 0) / A - yMin;
  const zG = rects.reduce((s, r) => s + area(r) * ((r.z0 + r.z1) / 2), 0) / A - zMin;

  let Iy = 0;
  let Iz = 0;
  let Iyz = 0;
  for (const r of rects) {
    const b = r.y1 - r.y0;
    const h = r.z1 - r.z0;
    const dy = (r.y0 + r.y1) / 2 - yMin - yG;
    const dz = (r.z0 + r.z1) / 2 - zMin - zG;
    Iy += (b * h ** 3) / 12 + b * h * dz ** 2;
    Iz += (h * b ** 3) / 12 + b * h * dy ** 2;
    Iyz += b * h * dy * dz;
  }

  return {
    A_m2: A,
    yG_m: yG,
    zG_m: zG,
    width_m: width,
    height_m: height,
    Iy_m4: Iy,
    Iz_m4: Iz,
    Iyz_m4: Iyz,
    Wel_y_m3: Iy / Math.max(zG, height - zG),
    Wel_z_m3: Iz / Math.max(yG, width - yG),
    Wpl_y_m3: plasticModulus(rects, 'z', A),
    Wpl_z_m3: plasticModulus(rects, 'y', A),
    principal: principalAxes(Iy, Iz, Iyz),
  };
}
