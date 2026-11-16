/**
 * Contraintes dans une section de poutre et critères de résistance.
 *
 * CONVENTIONS
 * - Repère de l'EN 1993-1-1 §1.7 (comme `sections` et `beams`) : z vertical vers le haut.
 *   Les cotes z des fibres sont mesurées depuis le centre de gravité G.
 * - Contrainte normale σ > 0 en TRACTION, σ < 0 en compression.
 * - Moment fléchissant M > 0 quand la fibre inférieure est tendue (convention de `beams`).
 *   D'où σ(z) = −M·z/Iy : pour M > 0, σ > 0 sous G (z < 0).
 * - Contrainte de cisaillement τ : seule sa valeur absolue intervient dans les critères.
 *
 * Hypothèses : petites déformations, matériau élastique linéaire homogène isotrope,
 * flexion plane autour de l'axe principal y (Iyz = 0), sections planes restant planes
 * (Navier-Bernoulli). Unités SI (Pa, N, N·m, m).
 */

/** Sources des formules de contraintes (affichées avec les résultats dans l'UI). */
export const STRESS_SOURCES = {
  navier:
    'Formule de Navier (flexion simple) : Timoshenko & Gere, Mechanics of Materials, chap. « Stresses in Beams » ; EN 1993-1-1 §6.2.5. TODO: à vérifier — n° de paragraphe de Timoshenko & Gere.',
  shear: 'Contrainte de cisaillement moyenne sur l’aire de cisaillement : EN 1993-1-1 §6.2.6 (Av).',
  vonMises:
    'Critère de von Mises en état plan (σ, τ) : EN 1993-1-1 §6.2.1(5), éq. (6.1) avec σz = 0 et γM0 = 1.',
  tresca:
    'Critère de Tresca en état plan (σ, τ) : Timoshenko & Gere, Mechanics of Materials, chap. « Analysis of Stress », critère du cisaillement maximal. TODO: à vérifier — n° de paragraphe.',
  rankine:
    'Contrainte principale maximale (critère de Rankine, matériaux fragiles) : Timoshenko & Gere, Mechanics of Materials, contraintes principales en état plan. TODO: à vérifier — n° de paragraphe.',
  safety: 'Coefficient de sécurité n = R / σ (définition).',
} as const;

/** Données invalides pour un calcul de contrainte. */
export class StressInputError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = 'StressInputError';
  }
}

function finite(name: string, v: number): void {
  if (!Number.isFinite(v)) throw new StressInputError(`${name} doit être un nombre fini.`);
}

function positive(name: string, v: number): void {
  if (!Number.isFinite(v) || v <= 0) {
    throw new StressInputError(`${name} doit être strictement positif.`);
  }
}

/**
 * Contrainte normale de flexion à la cote z (depuis G).
 *
 * Formule : σ(z) = −M · z / Iy (σ > 0 en traction, M > 0 fibre inférieure tendue).
 * Source : formule de Navier (voir `STRESS_SOURCES.navier`).
 * Hypothèses : flexion simple autour de l'axe principal y, domaine élastique, sans effort
 * normal. Lève une `StressInputError` si Iy ≤ 0 ou si une donnée n'est pas finie.
 */
export function bendingStress_Pa(M_Nm: number, Iy_m4: number, z_m: number): number {
  finite('Le moment fléchissant', M_Nm);
  positive('Le moment quadratique Iy', Iy_m4);
  finite('La cote z', z_m);
  return (-M_Nm * z_m) / Iy_m4 + 0;
}

/** Cotes des fibres extrêmes depuis G : supérieure (> 0) et inférieure (< 0). */
export interface ExtremeFibres {
  zTop_m: number;
  zBottom_m: number;
}

/**
 * Cotes des fibres extrêmes d'une section, mesurées depuis G.
 *
 * Formule : z_sup = h − zG ; z_inf = −zG (zG repéré depuis la fibre inférieure).
 * Source : géométrie de la section (module `sections`).
 * Lève une `StressInputError` si h ≤ 0 ou si G n'est pas strictement dans la hauteur.
 */
export function extremeFibres(height_m: number, zG_m: number): ExtremeFibres {
  positive('La hauteur de la section', height_m);
  finite('La position de G', zG_m);
  if (zG_m <= 0 || zG_m >= height_m) {
    throw new StressInputError('Le centre de gravité doit être strictement dans la hauteur.');
  }
  return { zTop_m: height_m - zG_m, zBottom_m: -zG_m };
}

