import { describe, expect, it } from 'vitest';
import {
  findMaterial,
  groupByFamily,
  loadMaterials,
  MaterialValidationError,
  REFERENCE_MATERIALS,
} from '@materials/index';
import { PROCESS_KEYS } from '@materials/selection';

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

  // Convention (CLAUDE.md) : une seule entrée par nuance et par état ; quand Re dépend
  // de l'épaisseur, on stocke la moyenne des minima des tranches courantes.
  it('ne contient qu’une entrée par nuance et par état', () => {
    const keys = REFERENCE_MATERIALS.map((m) => `${m.name}|${m.condition ?? ''}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // Moyennes des minima des tranches t ≤ 16 et 16 < t ≤ 40 mm (EN 10025-2),
  // ou d ≤ 16 et 16 < d ≤ 40 mm (EN ISO 683-1 / -2, état +QT).
  it.each([
    ['s235jr', 235e6, 225e6],
    ['s275jr', 275e6, 265e6],
    ['s355jr', 355e6, 345e6],
    ['c45-qt', 490e6, 430e6],
    ['42crmo4-qt', 900e6, 750e6],
  ])('%s : Re = moyenne de %d et %d Pa', (id, thin, thick) => {
    expect(findMaterial(id)?.Re_Pa).toBe((thin + thick) / 2);
  });

  it('la moyenne reste à moins de 10 % des valeurs de chaque tranche', () => {
    for (const [, thin, thick] of [
      ['s235jr', 235, 225],
      ['c45-qt', 490, 430],
      ['42crmo4-qt', 900, 750],
    ] as const) {
      const mean = (thin + thick) / 2;
      expect(Math.abs(thin - mean) / mean).toBeLessThan(0.1);
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

describe('base de référence — aide au choix', () => {
  it('chaque matériau a un indice de prix, les 17 procédés, au moins un secteur et une source', () => {
    for (const m of REFERENCE_MATERIALS) {
      expect(m.costIndex, m.id).toBeDefined();
      expect(m.costNote, m.id).toBeDefined();
      expect(Object.keys(m.processes ?? {}).sort(), m.id).toEqual([...PROCESS_KEYS].sort());
      expect(m.sectors?.length, m.id).toBeGreaterThan(0);
      expect(m.selectionSource, m.id).toBeDefined();
    }
  });

  it('chaque « déconseillé » ou « précautions » est expliqué par une note', () => {
    for (const m of REFERENCE_MATERIALS) {
      for (const [process, aptitude] of Object.entries(m.processes ?? {})) {
        if (aptitude.rating === 'deconseille' || aptitude.rating === 'precautions') {
          expect(aptitude.note, `${m.id} / ${process}`).toBeDefined();
        }
      }
    }
  });

  // Cohérence physique élémentaire (Ashby, ch. 14 ; métallurgie usuelle).
  it('oxycoupage impossible hors aciers non alliés et faiblement alliés', () => {
    for (const id of ['1-4301', '1-4404', 'en-aw-6060-t6', 'en-aw-7075-t6', 'ti-6al-4v-gr5']) {
      expect(findMaterial(id)?.processes?.oxycoupage?.rating, id).toBe('deconseille');
    }
  });

  it('anodisation réservée à l’aluminium et au titane', () => {
    for (const m of REFERENCE_MATERIALS) {
      const ok = m.family === "alliage d'aluminium" || m.family === 'alliage de titane';
      expect(m.processes?.anodisation?.rating === 'deconseille', m.id).toBe(!ok);
    }
  });

  it('7075 non soudable par fusion ; fontes : fonderie excellente', () => {
    expect(findMaterial('en-aw-7075-t6')?.processes?.soudage?.rating).toBe('deconseille');
    expect(findMaterial('en-gjl-250')?.processes?.fonderie?.rating).toBe('excellent');
    expect(findMaterial('en-gjs-400-15')?.processes?.fonderie?.rating).toBe('excellent');
  });

  it('ordre des prix : S235 le moins cher, Ti-6Al-4V le plus cher, 316L ≥ 304', () => {
    const cost = (id: string) => findMaterial(id)?.costIndex ?? NaN;
    expect(cost('s235jr')).toBe(1);
    expect(cost('ti-6al-4v-gr5')).toBe(5);
    expect(cost('1-4404')).toBeGreaterThanOrEqual(cost('1-4301'));
  });
});

describe('base de référence — atouts et limites', () => {
  it('chaque matériau a 2 à 4 atouts et 2 à 4 limites', () => {
    for (const m of REFERENCE_MATERIALS) {
      expect(m.pros?.length, m.id).toBeGreaterThanOrEqual(2);
      expect(m.pros?.length, m.id).toBeLessThanOrEqual(4);
      expect(m.cons?.length, m.id).toBeGreaterThanOrEqual(2);
      expect(m.cons?.length, m.id).toBeLessThanOrEqual(4);
    }
  });

  it('les limites sont cohérentes avec les procédés : un matériau « non soudable » a soudage déconseillé', () => {
    for (const m of REFERENCE_MATERIALS) {
      if (m.cons?.some((c) => /non soudable/i.test(c))) {
        expect(m.processes?.soudage?.rating, m.id).toBe('deconseille');
      }
    }
  });
});
