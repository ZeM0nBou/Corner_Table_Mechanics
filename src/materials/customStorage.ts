/**
 * Persistance des matériaux personnalisés dans le stockage du navigateur.
 *
 * Le stockage est injecté (interface minimale de `Storage`) pour rester testable
 * sans navigateur. Toute lecture ou écriture est protégée : stockage absent
 * (navigation privée, cookies bloqués), plein, ou contenu corrompu ne font
 * jamais planter l'application — on renvoie un avertissement lisible.
 *
 * Format stocké : le même que l'export JSON (versionné), ce qui permet de
 * réutiliser la validation de l'import.
 */
import { CustomFileError, parseCustomMaterials, serializeCustomMaterials } from './custom';
import type { Material } from './schema';

export const STORAGE_KEY = 'rdm.materiaux-perso';

/** Sous-ensemble de l'API `Storage` du navigateur. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LoadResult {
  materials: Material[];
  warning?: string;
}

/** Charge les matériaux personnalisés ; ne lève jamais d'exception. */
export function loadCustomMaterials(storage: StorageLike | null): LoadResult {
  if (storage === null) {
    return {
      materials: [],
      warning:
        'Stockage du navigateur indisponible : les matériaux personnalisés ne seront pas conservés.',
    };
  }

  let text: string | null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return {
      materials: [],
      warning: 'Lecture du stockage du navigateur impossible.',
    };
  }
  if (text === null) return { materials: [] };

  try {
    const { materials, rejected } = parseCustomMaterials(text);
    if (rejected.length > 0) {
      return {
        materials,
        warning: `${rejected.length} matériau(x) personnalisé(s) illisible(s) ont été ignorés.`,
      };
    }
    return { materials };
  } catch (e) {
    const detail = e instanceof CustomFileError ? ` (${e.message})` : '';
    return {
      materials: [],
      warning: `Matériaux personnalisés enregistrés illisibles${detail}.`,
    };
  }
}

/** Enregistre les matériaux personnalisés. Renvoie un message d'erreur, ou `undefined` si tout va bien. */
export function saveCustomMaterials(
  storage: StorageLike | null,
  materials: readonly Material[],
  now: Date,
): string | undefined {
  if (storage === null) {
    return 'Stockage du navigateur indisponible : pensez à exporter vos matériaux.';
  }
  try {
    storage.setItem(STORAGE_KEY, serializeCustomMaterials(materials, now));
    return undefined;
  } catch {
    return 'Enregistrement impossible (stockage plein ou bloqué) : pensez à exporter vos matériaux.';
  }
}

/** Accès protégé au `localStorage` du navigateur (null s'il est inaccessible). */
export function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
