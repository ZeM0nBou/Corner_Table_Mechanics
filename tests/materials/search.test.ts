import { describe, expect, it } from 'vitest';
import { buildFamilyGroups, knownFamilies, matchesQuery, normalizeText } from '@materials/search';
import type { Material } from '@materials/schema';

const mat = (id: string, family: string, extra: Partial<Material> = {}): Material => ({
  id,
  name: id.toUpperCase(),
  family,
  E_Pa: 200e9,
  nu: 0.3,
  rho_kg_m3: 7800,
  source: 'Valeurs fictives pour test',
  verified: false,
  ...extra,
});

describe('normalizeText', () => {
  it('ignore casse, accents et espaces multiples', () => {
    expect(normalizeText('  Fonte à  Graphite SPHÉROÏDAL ')).toBe('fonte a graphite spheroidal');
  });
});

describe('matchesQuery', () => {
  const s355 = mat('s355jr', 'acier de construction', {
    name: 'S355JR',
    standard: 'EN 10025-2',
    condition: 'laminé à chaud',
  });

  it.each(['', '  ', 's355', 'S355', 'acier', 'lamine', 'EN 10025', 'chaud s355'])(
    'trouve S355JR avec %j',
    (q) => {
      expect(matchesQuery(s355, q)).toBe(true);
    },
  );

  it.each(['s235', 'inox', 's355 alu'])('ne trouve pas S355JR avec %j', (q) => {
    expect(matchesQuery(s355, q)).toBe(false);
  });
});

describe('buildFamilyGroups', () => {
  const reference = [
    mat('s235', 'acier de construction'),
    mat('6060', "alliage d'aluminium"),
    mat('s355', 'acier de construction'),
  ];

  it('regroupe la référence par famille, dans l’ordre d’apparition', () => {
    const g = buildFamilyGroups(reference, []);
    expect(g.map((x) => x.family)).toEqual(['acier de construction', "alliage d'aluminium"]);
    expect(g[0]?.items.map((i) => i.material.id)).toEqual(['s235', 's355']);
  });

  it('range un personnalisé dans sa famille de référence, après la référence, même si la casse diffère', () => {
    const g = buildFamilyGroups(reference, [mat('perso-a', '  Acier de Construction ')]);
    expect(g).toHaveLength(2);
    expect(g[0]?.family).toBe('acier de construction');
    expect(g[0]?.items.map((i) => [i.material.id, i.isCustom])).toEqual([
      ['s235', false],
      ['s355', false],
      ['perso-a', true],
    ]);
  });

  it('crée une famille nouvelle, après les familles de référence', () => {
    const g = buildFamilyGroups(reference, [mat('perso-nbr', 'élastomère')]);
    expect(g.map((x) => x.family)).toEqual([
      'acier de construction',
      "alliage d'aluminium",
      'élastomère',
    ]);
  });

  it('filtre par la requête et omet les familles vides', () => {
    const g = buildFamilyGroups(reference, [mat('perso-a', 'élastomère')], 's3');
    expect(g.map((x) => x.family)).toEqual(['acier de construction']);
    expect(g[0]?.items.map((i) => i.material.id)).toEqual(['s355']);
  });

  it('renvoie une liste vide si rien ne correspond', () => {
    expect(buildFamilyGroups(reference, [], 'titane')).toEqual([]);
  });
});

describe('knownFamilies', () => {
  it('déduplique sans tenir compte de la casse ni des accents', () => {
    expect(
      knownFamilies([mat('a', 'Élastomère'), mat('b', 'elastomere'), mat('c', 'acier')]),
    ).toEqual(['Élastomère', 'acier']);
  });
});

describe('recherche par secteur et par emploi', () => {
  const ti = mat('ti', 'alliage de titane', {
    name: 'Ti-6Al-4V',
    sectors: ['aeronautique', 'medical'],
    applicationNotes: 'implants orthopédiques',
    selectionSource: 'fictive',
  });

  it.each(['médical', 'medical', 'aéronautique', 'implant', 'titane medical'])(
    'trouve Ti-6Al-4V avec %j',
    (q) => {
      expect(matchesQuery(ti, q)).toBe(true);
    },
  );

  it('ne trouve pas un secteur absent', () => {
    expect(matchesQuery(ti, 'ferroviaire')).toBe(false);
  });
});
