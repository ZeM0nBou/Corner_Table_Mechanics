import { useState } from 'react';
import { REFERENCE_MATERIALS } from '@materials/index';
import type { Material } from '@materials/schema';
import {
  addLinkedMaterial,
  linkedMaterialConflicts,
  resolveSharedMaterial,
  toSharedMaterial,
  type ResolvedMaterial,
} from '@share/materialLink';
import type { SharedMaterial } from '@share/schemas';
import { useCustomMaterials } from '@ui/materials/useCustomMaterials';

export interface LinkedMaterial {
  resolved: ResolvedMaterial;
  /** Le matériau reçu a été ajouté aux matériaux personnalisés. */
  saved: boolean;
  /** Un matériau personnalisé local porte déjà le même identifiant. */
  conflict: boolean;
  /** Ajoute le matériau personnalisé reçu à ses matériaux et le sélectionne. */
  save: (decision: 'replace' | 'keep-both') => void;
}

/**
 * Matériau choisi dans une page, matériaux personnalisés, et matériau reçu par un lien.
 *
 * @param defaultId matériau par défaut (sans lien), chaîne vide pour aucun
 * @param fromLink matériau du lien ; `undefined` si la page n'a pas été ouverte par un lien
 *        (`null` : lien sans matériau)
 */
export function usePageMaterial(defaultId: string, fromLink: SharedMaterial | undefined) {
  const custom = useCustomMaterials();
  // Résolu une seule fois, à l'ouverture : la liste des matériaux personnalisés est
  // déjà lue (lecture synchrone du stockage à l'initialisation de useCustomMaterials).
  const [resolved] = useState(() =>
    fromLink === undefined
      ? undefined
      : resolveSharedMaterial(fromLink, REFERENCE_MATERIALS, custom.materials),
  );
  const [materialId, setMaterialId] = useState(() =>
    fromLink === undefined ? defaultId : (resolved?.material.id ?? ''),
  );
  const [saved, setSaved] = useState(false);

  const temporary = !saved && resolved?.temporary ? [resolved.temporary] : [];
  const customList: Material[] = [...custom.materials, ...temporary];
  const material = [...REFERENCE_MATERIALS, ...customList].find((m) => m.id === materialId);

  let linked: LinkedMaterial | undefined;
  if (resolved) {
    const original = resolved.status.kind === 'perso-lien' ? resolved.status.original : undefined;
    linked = {
      resolved,
      saved,
      conflict: original !== undefined && linkedMaterialConflicts(custom.materials, original),
      save: (decision) => {
        if (!original) return;
        const r = addLinkedMaterial(custom.materials, original, decision);
        custom.replaceAll(r.materials);
        setSaved(true);
        setMaterialId(r.id);
      },
    };
  }

  return {
    /** Matériaux personnalisés + matériau temporaire du lien, pour le sélecteur. */
    customList,
    /** Avertissement de stockage des matériaux personnalisés. */
    storageWarning: custom.warning,
    material,
    materialId,
    setMaterialId,
    linked,
    /** Forme partageable du matériau choisi. */
    shared: (): SharedMaterial => toSharedMaterial(material, REFERENCE_MATERIALS),
  };
}
