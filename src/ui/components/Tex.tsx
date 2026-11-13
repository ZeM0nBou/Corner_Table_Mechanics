import { useEffect, useRef } from 'react';

type KatexModule = typeof import('katex');

let katexPromise: Promise<KatexModule['default']> | null = null;

/** Charge KaTeX et sa feuille de style à la première formule affichée (pas dans le paquet initial). */
function loadKatex(): Promise<KatexModule['default']> {
  katexPromise ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(
    ([m]) => m.default,
  );
  return katexPromise;
}

interface TexProps {
  /** Expression LaTeX (générée par l'application, jamais saisie librement). */
  expr: string;
  className?: string;
}

/**
 * Affiche une formule LaTeX avec KaTeX.
 * Rendu par `katex.render` dans l'élément (pas de `dangerouslySetInnerHTML`) ;
 * options par défaut de KaTeX : commandes « non sûres » (\href, \url…) désactivées.
 * En cas d'erreur de syntaxe, KaTeX affiche la source en rouge au lieu de planter.
 */
export function Tex({ expr, className = '' }: TexProps) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let cancelled = false;
    void loadKatex().then((katex) => {
      if (!cancelled && ref.current) {
        katex.render(expr, ref.current, { throwOnError: false, output: 'html' });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [expr]);
  return (
    <span ref={ref} className={className}>
      <span className="text-xs text-slate-400">chargement de la formule…</span>
    </span>
  );
}
