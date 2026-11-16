/**
 * Codage d'un objet JSON dans un paramètre d'URL : JSON → UTF-8 → deflate brut
 * (`CompressionStream('deflate-raw')`, natif du navigateur) → base64url.
 *
 * Un lien reçu est une ENTRÉE NON FIABLE (CLAUDE.md, § Dépôt public) :
 * - longueur du paramètre bornée AVANT tout décodage ;
 * - taille décompressée bornée PENDANT la décompression (arrêt dès le dépassement,
 *   ce qui neutralise une « bombe » de décompression) ;
 * - UTF-8 strict, JSON strict ; la validation du contenu (Zod) est faite ensuite
 *   par `share.ts`.
 *
 * Aucune dépendance : CompressionStream et DecompressionStream sont disponibles dans
 * tous les navigateurs courants depuis 2023 et dans Node ≥ 21.2 (deflate-raw).
 */

/** Longueur maximale du paramètre encodé (caractères base64url). */
export const MAX_PARAM_CHARS = 16_000;

/** Taille maximale du JSON après décompression (octets). */
export const MAX_JSON_BYTES = 256_000;

/** Lien inutilisable : le message s'affiche tel quel dans l'interface. */
export class ShareLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShareLinkError';
  }
}

const DAMAGED = 'Lien de partage invalide ou incomplet (a-t-il été coupé lors du copier-coller ?).';

/** Octets → base64url sans remplissage (RFC 4648 §5). */
export function bytesToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * base64url (sans remplissage) → octets.
 * @throws ShareLinkError si le texte contient un caractère hors alphabet ou a une longueur impossible
 */
export function base64urlToBytes(text: string): Uint8Array<ArrayBuffer> {
  // Une longueur ≡ 1 (mod 4) ne correspond à aucune suite d'octets.
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) throw new ShareLinkError(DAMAGED);
  const padded =
    text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Lit un flux d'octets en entier, en s'arrêtant au-delà de `maxBytes`. */
async function readAll(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new ShareLinkError('Lien de partage trop volumineux une fois décompressé.');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function streamOf(bytes: Uint8Array<ArrayBuffer>): ReadableStream<BufferSource> {
  return new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

/**
 * Sérialise et compresse une valeur JSON.
 * @throws ShareLinkError si le résultat dépasse `MAX_PARAM_CHARS`
 */
export async function compressJson(value: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(value));
  if (json.length > MAX_JSON_BYTES) {
    throw new ShareLinkError('Calcul trop volumineux pour être partagé par un lien.');
  }
  const compressed = await readAll(
    streamOf(json).pipeThrough(new CompressionStream('deflate-raw')),
    Number.POSITIVE_INFINITY,
  );
  const text = bytesToBase64url(compressed);
  if (text.length > MAX_PARAM_CHARS) {
    throw new ShareLinkError('Calcul trop volumineux pour être partagé par un lien.');
  }
  return text;
}

/**
 * Décompresse et lit un paramètre produit par `compressJson`.
 * Le résultat n'est PAS validé : c'est à l'appelant de le passer par un schéma Zod.
 * @throws ShareLinkError pour tout lien trop long, abîmé, trop gros ou qui n'est pas du JSON
 */
export async function decompressJson(text: string): Promise<unknown> {
  if (text.length === 0) throw new ShareLinkError(DAMAGED);
  if (text.length > MAX_PARAM_CHARS) {
    throw new ShareLinkError('Lien de partage trop long.');
  }
  const bytes = base64urlToBytes(text);
  let json: Uint8Array<ArrayBuffer>;
  try {
    json = await readAll(
      streamOf(bytes).pipeThrough(new DecompressionStream('deflate-raw')),
      MAX_JSON_BYTES,
    );
  } catch (e) {
    if (e instanceof ShareLinkError) throw e;
    throw new ShareLinkError(DAMAGED);
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(json)) as unknown;
  } catch {
    throw new ShareLinkError(DAMAGED);
  }
}
