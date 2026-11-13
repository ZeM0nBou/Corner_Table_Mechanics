import { describe, expect, it } from 'vitest';
import { MaterialSchema } from '@materials/schema';

/** Entrée minimale valide (valeurs fictives : on teste le schéma, pas les données). */
const valid = {
  id: 'materiau-test',
  name: 'Matériau test',
  family: 'test',
  E_Pa: 200e9,
  nu: 0.3,
  rho_kg_m3: 7800,
  source: 'Valeurs fictives pour test',
  verified: false,
};

const parse = (overrides: Record<string, unknown>) =>
  MaterialSchema.safeParse({ ...valid, ...overrides });

describe('MaterialSchema — entrées valides', () => {
  it('accepte une entrée minimale', () => {
    expect(MaterialSchema.safeParse(valid).success).toBe(true);
  });

  it('accepte une entrée complète', () => {
    const r = parse({
      standard: 'Norme X',
      condition: 'recuit',
      Re_Pa: 200e6,
      Rm_Pa: 300e6,
      A_percent: 20,
      alpha_1_K: 12e-6,
      thicknessRange_m: [0, 0.016],
      notes: 'note',
    });
    expect(r.success).toBe(true);
  });

  it('accepte Re = Rm (cas limite)', () => {
    expect(parse({ Re_Pa: 300e6, Rm_Pa: 300e6 }).success).toBe(true);
  });

  it('accepte ν = 0', () => {
    expect(parse({ nu: 0 }).success).toBe(true);
  });
});

describe('MaterialSchema — entrées invalides', () => {
  it.each([
    ['E nul', { E_Pa: 0 }],
    ['E négatif', { E_Pa: -210e9 }],
    ['E non fini', { E_Pa: Infinity }],
    ['E en texte', { E_Pa: '210e9' }],
    ['ν = 0,5', { nu: 0.5 }],
    ['ν négatif', { nu: -0.1 }],
    ['ρ nul', { rho_kg_m3: 0 }],
    ['Re négatif', { Re_Pa: -1 }],
    ['Re > Rm', { Re_Pa: 400e6, Rm_Pa: 300e6 }],
    ['A > 100 %', { A_percent: 150 }],
    ['plage d’épaisseur inversée', { thicknessRange_m: [0.04, 0.016] }],
    ['plage d’épaisseur négative', { thicknessRange_m: [-0.01, 0.016] }],
    ['source vide', { source: '  ' }],
    ['id avec majuscules', { id: 'S235JR' }],
    ['id avec espace', { id: 's235 jr' }],
    ['verified absent', { verified: undefined }],
    ['champ inconnu', { couleur: 'bleu' }],
  ])('rejette : %s', (_label, overrides) => {
    expect(parse(overrides).success).toBe(false);
  });

  it('rejette une entrée sans source', () => {
    const sansSource: Partial<typeof valid> = { ...valid };
    delete sansSource.source;
    expect(MaterialSchema.safeParse(sansSource).success).toBe(false);
  });

  it('donne un message clair (en français) pour Re > Rm', () => {
    const r = parse({ Re_Pa: 400e6, Rm_Pa: 300e6 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('Re doit être ≤ Rm.');
  });
});
