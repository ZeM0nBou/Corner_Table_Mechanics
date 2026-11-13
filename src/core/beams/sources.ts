/**
 * Sources et hypothèses du module poutres, affichées avec les résultats dans l'UI
 * (traçabilité, CLAUDE.md).
 */

/** Sources des formules de poutres. */
export const BEAM_SOURCES = {
  method:
    'Fonctions de singularité (W. H. Macaulay, Messenger of Mathematics, vol. 48, 1919 ; Hibbeler, Mechanics of Materials, § « Discontinuity Functions »). TODO: à vérifier — n° de paragraphe.',
  equations:
    'Poutre d’Euler-Bernoulli (Gere & Goodno, Mechanics of Materials, chap. « Deflections of Beams » ; Timoshenko, Résistance des matériaux, t. 1).',
  tables:
    'Roark’s Formulas for Stress and Strain, 8e éd., tableau 8.1 ; Gere & Goodno, Mechanics of Materials, annexe « Deflections and Slopes of Beams ». TODO: à vérifier — n° de cas.',
} as const;

/** Hypothèses affichées avec chaque résultat de poutre. */
export const BEAM_ASSUMPTIONS: readonly string[] = [
  'Poutre droite de rigidité EI constante ; petites déformations ; matériau élastique linéaire homogène isotrope.',
  'Théorie d’Euler-Bernoulli : la flèche due à l’effort tranchant est négligée (poutres courtes sous-estimées).',
  'Flexion plane, sans effort normal ni torsion ; appuis ponctuels parfaits.',
];
