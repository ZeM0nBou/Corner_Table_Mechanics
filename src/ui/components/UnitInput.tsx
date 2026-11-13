import { useState } from 'react';
import { fromSI, toSI, type Quantity, type UnitOf } from '@core/units';
import { formatInput, parseDecimal } from '@ui/format';
import { DecimalField } from './DecimalField';
import { UnitSelect } from './UnitSelect';

interface UnitInputProps<Q extends Quantity> {
  label: string;
  symbol?: string;
  quantity: Q;
  defaultUnit: UnitOf<Q>;
  /** Valeur initiale en SI (le composant gère ensuite sa saisie ; changer `key` pour le réinitialiser). */
  initialSI?: number | undefined;
  /** Reçoit la valeur en SI : `undefined` si vide, `NaN` si la saisie est invalide. */
  onChange: (valueSI: number | undefined) => void;
  /** Erreur de validation venant du parent (ex. schéma Zod). */
  error?: string | undefined;
  required?: boolean;
}

/**
 * Saisie d'une grandeur physique avec choix de l'unité.
 * La conversion vers le SI se fait ici (CLAUDE.md : conversions uniquement dans l'UI).
 * Changer d'unité conserve la valeur physique : le texte affiché est converti.
 */
export function UnitInput<Q extends Quantity>({
  label,
  symbol,
  quantity,
  defaultUnit,
  initialSI,
  onChange,
  error,
  required,
}: UnitInputProps<Q>) {
  const [unit, setUnit] = useState<UnitOf<Q>>(defaultUnit);
  const [text, setText] = useState(() =>
    initialSI === undefined ? '' : formatInput(fromSI(initialSI, quantity, defaultUnit)),
  );

  const parsed = parseDecimal(text);
  const localError = parsed !== undefined && Number.isNaN(parsed) ? 'Nombre invalide.' : undefined;

  const handleText = (next: string) => {
    setText(next);
    const v = parseDecimal(next);
    onChange(v === undefined || Number.isNaN(v) ? v : toSI(v, quantity, unit));
  };

  const handleUnit = (next: UnitOf<Q>) => {
    if (parsed !== undefined && Number.isFinite(parsed)) {
      setText(formatInput(fromSI(toSI(parsed, quantity, unit), quantity, next)));
    }
    setUnit(next);
  };

  return (
    <DecimalField
      label={label}
      {...(symbol !== undefined && { symbol })}
      {...(required !== undefined && { required })}
      text={text}
      onTextChange={handleText}
      error={localError ?? error}
      adornment={
        <UnitSelect
          quantity={quantity}
          value={unit}
          onChange={handleUnit}
          label={`Unité de ${label}`}
        />
      }
    />
  );
}

interface NumberInputProps {
  label: string;
  symbol?: string;
  /** Unité fixe affichée (ex. « % »), ou rien pour une grandeur sans dimension. */
  unitLabel?: string;
  initial?: number | undefined;
  onChange: (value: number | undefined) => void;
  error?: string | undefined;
  required?: boolean;
}

/** Saisie d'une grandeur sans choix d'unité (ν, A %…). */
export function NumberInput({
  label,
  symbol,
  unitLabel,
  initial,
  onChange,
  error,
  required,
}: NumberInputProps) {
  const [text, setText] = useState(() => (initial === undefined ? '' : formatInput(initial)));
  const parsed = parseDecimal(text);
  const localError = parsed !== undefined && Number.isNaN(parsed) ? 'Nombre invalide.' : undefined;

  return (
    <DecimalField
      label={label}
      {...(symbol !== undefined && { symbol })}
      {...(required !== undefined && { required })}
      text={text}
      onTextChange={(next) => {
        setText(next);
        onChange(parseDecimal(next));
      }}
      error={localError ?? error}
      adornment={
        unitLabel !== undefined && (
          <span className="w-12 shrink-0 text-sm text-slate-600">{unitLabel}</span>
        )
      }
    />
  );
}
