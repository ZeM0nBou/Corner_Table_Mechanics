/**
 * Avertissement permanent et discret (CLAUDE.md, § UI / UX).
 * Toujours visible, y compris à l'impression.
 */
export function Disclaimer() {
  return (
    <p
      role="note"
      className="border-t border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 print:border-black print:bg-white print:text-black"
    >
      Outil de pré-dimensionnement — ne remplace pas une note de calcul vérifiée.
    </p>
  );
}
