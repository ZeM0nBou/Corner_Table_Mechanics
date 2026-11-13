/**
 * Conversions d'unités.
 *
 * Le moteur de calcul travaille exclusivement en unités SI (m, N, Pa, kg, K).
 * Ces fonctions servent à l'UI pour convertir les saisies vers le SI et les
 * résultats depuis le SI.
 *
 * Source des facteurs : BIPM, *Le Système international d'unités (SI)*,
 * 9ᵉ éd. (2019), tableau 7 (préfixes SI). Tous les facteurs sont des puissances
 * de dix exactes par définition ; seule l'arithmétique flottante introduit une
 * erreur relative de l'ordre de 1e-16.
 *
 * Exception : le daN n'est pas une unité à préfixe recommandée par le SI, mais
 * il est d'usage courant en mécanique (1 daN = 10 N exactement).
 */

/** Facteur multiplicatif vers l'unité SI de la grandeur (valeur_SI = valeur × facteur). */
export const UNITS = {
  /** Longueur — SI : m */
  length: { mm: 1e-3, cm: 1e-2, m: 1 },
  /** Force — SI : N */
  force: { N: 1, daN: 10, kN: 1e3 },
  /** Contrainte, pression, module d'élasticité — SI : Pa */
  stress: { Pa: 1, kPa: 1e3, MPa: 1e6, GPa: 1e9 },
  /** Moment (flexion, torsion) — SI : N·m */
  moment: { 'N·mm': 1e-3, 'N·m': 1, 'kN·m': 1e3 },
  /** Aire — SI : m² */
  area: { 'mm²': 1e-6, 'cm²': 1e-4, 'm²': 1 },
  /** Module de résistance (W) — SI : m³ */
  sectionModulus: { 'mm³': 1e-9, 'cm³': 1e-6, 'm³': 1 },
  /** Moment quadratique (I, J) — SI : m⁴ */
  secondMomentOfArea: { 'mm⁴': 1e-12, 'cm⁴': 1e-8, 'm⁴': 1 },
  /** Masse volumique — SI : kg/m³ (1 g/cm³ = 10⁻³ kg / 10⁻⁶ m³ = 10³ kg/m³) */
  density: { 'kg/m³': 1, 'g/cm³': 1e3 },
  /** Coefficient de dilatation thermique — SI : 1/K */
  thermalExpansion: { '1/K': 1, '10⁻⁶/K': 1e-6 },
} as const;

/** Grandeur physique gérée par le module. */
export type Quantity = keyof typeof UNITS;

/** Unités disponibles pour une grandeur donnée. */
export type UnitOf<Q extends Quantity> = keyof (typeof UNITS)[Q] & string;

/** Unité SI de référence (facteur 1) de chaque grandeur. */
export const SI_UNIT = {
  length: 'm',
  force: 'N',
  stress: 'Pa',
  moment: 'N·m',
  area: 'm²',
  sectionModulus: 'm³',
  secondMomentOfArea: 'm⁴',
  density: 'kg/m³',
  thermalExpansion: '1/K',
} as const satisfies { [Q in Quantity]: UnitOf<Q> };

/** Liste ordonnée des unités d'une grandeur (pour les sélecteurs de l'UI). */
export function unitsOf<Q extends Quantity>(quantity: Q): UnitOf<Q>[] {
  return Object.keys(UNITS[quantity]) as UnitOf<Q>[];
}

function factor<Q extends Quantity>(quantity: Q, unit: UnitOf<Q>): number {
  const table: Record<string, number> = UNITS[quantity];
  const f = table[unit];
  if (f === undefined) {
    throw new Error(`Unité inconnue « ${unit} » pour la grandeur « ${quantity} ».`);
  }
  return f;
}

function assertFinite(value: number, context: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${context} : valeur non finie (${String(value)}).`);
  }
}

/**
 * Convertit une valeur exprimée dans `unit` vers l'unité SI de la grandeur.
 *
 * Formule : valeur_SI = valeur × facteur(unit)
 * Source : BIPM, Brochure SI, 9ᵉ éd., tableau 7.
 * Limites : conversions linéaires uniquement (pas de températures en °C,
 * qui demanderaient un décalage). Lève une RangeError si la valeur n'est pas finie.
 *
 * @example toSI(235, 'stress', 'MPa') // 2.35e8 (Pa)
 */
export function toSI<Q extends Quantity>(value: number, quantity: Q, unit: UnitOf<Q>): number {
  assertFinite(value, `Conversion de ${unit} vers le SI`);
  return value * factor(quantity, unit);
}

/**
 * Convertit une valeur SI vers l'unité `unit` de la même grandeur.
 *
 * Formule : valeur = valeur_SI / facteur(unit)
 * Source : BIPM, Brochure SI, 9ᵉ éd., tableau 7.
 * Limites : idem `toSI`.
 *
 * @example fromSI(2.35e8, 'stress', 'MPa') // 235
 */
export function fromSI<Q extends Quantity>(valueSI: number, quantity: Q, unit: UnitOf<Q>): number {
  assertFinite(valueSI, `Conversion du SI vers ${unit}`);
  return valueSI / factor(quantity, unit);
}
