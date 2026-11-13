/**
 * Matériaux personnalisés : création d'identifiants, export / import JSON et
 * résolution des conflits d'identifiants.
 *
 * Fonctions pures (aucun accès au navigateur) : le stockage est dans
 * `customStorage.ts`, l'interface dans `src/ui/materials`.
 *
 * Un fichier importé est une ENTRÉE NON FIABLE (CLAUDE.md, § Dépôt public) :
 * taille bornée, format versionné, chaque matériau validé par Zod.
 */
import { z } from 'zod';
import { MaterialSchema, type Material } from './schema';

/** Préfixe réservé aux identifiants personnalisés : aucune collision possible avec la base de référence. */
export const CUSTOM_PREFIX = 'perso-';

/** Taille maximale d'un fichier importé (octets). */
export const MAX_IMPORT_BYTES = 1_000_000;

/** Nombre maximal de matériaux dans un fichier. */
export const MAX_MATERIALS = 500;

export const FILE_FORMAT = 'rdm-materiaux';
export const FILE_VERSION = 1;

const NOT_AN_EXPORT = 'Ce fichier n’est pas un export de matériaux.';

const FileSchema = z.object(
  {
    format: z.literal(FILE_FORMAT, { error: NOT_AN_EXPORT }),
    version: z.literal(FILE_VERSION, {
      error: `Version de fichier non prise en charge (attendue : ${FILE_VERSION}).`,
    }),
    exportedAt: z.string().optional(),
    materials: z
      .array(z.unknown(), { error: 'Le fichier ne contient pas de liste « materials ».' })
      .max(MAX_MATERIALS, `Trop de matériaux (maximum ${MAX_MATERIALS}).`),
  },
  { error: NOT_AN_EXPORT },
);

/** Erreur bloquante : le fichier entier est inutilisable. */
export class CustomFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomFileError';
  }
}

export interface RejectedEntry {
  index: number;
  id?: string;
  message: string;
}

export interface ParsedFile {
  materials: Material[];
  rejected: RejectedEntry[];
}

/** Transforme un texte en fragment d'identifiant : minuscules, sans accents, tirets. */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'materiau' : slug.slice(0, 60).replace(/-+$/, '');
}

/** Ajoute le préfixe personnalisé s'il est absent. */
export function withCustomPrefix(id: string): string {
  return id.startsWith(CUSTOM_PREFIX) ? id : `${CUSTOM_PREFIX}${id}`;
}

/**
 * Identifiant libre dérivé de `base` : `base`, puis `base-2`, `base-3`…
 * @param base identifiant déjà préfixé
 */
export function uniqueId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** Identifiant d'un nouveau matériau personnalisé, à partir de son nom. */
export function newCustomId(name: string, taken: ReadonlySet<string>): string {
  return uniqueId(`${CUSTOM_PREFIX}${slugify(name)}`, taken);
}

/** Sérialise des matériaux personnalisés au format d'export versionné. */
export function serializeCustomMaterials(materials: readonly Material[], exportedAt: Date): string {
  return JSON.stringify(
    {
      format: FILE_FORMAT,
      version: FILE_VERSION,
      exportedAt: exportedAt.toISOString(),
      materials,
    },
    null,
    2,
  );
}

/**
 * Lit un fichier d'export. Les matériaux invalides sont rejetés individuellement
 * (avec un message lisible) sans bloquer les autres ; les identifiants reçoivent
 * le préfixe personnalisé ; un identifiant en double dans le fichier est rejeté.
 *
 * @throws CustomFileError si le fichier entier est inutilisable (trop gros, pas du
 *         JSON, mauvais format ou version).
 */
export function parseCustomMaterials(text: string): ParsedFile {
  // Borne en octets (UTF-8), pas en caractères.
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) {
    throw new CustomFileError(
      `Fichier trop volumineux (maximum ${MAX_IMPORT_BYTES / 1_000_000} Mo).`,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new CustomFileError('Le fichier n’est pas un JSON valide.');
  }

  const file = FileSchema.safeParse(raw);
  if (!file.success) {
    throw new CustomFileError(file.error.issues[0]?.message ?? 'Format de fichier invalide.');
  }

  const materials: Material[] = [];
  const rejected: RejectedEntry[] = [];
  const seen = new Set<string>();

  file.data.materials.forEach((entry, index) => {
    const result = MaterialSchema.safeParse(entry);
    if (!result.success) {
      const rawId =
        typeof entry === 'object' && entry !== null && 'id' in entry && typeof entry.id === 'string'
          ? entry.id
          : undefined;
      rejected.push({
        index,
        ...(rawId !== undefined && { id: rawId }),
        message: result.error.issues
          .map((i) => (i.path.length > 0 ? `${i.path.join('.')} : ${i.message}` : i.message))
          .join(' ; '),
      });
      return;
    }
    const material = { ...result.data, id: withCustomPrefix(result.data.id) };
    if (seen.has(material.id)) {
      rejected.push({ index, id: material.id, message: 'Identifiant en double dans le fichier.' });
      return;
    }
    seen.add(material.id);
    materials.push(material);
  });

  return { materials, rejected };
}

/** Matériaux importés dont l'identifiant existe déjà. */
export function findConflicts(
  existing: readonly Material[],
  imported: readonly Material[],
): Material[] {
  const ids = new Set(existing.map((m) => m.id));
  return imported.filter((m) => ids.has(m.id));
}

/** Décision de l'utilisateur pour un conflit d'identifiant. */
export type ConflictDecision = 'replace' | 'keep-both' | 'skip';

export interface MergeResult {
  materials: Material[];
  added: number;
  replaced: number;
  skipped: number;
}

/**
 * Fusionne des matériaux importés dans la liste existante.
 * Sans conflit : ajout en fin de liste. En conflit : décision obligatoire
 * (`replace` remplace sur place, `keep-both` renomme l'importé, `skip` l'ignore).
 *
 * @throws Error si un conflit n'a pas de décision (garde-fou contre un écrasement silencieux)
 */
export function mergeImported(
  existing: readonly Material[],
  imported: readonly Material[],
  decisions: Readonly<Record<string, ConflictDecision>>,
): MergeResult {
  const result = [...existing];
  const taken = new Set(existing.map((m) => m.id));
  let added = 0;
  let replaced = 0;
  let skipped = 0;

  for (const m of imported) {
    if (!taken.has(m.id)) {
      result.push(m);
      taken.add(m.id);
      added += 1;
      continue;
    }
    const decision = decisions[m.id];
    switch (decision) {
      case 'replace': {
        const i = result.findIndex((x) => x.id === m.id);
        result[i] = m;
        replaced += 1;
        break;
      }
      case 'keep-both': {
        const id = uniqueId(m.id, taken);
        result.push({ ...m, id });
        taken.add(id);
        added += 1;
        break;
      }
      case 'skip':
        skipped += 1;
        break;
      default:
        throw new Error(`Conflit non résolu pour l’identifiant « ${m.id} ».`);
    }
  }

  return { materials: result, added, replaced, skipped };
}
