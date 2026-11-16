import { createContext, useContext } from 'react';

/**
 * Export PDF par l'impression du navigateur (CLAUDE.md, § Partage).
 * Pendant un export, toutes les formules et les volets de détail sont dépliés.
 */
export interface PrintState {
  /** Déplie toutes les formules (bouton ƒ) et les volets « Détail du calcul ». */
  expandAll: boolean;
  /** Date de l'impression, affichée dans l'en-tête imprimé. */
  printedAt: Date | undefined;
  /** Lien qui rouvre le calcul imprimé (traçabilité), s'il a pu être créé. */
  link: string | undefined;
}

export interface PrintApi extends PrintState {
  /**
   * Déplie tout, attend le rendu des formules, puis ouvre la boîte d'impression.
   * @param getLink fabrique le lien du calcul à imprimer dans l'en-tête
   */
  exportPdf: (getLink?: () => Promise<string>) => Promise<void>;
}

export const PrintContext = createContext<PrintApi>({
  expandAll: false,
  printedAt: undefined,
  link: undefined,
  exportPdf: () => Promise.resolve(),
});

export function usePrint(): PrintApi {
  return useContext(PrintContext);
}
