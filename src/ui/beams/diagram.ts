/**
 * Géométrie des diagrammes (fonctions pures, testables sans navigateur) :
 * graduations « rondes », échelles linéaires et tracé d'une courbe en chemin SVG.
 */

/**
 * Graduations régulières couvrant [min, max], de pas 1, 2 ou 5 × 10ⁿ, zéro inclus
 * quand l'intervalle le contient. Renvoie au moins deux valeurs.
 *
 * @param target nombre de graduations souhaité (ordre de grandeur).
 */
export function niceTicks(min: number, max: number, target = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);
  if (hi - lo <= Math.abs(hi) * 1e-12) {
    // Intervalle dégénéré (courbe constante) : on l’étend jusqu’à zéro, ou à [0, 1] si tout est nul.
    if (hi > 0) lo = 0;
    else if (lo < 0) hi = 0;
    else hi = 1;
  }
  const raw = (hi - lo) / Math.max(1, target);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const ratio = raw / pow;
  const step = (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10) * pow;
  const first = Math.floor(lo / step + 1e-9);
  const last = Math.ceil(hi / step - 1e-9);
  const ticks: number[] = [];
  for (let i = first; i <= last; i++) {
    // Arrondi sur la grille du pas pour éviter 0,30000000000000004.
    ticks.push(Number((i * step).toPrecision(12)) + 0);
  }
  return ticks;
}

/** Échelle linéaire d'un domaine [d0, d1] vers un intervalle d'écran [r0, r1]. */
export function linearScale(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  const span = d1 - d0;
  return span === 0 ? () => (r0 + r1) / 2 : (v) => r0 + ((v - d0) / span) * (r1 - r0);
}

export interface Point {
  x: number;
  y: number;
}

const f = (v: number) => (Math.round(v * 100) / 100).toString();

/** Chemin SVG de la ligne brisée passant par les points (coordonnées d'écran). */
export function linePath(points: readonly Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${f(p.x)} ${f(p.y)}`).join(' ');
}

/** Chemin SVG fermé entre la courbe et la ligne de base `y0` (aire remplie). */
export function areaPath(points: readonly Point[], y0: number): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return '';
  return `M${f(first.x)} ${f(y0)} ${points.map((p) => `L${f(p.x)} ${f(p.y)}`).join(' ')} L${f(last.x)} ${f(y0)} Z`;
}
