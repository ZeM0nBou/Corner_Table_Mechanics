import { describe, expect, it } from 'vitest';
import {
  base64urlToBytes,
  bytesToBase64url,
  compressJson,
  decompressJson,
  MAX_JSON_BYTES,
  MAX_PARAM_CHARS,
  ShareLinkError,
} from '@share/codec';

/** Compresse des octets quelconques (sans les garde-fous de `compressJson`). */
async function rawDeflate(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return bytesToBase64url(new Uint8Array(await new Response(stream).arrayBuffer()));
}

describe('base64url (RFC 4648 §5)', () => {
  // Vecteurs de test de la RFC 4648 §10, en alphabet URL et sans remplissage.
  it.each([
    ['', ''],
    ['f', 'Zg'],
    ['fo', 'Zm8'],
    ['foo', 'Zm9v'],
    ['foob', 'Zm9vYg'],
    ['fooba', 'Zm9vYmE'],
    ['foobar', 'Zm9vYmFy'],
  ])('%j ↔ %j', (text, encoded) => {
    const bytes = new TextEncoder().encode(text);
    expect(bytesToBase64url(bytes)).toBe(encoded);
    expect(base64urlToBytes(encoded)).toEqual(bytes);
  });

  it('utilise - et _ au lieu de + et /', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf]);
    expect(bytesToBase64url(bytes)).toBe('-_-_');
    expect(base64urlToBytes('-_-_')).toEqual(bytes);
  });

  it('aller-retour sur les 256 valeurs d’octet', () => {
    const bytes = new Uint8Array(256).map((_, i) => i);
    expect(base64urlToBytes(bytesToBase64url(bytes))).toEqual(bytes);
  });

  it.each(['Zm9v+', 'Zm9v/', 'Zm9v=', 'Zm 9v', 'é', 'Zm9vY'])('refuse %j', (text) => {
    expect(() => base64urlToBytes(text)).toThrow(ShareLinkError);
  });
});

describe('compressJson / decompressJson', () => {
  it('aller-retour d’un objet JSON (accents, nombres extrêmes, imbrication)', async () => {
    const value = {
      nom: 'Poutre « essai » — 3 m',
      E: 2.1e11,
      petit: 1.234e-12,
      négatif: -0.5,
      liste: [1, null, true, { a: 'b' }],
    };
    const text = await compressJson(value);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decompressJson(text)).toEqual(value);
  });

  it('les doubles sont relus à l’identique (JSON exact pour les nombres finis)', async () => {
    const values = [0.1 + 0.2, Math.PI, 1 / 3, 7850, 2.1e-5, Number.MAX_SAFE_INTEGER];
    expect(await decompressJson(await compressJson(values))).toEqual(values);
  });

  it('compresse un état répétitif', async () => {
    const loads = Array.from({ length: 50 }, (_, i) => ({ kind: 'ponctuelle', x_m: i / 10 }));
    const json = JSON.stringify(loads);
    expect((await compressJson(loads)).length).toBeLessThan(json.length);
  });

  it('refuse un état trop volumineux à l’encodage', async () => {
    const big = 'x'.repeat(MAX_JSON_BYTES + 1);
    await expect(compressJson(big)).rejects.toThrow(ShareLinkError);
  });

  it('refuse un paramètre compressé trop long (même s’il est valide une fois décodé)', async () => {
    // Données aléatoires : incompressibles, donc paramètre plus long que la borne.
    const noise = Array.from({ length: 4000 }, () => Math.random().toString(36));
    await expect(compressJson(noise)).rejects.toThrow(/trop volumineux/);
  });

  it('refuse un paramètre vide ou trop long avant tout décodage', async () => {
    await expect(decompressJson('')).rejects.toThrow(ShareLinkError);
    await expect(decompressJson('A'.repeat(MAX_PARAM_CHARS + 1))).rejects.toThrow(/trop long/);
  });

  it('refuse un lien tronqué', async () => {
    const text = await compressJson({
      a: 'une valeur assez longue pour être coupée',
      b: [1, 2, 3],
    });
    for (const cut of [1, 2, 3, Math.floor(text.length / 2)]) {
      await expect(decompressJson(text.slice(0, text.length - cut))).rejects.toThrow(
        ShareLinkError,
      );
    }
  });

  it('refuse des octets qui ne sont pas un flux deflate', async () => {
    await expect(decompressJson('AAAAAAAA')).rejects.toThrow(ShareLinkError);
    await expect(decompressJson('_____-__')).rejects.toThrow(ShareLinkError);
  });

  it('refuse un contenu qui n’est pas du JSON', async () => {
    const text = await rawDeflate(new TextEncoder().encode('pas du json {'));
    await expect(decompressJson(text)).rejects.toThrow(ShareLinkError);
  });

  it('refuse un contenu qui n’est pas de l’UTF-8 valide', async () => {
    const text = await rawDeflate(new Uint8Array([0x22, 0xff, 0xfe, 0x22]));
    await expect(decompressJson(text)).rejects.toThrow(ShareLinkError);
  });

  it('arrête une « bombe » de décompression à la borne', async () => {
    // 4 Mo de blancs (JSON valide autour) : quelques ko une fois compressés.
    const bomb = new Uint8Array(4_000_000).fill(0x20);
    bomb[0] = 0x5b; // [
    bomb[bomb.length - 1] = 0x5d; // ]
    const text = await rawDeflate(bomb);
    expect(text.length).toBeLessThan(MAX_PARAM_CHARS);
    await expect(decompressJson(text)).rejects.toThrow(/trop volumineux une fois décompressé/);
  });

  it('accepte un contenu juste sous la borne de décompression', async () => {
    const value = 'a'.repeat(MAX_JSON_BYTES - 2); // + 2 guillemets = borne exacte
    expect(
      await decompressJson(await rawDeflate(new TextEncoder().encode(JSON.stringify(value)))),
    ).toBe(value);
  });
});
