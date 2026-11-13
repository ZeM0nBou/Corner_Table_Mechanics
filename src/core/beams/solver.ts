/**
 * Résolution d'une poutre droite : réactions, effort tranchant, moment fléchissant,
 * rotation et flèche, par les fonctions de singularité (méthode de Macaulay).
 *
 * Conventions de signe : voir `model.ts` (forces et flèche positives vers le haut,
 * couples positifs dans le sens trigonométrique, M > 0 fibre inférieure tendue,
 * dV/dx = q, dM/dx = V, EI·w″ = M).
 *
 * MÉTHODE
 * Chaque action (charge ou réaction) est un terme c·⟨x − a⟩ⁿ de la charge répartie
 * q(x), avec ⟨x − a⟩ⁿ = (x − a)ⁿ si x > a et 0 sinon :
 *   - force ponctuelle F en a           : n = −1, c = F ;
 *   - couple trigonométrique C en a     : n = −2, c = −C (il fait sauter M de −C) ;
 *   - charge linéaire de q1 à q2 sur [x1, x2], de pente s = (q2 − q1)/(x2 − x1) :
 *       q1⟨x − x1⟩⁰ + s⟨x − x1⟩¹ − q2⟨x − x2⟩⁰ − s⟨x − x2⟩¹.
 * Les intégrations successives sont exactes : ∫⟨x − a⟩ⁿ dx = ⟨x − a⟩ⁿ⁺¹/(n + 1) pour
 * n ≥ 0 et ⟨x − a⟩ⁿ⁺¹ pour n < 0. D'où, avec k le nombre d'intégrations
 * (1 : V, 2 : M, 3 : EI·θ, 4 : EI·w) : contribution = c·⟨x − a⟩ⁿ⁺ᵏ/(n + k)!.
 *   V(x)    = Σ termes (k = 1)
 *   M(x)    = Σ termes (k = 2)
 *   EI·θ(x) = Σ termes (k = 3) + EI·θ₀
 *   EI·w(x) = Σ termes (k = 4) + EI·θ₀·x + EI·w₀
 * Inconnues : les r réactions et les deux constantes EI·θ₀, EI·w₀. Équations : équilibre
 * (V(L⁺) = 0, M(L⁺) = 0) et conditions cinématiques (w = 0 par appui, w = 0 et θ = 0 par
 * encastrement), soit un système linéaire (r + 2) × (r + 2), identique en isostatique
 * et en hyperstatique. EI étant constant, il n'intervient pas dans le système.
 *
 * Sources : W. H. Macaulay, « A note on the deflection of beams », Messenger of
 * Mathematics, vol. 48, 1919 ; Hibbeler, Mechanics of Materials, chap. « Deflection of
 * Beams and Shafts », § « Discontinuity Functions » ; Gere & Goodno, Mechanics of
 * Materials, chap. « Deflections of Beams ». TODO: à vérifier — n° de paragraphes.
 */
import {
  BeamModelError,
  classifyBeam,
  validateBeamModel,
  type BeamModel,
  type BeamStaticity,
  type Support,
} from './model';

/** Terme c·⟨x − a⟩ⁿ de la charge répartie q(x) ; n = −1 : force, n = −2 : couple. */
export interface SingularityTerm {
  a_m: number;
  n: -2 | -1 | 0 | 1;
  /** Coefficient en unités SI (N·m pour n = −2, N pour −1, N/m pour 0, N/m² pour 1). */
  c: number;
}

export interface BeamReaction {
  kind: Support['kind'];
  x_m: number;
  /** Force exercée par l'appui sur la poutre, positive vers le haut. */
  Fz_N: number;
  /** Couple exercé par l'encastrement sur la poutre, positif dans le sens trigonométrique. */
  C_Nm?: number;
}

