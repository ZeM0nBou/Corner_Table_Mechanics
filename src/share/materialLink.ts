/**
 * Matériau dans un lien partagé.
 *
 * Décisions (responsable du projet, 16 novembre 2026) :
 * - matériau de la base de référence : identifiant + instantané des propriétés
 *   utilisées par les calculs ; si la base a changé depuis, l'écart est signalé et
 *   le calcul reprend les valeurs du lien ;
 * - matériau personnalisé : toutes ses propriétés sont dans le lien ; chez le
 *   destinataire il est utilisé pour ce calcul seulement (matériau « temporaire »),
 *   et un bouton permet de l'ajouter à ses matériaux.
 *
 * Un matériau temporaire n'est jamais écrit dans la base de référence ni, sans
 * action de l'utilisateur, dans ses matériaux personnalisés.
 */
import { mergeImported, withCustomPrefix } from '@materials/custom';
import type { Material } from '@materials/schema';
import type { SharedMaterial, SharedReferenceMaterial } from './schemas';

/** Préfixe des identifiants des matériaux temporaires issus d'un lien. */
export const LINK_PREFIX = 'lien-';

/** Propriétés recopiées dans l'instantané d'un matériau de référence. */
export const SNAPSHOT_KEYS = ['E_Pa', 'nu', 'rho_kg_m3', 'Re_Pa', 'Rm_Pa'] as const;
export type SnapshotKey = (typeof SNAPSHOT_KEYS)[number];

/**
 * Forme partageable du matériau choisi.
 * @param reference base de référence : un matériau qui y figure (même identifiant)
 *        est partagé par son instantané, tout autre en entier.
 */
export function toSharedMaterial(
  material: Material | undefined,
  reference: readonly Material[],
): SharedMaterial {
  if (!material) return null;
  if (!reference.some((r) => r.id === material.id)) return { kind: 'custom', material };
  const snap: SharedReferenceMaterial = {
    kind: 'reference',
    id: material.id,
    name: material.name,
    E_Pa: material.E_Pa,
    nu: material.nu,
    rho_kg_m3: material.rho_kg_m3,
  };
  if (material.Re_Pa !== undefined) snap.Re_Pa = material.Re_Pa;
  if (material.Rm_Pa !== undefined) snap.Rm_Pa = material.Rm_Pa;
  return snap;
}

export interface SnapshotDifference {
  key: SnapshotKey;
  /** Valeur du lien (retenue pour le calcul). */
  link: number | undefined;
  /** Valeur actuelle de la base de référence. */
  current: number | undefined;
}

export type LinkedMaterialStatus =
  /** Matériau de référence, valeurs identiques à la base actuelle. */
  | { kind: 'reference' }
  /** Matériau de référence dont la base a changé : valeurs du lien retenues. */
  | { kind: 'reference-modifiee'; differences: SnapshotDifference[] }
  /** Matériau absent de la base actuelle : reconstitué à partir du lien. */
  | { kind: 'reference-inconnue' }
  /** Matériau personnalisé déjà présent, à l'identique, chez le destinataire. */
  | { kind: 'perso-local' }
  /** Matériau personnalisé reçu par le lien, utilisé pour ce calcul seulement. */
  | { kind: 'perso-lien'; original: Material };

export interface ResolvedMaterial {
  /** Matériau à sélectionner dans la page. */
  material: Material;
  /**
   * Matériau temporaire à ajouter à la liste de la page (il n'existe ni dans la base
   * ni dans les matériaux personnalisés), ou `undefined`.
   */
  temporary: Material | undefined;
  status: LinkedMaterialStatus;
}

function snapshotDifferences(
  shared: SharedReferenceMaterial,
  current: Material,
): SnapshotDifference[] {
  return SNAPSHOT_KEYS.filter((k) => shared[k] !== current[k]).map((k) => ({
    key: k,
    link: shared[k],
    current: current[k],
  }));
}

function withSnapshot(base: Material, shared: SharedReferenceMaterial): Material {
  const m: Material = {
    ...base,
    E_Pa: shared.E_Pa,
    nu: shared.nu,
    rho_kg_m3: shared.rho_kg_m3,
    verified: false,
  };
  if (shared.Re_Pa !== undefined) m.Re_Pa = shared.Re_Pa;
  else delete m.Re_Pa;
  if (shared.Rm_Pa !== undefined) m.Rm_Pa = shared.Rm_Pa;
  else delete m.Rm_Pa;
  return m;
}

