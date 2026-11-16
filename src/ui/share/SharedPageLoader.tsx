import { useEffect, useState, type ReactNode } from 'react';
import { ShareLinkError } from '@share/codec';
import type { SharedPage, SharedState } from '@share/schemas';
import { decodeShare } from '@share/share';

/** Résultat de l'ouverture d'une page : sans lien, lien lu, ou lien inutilisable. */
export type LinkLoad<P extends SharedPage> =
  { kind: 'none' } | { kind: 'ok'; state: SharedState<P> } | { kind: 'error'; message: string };

interface Props<P extends SharedPage> {
  page: P;
  /** Paramètre `c` de l'ancre, ou `undefined` sans lien. */
  param: string | undefined;
  children: (link: LinkLoad<P>) => ReactNode;
}

/**
 * Décode le lien (asynchrone : décompression native) AVANT de monter la page, qui
 * initialise ainsi son état directement avec les valeurs du lien.
 * À monter avec `key={param}` : un nouveau lien remonte la page.
 */
export function SharedPageLoader<P extends SharedPage>({ page, param, children }: Props<P>) {
  const [link, setLink] = useState<LinkLoad<P> | undefined>(
    param === undefined ? { kind: 'none' } : undefined,
  );

  useEffect(() => {
    if (param === undefined) return undefined;
    let cancelled = false;
    decodeShare(param, page).then(
      (state) => {
        if (!cancelled) setLink({ kind: 'ok', state });
      },
      (e: unknown) => {
        if (cancelled) return;
        setLink({
          kind: 'error',
          message:
            e instanceof ShareLinkError
              ? e.message
              : 'Lien de partage illisible (navigateur trop ancien ?).',
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [param, page]);

  if (!link) return <p className="text-sm text-slate-500">Ouverture du calcul partagé…</p>;
  return children(link);
}
