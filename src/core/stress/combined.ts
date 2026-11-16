/**
 * Contraintes dans une section sous efforts combinés : effort normal N, moment fléchissant My,
 * effort tranchant Vz et moment de torsion T.
 *
 * CONVENTIONS (comme `stress.ts` et `beams`)
 * - Repère de l'EN 1993-1-1 §1.7 : y horizontal, z vertical vers le haut, x le long de la barre.
 *   Les coordonnées (y, z) des points sont mesurées depuis le centre de gravité G.
 * - N > 0 en traction ; σ > 0 en traction.
 * - My > 0 tend la fibre inférieure (convention de `beams`).
 * - Vz et T : seule leur valeur absolue intervient (τ dans les critères).
 *
 * Choix (confirmés, voir docs/AVANCEMENT.md § 5) :
 * - MAJORANT : |σ|max (fibre la plus sollicitée) est combinée avec τ = τ_V + τ_T, même si ces
 *   maxima ne sont pas atteints au même point. C'est conservatif.
 * - τ_V est la contrainte MOYENNE sur l'aire de cisaillement Av (pas de répartition de
 *   Jourawski) ; τ_T est la contrainte MAXIMALE de torsion de Saint-Venant.
 *
 * Hypothèses : petites déformations, matériau élastique linéaire homogène isotrope, sections
 * planes restant planes (Navier-Bernoulli), torsion de Saint-Venant sans gauchissement gêné.
 * Unités SI (N, N·m, m, Pa).
 */
import type { SectionInput, SectionResult } from '../sections';
import {
  averageShearStress_Pa,
  maxPrincipalStress_Pa,
  StressInputError,
  tresca_Pa,
  vonMises_Pa,
} from './stress';

/** Sources des formules propres aux efforts combinés. */
export const COMBINED_SOURCES = {
  normal:
    'Flexion composée (superposition N/A et Navier) ; flexion déviée d’une section rapportée à des axes non principaux, déduite de l’équilibre ∫σ dA = N, ∫σ z dA = −My, ∫σ y dA = 0 : Timoshenko & Gere, Mechanics of Materials, chap. « Unsymmetric bending ». TODO: à vérifier — n° de paragraphe.',
  torsionRound:
    'Torsion des arbres circulaires, τ = T r / Ip : Timoshenko & Gere, Mechanics of Materials, chap. « Torsion ». TODO: à vérifier — n° de paragraphe.',
  torsionRect:
    'Rectangle plein, τmax = 3T/(8ab²)·[1 + 0,6095 (b/a) + 0,8865 (b/a)² − 1,8023 (b/a)³ + 0,9100 (b/a)⁴], a ≥ b demi-côtés, au milieu des grands côtés : Roark’s Formulas for Stress and Strain, 8e éd., chap. 10. TODO: à vérifier — n° de tableau et de cas. Recoupé : 1/(0,208 s³) pour un carré, 3T/(h t²) pour un plat mince.',
  torsionBredt:
    'Tube mince fermé, formule de Bredt τ = T / (2 Am t) : Timoshenko & Goodier, Theory of Elasticity ; Roark 8e éd., chap. 10. TODO: à vérifier — paragraphe.',
  torsionOpen:
    'Profil mince ouvert, τmax = T tmax / J dans la paroi la plus épaisse : Roark 8e éd., chap. 10 ; Timoshenko & Goodier. TODO: à vérifier — n° de tableau. Concentrations aux angles rentrants et congés négligées.',
} as const;

/** Efforts intérieurs dans la section (SI). */
export interface SectionEfforts {
  /** Effort normal, > 0 en traction. */
  N_N: number;
  /** Moment fléchissant autour de y, > 0 quand la fibre inférieure est tendue. */
  My_Nm: number;
  /** Effort tranchant selon z. */
  Vz_N: number;
  /** Moment de torsion autour de x. */
  T_Nm: number;
}

export type TorsionMethod = 'circulaire' | 'rectanglePlein' | 'bredt' | 'paroiMinceOuverte';

/** Module de torsion Wt tel que τmax = |T| / Wt. */
export interface TorsionModulus {
  Wt_m3: number;
  method: TorsionMethod;
  /** Épaisseur de paroi retenue (profils minces ouverts et Bredt). */
  t_m?: number;
  /** Aire délimitée par la ligne moyenne (Bredt). */
  Am_m2?: number;
}

/**
 * Coefficient de la formule de Roark pour le rectangle plein (voir `COMBINED_SOURCES.torsionRect`).
 * τmax = 3T/(8ab²) · k(b/a), a ≥ b demi-côtés.
 */
