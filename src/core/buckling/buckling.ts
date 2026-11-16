/**
 * Flambement d'une barre droite comprimée : charge critique d'Euler, parabole de Johnson
 * pour les barres peu élancées, longueurs de flambement usuelles.
 *
 * CONVENTIONS
 * - Effort de compression N saisi POSITIF (N > 0 = compression ; ce module ne traite que
 *   la compression).
 * - Longueur de flambement Lk = K · L. Élancement λ = Lk / i, i = √(I/A).
 * - Deux plans de flambement, chacun avec son K : autour de y et de z (axes de la section),
 *   ou autour des axes principaux u et v pour une section dont y et z ne le sont pas (cornière).
 *
 * Hypothèses : barre droite, prismatique, chargée dans l'axe (sans excentricité ni
 * défaut de rectitude), matériau élastique linéaire homogène isotrope, petites
 * déformations ; flambement par flexion seulement (pas de flambement par torsion ni par
 * flexion-torsion, qui peut gouverner pour les profils minces ouverts L, T, U).
 * Unités SI (N, m, Pa).
 */

/** Sources des formules de flambement (affichées avec les résultats dans l'UI). */
export const BUCKLING_SOURCES = {
  euler:
    'Charge critique d’Euler Ncr = π² E I / Lk² : Timoshenko & Gere, Theory of Elastic Stability, chap. 2 ; EN 1993-1-1 §6.3.1.2. TODO: à vérifier — n° de paragraphe.',
  lengths:
    'Longueurs de flambement théoriques Lk = K L (K = 2 ; 1 ; 0,7 ; 0,5) : Timoshenko & Gere, Theory of Elastic Stability, chap. 2. TODO: à vérifier — n° de paragraphe. Pour l’encastrée-articulée, la valeur exacte est K ≈ 0,699.',
  johnson:
    'Parabole de Johnson σcr = Re − (Re / (2π))² λ² / E pour λ < λc = π √(2E/Re) : Shigley’s Mechanical Engineering Design (colonnes de longueur intermédiaire). TODO: à vérifier — édition et n° d’équation.',
  slenderness: 'Élancement λ = Lk / i, rayon de giration i = √(I/A) (définition).',
  safety: 'Coefficient de sécurité vis-à-vis du flambement n = Ncr / N (définition).',
} as const;

/** Données invalides pour un calcul de flambement. */
export class BucklingInputError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = 'BucklingInputError';
  }
}

function positive(name: string, v: number): void {
  if (!Number.isFinite(v) || v <= 0) {
    throw new BucklingInputError(`${name} doit être strictement positif.`);
  }
}

/** Cas d'appuis usuels et coefficient K théorique (voir `BUCKLING_SOURCES.lengths`). */
export const BUCKLING_CASES = {
  console: { K: 2, label: 'Encastrée – libre (console)' },
  biArticulee: { K: 1, label: 'Articulée – articulée' },
  encastreeArticulee: { K: 0.7, label: 'Encastrée – articulée' },
  biEncastree: { K: 0.5, label: 'Encastrée – encastrée' },
} as const;

export type BucklingCase = keyof typeof BUCKLING_CASES;

/**
 * Charge critique d'Euler.
 *
 * Formule : Ncr = π² E I / Lk².
 * Source : `BUCKLING_SOURCES.euler`.
 * Domaine : flambement élastique (σcr = Ncr/A inférieure à la limite élastique).
 */
export function eulerCriticalLoad_N(E_Pa: number, I_m4: number, Lk_m: number): number {
  positive('Le module d’Young E', E_Pa);
  positive('Le moment quadratique I', I_m4);
  positive('La longueur de flambement Lk', Lk_m);
  return (Math.PI ** 2 * E_Pa * I_m4) / Lk_m ** 2;
}

/**
 * Élancement de transition entre Johnson et Euler (tangence des deux courbes en σ = Re/2).
 *
 * Formule : λc = π √(2E / Re).
 * Source : `BUCKLING_SOURCES.johnson`.
 */
export function transitionSlenderness(E_Pa: number, Re_Pa: number): number {
  positive('Le module d’Young E', E_Pa);
  positive('La limite élastique Re', Re_Pa);
  return Math.PI * Math.sqrt((2 * E_Pa) / Re_Pa);
}

export type BucklingModel = 'euler' | 'johnson';

export interface CriticalStress {
  sigma_Pa: number;
  model: BucklingModel;
}

/**
 * Contrainte critique de flambement.
 *
 * Formules :
 * - λ ≥ λc (ou Re inconnue) : Euler, σcr = π² E / λ² ;
 * - λ < λc : Johnson, σcr = Re − (Re λ / (2π))² / E.
 * Source : `BUCKLING_SOURCES.euler` et `BUCKLING_SOURCES.johnson`.
 * Sans Re (fonte grise), seule la formule d'Euler est appliquée : l'appelant doit alors
 * signaler qu'elle n'est pas plafonnée.
 */
