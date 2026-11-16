/**
 * Vérification d'une poutre en flexion simple : contraintes maximales de traction, de
 * compression et de cisaillement, contrainte de comparaison selon le matériau, coefficient
 * de sécurité, et flèche comparée à une flèche admissible.
 *
 * Conventions : voir `stress.ts` (σ > 0 en traction, M > 0 fibre inférieure tendue).
 *
 * Choix (confirmés, voir docs/AVANCEMENT.md § 5) :
 * - matériau DUCTILE (Re connue) : von Mises comparé à Re, quel que soit le signe de σ ;
 * - matériau FRAGILE (Rm seule) : contrainte principale de traction σ₁ comparée à Rm ;
 *   la compression n'est pas vérifiée (pas de résistance en compression dans la base) ;
 * - MAJORANT : σ_max et τ_max sont combinés même s'ils ne sont pas atteints au même point.
 */
import {
  averageShearStress_Pa,
  bendingStress_Pa,
  maxPrincipalStress_Pa,
  safetyFactor,
  StressInputError,
  verdict,
  vonMises_Pa,
  type ExtremeFibres,
  type Verdict,
} from './stress';

/** Valeur extrême d'un effort et son abscisse le long de la poutre. */
export interface EffortAt {
  value: number;
  x_m: number;
}

export interface BeamStressInput {
  /** Moment maximal (le plus positif) et minimal (le plus négatif) le long de la poutre. */
  momentMax: EffortAt;
  momentMin: EffortAt;
  /** Effort tranchant de plus grande valeur absolue. */
  shearAbsMax: EffortAt;
  Iy_m4: number;
  fibres: ExtremeFibres;
  /** Aire de cisaillement pour Vz ; absente si non définie (cornière). */
  Av_m2?: number | undefined;
}

export type Fibre = 'superieure' | 'inferieure';

/** Contrainte extrême, avec la fibre, l'abscisse et le moment qui la produisent. */
export interface FibreStress {
  sigma_Pa: number;
  fibre: Fibre;
  x_m: number;
  M_Nm: number;
  z_m: number;
}

export interface BeamStresses {
  /** Plus grande contrainte de traction (σ ≥ 0) ; 0 si la poutre n'est pas fléchie. */
  tension: FibreStress;
  /** Plus grande contrainte de compression (σ ≤ 0). */
  compression: FibreStress;
  /** Contrainte de cisaillement moyenne maximale ; absente si Av n'est pas définie. */
  shear?: { tau_Pa: number; x_m: number; V_N: number };
}

/**
 * Contraintes extrêmes de flexion et de cisaillement d'une poutre.
 *
 * Formules : σ = −M·z/Iy aux deux fibres extrêmes, pour le moment maximal et le moment
 * minimal (4 candidats) ; τ = |V|max / Av.
 * Sources : Navier et EN 1993-1-1 §6.2.6 (voir `STRESS_SOURCES`).
 * Limites : flexion simple autour de y ; τ moyen (pas de répartition de Jourawski).
 */
export function beamStresses(input: BeamStressInput): BeamStresses {
  const { Iy_m4, fibres } = input;
  const candidates: FibreStress[] = [];
  for (const m of [input.momentMax, input.momentMin]) {
    for (const [fibre, z_m] of [
      ['superieure', fibres.zTop_m],
      ['inferieure', fibres.zBottom_m],
    ] as const) {
      candidates.push({
        sigma_Pa: bendingStress_Pa(m.value, Iy_m4, z_m),
        fibre,
        x_m: m.x_m,
        M_Nm: m.value,
        z_m,
      });
    }
  }
  const pick = (better: (a: FibreStress, b: FibreStress) => boolean) =>
    candidates.reduce((best, c) => (better(c, best) ? c : best));
  const tension = pick((a, b) => a.sigma_Pa > b.sigma_Pa);
  const compression = pick((a, b) => a.sigma_Pa < b.sigma_Pa);
  const clamp = (s: FibreStress, sign: 1 | -1): FibreStress =>
    sign * s.sigma_Pa < 0 ? { ...s, sigma_Pa: 0 } : s;

  return {
    tension: clamp(tension, 1),
    compression: clamp(compression, -1),
    ...(input.Av_m2 !== undefined && {
      shear: {
        tau_Pa: averageShearStress_Pa(input.shearAbsMax.value, input.Av_m2),
        x_m: input.shearAbsMax.x_m,
        V_N: input.shearAbsMax.value,
      },
    }),
  };
}

/** Résistance de référence d'un matériau, selon son comportement. */
export type StrengthBasis = { kind: 'ductile'; Re_Pa: number } | { kind: 'fragile'; Rm_Pa: number };

/**
 * Comportement retenu pour la vérification : ductile si Re est connue, fragile si seule Rm
 * l'est, `undefined` sinon (aucune résistance renseignée).
 */
export function strengthBasis(material: {
  Re_Pa?: number | undefined;
  Rm_Pa?: number | undefined;
}): StrengthBasis | undefined {
  if (material.Re_Pa !== undefined && material.Re_Pa > 0) {
    return { kind: 'ductile', Re_Pa: material.Re_Pa };
  }
  if (material.Rm_Pa !== undefined && material.Rm_Pa > 0) {
    return { kind: 'fragile', Rm_Pa: material.Rm_Pa };
  }
  return undefined;
}

