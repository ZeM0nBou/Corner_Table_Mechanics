import { useId, type ReactNode } from 'react';

interface DecimalFieldProps {
  label: string;
  /** Symbole de la grandeur, affiché en italique (ex. « E »). */
  symbol?: string;
  text: string;
  onTextChange: (text: string) => void;
  /** Message d'erreur à afficher sous le champ. */
  error?: string | undefined;
  required?: boolean;
  /** Élément à droite du champ : sélecteur d'unité ou unité fixe. */
  adornment?: ReactNode;
}

/** Champ de saisie numérique accessible, avec libellé, unité et message d'erreur. */
export function DecimalField({
  label,
  symbol,
  text,
  onTextChange,
  error,
  required = false,
  adornment,
}: DecimalFieldProps) {
  const id = useId();
  const errorId = `${id}-erreur`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-slate-700">
        {label}
        {symbol && <span className="ml-1 font-serif italic text-slate-900">{symbol}</span>}
        {required && <span className="ml-0.5 text-red-700">*</span>}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          aria-invalid={error !== undefined}
          aria-describedby={error !== undefined ? errorId : undefined}
          className={`w-full min-w-0 rounded-md border bg-white px-2.5 py-1.5 font-mono tabular-nums focus:outline-none focus:ring-2 ${
            error !== undefined
              ? 'border-red-500 focus:ring-red-500/30'
              : 'border-slate-300 focus:border-sky-600 focus:ring-sky-600/30'
          }`}
        />
        {adornment}
      </div>
      {error !== undefined && (
        <p id={errorId} className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
