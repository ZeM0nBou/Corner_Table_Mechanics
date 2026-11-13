/**
 * Chargement et validation de la base de matériaux de référence.
 *
 * Chaque fichier de `data/` est validé par le schéma Zod au chargement : une
 * entrée invalide ou un identifiant en double fait échouer le chargement avec
 * un message désignant précisément l'entrée fautive.
 */
import { z } from 'zod';
import { MaterialSchema, type Material } from './schema';
import aciers from './data/aciers.json';
import aluminiums from './data/aluminiums.json';
import fontes from './data/fontes.json';
import inox from './data/inox.json';
import titanes from './data/titanes.json';

export type { Material } from './schema';
export { MaterialSchema } from './schema';

/** Un fichier de données brut, avant validation. */
export interface MaterialSource {
  file: string;
  data: unknown;
}

/** Erreur levée quand une source de matériaux ne respecte pas le schéma. */
export class MaterialValidationError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Base de matériaux invalide :\n- ${problems.join('\n- ')}`);
    this.name = 'MaterialValidationError';
    this.problems = problems;
  }
}

/**
 * Valide et fusionne des sources de matériaux.
 * Fonction pure : ne dépend que de ses arguments (testable sur des données fictives).
 *
 * @throws MaterialValidationError avec la liste de tous les problèmes trouvés
 */
export function loadMaterials(sources: readonly MaterialSource[]): Material[] {
  const problems: string[] = [];
  const materials: Material[] = [];
  const seen = new Map<string, string>();

  for (const { file, data } of sources) {
    if (!Array.isArray(data)) {
      problems.push(`${file} : le contenu doit être un tableau de matériaux.`);
      continue;
    }
    data.forEach((entry: unknown, index) => {
      const result = MaterialSchema.safeParse(entry);
      const label = `${file} [${index}]`;
      if (!result.success) {
        const rawId =
          typeof entry === 'object' && entry !== null && 'id' in entry
            ? String(entry.id)
            : '(sans id)';
        problems.push(`${label} « ${rawId} » : ${z.prettifyError(result.error)}`);
        return;
      }
      const material = result.data;
      const previous = seen.get(material.id);
      if (previous !== undefined) {
        problems.push(`${label} : id « ${material.id} » déjà utilisé dans ${previous}.`);
        return;
      }
      seen.set(material.id, label);
      materials.push(material);
    });
  }

  if (problems.length > 0) {
    throw new MaterialValidationError(problems);
  }
  return materials;
}

/** Fichiers de la base de référence. */
export const REFERENCE_SOURCES: readonly MaterialSource[] = [
  { file: 'aciers.json', data: aciers },
  { file: 'inox.json', data: inox },
  { file: 'aluminiums.json', data: aluminiums },
  { file: 'fontes.json', data: fontes },
  { file: 'titanes.json', data: titanes },
];

/** Base de matériaux de référence, validée au chargement du module. */
export const REFERENCE_MATERIALS: readonly Material[] = Object.freeze(
  loadMaterials(REFERENCE_SOURCES),
);

/** Recherche un matériau de référence par son identifiant. */
export function findMaterial(id: string): Material | undefined {
  return REFERENCE_MATERIALS.find((m) => m.id === id);
}

/** Regroupe des matériaux par famille, en conservant l'ordre d'apparition. */
export function groupByFamily(materials: readonly Material[]): Map<string, Material[]> {
  const groups = new Map<string, Material[]>();
  for (const m of materials) {
    const group = groups.get(m.family);
    if (group) {
      group.push(m);
    } else {
      groups.set(m.family, [m]);
    }
  }
  return groups;
}
