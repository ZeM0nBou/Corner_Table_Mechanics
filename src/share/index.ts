/**
 * Partage d'un calcul par lien (étape 7). Fonctions pures, sans React :
 * - `codec.ts` : compression bornée + base64url ;
 * - `schemas.ts` : format versionné de l'état de chaque page (Zod) ;
 * - `share.ts` : enveloppe, encodage et décodage, lecture de l'ancre ;
 * - `materialLink.ts` : matériau partagé (instantané de référence ou matériau personnalisé).
 */
export * from './codec';
export * from './schemas';
export * from './share';
export * from './materialLink';