/** Solution d'une poutre : données pures, exploitées par `shear_N`, `moment_Nm`, etc. */
export interface BeamSolution {
  length_m: number;
  EI_Nm2: number | undefined;
  supports: readonly Support[];
  staticity: BeamStaticity;
  reactions: BeamReaction[];
  /** Termes des charges appliquées. */
  loadTerms: SingularityTerm[];
  /** Termes des réactions d'appui. */
  reactionTerms: SingularityTerm[];
  /** Constantes d'intégration : EI·θ(0) en N·m² et EI·w(0) en N·m³. */
  EItheta0_Nm2: number;
  EIw0_Nm3: number;
  /** Résidus d'équilibre de la solution (≈ 0) : somme des forces et des moments en x = L. */
  residualForce_N: number;
  residualMoment_Nm: number;
}

/** Côté d'évaluation à une discontinuité (force ponctuelle pour V, couple pour M). */
export type Side = 'gauche' | 'droite';

export interface SolveOptions {
  /** Accepte les poutres hyperstatiques (refusées par défaut à l'étape 4). */
  allowHyperstatic?: boolean;
}

const FACTORIAL = [1, 1, 2, 6, 24, 120] as const;

/**
 * Valeur de ⟨d⟩ᵐ/m! : 0 si m < 0 (impulsions, nulles hors de leur point d'application) ;
 * échelon si m = 0 (le côté tranche en d = 0) ; dᵐ/m! pour d > 0 sinon.
 */
function macaulay(d: number, m: number, side: Side): number {
  if (m < 0) return 0;
  if (m === 0) return d > 0 || (d === 0 && side === 'droite') ? 1 : 0;
  return d > 0 ? d ** m / (FACTORIAL[m] ?? NaN) : 0;
}

function sumTerms(terms: readonly SingularityTerm[], k: number, x_m: number, side: Side): number {
  let sum = 0;
  for (const t of terms) sum += t.c * macaulay(x_m - t.a_m, t.n + k, side);
  return sum;
}

/** Traduit les charges du modèle en termes de singularité (voir l'en-tête du module). */
export function loadTerms(model: Pick<BeamModel, 'loads'>): SingularityTerm[] {
  const terms: SingularityTerm[] = [];
  for (const load of model.loads) {
    switch (load.kind) {
      case 'ponctuelle':
        terms.push({ a_m: load.x_m, n: -1, c: load.Fz_N });
        break;
      case 'couple':
        terms.push({ a_m: load.x_m, n: -2, c: -load.C_Nm });
        break;
      case 'repartie': {
        const slope = (load.q2_N_m - load.q1_N_m) / (load.x2_m - load.x1_m);
        terms.push(
          { a_m: load.x1_m, n: 0, c: load.q1_N_m },
          { a_m: load.x1_m, n: 1, c: slope },
          { a_m: load.x2_m, n: 0, c: -load.q2_N_m },
          { a_m: load.x2_m, n: 1, c: -slope },
        );
        break;
      }
    }
  }
  return terms;
}

/**
 * Résout A·x = b par élimination de Gauss à pivot partiel (A est modifiée).
 * Renvoie `null` si la matrice est singulière (pivot inférieur à 1e-12 en relatif).
 * Source : Golub & Van Loan, Matrix Computations, élimination de Gauss avec pivot partiel.
 */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const scale = Math.max(...A.flat().map(Math.abs), Number.MIN_VALUE);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row]?.[col] ?? 0) > Math.abs(A[pivot]?.[col] ?? 0)) pivot = row;
    }
    const pivotRow = A[pivot];
    const current = A[col];
    if (!pivotRow || !current) return null;
    A[col] = pivotRow;
    A[pivot] = current;
    const bPivot = b[pivot] ?? 0;
    b[pivot] = b[col] ?? 0;
    b[col] = bPivot;
    const p = pivotRow[col] ?? 0;
    if (Math.abs(p) < 1e-12 * scale) return null;
    for (let row = col + 1; row < n; row++) {
      const r = A[row];
      if (!r) return null;
      const f = (r[col] ?? 0) / p;
      if (f === 0) continue;
      for (let j = col; j < n; j++) r[j] = (r[j] ?? 0) - f * (pivotRow[j] ?? 0);
      b[row] = (b[row] ?? 0) - f * bPivot;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    const r = A[row];
    if (!r) return null;
    let s = b[row] ?? 0;
    for (let j = row + 1; j < n; j++) s -= (r[j] ?? 0) * (x[j] ?? 0);
    x[row] = s / (r[row] ?? NaN);
  }
  return x;
}

