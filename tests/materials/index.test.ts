import { describe, expect, it } from 'vitest';
import {
  findMaterial,
  groupByFamily,
  loadMaterials,
  MaterialValidationError,
  REFERENCE_MATERIALS,
} from '@materials/index';

const fictif = {
  id: 'fictif',
  name: 'Fictif',
  family: 'test',
  E_Pa: 1e9,
  nu: 0.3,
  rho_kg_m3: 1000,
  source: 'Valeurs fictives pour test',
  verified: false,
};

describe('base de référence', () => {
  it('se charge sans erreur et contient au moins dix matériaux', () => {
    expect(REFERENCE_MATERIALS.length).toBeGreaterThanOrEqual(10);
  });

  it('a des identifiants uniques', () => {
    const ids = REFERENCE_MATERIALS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cite une norme ou une référence pour chaque entrée', () => {
    for (const m of REFERENCE_MATERIALS) {
      expect(m.source.length, m.id).toBeGreaterThan(10);
    }
  });

  it('couvre les familles demandées', () => {
    const families = new Set(REFERENCE_MATERIALS.map((m) => m.family));
    for (const f of [
      'acier de construction',
      'acier pour trempe et revenu',
      'acier inoxydable austénitique',
      "alliage d'aluminium",
      'fonte à graphite lamellaire',
      'fonte à graphite sphéroïdal',
      'alliage de titane',
    ]) {
      expect(families.has(f), f).toBe(true);
    }
  });

  // Source : EN 10025-2 — ReH min. pour t ≤ 16 mm et 16 < t ≤ 40 mm.
  it.each([
    ['s235jr-t16', 235e6],
    ['s235jr-t40', 225e6],
    ['s275jr-t16', 275e6],
    ['s275jr-t40', 265e6],
    ['s355jr-t16', 355e6],
    ['s355jr-t40', 345e6],
  ])('%s : Re = %d Pa (EN 10025-2)', (id, Re) => {
    expect(findMaterial(id)?.Re_Pa).toBe(Re);
  });

  it('les deux tranches d’épaisseur d’une nuance sont contiguës', () => {
    for (const grade of ['s235jr', 's275jr', 's355jr', 'c45-qt', '42crmo4-qt']) {
      const thin = findMaterial(`${grade}-${grade.startsWith('s') ? 't' : 'd'}16`);
      const thick = findMaterial(`${grade}-${grade.startsWith('s') ? 't' : 'd'}40`);
      expect(thin?.thicknessRange_m?.[1], grade).toBe(0.016);
      expect(thick?.thicknessRange_m?.[0], grade).toBe(0.016);
    }
  });

  it('Re diminue quand l’épaisseur augmente (effet d’épaisseur)', () => {
    for (const [thin, thick] of [
      ['s235jr-t16', 's235jr-t40'],
      ['c45-qt-d16', 'c45-qt-d40'],
      ['42crmo4-qt-d16', '42crmo4-qt-d40'],
    ] as const) {
      expect(findMaterial(thin)?.Re_Pa).toBeGreaterThan(findMaterial(thick)?.Re_Pa ?? Infinity);
    }
  });

  it('la fonte grise n’a pas de limite élastique (matériau fragile)', () => {
    expect(findMaterial('en-gjl-250')?.Re_Pa).toBeUndefined();
  });
});

describe('loadMaterials', () => {
  it('fusionne plusieurs sources valides', () => {
    const r = loadMaterials([
      { file: 'a.json', data: [fictif] },
      { file: 'b.json', data: [{ ...fictif, id: 'fictif-2' }] },
    ]);
    expect(r.map((m) => m.id)).toEqual(['fictif', 'fictif-2']);
  });

  it('rejette un id en double entre deux fichiers, en nommant les deux', () => {
    expect(() =>
      loadMaterials([
        { file: 'a.json', data: [fictif] },
        { file: 'b.json', data: [fictif] },
      ]),
    ).toThrow(/b\.json \[0\].*« fictif ».*a\.json \[0\]/);
  });

  it('rejette une entrée invalide en indiquant le fichier, l’index et l’id', () => {
    expect(() => loadMaterials([{ file: 'a.json', data: [{ ...fictif, E_Pa: -1 }] }])).toThrow(
      /a\.json \[0\] « fictif »/,
    );
  });

  it('rejette un fichier qui n’est pas un tableau', () => {
    expect(() => loadMaterials([{ file: 'a.json', data: { id: 'x' } }])).toThrow(
      MaterialValidationError,
    );
  });

  it('rapporte tous les problèmes, pas seulement le premier', () => {
    try {
      loadMaterials([
        {
          file: 'a.json',
          data: [
            { ...fictif, nu: 0.7 },
            { ...fictif, id: 'b', rho_kg_m3: 0 },
          ],
        },
      ]);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(MaterialValidationError);
      expect((e as MaterialValidationError).problems).toHaveLength(2);
    }
  });

  it('accepte une source vide', () => {
    expect(loadMaterials([{ file: 'vide.json', data: [] }])).toEqual([]);
  });
});

describe('groupByFamily', () => {
  it('regroupe en conservant l’ordre d’apparition', () => {
    const g = groupByFamily([
      { ...fictif, id: 'a', family: 'f1' },
      { ...fictif, id: 'b', family: 'f2' },
      { ...fictif, id: 'c', family: 'f1' },
    ]);
    expect([...g.keys()]).toEqual(['f1', 'f2']);
    expect(g.get('f1')?.map((m) => m.id)).toEqual(['a', 'c']);
  });
});
