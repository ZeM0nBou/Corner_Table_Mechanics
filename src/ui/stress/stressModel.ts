/**
 * Préparation de la page Contraintes pour l'UI (fonction pure, testable) : appel du moteur
 * `@core/stress`, vérification selon le matériau, formules et remarques à afficher.
 */
import type { SectionInput, SectionResult } from '@core/sections';
import {
  checkStrength,
  combinedStresses,
  strengthBasis,
  StressInputError,
  type CombinedStresses,
  type SectionEfforts,
  type StrengthCheck,
} from '@core/stress';
import type { Material } from '@materials/schema';
import { equivalentFormula, safetyFormula, type CheckFormula } from '@ui/beams/beamCheckFormulas';
import { stressFormulas, type StressKey } from './stressFormulas';

export interface StressPageInput {
  sectionInput: SectionInput;
  section: SectionResult;
  /** Efforts saisis ; un effort vide vaut 0, un effort invalide vaut NaN. */
  efforts: SectionEfforts;
  material: Pick<Material, 'name' | 'Re_Pa' | 'Rm_Pa'> | undefined;
  /** Seuil du coefficient de sécurité (≥ 1), ou `undefined` si la saisie est vide. */
  threshold: number | undefined;
}

export type StressEvaluation =
  | { kind: 'indisponible'; message: string }
  | {
      kind: 'ok';
      stresses: CombinedStresses;
      /** Vérification ; absente si le matériau ou le seuil manquent (voir `checkMessage`). */
      check: StrengthCheck | undefined;
      checkMessage: string | undefined;
      formulas: Partial<Record<StressKey | 'equivalent' | 'n', CheckFormula>>;
      /** Remarques à afficher en évidence. */
      notes: string[];
    };

/** Remarques propres à la section et aux efforts. */
function sectionNotes(input: SectionInput, s: CombinedStresses, e: SectionEfforts): string[] {
  const notes: string[] = [];
  if (s.unsymmetric && e.My_Nm !== 0) {
    notes.push(
      'Cornière : y et z ne sont pas des axes principaux. La contrainte normale est calculée en flexion déviée (avec Iyz) : un moment autour de y seul fait aussi fléchir la barre latéralement si rien ne la retient.',
    );
  }
  if (s.tauV_Pa === undefined && e.Vz_N !== 0) {
    notes.push(
      'Aire de cisaillement non définie pour la cornière : la contrainte due à Vz n’est pas calculée.',
    );
  }
  if (e.T_Nm !== 0) {
    if (s.torsion.method === 'paroiMinceOuverte') {
      notes.push(
        'Profil mince ouvert : torsion de Saint-Venant seule. Ces profils sont très souples en torsion ; le gauchissement gêné et les concentrations aux angles rentrants ne sont pas pris en compte.',
      );
    } else if (s.torsion.method === 'rectanglePlein') {
      notes.push('Rectangle plein : τ de torsion par la formule approchée de Roark (quelques %).');
    } else if (s.torsion.method === 'bredt') {
      notes.push(
        'Rectangle creux : formule de Bredt (paroi mince), sans concentration aux angles.',
      );
    }
  }
  if ((input.shape === 'U' || input.shape === 'L') && e.Vz_N !== 0) {
    notes.push(
      'Centre de cisaillement non calculé : un effort tranchant passant par G fait aussi tordre ce profilé.',
    );
  }
  return notes;
}

export function evaluateStress(p: StressPageInput): StressEvaluation {
  const { efforts, material, threshold } = p;
  const invalid = Object.values(efforts).some((v) => !Number.isFinite(v));
  if (invalid) {
    return { kind: 'indisponible', message: 'Un effort saisi n’est pas un nombre valide.' };
  }
  try {
    const stresses = combinedStresses(p.sectionInput, p.section, efforts);
    const formulas: Partial<Record<StressKey | 'equivalent' | 'n', CheckFormula>> = stressFormulas(
      p.sectionInput,
      p.section,
      efforts,
      stresses,
    );
    const notes = sectionNotes(p.sectionInput, stresses, efforts);

    let check: StrengthCheck | undefined;
    let checkMessage: string | undefined;
    const basis = material && strengthBasis(material);
    if (!material) {
      checkMessage = 'Choisissez un matériau pour obtenir le coefficient de sécurité.';
    } else if (!basis) {
      checkMessage = `Le matériau « ${material.name} » n’a ni Re ni Rm : la résistance ne peut pas être vérifiée.`;
    } else if (threshold === undefined || !Number.isFinite(threshold) || threshold < 1) {
      checkMessage = 'Le seuil du coefficient de sécurité doit être un nombre au moins égal à 1.';
    } else {
      check = checkStrength(
        stresses.tension.sigma_Pa,
        stresses.compression.sigma_Pa,
        stresses.tau_Pa,
        basis,
        threshold,
      );
      formulas.equivalent = equivalentFormula(check);
      formulas.n = safetyFormula(check);
      if (check.compressionNotChecked) {
        notes.push(
          'Matériau fragile (pas de limite élastique) : seule la traction est comparée à Rm. La compression n’est pas vérifiée, faute de résistance en compression dans la base.',
        );
      }
    }
    return { kind: 'ok', stresses, check, checkMessage, formulas, notes };
  } catch (e) {
    if (e instanceof StressInputError) return { kind: 'indisponible', message: e.message };
    throw e;
  }
}
