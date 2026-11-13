import { describe, expect, it } from 'vitest';
import {
  CustomFileError,
  findConflicts,
  MAX_IMPORT_BYTES,
  MAX_MATERIALS,
  mergeImported,
  newCustomId,
  parseCustomMaterials,
  serializeCustomMaterials,
  slugify,
  uniqueId,
  withCustomPrefix,
} from '@materials/custom';
import type { Material } from '@materials/schema';

/** Matériau fictif (valeurs de test, sans signification physique particulière). */
const mat = (id: string, extra: Partial<Material> = {}): Material => ({
  id,
  name: id,
  family: 'test',
  E_Pa: 200e9,
  nu: 0.3,
  rho_kg_m3: 7800,
  source: 'Valeurs fictives pour test',
  verified: false,
  ...extra,
});

const file = (materials: unknown[], overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ format: 'rdm-materiaux', version: 1, materials, ...overrides });

describe('identifiants', () => {
  it.each([
    ['Acier S355 fournisseur', 'acier-s355-fournisseur'],
    ['Élastomère « NBR » 70 Sh', 'elastomere-nbr-70-sh'],
    ['  --  ', 'materiau'],
    ['', 'materiau'],
  ])('slugify(%j) = %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('limite la longueur du slug', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(60);
  });

  it('ajoute le préfixe une seule fois', () => {
    expect(withCustomPrefix('abc')).toBe('perso-abc');
    expect(withCustomPrefix('perso-abc')).toBe('perso-abc');
  });

  it('uniqueId suffixe -2, -3… en cas de collision', () => {
    expect(uniqueId('perso-a', new Set())).toBe('perso-a');
    expect(uniqueId('perso-a', new Set(['perso-a']))).toBe('perso-a-2');
    expect(uniqueId('perso-a', new Set(['perso-a', 'perso-a-2']))).toBe('perso-a-3');
  });

  it('newCustomId produit un id valide pour le schéma', () => {
    expect(newCustomId('Mon Acier', new Set())).toBe('perso-mon-acier');
  });
});

describe('export / import', () => {
  it('aller-retour sans perte', () => {
    const list = [mat('perso-a', { Re_Pa: 300e6, thicknessRange_m: [0, 0.01] }), mat('perso-b')];
    const text = serializeCustomMaterials(list, new Date('2026-11-13T10:00:00Z'));
    const parsed = parseCustomMaterials(text);
    expect(parsed.rejected).toEqual([]);
    expect(parsed.materials).toEqual(list);
    expect(JSON.parse(text)).toMatchObject({ exportedAt: '2026-11-13T10:00:00.000Z' });
  });

  it('préfixe les identifiants importés qui ne le sont pas', () => {
    const parsed = parseCustomMaterials(file([mat('acier-x')]));
    expect(parsed.materials[0]?.id).toBe('perso-acier-x');
  });

  it('rejette individuellement les entrées invalides, avec leur position et un message', () => {
    const parsed = parseCustomMaterials(
      file([mat('perso-ok'), { ...mat('perso-ko'), E_Pa: -1 }, 42]),
    );
    expect(parsed.materials.map((m) => m.id)).toEqual(['perso-ok']);
    expect(parsed.rejected).toHaveLength(2);
    expect(parsed.rejected[0]).toMatchObject({ index: 1, id: 'perso-ko' });
    expect(parsed.rejected[0]?.message).toMatch(/E_Pa/);
    expect(parsed.rejected[1]).toMatchObject({ index: 2 });
  });

  it('rejette un identifiant en double dans le même fichier', () => {
    const parsed = parseCustomMaterials(file([mat('perso-a'), mat('a')]));
    expect(parsed.materials).toHaveLength(1);
    expect(parsed.rejected[0]?.message).toMatch(/double/);
  });

  it.each([
    ['pas du JSON', '{ pas du json', /JSON valide/],
    ['mauvais format', file([], { format: 'autre' }), /export de matériaux/],
    ['mauvaise version', file([], { version: 2 }), /Version/],
    ['tableau nu', JSON.stringify([mat('a')]), /export de matériaux/],
    [
      'materials absent',
      JSON.stringify({ format: 'rdm-materiaux', version: 1 }),
      /pas de liste « materials »/,
    ],
  ])('erreur bloquante : %s', (_label, text, message) => {
    expect(() => parseCustomMaterials(text)).toThrow(CustomFileError);
    expect(() => parseCustomMaterials(text)).toThrow(message);
  });

  it('refuse un fichier trop volumineux (avant même de le lire)', () => {
    const big = file([], { padding: 'x'.repeat(MAX_IMPORT_BYTES) });
    expect(() => parseCustomMaterials(big)).toThrow(/trop volumineux/);
  });

  it('compte la taille en octets UTF-8, pas en caractères', () => {
    // « é » occupe 2 octets : 600 000 caractères = 1,2 Mo.
    const big = file([], { padding: 'é'.repeat(600_000) });
    expect(() => parseCustomMaterials(big)).toThrow(/trop volumineux/);
  });

  it('refuse plus de MAX_MATERIALS matériaux', () => {
    const many = Array.from({ length: MAX_MATERIALS + 1 }, (_, i) => mat(`perso-${i}`));
    expect(() => parseCustomMaterials(file(many))).toThrow(/Trop de matériaux/);
  });
});

describe('conflits et fusion', () => {
  const existing = [mat('perso-a', { name: 'A ancien' }), mat('perso-b')];

  it('détecte les conflits d’identifiant', () => {
    expect(findConflicts(existing, [mat('perso-a'), mat('perso-c')]).map((m) => m.id)).toEqual([
      'perso-a',
    ]);
  });

  it('ajoute sans décision les matériaux sans conflit', () => {
    const r = mergeImported(existing, [mat('perso-c')], {});
    expect(r.materials.map((m) => m.id)).toEqual(['perso-a', 'perso-b', 'perso-c']);
    expect(r).toMatchObject({ added: 1, replaced: 0, skipped: 0 });
  });

  it('replace : remplace sur place', () => {
    const r = mergeImported(existing, [mat('perso-a', { name: 'A nouveau' })], {
      'perso-a': 'replace',
    });
    expect(r.materials.map((m) => m.name)).toEqual(['A nouveau', 'perso-b']);
    expect(r.replaced).toBe(1);
  });

  it('keep-both : renomme l’importé', () => {
    const r = mergeImported(existing, [mat('perso-a', { name: 'A nouveau' })], {
      'perso-a': 'keep-both',
    });
    expect(r.materials.map((m) => m.id)).toEqual(['perso-a', 'perso-b', 'perso-a-2']);
    expect(r.materials[0]?.name).toBe('A ancien');
  });

  it('skip : ignore l’importé', () => {
    const r = mergeImported(existing, [mat('perso-a', { name: 'A nouveau' })], {
      'perso-a': 'skip',
    });
    expect(r.materials).toEqual(existing);
    expect(r.skipped).toBe(1);
  });

  it('refuse de fusionner un conflit sans décision (pas d’écrasement silencieux)', () => {
    expect(() => mergeImported(existing, [mat('perso-a')], {})).toThrow(/non résolu/);
  });

  it('ne modifie pas la liste existante (fonction pure)', () => {
    const copy = structuredClone(existing);
    mergeImported(existing, [mat('perso-a'), mat('perso-z')], { 'perso-a': 'replace' });
    expect(existing).toEqual(copy);
  });
});