/**
 * Contrainte de cisaillement moyenne sur l'aire de cisaillement.
 *
 * Formule : τ = |V| / Av.
 * Source : EN 1993-1-1 §6.2.6 (voir `STRESS_SOURCES.shear`).
 * Limites : valeur moyenne ; la répartition réelle (Jourawski) donne un maximum plus élevé
 * pour les sections pleines (×1,5 pour un rectangle). Lève une erreur si Av ≤ 0.
 */
export function averageShearStress_Pa(V_N: number, Av_m2: number): number {
  finite('L’effort tranchant', V_N);
  positive('L’aire de cisaillement Av', Av_m2);
  return Math.abs(V_N) / Av_m2;
}

/**
 * Contrainte équivalente de von Mises en état plan (σ, τ).
 *
 * Formule : σ_eq = √(σ² + 3τ²).
 * Source : EN 1993-1-1 §6.2.1(5), éq. (6.1), avec σz = 0 (voir `STRESS_SOURCES.vonMises`).
 * Domaine : matériaux ductiles.
 */
export function vonMises_Pa(sigma_Pa: number, tau_Pa: number): number {
  finite('σ', sigma_Pa);
  finite('τ', tau_Pa);
  return Math.sqrt(sigma_Pa ** 2 + 3 * tau_Pa ** 2);
}

/**
 * Contrainte équivalente de Tresca en état plan (σ, τ).
 *
 * Formule : σ_eq = √(σ² + 4τ²) (deux fois le cisaillement maximal).
 * Source : critère du cisaillement maximal (voir `STRESS_SOURCES.tresca`).
 * Domaine : matériaux ductiles ; plus conservatif que von Mises (au plus de 2/√3 ≈ 15 %).
 */
export function tresca_Pa(sigma_Pa: number, tau_Pa: number): number {
  finite('σ', sigma_Pa);
  finite('τ', tau_Pa);
  return Math.sqrt(sigma_Pa ** 2 + 4 * tau_Pa ** 2);
}

/**
 * Contrainte principale maximale en état plan (σ, τ).
 *
 * Formule : σ₁ = σ/2 + √((σ/2)² + τ²) (σ > 0 en traction).
 * Source : contraintes principales en état plan (voir `STRESS_SOURCES.rankine`).
 * Domaine : critère de Rankine, matériaux fragiles (fonte grise) en traction.
 */
export function maxPrincipalStress_Pa(sigma_Pa: number, tau_Pa: number): number {
  finite('σ', sigma_Pa);
  finite('τ', tau_Pa);
  return sigma_Pa / 2 + Math.sqrt((sigma_Pa / 2) ** 2 + tau_Pa ** 2);
}

/**
 * Coefficient de sécurité vis-à-vis d'une résistance.
 *
 * Formule : n = R / σ ; +∞ si σ = 0.
 * Source : définition (voir `STRESS_SOURCES.safety`).
 * Lève une erreur si R ≤ 0 ou si σ est négative ou non finie (σ est une contrainte
 * équivalente ou une valeur absolue).
 */
export function safetyFactor(strength_Pa: number, stress_Pa: number): number {
  positive('La résistance', strength_Pa);
  if (!Number.isFinite(stress_Pa) || stress_Pa < 0) {
    throw new StressInputError('La contrainte doit être un nombre positif ou nul.');
  }
  return stress_Pa === 0 ? Infinity : strength_Pa / stress_Pa;
}

export type Verdict = 'ok' | 'limite' | 'ko';

/**
 * Verdict d'un coefficient de sécurité : « ok » si n ≥ seuil, « limite » si 1 ≤ n < seuil,
 * « ko » si n < 1. Le seuil (≥ 1) est réglé par l'utilisateur.
 */
export function verdict(n: number, threshold: number): Verdict {
  if (Number.isNaN(n)) throw new StressInputError('Coefficient de sécurité invalide.');
  if (!Number.isFinite(threshold) || threshold < 1) {
    throw new StressInputError('Le seuil du coefficient de sécurité doit être au moins 1.');
  }
  if (n >= threshold) return 'ok';
  return n >= 1 ? 'limite' : 'ko';
}
