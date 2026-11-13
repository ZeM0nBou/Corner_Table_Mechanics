import { useCallback, useState } from 'react';
import type { Material } from '@materials/schema';
import { browserStorage, loadCustomMaterials, saveCustomMaterials } from '@materials/customStorage';

interface CustomState {
  materials: Material[];
  /** Dernier avertissement de stockage (lecture ou écriture), à afficher. */
  warning: string | undefined;
}

/** Matériaux personnalisés de l'utilisateur, persistés dans le navigateur. */
export function useCustomMaterials() {
  const [state, setState] = useState<CustomState>(() => {
    const r = loadCustomMaterials(browserStorage());
    return { materials: r.materials, warning: r.warning };
  });

  /** Remplace la liste complète et l'enregistre. */
  const replaceAll = useCallback((next: Material[]) => {
    const warning = saveCustomMaterials(browserStorage(), next, new Date());
    setState({ materials: next, warning });
  }, []);

  const upsert = useCallback(
    (m: Material) => {
      const list = state.materials;
      const i = list.findIndex((x) => x.id === m.id);
      replaceAll(i === -1 ? [...list, m] : list.map((x) => (x.id === m.id ? m : x)));
    },
    [state.materials, replaceAll],
  );

  const remove = useCallback(
    (id: string) => replaceAll(state.materials.filter((m) => m.id !== id)),
    [state.materials, replaceAll],
  );

  return { materials: state.materials, warning: state.warning, replaceAll, upsert, remove };
}
