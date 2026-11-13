/**
 * Poids propre d'une poutre, comme charge répartie uniforme.
 *
 * Convention : la valeur renvoyée est l'INTENSITÉ (positive) du poids par unité de longueur ;
 * appliqué à la poutre, il est dirigé vers le bas (−z dans le moteur).
 */

/**
 * Accélération normale de la pesanteur g₀ = 9,806 65 m/s² (valeur exacte par définition).
 * Source : 3ᵉ Conférence générale des poids et mesures (1901) ; BIPM, Brochure SI, 9ᵉ éd.
 * Limite : valeur conventionnelle ; g local varie d'environ ±0,3 % selon le lieu.
 */
export const STANDARD_GRAVITY_m_s2 = 9.80665;

/**
 * Poids propre par unité de longueur d'une poutre prismatique.
 *
 * Formule : q = m′ · g₀, avec m′ = ρ · A la masse linéique (kg/m).
 * Source : définition du poids (P = m g) ; g₀ : BIPM, Brochure SI, 9ᵉ éd.
 * Hypothèses : section constante, matériau homogène ; congés des profilés négligés
 * (voir le module `sections`). Lève une RangeError si m′ est négative ou non finie.
 */
export function selfWeight_N_m(linearMass_kg_m: number): number {
  if (!Number.isFinite(linearMass_kg_m) || linearMass_kg_m < 0) {
    throw new RangeError('La masse linéique doit être un nombre positif ou nul.');
  }
  return linearMass_kg_m * STANDARD_GRAVITY_m_s2;
}