/**
 * Calcule les réactions et les constantes d'intégration d'une poutre.
 *
 * Formules : V(L⁺) = 0, M(L⁺) = 0 (équilibre), w = 0 à chaque appui, w = 0 et θ = 0 à
 * chaque encastrement, avec V, M, θ, w écrits en fonctions de singularité (en-tête du module).
 * Le système est adimensionné (longueurs divisées par L) pour rester bien conditionné.
 * Source : méthode de Macaulay (références en tête de module).
 * Hypothèses et limites : Euler-Bernoulli, EI constant, petites déformations ; lève une
 * `BeamModelError` si les données sont invalides, si la poutre est un mécanisme, ou si
 * elle est hyperstatique sans `allowHyperstatic`.
 */
export function solveBeam(model: BeamModel, options: SolveOptions = {}): BeamSolution {
  validateBeamModel(model);
  const staticity = classifyBeam(model);
  if (staticity.kind === 'mecanisme') {
    throw new BeamModelError(
      'La poutre n’est pas maintenue (mécanisme) : il faut un encastrement ou deux appuis.',
    );
  }
  if (staticity.kind === 'hyperstatique' && options.allowHyperstatic !== true) {
    throw new BeamModelError(
      `La poutre est hyperstatique de degré ${staticity.degree} : seules les poutres isostatiques sont traitées ici.`,
    );
  }

  const L = model.length_m;
  const applied = loadTerms(model);

  // Inconnues (toutes homogènes à une force) : pour chaque appui sa force R, pour chaque
  // encastrement en plus C/L, puis EI·θ₀/L² et EI·w₀/L³.
  type Unknown = { support: Support; couple: boolean };
  const unknowns: Unknown[] = [];
  for (const support of model.supports) {
    unknowns.push({ support, couple: false });
    if (support.kind === 'encastrement') unknowns.push({ support, couple: true });
  }
  const r = unknowns.length;
  const n = r + 2;
  const iTheta = r;
  const iW = r + 1;

  /** Contribution d'une réaction unitaire au niveau k, en x, divisée par L^(k−1). */
  const unit = (u: Unknown, k: number, x_m: number): number => {
    const d = x_m - u.support.x_m;
    // Force unitaire : ⟨d⟩^(k−1)/(k−1)! ; couple unitaire C/L = 1 : −L·⟨d⟩^(k−2)/(k−2)!.
    const raw = u.couple ? -L * macaulay(d, k - 2, 'droite') : macaulay(d, k - 1, 'droite');
    return raw / L ** (k - 1);
  };

  const A: number[][] = [];
  const b: number[] = [];
  const row = (k: number, x_m: number, thetaCoef: number, wCoef: number): void => {
    const line = unknowns.map((u) => unit(u, k, x_m));
    line[iTheta] = thetaCoef;
    line[iW] = wCoef;
    A.push(line);
    b.push(-sumTerms(applied, k, x_m, 'droite') / L ** (k - 1));
  };

  row(1, L, 0, 0); // ΣFz = 0, soit V(L⁺) = 0
  row(2, L, 0, 0); // ΣM = 0, soit M(L⁺) = 0
  for (const support of model.supports) {
    row(4, support.x_m, support.x_m / L, 1); // w = 0
    if (support.kind === 'encastrement') row(3, support.x_m, 1, 0); // θ = 0
  }

  const x = solveLinear(A, b);
  if (!x || x.length !== n || x.some((v) => !Number.isFinite(v))) {
    throw new BeamModelError('La poutre n’est pas maintenue (mécanisme) : appuis insuffisants.');
  }

  const reactions: BeamReaction[] = [];
  const reactionTerms: SingularityTerm[] = [];
  unknowns.forEach((u, i) => {
    const value = (x[i] ?? 0) + 0; // « + 0 » : évite un −0 affiché « -0 »
    if (u.couple) {
      const C_Nm = value * L;
      const last = reactions[reactions.length - 1];
      if (last) last.C_Nm = C_Nm;
      reactionTerms.push({ a_m: u.support.x_m, n: -2, c: -C_Nm });
    } else {
      reactions.push({ kind: u.support.kind, x_m: u.support.x_m, Fz_N: value });
      reactionTerms.push({ a_m: u.support.x_m, n: -1, c: value });
    }
  });

  const all = [...applied, ...reactionTerms];
  return {
    length_m: L,
    EI_Nm2: model.EI_Nm2,
    supports: model.supports.map((s) => ({ ...s })),
    staticity,
    reactions,
    loadTerms: applied,
    reactionTerms,
    EItheta0_Nm2: (x[iTheta] ?? 0) * L ** 2,
    EIw0_Nm3: (x[iW] ?? 0) * L ** 3,
    residualForce_N: sumTerms(all, 1, L, 'droite'),
    residualMoment_Nm: sumTerms(all, 2, L, 'droite'),
  };
}

