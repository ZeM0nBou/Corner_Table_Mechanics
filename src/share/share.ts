/**
 * Partage d'un calcul par lien : enveloppe versionnée `{ v, page, state }`,
 * compressée dans le paramètre `c` de l'ancre (`#/poutres?c=…`).
 *
 * L'ancre n'est jamais envoyée au serveur : le calcul partagé ne quitte pas le
 * navigateur (hors copie du lien par l'utilisateur).
 */
import { z } from 'zod';
import { compressJson, decompressJson, ShareLinkError } from './codec';
import {
  SHARE_VERSION,
  STATE_SCHEMAS,
  type SharedPage,
  type SharedState,
  type SharedStateInput,
} from './schemas';

/** Nom du paramètre d'ancre qui porte le calcul. */
export const SHARE_PARAM = 'c';

const EnvelopeSchema = z.object({
  v: z.number(),
  page: z.string(),
  state: z.unknown(),
});

function describeIssues(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return '';
  const path = first.path.map(String).join('.');
  return path ? ` (${path} : ${first.message})` : ` (${first.message})`;
}

/**
 * Encode l'état d'une page dans le paramètre de lien.
 * L'état est d'abord validé par le même schéma qu'au décodage : un lien produit
 * par l'application est toujours relisible.
 * @throws ShareLinkError si l'état est trop volumineux
 * @throws Error si l'état ne respecte pas le schéma (erreur de programmation)
 */
export async function encodeShare<P extends SharedPage>(
  page: P,
  state: SharedStateInput<P>,
): Promise<string> {
  // Aller-retour JSON : NaN → null, undefined retiré ; ce que lira le destinataire.
  const plain = JSON.parse(JSON.stringify(state)) as unknown;
  const parsed = STATE_SCHEMAS[page].safeParse(plain);
  if (!parsed.success) {
    throw new Error(`État de la page « ${page} » non partageable${describeIssues(parsed.error)}.`);
  }
  return compressJson({ v: SHARE_VERSION, page, state: plain });
}

/**
 * Décode et valide le paramètre d'un lien pour la page `page`.
 * @throws ShareLinkError avec un message affichable si le lien est inutilisable
 */
export async function decodeShare<P extends SharedPage>(
  param: string,
  page: P,
): Promise<SharedState<P>> {
  const raw = await decompressJson(param);
  const envelope = EnvelopeSchema.safeParse(raw);
  if (!envelope.success) throw new ShareLinkError('Lien de partage invalide.');
  const { v, page: linkPage, state } = envelope.data;
  if (v !== SHARE_VERSION) {
    throw new ShareLinkError(
      v > SHARE_VERSION
        ? 'Ce lien a été créé par une version plus récente de l’outil : rechargez la page.'
        : 'Version de lien non prise en charge.',
    );
  }
  if (linkPage !== page) {
    throw new ShareLinkError('Ce lien ne correspond pas à cette page.');
  }
  const parsed = STATE_SCHEMAS[page].safeParse(state);
  if (!parsed.success) {
    throw new ShareLinkError(`Lien de partage invalide${describeIssues(parsed.error)}.`);
  }
  return parsed.data as SharedState<P>;
}

/**
 * Paramètre de partage contenu dans une ancre (`#/poutres?c=…`), ou `undefined`.
 * Le contenu n'est pas validé ici.
 */
export function shareParamFromHash(hash: string): string | undefined {
  const q = hash.indexOf('?');
  if (q === -1) return undefined;
  const value = new URLSearchParams(hash.slice(q + 1)).get(SHARE_PARAM);
  return value === null || value === '' ? undefined : value;
}

/**
 * Lien complet vers une page avec un calcul partagé.
 * @param href adresse courante (son ancre éventuelle est remplacée)
 */
export function shareUrl(href: string, page: SharedPage, param: string): string {
  const base = href.split('#')[0] ?? href;
  return `${base}#/${page}?${SHARE_PARAM}=${param}`;
}
