import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

interface InfoTipProps {
  /** Nom accessible du bouton, ex. « Aperçu des formes de section ». */
  label: string;
  children: ReactNode;
}

/**
 * Bouton « i » entouré qui affiche un panneau d'aide au survol, au focus clavier ou au
 * toucher (tablette). Le panneau reste ouvert tant que le pointeur est sur le bouton ou
 * sur le panneau ; Échap ou un clic ailleurs le ferme.
 */
export function InfoTip({ label, children }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span
      ref={root}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        className="no-print inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-400 font-serif text-[11px] leading-none text-slate-600 italic hover:border-sky-600 hover:text-sky-700 focus:ring-2 focus:ring-sky-600/30 focus:outline-none"
      >
        i
      </button>
      {open && (
        <span
          id={panelId}
          role="tooltip"
          className="absolute top-full left-0 z-30 mt-1 block w-max max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  );
}
