/**
 * Préparation de la vérification d'une poutre pour l'UI (fonction pure, testable) :
 * choix des données, appel du moteur `@core/stress`, formules et remarques à afficher.
 */
import type { BeamExtrema } from '@core/beams';
import type { SectionResult } from '@core/sections';
import {
  beamStresses,
  checkBeamStrength,
  checkDeflection,
  extremeFibres,
  strengthBasis,
  StressInputError,
  type BeamStresses,
  type DeflectionCheck,
  type StrengthCheck,
} from '@core/stress';
import type { Material } from '@materials/schema';
import { checkFormulas, type CheckFormula, type CheckKey } from './beamCheckFormulas';
import { absExtremum } from './beamFormulas';

export interface CheckInput {
  length_m: number;
  extrema: BeamExtrema;
  /** Ordre de grandeur des forces, pour ramener à zéro le bruit d'arrondi. */
  refForce_N: number;
  section: SectionResult | undefined;
  material: Pick<Material, 'name' | 'Re_Pa' | 'Rm_Pa'> | undefined;
  /** Seuil du coefficient de sécurité (≥ 1), ou `undefined` si la saisie est vide. */
  threshold: number | undefined;
  /** Dénominateur de la flèche admissible L/limite, ou `undefined`. */
  deflectionLimit: number | undefined;
}

export type CheckEvaluation =
  | { kind: 'indisponible'; message: string }
  | {
      kind: 'ok';
      stresses: BeamStresses;
      check: StrengthCheck;
      deflection: { result: DeflectionCheck; limit: number } | undefined;
      formulas: Partial<Record<CheckKey, CheckFormula>>;
      /** Remarques à afficher en évidence (données manquantes, matériau fragile…). */
      notes: string[];
    };

const snap = (v: number, ref: number) => (Math.abs(v) <= 1e-9 * ref ? 0 : v);

export function evaluateCheck(input: CheckInput): CheckEvaluation {
  const { section, material, threshold, deflectionLimit: limit, extrema } = input;
  if (!section) {
    return {
      kind: 'indisponible',
      message:
        'Vérification des contraintes indisponible en saisie directe de I : choisissez une section paramétrique (position de G et aire de cisaillement nécessaires).',
    };
  }
  if (!material) {
    return {
      kind: 'indisponible',
      message:
        'Choisissez un matériau pour vérifier la résistance (limite élastique Re ou résistance Rm).',
    };
  }
  const basis = strengthBasis(material);
  if (!basis) {
    return {
      kind: 'indisponible',
      message: `Le matériau « ${material.name} » n’a ni Re ni Rm : la résistance ne peut pas être vérifiée.`,
    };
  }
  if (threshold === undefined || !Number.isFinite(threshold) || threshold < 1) {
    return {
      kind: 'indisponible',
      message: 'Le seuil du coefficient de sécurité doit être un nombre au moins égal à 1.',
    };
  }

  try {
    const L = input.length_m;
    const F = input.refForce_N;
    const M = extrema.moment_Nm;
    const V = absExtremum(extrema.shear_N);
    const stresses = beamStresses({
      momentMax: { value: snap(M.max.value, F * L), x_m: M.max.x_m },
      momentMin: { value: snap(M.min.value, F * L), x_m: M.min.x_m },
      shearAbsMax: { value: snap(V.value, F), x_m: V.x_m },
      Iy_m4: section.Iy_m4,
      fibres: extremeFibres(section.height_m, section.zG_m),
      Av_m2: section.Av_z_m2,
    });
    const check = checkBeamStrength(stresses, basis, threshold);
    const limitOk = limit !== undefined && Number.isFinite(limit) && limit > 0;
    const deflection =
      extrema.deflection_m && limitOk
        ? { result: checkDeflection(absExtremum(extrema.deflection_m).value, L, limit), limit }
        : undefined;
    const formulas = checkFormulas(
      stresses,
      check,
      section.Iy_m4,
      section.Av_z_m2,
      deflection && { ...deflection, length_m: L },
    );

    const notes: string[] = [];
    if (!stresses.shear) {
      notes.push('Aire de cisaillement non définie pour cette section : τ n’est pas calculée.');
    }
    if (!extrema.deflection_m) {
      notes.push('Flèche non vérifiée : E et I sont nécessaires.');
    } else if (!limitOk) {
      notes.push('Flèche non vérifiée : la limite L/… doit être un nombre positif.');
    }
    if (check.compressionNotChecked) {
      notes.push(
        'Matériau fragile (pas de limite élastique) : seule la traction est comparée à Rm. La compression n’est pas vérifiée, faute de résistance en compression dans la base.',
      );
    }
    return { kind: 'ok', stresses, check, deflection, formulas, notes };
  } catch (e) {
    if (e instanceof StressInputError) return { kind: 'indisponible', message: e.message };
    throw e;
  }
}
