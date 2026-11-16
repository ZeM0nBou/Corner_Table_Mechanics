import { describe, expect, it } from 'vitest';
import { bytesToBase64url, compressJson, ShareLinkError } from '@share/codec';
import {
  MAX_LOADS,
  MAX_SUPPORTS,
  SHARE_VERSION,
  type SharedPage,
  type SharedStateInput,
} from '@share/schemas';
import { decodeShare, encodeShare, shareParamFromHash, shareUrl } from '@share/share';

// États fictifs de chaque page (valeurs d'exemple, en SI).
const section = { shape: 'I' as const, dims: { h_m: 0.2, b_m: 0.1, tw_m: 0.0056, tf_m: 0.0085 } };
const reference = {
  kind: 'reference' as const,
  id: 's235jr',
  name: 'S235JR',
  E_Pa: 210e9,
  nu: 0.3,
  rho_kg_m3: 7850,
  Re_Pa: 235e6,
  Rm_Pa: 360e6,
};

/** Matériau personnalisé fictif (valeurs de test). */
const customMaterial = {
  id: 'perso-acier-essai',
  name: 'Acier d’essai',
  family: 'acier de construction',
  E_Pa: 205e9,
  nu: 0.29,
  rho_kg_m3: 7800,
  Re_Pa: 300e6,
  source: 'Valeurs fictives pour test',
  verified: false,
};

const STATES: { [P in SharedPage]: SharedStateInput<P> } = {
  sections: { section, material: null },
  contraintes: {
    material: reference,
    section,
    efforts: { N_N: 20_000, My_Nm: 10_000, Vz_N: 15_000, T_Nm: 200 },
    threshold: 1.5,
  },
  flambement: {
    material: reference,
    manualE_Pa: undefined,
    section: { shape: 'tube', dims: { d_m: 0.0603, t_m: 0.004 } },
    length_m: 3,
    planes: [
      { choice: 'biArticulee', freeK: 1 },
      { choice: 'libre', freeK: 0.85 },
    ],
    N_N: 100_000,
    threshold: 1.5,
  },
  poutres: {
    length_m: 3,
    rightEnd_m: 3,
    lengthUnit: 'm',
    supports: [
      { kind: 'appui', x_m: 0 },
      { kind: 'encastrement', x_m: 3 },
    ],
    selfWeight: true,
    loads: [
      {
        kind: 'lineaire',
        color: 2,
        x_m: undefined,
        value: 0,
        value2: 5000,
        fullLength: false,
        x1_m: 0.5,
        x2_m: 2.5,
      },
    ],
    material: { kind: 'custom', material: customMaterial },
    manualE_Pa: undefined,
    inertiaMode: 'section',
    section,
    manualI_m4: undefined,
    manualMass_kg_m: undefined,
    threshold: 1.5,
    deflectionLimit: 300,
  },
};

/** Paramètre construit à la main (pour fabriquer des liens invalides). */
const forge = (envelope: unknown) => compressJson(envelope);

describe('encodeShare / decodeShare : aller-retour', () => {
  it.each(Object.keys(STATES) as SharedPage[])('page « %s »', async (page) => {
    const param = await encodeShare(page, STATES[page]);
    expect(param).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeShare(param, page)).toEqual(STATES[page]);
  });

  it('un champ vide (undefined) ou invalide (NaN) revient vide', async () => {
    const state = {
      ...STATES.contraintes,
      efforts: { N_N: Number.NaN, My_Nm: undefined, Vz_N: 0, T_Nm: -5 },
    };
    const decoded = await decodeShare(await encodeShare('contraintes', state), 'contraintes');
    expect(decoded.efforts).toEqual({ N_N: undefined, My_Nm: undefined, Vz_N: 0, T_Nm: -5 });
  });

  it('un lien de poutre reste court (ordre de grandeur pour un message)', async () => {
    expect((await encodeShare('poutres', STATES.poutres)).length).toBeLessThan(1000);
  });

  it('refuse d’encoder un état hors schéma (erreur de programmation)', async () => {
    const bad = { ...STATES.sections, extra: 1 } as SharedStateInput<'sections'>;
    await expect(encodeShare('sections', bad)).rejects.toThrow(/non partageable/);
  });
});