function allTerms(solution: BeamSolution): SingularityTerm[] {
  return [...solution.loadTerms, ...solution.reactionTerms];
}

function requireEI(solution: BeamSolution): number {
  if (solution.EI_Nm2 === undefined) {
    throw new BeamModelError(
      'La rigidité EI est nécessaire pour calculer la rotation et la flèche.',
    );
  }
  return solution.EI_Nm2;
}

/**
 * Charge répartie q(x) en N/m (positive vers le haut), hors forces et couples ponctuels.
 * Formule : q(x) = Σ c·⟨x − a⟩ⁿ pour les termes n ≥ 0. Source : en-tête du module.
 */
export function distributedLoad_N_m(
  solution: BeamSolution,
  x_m: number,
  side: Side = 'droite',
): number {
  return sumTerms(allTerms(solution), 0, x_m, side);
}

/**
 * Effort tranchant V(x) en N : somme des forces vers le haut à gauche de la coupe.
 * Formule : V(x) = Σ c·⟨x − a⟩ⁿ⁺¹/(n + 1)!. Source : méthode de Macaulay (en-tête du module).
 * À l'aplomb d'une force ponctuelle, `side` choisit la valeur juste à gauche ou juste à droite.
 */
export function shear_N(solution: BeamSolution, x_m: number, side: Side = 'droite'): number {
  return sumTerms(allTerms(solution), 1, x_m, side);
}

/**
 * Moment fléchissant M(x) en N·m, positif quand la fibre inférieure est tendue.
 * Formule : M(x) = Σ c·⟨x − a⟩ⁿ⁺²/(n + 2)!. Source : méthode de Macaulay (en-tête du module).
 * À l'aplomb d'un couple ponctuel, `side` choisit la valeur juste à gauche ou juste à droite.
 */
export function moment_Nm(solution: BeamSolution, x_m: number, side: Side = 'droite'): number {
  return sumTerms(allTerms(solution), 2, x_m, side);
}

/**
 * Rotation θ(x) = dw/dx en rad, positive dans le sens trigonométrique.
 * Formule : EI·θ(x) = Σ c·⟨x − a⟩ⁿ⁺³/(n + 3)! + EI·θ₀. Source : méthode de Macaulay.
 * Limites : Euler-Bernoulli, petites rotations ; lève une erreur si EI n'est pas fourni.
 */
