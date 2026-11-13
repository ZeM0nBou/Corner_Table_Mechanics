import { describe, expect, it } from 'vitest';
import {
  browserStorage,
  loadCustomMaterials,
  saveCustomMaterials,
  STORAGE_KEY,
  type StorageLike,
} from '@materials/customStorage';
import type { Material } from '@materials/schema';

const mat = (id: string): Material => ({
  id,
  name: id,
  family: 'test',
  E_Pa: 200e9,
  nu: 0.3,
  rho_kg_m3: 7800,
  source: 'Valeurs fictives pour test',
  verified: true,
});

/** Stockage en mémoire, avec possibilité de simuler des pannes. */
function memoryStorage(initial?: string, fail?: { get?: boolean; set?: boolean }) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(STORAGE_KEY, initial);
  const storage: StorageLike = {
    getItem: (k) => {
      if (fail?.get) throw new Error('SecurityError');
      return data.get(k) ?? null;
    },
    setItem: (k, v) => {
      if (fail?.set) throw new Error('QuotaExceededError');
      data.set(k, v);
    },
  };
  return { storage, data };
}

const NOW = new Date('2026-11-13T10:00:00Z');

describe('stockage des matériaux personnalisés', () => {
  it('aller-retour enregistrement → chargement', () => {
    const { storage } = memoryStorage();
    expect(saveCustomMaterials(storage, [mat('perso-a'), mat('perso-b')], NOW)).toBeUndefined();
    expect(loadCustomMaterials(storage)).toEqual({ materials: [mat('perso-a'), mat('perso-b')] });
  });

  it('stockage vide : liste vide, sans avertissement', () => {
    expect(loadCustomMaterials(memoryStorage().storage)).toEqual({ materials: [] });
  });

  it('stockage indisponible : liste vide et avertissement', () => {
    const r = loadCustomMaterials(null);
    expect(r.materials).toEqual([]);
    expect(r.warning).toMatch(/indisponible/);
    expect(saveCustomMaterials(null, [], NOW)).toMatch(/exporter/);
  });

  it('lecture qui lève une exception (navigation privée) : pas de plantage', () => {
    const r = loadCustomMaterials(memoryStorage(undefined, { get: true }).storage);
    expect(r.materials).toEqual([]);
    expect(r.warning).toMatch(/impossible/);
  });

  it('stockage plein : message d’erreur, pas d’exception', () => {
    const { storage } = memoryStorage(undefined, { set: true });
    expect(saveCustomMaterials(storage, [mat('perso-a')], NOW)).toMatch(/plein/);
  });

  it('contenu corrompu : liste vide et avertissement', () => {
    const r = loadCustomMaterials(memoryStorage('{ corrompu').storage);
    expect(r.materials).toEqual([]);
    expect(r.warning).toMatch(/illisibles/);
  });

  it('entrées partiellement invalides : garde les valides et avertit', () => {
    const text = JSON.stringify({
      format: 'rdm-materiaux',
      version: 1,
      materials: [mat('perso-a'), { ...mat('perso-b'), nu: 2 }],
    });
    const r = loadCustomMaterials(memoryStorage(text).storage);
    expect(r.materials.map((m) => m.id)).toEqual(['perso-a']);
    expect(r.warning).toMatch(/1 matériau/);
  });

  it('browserStorage renvoie null hors navigateur', () => {
    expect(browserStorage()).toBeNull();
  });
});