describe('decodeShare : liens invalides', () => {
  const envelope = (overrides: Record<string, unknown>) => ({
    v: SHARE_VERSION,
    page: 'sections',
    state: STATES.sections,
    ...overrides,
  });

  it('lien pour une autre page', async () => {
    const param = await encodeShare('sections', STATES.sections);
    await expect(decodeShare(param, 'poutres')).rejects.toThrow(/ne correspond pas/);
  });

  it('version plus récente ou inconnue', async () => {
    await expect(decodeShare(await forge(envelope({ v: 2 })), 'sections')).rejects.toThrow(
      /plus récente/,
    );
    await expect(decodeShare(await forge(envelope({ v: 0 })), 'sections')).rejects.toThrow(
      /non prise en charge/,
    );
  });

  it.each([
    ['pas un objet', [1, 2]],
    ['sans version', { page: 'sections', state: {} }],
    ['version non numérique', { v: '1', page: 'sections', state: {} }],
  ])('enveloppe invalide : %s', async (_, raw) => {
    await expect(decodeShare(await forge(raw), 'sections')).rejects.toThrow(ShareLinkError);
  });

  it.each([
    ['champ inconnu', { ...STATES.sections, script: 'alert(1)' }],
    ['forme inconnue', { ...STATES.sections, section: { shape: 'Z', dims: {} } }],
    ['cote inconnue', { ...STATES.sections, section: { shape: 'I', dims: { r_m: 0.01 } } }],
    ['cote non numérique', { ...STATES.sections, section: { shape: 'I', dims: { h_m: '0.2' } } }],
    ['matériau sans propriété', { ...STATES.sections, material: { kind: 'reference', id: 'x' } }],
    [
      'matériau de référence non physique',
      { ...STATES.sections, material: { ...reference, nu: 0.7 } },
    ],
    [
      'matériau personnalisé invalide (Re > Rm)',
      {
        ...STATES.sections,
        material: { kind: 'custom', material: { ...customMaterial, Rm_Pa: 100e6 } },
      },
    ],
    ['identifiant non conforme', { ...STATES.sections, material: { ...reference, id: '../x' } }],
  ])('état invalide : %s', async (_, state) => {
    await expect(decodeShare(await forge(envelope({ state })), 'sections')).rejects.toThrow(
      /Lien de partage invalide/,
    );
  });

  it('nombre infini (1e999 dans le JSON) refusé', async () => {
    // JSON.stringify n'écrit jamais Infinity : on forge le texte JSON lui-même.
    const json = JSON.stringify(envelope({})).replace('"h_m":0.2', '"h_m":1e999');
    const stream = new Blob([new TextEncoder().encode(json)])
      .stream()
      .pipeThrough(new CompressionStream('deflate-raw'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    await expect(decodeShare(bytesToBase64url(bytes), 'sections')).rejects.toThrow(
      /Lien de partage invalide/,
    );
  });

  it('listes bornées (appuis, charges)', async () => {
    const base = STATES.poutres;
    const tooManySupports = {
      ...base,
      supports: Array.from({ length: MAX_SUPPORTS + 1 }, () => ({ kind: 'appui', x_m: 0 })),
    };
    const tooManyLoads = {
      ...base,
      loads: Array.from({ length: MAX_LOADS + 1 }, () => base.loads[0]),
    };
    for (const state of [tooManySupports, tooManyLoads]) {
      await expect(
        decodeShare(await forge({ v: SHARE_VERSION, page: 'poutres', state }), 'poutres'),
      ).rejects.toThrow(/Lien de partage invalide/);
    }
  });

  it('plans de flambement : exactement deux', async () => {
    const state = { ...STATES.flambement, planes: [STATES.flambement.planes[0]] };
    await expect(
      decodeShare(await forge({ v: SHARE_VERSION, page: 'flambement', state }), 'flambement'),
    ).rejects.toThrow(/Lien de partage invalide/);
  });
});

describe('ancre et lien', () => {
  it.each([
    ['#/poutres?c=abc_-1', 'abc_-1'],
    ['#/poutres?x=1&c=abc', 'abc'],
    ['#/poutres', undefined],
    ['#/poutres?c=', undefined],
    ['', undefined],
  ])('shareParamFromHash(%j) = %j', (hash, expected) => {
    expect(shareParamFromHash(hash)).toBe(expected);
  });

  it('shareUrl remplace l’ancre courante', () => {
    expect(shareUrl('https://exemple.org/app/#/sections?c=old', 'poutres', 'abc')).toBe(
      'https://exemple.org/app/#/poutres?c=abc',
    );
    expect(shareUrl('https://exemple.org/app/', 'flambement', 'xyz')).toBe(
      'https://exemple.org/app/#/flambement?c=xyz',
    );
  });

  it('aller-retour complet par l’URL', async () => {
    const url = shareUrl(
      'https://exemple.org/',
      'contraintes',
      await encodeShare('contraintes', STATES.contraintes),
    );
    const param = shareParamFromHash(new URL(url).hash);
    expect(param).toBeDefined();
    expect(await decodeShare(param ?? '', 'contraintes')).toEqual(STATES.contraintes);
  });
});
