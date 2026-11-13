/**
 * Exploitation d'une solution de poutre : tronçons, extremums de V, M, θ et w,
 * et échantillonnage pour les diagrammes.
 *
 * Conventions de signe : voir `model.ts`.
 */
import {
  deflection_m,
  distributedLoad_N_m,
  moment_Nm,
  shear_N,
  slope_rad,
  type BeamSolution,
  type Side,
} from './solver';

/** Valeur extrême d'une grandeur et abscisse où elle est atteinte. */
export interface Extremum {
  value: number;
  x_m: number;
}

export interface Range {
  min: Extremum;
  max: Extremum;
}

export interface BeamExtrema {
  shear_N: Range;
  moment_Nm: Range;
  /** Absents si EI n'est pas fourni. */
  slope_rad?: Range;
  deflection_m?: Range;
}

/** Point d'un diagramme. Aux discontinuités, deux points de même abscisse se suivent. */
export interface BeamSample {
  x_m: number;
  V_N: number;
  M_Nm: number;
  theta_rad?: number;
  w_m?: number;
}

/**
 * Abscisses triées qui délimitent les tronçons : extrémités, appuis et points
 * d'application ou bornes des charges. Entre deux abscisses consécutives, V, M, EI·θ
 * et EI·w sont des polynômes (de degré ≤ 2, 3, 4 et 5).
 */
export function breakpoints(solution: BeamSolution): number[] {
  const xs = [0, solution.length_m];
  for (const t of [...solution.loadTerms, ...solution.reactionTerms]) xs.push(t.a_m);
  xs.sort((a, b) => a - b);
  return xs.filter((x, i) => i === 0 || x !== xs[i - 1]);
}

/** Nombre de sous-intervalles par tronçon pour encadrer les racines. */
const ROOT_SUBDIVISIONS = 32;

/**
 * Racines de f sur ]a, b[ : encadrement par changement de signe sur 32 sous-intervalles,
 * puis dichotomie (60 itérations, soit la précision machine).
 * Limite : deux racines dans un même sous-intervalle (1/32 du tronçon) ne sont pas vues.
 */
function rootsBetween(f: (x: number) => number, a: number, b: number): number[] {
  const roots: number[] = [];
  const h = (b - a) / ROOT_SUBDIVISIONS;
  let x0 = a + h * 1e-9; // juste après la discontinuité éventuelle en a
  let f0 = f(x0);
  for (let i = 1; i <= ROOT_SUBDIVISIONS; i++) {
    const x1 = i === ROOT_SUBDIVISIONS ? b - h * 1e-9 : a + i * h;
    const f1 = f(x1);
    if (f0 === 0) {
      roots.push(x0);
    } else if (f0 * f1 < 0) {
      let lo = x0;
      let hi = x1;
      let flo = f0;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        const fm = f(mid);
        if (fm === 0) {
          lo = mid;
          hi = mid;
          break;
        }
        if (flo * fm < 0) {
          hi = mid;
        } else {
          lo = mid;
          flo = fm;
        }
      }
      roots.push((lo + hi) / 2);
    }
    x0 = x1;
    f0 = f1;
  }
  return roots;
}

function rangeOf(candidates: readonly Extremum[]): Range {
  let min = candidates[0] ?? { value: 0, x_m: 0 };
  let max = min;
  for (const c of candidates) {
    if (c.value < min.value) min = c;
    if (c.value > max.value) max = c;
  }
  return { min, max };
}

/**
 * Extremums de V, M, θ et w sur toute la poutre.
 *
 * Méthode : sur chaque tronçon, les extremums d'une grandeur sont à ses bornes (valeurs à
 * gauche et à droite) ou aux zéros de sa dérivée : dV/dx = q (charge linéaire : V est
 * comparé aux bornes et aux zéros de q), dM/dx = V, dθ/dx = M/EI, dw/dx = θ.
 * Les zéros sont trouvés par dichotomie (précision machine sur l'abscisse).
 * Source : relations différentielles de la poutre d'Euler-Bernoulli (en-tête de `model.ts`).
 * Limite : deux zéros distants de moins de 1/32 de tronçon peuvent être manqués.
 */
export function beamExtrema(solution: BeamSolution): BeamExtrema {
  const xs = breakpoints(solution);
  const hasEI = solution.EI_Nm2 !== undefined;
  const sides: Side[] = ['gauche', 'droite'];

  const V: Extremum[] = [];
  const M: Extremum[] = [];
  const theta: Extremum[] = [];
  const w: Extremum[] = [];

  for (const x of xs) {
    for (const side of sides) {
      V.push({ value: shear_N(solution, x, side), x_m: x });
      M.push({ value: moment_Nm(solution, x, side), x_m: x });
    }
    if (hasEI) {
      theta.push({ value: slope_rad(solution, x), x_m: x });
      w.push({ value: deflection_m(solution, x), x_m: x });
    }
  }

  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1] ?? 0;
    const b = xs[i] ?? 0;
    // Zéros de q (pente de V) : q est linéaire sur le tronçon, donc au plus un zéro.
    for (const x of rootsBetween((t) => distributedLoad_N_m(solution, t), a, b)) {
      V.push({ value: shear_N(solution, x), x_m: x });
    }
    for (const x of rootsBetween((t) => shear_N(solution, t), a, b)) {
      M.push({ value: moment_Nm(solution, x), x_m: x });
    }
    if (hasEI) {
      for (const x of rootsBetween((t) => moment_Nm(solution, t), a, b)) {
        theta.push({ value: slope_rad(solution, x), x_m: x });
      }
      for (const x of rootsBetween((t) => slope_rad(solution, t), a, b)) {
        w.push({ value: deflection_m(solution, x), x_m: x });
      }
    }
  }

  return {
    shear_N: rangeOf(V),
    moment_Nm: rangeOf(M),
    ...(hasEI && { slope_rad: rangeOf(theta), deflection_m: rangeOf(w) }),
  };
}

/**
 * Échantillonne V, M, θ et w pour tracer les diagrammes.
 *
 * Chaque tronçon reçoit un nombre de points proportionnel à sa longueur (au moins 2).
 * Ses bornes sont évaluées « côté tronçon », si bien qu'un saut de V (force ponctuelle)
 * ou de M (couple) apparaît comme deux points de même abscisse.
 *
 * @param totalPoints nombre approximatif de points sur la poutre (200 par défaut).
 */
export function sampleBeam(solution: BeamSolution, totalPoints = 200): BeamSample[] {
  if (!Number.isFinite(totalPoints) || totalPoints < 2) {
    throw new RangeError('Le nombre de points d’échantillonnage doit être au moins 2.');
  }
  const xs = breakpoints(solution);
  const hasEI = solution.EI_Nm2 !== undefined;
  const samples: BeamSample[] = [];
  const point = (x: number, side: Side): BeamSample => ({
    x_m: x,
    V_N: shear_N(solution, x, side),
    M_Nm: moment_Nm(solution, x, side),
    ...(hasEI && { theta_rad: slope_rad(solution, x), w_m: deflection_m(solution, x) }),
  });
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1] ?? 0;
    const b = xs[i] ?? 0;
    const n = Math.max(2, Math.ceil((totalPoints * (b - a)) / solution.length_m));
    samples.push(point(a, 'droite'));
    for (let j = 1; j < n; j++) samples.push(point(a + ((b - a) * j) / n, 'droite'));
    samples.push(point(b, 'gauche'));
  }
  return samples;
}