/** Deux matériaux identiques (même contenu, ordre des clés indifférent). */
function sameMaterial(a: Material, b: Material): boolean {
  const canon = (m: Material) =>
    JSON.stringify(
      Object.keys(m)
        .sort()
        .map((k) => [k, m[k as keyof Material]]),
    );
  return canon(a) === canon(b);
}

/** Identifiant libre : `base`, puis `base-2`, `base-3`… */
function freeId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * Matériau à utiliser pour un lien reçu.
 * @param reference base de référence actuelle
 * @param custom matériaux personnalisés du destinataire
 * @returns `undefined` si le lien ne porte aucun matériau
 */
export function resolveSharedMaterial(
  shared: SharedMaterial,
  reference: readonly Material[],
  custom: readonly Material[],
): ResolvedMaterial | undefined {
  if (shared === null) return undefined;
  const taken = new Set([...reference, ...custom].map((m) => m.id));

  if (shared.kind === 'reference') {
    const current = reference.find((r) => r.id === shared.id);
    if (current) {
      const differences = snapshotDifferences(shared, current);
      if (differences.length === 0) {
        return { material: current, temporary: undefined, status: { kind: 'reference' } };
      }
      const temporary: Material = {
        ...withSnapshot(current, shared),
        id: freeId(`${LINK_PREFIX}${shared.id}`, taken),
        name: `${current.name} (valeurs du lien)`,
        notes: 'Valeurs reçues par un lien partagé, différentes de la base de référence actuelle.',
      };
      return {
        material: temporary,
        temporary,
        status: { kind: 'reference-modifiee', differences },
      };
    }
    const temporary: Material = {
      id: freeId(`${LINK_PREFIX}${shared.id}`, taken),
      name: `${shared.name} (issu du lien)`,
      family: 'Matériaux issus d’un lien',
      E_Pa: shared.E_Pa,
      nu: shared.nu,
      rho_kg_m3: shared.rho_kg_m3,
      source: 'Valeurs reçues par un lien partagé (matériau absent de la base actuelle).',
      verified: false,
    };
    if (shared.Re_Pa !== undefined) temporary.Re_Pa = shared.Re_Pa;
    if (shared.Rm_Pa !== undefined) temporary.Rm_Pa = shared.Rm_Pa;
    return { material: temporary, temporary, status: { kind: 'reference-inconnue' } };
  }

  const original = shared.material;
  const local = custom.find((m) => m.id === original.id);
  if (local && sameMaterial(local, original)) {
    return { material: local, temporary: undefined, status: { kind: 'perso-local' } };
  }
  // Un matériau de référence n'a jamais le préfixe « perso- » ; un identifiant déjà
  // pris (autre matériau local de même identifiant) reçoit un suffixe.
  const temporary: Material = { ...original, id: freeId(original.id, taken) };
  return { material: temporary, temporary, status: { kind: 'perso-lien', original } };
}

/** Identifiant sous lequel un matériau reçu est enregistré (préfixe personnalisé imposé). */
function savedId(original: Material): string {
  return withCustomPrefix(original.id);
}

/** Un matériau personnalisé local porte déjà l'identifiant du matériau reçu. */
export function linkedMaterialConflicts(
  existing: readonly Material[],
  original: Material,
): boolean {
  const id = savedId(original);
  return existing.some((m) => m.id === id);
}

/**
 * Ajoute à ses matériaux personnalisés un matériau reçu par un lien, avec la même
 * gestion des conflits que l'import JSON (`mergeImported`).
 * @param decision utilisée seulement en cas de conflit d'identifiant
 * @returns la nouvelle liste et l'identifiant du matériau enregistré
 */
export function addLinkedMaterial(
  existing: readonly Material[],
  original: Material,
  decision: 'replace' | 'keep-both',
): { materials: Material[]; id: string } {
  const m = { ...original, id: savedId(original) };
  const conflict = linkedMaterialConflicts(existing, original);
  const { materials } = mergeImported(existing, [m], conflict ? { [m.id]: decision } : {});
  const id = conflict && decision === 'keep-both' ? (materials.at(-1)?.id ?? m.id) : m.id;
  return { materials, id };
}
