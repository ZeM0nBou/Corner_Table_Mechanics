const formatter = new Intl.NumberFormat('fr-FR', { maximumSignificantDigits: 4 });

/** Formate un nombre pour l'affichage (français, 4 chiffres significatifs). */
export function formatNumber(value: number): string {
  return formatter.format(value);
}
