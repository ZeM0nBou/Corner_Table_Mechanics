import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { loadKatex } from '@ui/components/katexLoader';
import { PrintContext, type PrintApi, type PrintState } from './printContext';

/** Attend que le navigateur ait peint deux images (rendu des formules KaTeX). */
function settle(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(resolve, 50)));
  });
}

export function PrintProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PrintState>({
    expandAll: false,
    printedAt: undefined,
    link: undefined,
  });

  useEffect(() => {
    // Impression par Ctrl+P : date à jour dans l'en-tête (rendu synchrone avant l'aperçu).
    const before = () =>
      flushSync(() => setState((s) => (s.expandAll ? s : { ...s, printedAt: new Date() })));
    const after = () => setState((s) => ({ ...s, expandAll: false, link: undefined }));
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  const exportPdf = useCallback(async (getLink?: () => Promise<string>) => {
    let link: string | undefined;
    try {
      link = getLink ? await getLink() : undefined;
    } catch {
      link = undefined; // l'export reste possible sans lien (calcul trop volumineux…)
    }
    setState({ expandAll: true, printedAt: new Date(), link });
    await loadKatex();
    await settle();
    // Repli dépliage → à l'événement `afterprint`.
    window.print();
  }, []);

  const api = useMemo<PrintApi>(() => ({ ...state, exportPdf }), [state, exportPdf]);
  return <PrintContext.Provider value={api}>{children}</PrintContext.Provider>;
}

/**
 * En-tête visible seulement à l'impression : application, page, date, avertissement
 * et lien qui rouvre le calcul.
 */
export function PrintHeader({ pageTitle }: { pageTitle: string }) {
  return (
    <PrintContext.Consumer>
      {({ printedAt, link }) => (
        <div className="mb-4 hidden border-b border-black pb-2 text-xs print:block">
          <p className="text-sm font-semibold">Calculs RDM — coin de table · {pageTitle}</p>
          <p>
            {printedAt
              ? `Imprimé le ${printedAt.toLocaleDateString('fr-FR')} à ${printedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
              : ''}
          </p>
          <p className="mt-1 font-medium">
            Outil de pré-dimensionnement — ne remplace pas une note de calcul vérifiée.
          </p>
          {link && (
            <p className="mt-1 break-all text-[9px] text-slate-700">Lien du calcul : {link}</p>
          )}
        </div>
      )}
    </PrintContext.Consumer>
  );
}