export function slope_rad(solution: BeamSolution, x_m: number): number {
  const EI = requireEI(solution);
  return (sumTerms(allTerms(solution), 3, x_m, 'droite') + solution.EItheta0_Nm2) / EI;
}

/**
 * Flèche w(x) en m, positive vers le haut.
 * Formule : EI·w(x) = Σ c·⟨x − a⟩ⁿ⁺⁴/(n + 4)! + EI·θ₀·x + EI·w₀. Source : méthode de Macaulay.
 * Limites : Euler-Bernoulli (pas de flèche d'effort tranchant), petites déformations ;
 * lève une erreur si EI n'est pas fourni.
 */
export function deflection_m(solution: BeamSolution, x_m: number): number {
  const EI = requireEI(solution);
  return (
    (sumTerms(allTerms(solution), 4, x_m, 'droite') +
      solution.EItheta0_Nm2 * x_m +
      solution.EIw0_Nm3) /
    EI
  );
}

/**
 * Combinaison linéaire de solutions d'une même poutre (superposition de cas de charge).
 *
 * Formule : S = Σ λᵢ·Sᵢ, appliquée aux réactions, aux termes de singularité et aux
 * constantes d'intégration.
 * Source : principe de superposition, valable car le problème est linéaire (élasticité
 * linéaire, petites déformations) — Gere & Goodno, Mechanics of Materials, § « Method of
 * Superposition ». TODO: à vérifier — n° de paragraphe.
 * Limites : toutes les solutions doivent partager la même longueur, la même rigidité EI
 * et les mêmes appuis, sinon une `BeamModelError` est levée.
 */
export function combineSolutions(
  cases: readonly { solution: BeamSolution; factor: number }[],
): BeamSolution {
  const first = cases[0]?.solution;
  if (!first) throw new BeamModelError('Aucun cas de charge à combiner.');
  const sameSupports = (s: BeamSolution) =>
    s.supports.length === first.supports.length &&
    s.supports.every((p, i) => {
      const q = first.supports[i];
      return q !== undefined && p.kind === q.kind && p.x_m === q.x_m;
    });
  for (const { solution, factor } of cases) {
    if (!Number.isFinite(factor)) throw new BeamModelError('Coefficient de combinaison non fini.');
    if (
      solution.length_m !== first.length_m ||
      solution.EI_Nm2 !== first.EI_Nm2 ||
      !sameSupports(solution)
    ) {
      throw new BeamModelError(
        'Les cas de charge à combiner doivent porter sur la même poutre (longueur, EI, appuis).',
      );
    }
  }
  const scale = (terms: readonly SingularityTerm[], f: number) =>
    terms.map((t) => ({ ...t, c: t.c * f }));
  const sum = (pick: (s: BeamSolution) => number) =>
    cases.reduce((acc, { solution, factor }) => acc + factor * pick(solution), 0);

  return {
    length_m: first.length_m,
    EI_Nm2: first.EI_Nm2,
    supports: first.supports,
    staticity: first.staticity,
    reactions: first.reactions.map((r, i) => ({
      kind: r.kind,
      x_m: r.x_m,
      Fz_N: sum((s) => s.reactions[i]?.Fz_N ?? 0),
      ...(r.C_Nm !== undefined && { C_Nm: sum((s) => s.reactions[i]?.C_Nm ?? 0) }),
    })),
    loadTerms: cases.flatMap(({ solution, factor }) => scale(solution.loadTerms, factor)),
    reactionTerms: cases.flatMap(({ solution, factor }) => scale(solution.reactionTerms, factor)),
    EItheta0_Nm2: sum((s) => s.EItheta0_Nm2),
    EIw0_Nm3: sum((s) => s.EIw0_Nm3),
    residualForce_N: sum((s) => s.residualForce_N),
    residualMoment_Nm: sum((s) => s.residualMoment_Nm),
  };
}