export interface StrengthCheck {
  basis: StrengthBasis;
  /** Critère appliqué : von Mises (ductile) ou contrainte principale de traction (fragile). */
  criterion: 'vonMises' | 'rankine';
  /** σ utilisée dans le critère : |σ| maximale (ductile) ou traction maximale (fragile). */
  sigma_Pa: number;
  /** τ utilisée dans le critère (0 si Av n'est pas définie). */
  tau_Pa: number;
  /** Contrainte de comparaison. */
  equivalent_Pa: number;
  /** Résistance de comparaison : Re (ductile) ou Rm (fragile). */
  strength_Pa: number;
  safetyFactor: number;
  verdict: Verdict;
  /** Vrai pour un matériau fragile : la compression n'est pas vérifiée. */
  compressionNotChecked: boolean;
}

/**
 * Vérification de résistance à partir des contraintes extrêmes (section ou poutre).
 *
 * Formules :
 * - ductile : σ_eq = √(σ² + 3τ²) avec σ = max(σ_traction, |σ_compression|), n = Re/σ_eq ;
 * - fragile : σ₁ = σ/2 + √((σ/2)² + τ²) avec σ = σ_traction, n = Rm/σ₁.
 * Sources : EN 1993-1-1 §6.2.1(5) ; critère de Rankine (voir `STRESS_SOURCES`).
 * Hypothèses : majorant (σ_max et τ_max combinés même s'ils ne coïncident pas) ;
 * coefficient de sécurité brut, sans coefficient partiel.
 *
 * @param tension_Pa plus grande contrainte de traction (≥ 0).
 * @param compression_Pa plus grande contrainte de compression (≤ 0).
 * @param tau_Pa contrainte de cisaillement retenue (≥ 0).
 * @param threshold seuil (≥ 1) au-delà duquel le coefficient de sécurité est « ok ».
 */
export function checkStrength(
  tension_Pa: number,
  compression_Pa: number,
  tau_Pa: number,
  basis: StrengthBasis,
  threshold: number,
): StrengthCheck {
  if (basis.kind === 'ductile') {
    const sigma = Math.max(tension_Pa, -compression_Pa);
    const eq = vonMises_Pa(sigma, tau_Pa);
    const n = safetyFactor(basis.Re_Pa, eq);
    return {
      basis,
      criterion: 'vonMises',
      sigma_Pa: sigma,
      tau_Pa,
      equivalent_Pa: eq,
      strength_Pa: basis.Re_Pa,
      safetyFactor: n,
      verdict: verdict(n, threshold),
      compressionNotChecked: false,
    };
  }
  const eq = maxPrincipalStress_Pa(tension_Pa, tau_Pa);
  const n = safetyFactor(basis.Rm_Pa, eq);
  return {
    basis,
    criterion: 'rankine',
    sigma_Pa: tension_Pa,
    tau_Pa,
    equivalent_Pa: eq,
    strength_Pa: basis.Rm_Pa,
    safetyFactor: n,
    verdict: verdict(n, threshold),
    compressionNotChecked: true,
  };
}

/**
 * Vérification de résistance d'une poutre : `checkStrength` appliquée aux contraintes
 * extrêmes de `beamStresses` (τ = 0 si Av n'est pas définie).
 */
export function checkBeamStrength(
  stresses: BeamStresses,
  basis: StrengthBasis,
  threshold: number,
): StrengthCheck {
  return checkStrength(
    stresses.tension.sigma_Pa,
    stresses.compression.sigma_Pa,
    stresses.shear?.tau_Pa ?? 0,
    basis,
    threshold,
  );
}

export interface DeflectionCheck {
  /** Flèche maximale en valeur absolue. */
  deflection_m: number;
  /** Flèche admissible L / limite. */
  allowable_m: number;
  /** Rapport δ / δ_adm (≤ 1 : satisfait). */
  ratio: number;
  verdict: 'ok' | 'ko';
}

/**
 * Vérification de flèche.
 *
 * Formule : δ_adm = L / limite ; satisfaite si |δ|max ≤ δ_adm.
 * Source : critère de service usuel (ex. EN 1990 annexe A1.4 et annexes nationales, où
 * les valeurs limites sont fixées par le projet). TODO: à vérifier — paragraphe exact.
 * Limites : L est la longueur totale de la poutre, y compris pour une console.
 *
 * @param limit dénominateur de la flèche admissible (ex. 300 pour L/300), > 0.
 */
export function checkDeflection(
  maxDeflection_m: number,
  length_m: number,
  limit: number,
): DeflectionCheck {
  if (!Number.isFinite(maxDeflection_m)) {
    throw new StressInputError('La flèche doit être un nombre fini.');
  }
  if (!Number.isFinite(length_m) || length_m <= 0) {
    throw new StressInputError('La longueur doit être strictement positive.');
  }
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new StressInputError('La limite de flèche doit être strictement positive.');
  }
  const deflection = Math.abs(maxDeflection_m);
  const allowable = length_m / limit;
  const ratio = deflection / allowable;
  return {
    deflection_m: deflection,
    allowable_m: allowable,
    ratio,
    verdict: ratio <= 1 ? 'ok' : 'ko',
  };
}
