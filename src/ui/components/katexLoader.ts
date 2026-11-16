type KatexModule = typeof import('katex');

let katexPromise: Promise<KatexModule['default']> | null = null;

/** Charge KaTeX et sa feuille de style à la première formule affichée (pas dans le paquet initial). */
export function loadKatex(): Promise<KatexModule['default']> {
  katexPromise ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(
    ([m]) => m.default,
  );
  return katexPromise;
}
