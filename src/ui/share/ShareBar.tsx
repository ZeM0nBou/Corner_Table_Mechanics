import { useEffect, useState } from 'react';
import { ShareLinkError } from '@share/codec';
import type { SharedPage, SharedStateInput } from '@share/schemas';
import { encodeShare, shareUrl } from '@share/share';
import { Button } from '@ui/components/Button';

type Status =
  | { kind: 'idle' }
  | { kind: 'copied' }
  /** Presse-papiers indisponible : lien affiché pour une copie manuelle. */
  | { kind: 'manual'; url: string }
  | { kind: 'error'; message: string };

interface ShareBarProps<P extends SharedPage> {
  page: P;
  /** État courant de la page, lu au moment du clic. */
  getState: () => SharedStateInput<P>;
}

/**
 * Bouton « Copier le lien » : encode le calcul dans un lien et le copie.
 * La barre d'adresse n'est pas modifiée (décision du 16 novembre 2026 : le lien
 * n'est fabriqué qu'au clic).
 */
export function ShareBar<P extends SharedPage>({ page, getState }: ShareBarProps<P>) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    if (status.kind !== 'copied') return undefined;
    const timer = window.setTimeout(() => setStatus({ kind: 'idle' }), 3000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const copy = async () => {
    let url: string;
    try {
      url = shareUrl(window.location.href, page, await encodeShare(page, getState()));
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof ShareLinkError ? e.message : 'Impossible de créer le lien.',
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus({ kind: 'copied' });
    } catch {
      setStatus({ kind: 'manual', url });
    }
  };

  return (
    <div className="no-print flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={() => void copy()} title="Copier un lien qui rouvre ce calcul">
          Copier le lien
        </Button>
      </div>
      <p aria-live="polite" className="text-xs text-slate-600">
        {status.kind === 'copied' && 'Lien copié dans le presse-papiers.'}
        {status.kind === 'error' && <span className="text-red-700">{status.message}</span>}
      </p>
      {status.kind === 'manual' && (
        <label className="w-full max-w-md text-xs text-slate-600">
          Copie automatique impossible : copiez ce lien.
          <input
            readOnly
            value={status.url}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 font-mono text-xs"
          />
        </label>
      )}
    </div>
  );
}