export function rectangleTorsionFactor(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1) {
    throw new StressInputError('Le rapport b/a doit être compris dans ]0 ; 1].');
  }
  const r = ratio;
  return 1 + 0.6095 * r + 0.8865 * r ** 2 - 1.8023 * r ** 3 + 0.91 * r ** 4;
}

/**
 * Module de torsion d'une section (τmax = |T| / Wt).
 *
 * Formules :
 * - rond et tube : Wt = J / (D/2) (exact) ;
 * - rectangle plein : Wt = 8ab² / [3 k(b/a)] (Roark, erreur annoncée de quelques %) ;
 * - rectangle creux : Wt = 2 Am t, Am = (b − t)(h − t) (Bredt, paroi mince) ;
 * - I, U, T : Wt = J / max(tw, tf) ; L : Wt = J / t (paroi mince ouverte).
 * Sources : voir `COMBINED_SOURCES`.
 * Limites : torsion de Saint-Venant ; concentrations aux angles rentrants non prises en compte.
 *
 * @param input dimensions de la section (forme et épaisseurs).
 * @param section propriétés calculées par `computeSection(input)` (J).
 */
export function torsionModulus(input: SectionInput, section: SectionResult): TorsionModulus {
  const J = section.J_m4;
  switch (input.shape) {
    case 'rond':
    case 'tube':
      return { Wt_m3: J / (input.d_m / 2), method: 'circulaire' };
    case 'rectangle': {
      const a = Math.max(input.b_m, input.h_m) / 2;
      const b = Math.min(input.b_m, input.h_m) / 2;
      return {
        Wt_m3: (8 * a * b ** 2) / (3 * rectangleTorsionFactor(b / a)),
        method: 'rectanglePlein',
      };
    }
    case 'rectangleCreux': {
      const { b_m: b, h_m: h, t_m: t } = input;
      const Am = (b - t) * (h - t);
      return { Wt_m3: 2 * Am * t, method: 'bredt', t_m: t, Am_m2: Am };
    }
    case 'I':
    case 'U':
    case 'T': {
      const t = Math.max(input.tw_m, input.tf_m);
      return { Wt_m3: J / t, method: 'paroiMinceOuverte', t_m: t };
    }
    case 'L':
      return { Wt_m3: J / input.t_m, method: 'paroiMinceOuverte', t_m: input.t_m };
  }
}

/** Contrainte normale en un point de la section (coordonnées depuis G). */
export interface PointStress {
  sigma_Pa: number;
  y_m: number;
  z_m: number;
}

export interface CombinedStresses {
  /** Contrainte uniforme due à l'effort normal, N / A. */
  sigmaN_Pa: number;
  /** Plus grande traction (σ ≥ 0, ramenée à 0 si toute la section est comprimée). */
  tension: PointStress;
  /** Plus grande compression (σ ≤ 0, ramenée à 0 si toute la section est tendue). */
  compression: PointStress;
  /** Vrai si Iyz ≠ 0 (cornière) : flexion déviée, l'axe neutre n'est pas parallèle à y. */
  unsymmetric: boolean;
  /** τ moyenne due à Vz ; `undefined` si Av,z n'est pas définie (cornière). */
  tauV_Pa: number | undefined;
  /** τ maximale de torsion. */
  tauT_Pa: number;
  torsion: TorsionModulus;
  /** τ retenue dans les critères : τ_V + τ_T (majorant). */
  tau_Pa: number;
  /** |σ| maximale retenue dans von Mises et Tresca. */
  sigmaAbsMax_Pa: number;
  vonMises_Pa: number;
  tresca_Pa: number;
  /** Contrainte principale maximale avec la plus grande traction (critère de Rankine). */
  sigma1_Pa: number;
}

/** Points candidats (coins des rectangles, ou points du cercle extérieur), depuis G. */
function candidatePoints(section: SectionResult): { y: number; z: number }[] {
  const g = section.geometry;
  if (g.kind === 'circle') {
    const R = g.d_m / 2;
    return [
      { y: 0, z: R },
      { y: 0, z: -R },
      { y: R, z: 0 },
      { y: -R, z: 0 },
    ];
  }
  return g.rects.flatMap((r) =>
    [r.y0, r.y1].flatMap((y) =>
      [r.z0, r.z1].map((z) => ({ y: y - section.yG_m, z: z - section.zG_m })),
    ),
  );
}

function finite(name: string, v: number): void {
  if (!Number.isFinite(v)) throw new StressInputError(`${name} doit être un nombre fini.`);
}