export function criticalStress(
  E_Pa: number,
  Re_Pa: number | undefined,
  slenderness: number,
): CriticalStress {
  positive('Le module d’Young E', E_Pa);
  positive('L’élancement λ', slenderness);
  const euler = (Math.PI ** 2 * E_Pa) / slenderness ** 2;
  if (Re_Pa === undefined) return { sigma_Pa: euler, model: 'euler' };
  if (slenderness >= transitionSlenderness(E_Pa, Re_Pa)) return { sigma_Pa: euler, model: 'euler' };
  return {
    sigma_Pa: Re_Pa - ((Re_Pa * slenderness) / (2 * Math.PI)) ** 2 / E_Pa,
    model: 'johnson',
  };
}

/** Un plan de flambement : axe, moment quadratique et coefficient K. */
export interface BucklingAxisInput {
  /** Nom de l'axe autour duquel la barre fléchit : 'y', 'z', 'u' ou 'v'. */
  axis: 'y' | 'z' | 'u' | 'v';
  I_m4: number;
  K: number;
}

export interface BucklingInput {
  length_m: number;
  A_m2: number;
  E_Pa: number;
  /** Limite élastique ; absente pour un matériau fragile (Euler seul). */
  Re_Pa?: number | undefined;
  axes: readonly BucklingAxisInput[];
  /** Effort de compression (> 0), ou 0 / absent pour n'obtenir que Ncr. */
  N_N?: number | undefined;
}

export interface BucklingAxisResult {
  axis: BucklingAxisInput['axis'];
  K: number;
  I_m4: number;
  Lk_m: number;
  i_m: number;
  slenderness: number;
  /** Charge critique d'Euler (non plafonnée). */
  NcrEuler_N: number;
  /** Contrainte critique retenue (Euler ou Johnson) et charge correspondante σcr·A. */
  sigmaCr_Pa: number;
  Ncr_N: number;
  model: BucklingModel;
}

export interface BucklingResult {
  axes: BucklingAxisResult[];
  /** Plan le plus défavorable (Ncr minimal). */
  governing: BucklingAxisResult;
  /** Élancement de transition λc ; absent sans Re. */
  transitionSlenderness: number | undefined;
  /** Contrainte de compression N/A (si N fourni). */
  sigma_Pa: number | undefined;
  /** n = Ncr / N, +∞ si N = 0 ; absent si N n'est pas fourni. */
  safetyFactor: number | undefined;
}

/**
 * Flambement par flexion d'une barre comprimée dans plusieurs plans.
 *
 * Formules : Lk = K L ; i = √(I/A) ; λ = Lk/i ; σcr par `criticalStress` ; Ncr = σcr A ;
 * n = Ncr,min / N.
 * Sources : `BUCKLING_SOURCES`.
 * Limites : voir l'en-tête du module (barre parfaite, flexion seule). Le coefficient de
 * sécurité est brut : les imperfections réelles réduisent la charge de ruine bien en
 * dessous de Ncr pour les élancements moyens (d'où les courbes de l'EN 1993-1-1 §6.3.1).
 */
export function bucklingCheck(input: BucklingInput): BucklingResult {
  const { length_m: L, A_m2: A, E_Pa: E, Re_Pa: Re } = input;
  positive('La longueur L', L);
  positive('L’aire A', A);
  positive('Le module d’Young E', E);
  if (Re !== undefined) positive('La limite élastique Re', Re);
  if (input.axes.length === 0) throw new BucklingInputError('Aucun plan de flambement.');
  const N = input.N_N;
  if (N !== undefined && (!Number.isFinite(N) || N < 0)) {
    throw new BucklingInputError('L’effort de compression N doit être positif ou nul.');
  }

  const axes = input.axes.map((a): BucklingAxisResult => {
    positive(`Le coefficient K (axe ${a.axis})`, a.K);
    positive(`Le moment quadratique I (axe ${a.axis})`, a.I_m4);
    const Lk = a.K * L;
    const i = Math.sqrt(a.I_m4 / A);
    const slenderness = Lk / i;
    const cr = criticalStress(E, Re, slenderness);
    return {
      axis: a.axis,
      K: a.K,
      I_m4: a.I_m4,
      Lk_m: Lk,
      i_m: i,
      slenderness,
      NcrEuler_N: eulerCriticalLoad_N(E, a.I_m4, Lk),
      sigmaCr_Pa: cr.sigma_Pa,
      Ncr_N: cr.sigma_Pa * A,
      model: cr.model,
    };
  });
  const governing = axes.reduce((g, a) => (a.Ncr_N < g.Ncr_N ? a : g));
  return {
    axes,
    governing,
    transitionSlenderness: Re === undefined ? undefined : transitionSlenderness(E, Re),
    sigma_Pa: N === undefined ? undefined : N / A,
    safetyFactor: N === undefined ? undefined : N === 0 ? Infinity : governing.Ncr_N / N,
  };
}
