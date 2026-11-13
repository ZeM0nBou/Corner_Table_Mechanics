const displayFormatter = new Intl.NumberFormat('fr-FR', { maximumSignificantDigits: 4 });
const inputFormatter = new Intl.NumberFormat('fr-FR', {
  maximumSignificantDigits: 6,
  useGrouping: false,
});

/** Formate un nombre pour l'affichage (français, 4 chiffres significatifs). */
export function formatNumber(value: number): string {
  return displayFormatter.format(value);
}

/** Formate un nombre pour pré-remplir un champ de saisie (virgule décimale, sans séparateur de milliers). */
export function formatInput(value: number): string {
  return inputFormatter.format(value);
}

const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

/**
 * Lit un nombre saisi par l'utilisateur.
 * Accepte la virgule ou le point décimal, les espaces (y compris insécables) comme
 * séparateurs de milliers et la notation scientifique (2,1e5).
 *
 * @returns `undefined` si le champ est vide, `NaN` si la saisie est invalide.
 */
export function parseDecimal(text: string): number | undefined {
  // \s couvre aussi les espaces insécables (U+00A0, U+202F) produites par Intl fr-FR.
  const cleaned = text.replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return undefined;
  return DECIMAL.test(cleaned) ? Number(cleaned) : NaN;
}