/**
 * Contrainte normale en un point (y, z) mesuré depuis G.
 *
 * Formule : σ = N/A + My·(Iyz·y − Iz·z) / (Iy·Iz − Iyz²) ; si Iyz = 0 : σ = N/A − My·z/Iy.
 * Obtenue en écrivant σ = a + b·y + c·z (sections planes) et l'équilibre
 * ∫σ dA = N, ∫σ·z dA = −My, ∫σ·y dA = 0 (pas de moment Mz).
 * Source : `COMBINED_SOURCES.normal`.
 */
export function normalStress_Pa(
  section: Pick<SectionResult, 'A_m2' | 'Iy_m4' | 'Iz_m4' | 'Iyz_m4'>,
  N_N: number,
  My_Nm: number,
  y_m: number,
  z_m: number,
): number {
  finite('L’effort normal', N_N);
  finite('Le moment fléchissant', My_Nm);
  finite('La coordonnée y', y_m);
  finite('La coordonnée z', z_m);
  const { A_m2: A, Iy_m4: Iy, Iz_m4: Iz, Iyz_m4: Iyz } = section;
  const det = Iy * Iz - Iyz ** 2;
  if (!(A > 0) || !(Iy > 0) || !(Iz > 0) || !(det > 0)) {
    throw new StressInputError('Propriétés de section invalides (A, Iy, Iz).');
  }
  return N_N / A + (My_Nm * (Iyz * y_m - Iz * z_m)) / det + 0;
}

/**
 * Contraintes extrêmes d'une section sous N, My, Vz et T, et contraintes équivalentes.
 *
 * Formules :
 * - σ en chaque coin de la section (`normalStress_Pa`) ; la contrainte normale étant linéaire
 *   en (y, z), ses extremums sont atteints en des sommets ;
 * - τ_V = |Vz| / Av,z (moyenne) ; τ_T = |T| / Wt (`torsionModulus`) ; τ = τ_V + τ_T ;
 * - von Mises √(σ² + 3τ²), Tresca √(σ² + 4τ²) avec σ = |σ|max ;
 *   σ₁ = σ/2 + √((σ/2)² + τ²) avec σ = traction maximale.
 * Sources : `COMBINED_SOURCES`, `STRESS_SOURCES`.
 * Limites : majorant (σ et τ maximales combinées même si elles ne coïncident pas) ; τ_V
 * moyenne ; τ_V non calculée pour la cornière (Av non définie) ; gauchissement non pris en
 * compte ; pas d'instabilité (flambement, déversement, voilement).
 */
export function combinedStresses(
  input: SectionInput,
  section: SectionResult,
  efforts: SectionEfforts,
): CombinedStresses {
  const { N_N, My_Nm, Vz_N, T_Nm } = efforts;
  finite('L’effort tranchant', Vz_N);
  finite('Le moment de torsion', T_Nm);

  const points = candidatePoints(section).map((p) => ({
    sigma_Pa: normalStress_Pa(section, N_N, My_Nm, p.y, p.z),
    y_m: p.y,
    z_m: p.z,
  }));
  const pick = (better: (a: PointStress, b: PointStress) => boolean) =>
    points.reduce((best, c) => (better(c, best) ? c : best));
  const tMax = pick((a, b) => a.sigma_Pa > b.sigma_Pa);
  const cMax = pick((a, b) => a.sigma_Pa < b.sigma_Pa);
  const tension = tMax.sigma_Pa < 0 ? { ...tMax, sigma_Pa: 0 } : tMax;
  const compression = cMax.sigma_Pa > 0 ? { ...cMax, sigma_Pa: 0 } : cMax;

  const tauV =
    section.Av_z_m2 === undefined ? undefined : averageShearStress_Pa(Vz_N, section.Av_z_m2);
  const torsion = torsionModulus(input, section);
  const tauT = Math.abs(T_Nm) / torsion.Wt_m3;
  const tau = (tauV ?? 0) + tauT;
  const sigmaAbs = Math.max(tension.sigma_Pa, -compression.sigma_Pa);

  return {
    sigmaN_Pa: N_N / section.A_m2 + 0,
    tension,
    compression,
    unsymmetric: Math.abs(section.Iyz_m4) > 1e-9 * Math.sqrt(section.Iy_m4 * section.Iz_m4),
    tauV_Pa: tauV,
    tauT_Pa: tauT,
    torsion,
    tau_Pa: tau,
    sigmaAbsMax_Pa: sigmaAbs,
    vonMises_Pa: vonMises_Pa(sigmaAbs, tau),
    tresca_Pa: tresca_Pa(sigmaAbs, tau),
    sigma1_Pa: maxPrincipalStress_Pa(tension.sigma_Pa, tau),
  };
}
