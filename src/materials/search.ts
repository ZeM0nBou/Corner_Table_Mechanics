/**
 * Recherche de matériaux et regroupement par famille (référence + personnalisés).
 * Fonctions pures, indépendantes de l'UI.
 */
import type { Material } from './schema';
import { SECTORS } from './selection';

/** Texte normalisé pour comparaison : minuscules, sans accents, espaces réduits. */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Vrai si tous les mots de la requête apparaissent dans le nom, la famille,
 * l'état, la norme, l'identifiant, les secteurs ou les exemples d'emplois du
 * matériau (ordre indifférent). Une requête vide accepte tout.
 */
export function matchesQuery(m: Material, query: string): boolean {
  const tokens = normalizeText(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = normalizeText(
    [
      m.name,
      m.family,
      m.condition ?? '',
      m.standard ?? '',
      m.id,
      ...(m.sectors ?? []).map((s) => SECTORS[s]),
      m.applicationNotes ?? '',
    ].join(' '),
  );
  return tokens.every((t) => haystack.includes(t));
}

export interface PickerItem {
  material: Material;
  isCustom: boolean;
}

export interface FamilyGroup {
  /** Libellé affiché (celui de la base de référence si la famille y existe). */
  family: string;
  items: PickerItem[];
}

/**
 * Regroupe matériaux de référence et personnalisés par famille, filtrés par la requête.
 * - Les familles sont comparées sans tenir compte de la casse, des accents ni des espaces :
 *   un matériau personnalisé de famille « Acier de construction » rejoint la famille de référence.
 * - Ordre : familles de référence (ordre d'apparition), puis familles uniquement personnalisées.
 * - Dans une famille : matériaux de référence, puis personnalisés.
 * - Les familles sans résultat sont omises.
 */
export function buildFamilyGroups(
  reference: readonly Material[],
  custom: readonly Material[],
  query = '',
): FamilyGroup[] {
  const groups = new Map<string, FamilyGroup>();
  const add = (m: Material, isCustom: boolean) => {
    const key = normalizeText(m.family);
    let group = groups.get(key);
    if (!group) {
      group = { family: m.family.trim(), items: [] };
      groups.set(key, group);
    }
    if (matchesQuery(m, query)) group.items.push({ material: m, isCustom });
  };
  reference.forEach((m) => add(m, false));
  custom.forEach((m) => add(m, true));
  return [...groups.values()].filter((g) => g.items.length > 0);
}

/** Liste des familles connues (pour suggérer une famille à la création). */
export function knownFamilies(materials: readonly Material[]): string[] {
  const seen = new Map<string, string>();
  for (const m of materials) {
    const key = normalizeText(m.family);
    if (!seen.has(key)) seen.set(key, m.family.trim());
  }
  return [...seen.values()];
}
