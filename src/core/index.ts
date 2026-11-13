/**
 * Moteur de calcul RDM.
 *
 * Règles (voir CLAUDE.md) :
 * - TypeScript pur, AUCUNE dépendance à React ni à l'UI (vérifié par ESLint).
 * - Fonctions pures : entrées typées, sorties typées, pas d'effet de bord.
 * - Unités SI en interne (m, N, Pa, kg, K) ; les conversions se font dans l'UI.
 * - Chaque fonction documente sa formule, sa source et ses hypothèses (JSDoc).
 *
 * Les modules (units, sections, beams, stress, buckling…) seront ajoutés
 * au fil de la feuille de route.
 */
export {};
