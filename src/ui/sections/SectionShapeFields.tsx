import type { SectionShape } from '@core/sections';
import { InfoTip } from '@ui/components/InfoTip';
import { UnitInput } from '@ui/components/UnitInput';
import { SHAPES, shapeSpec } from './sectionForm';
import { ShapeThumbnail } from './ShapeThumbnail';

export type Dims = Record<string, number | undefined>;

interface SectionShapeFieldsProps {
  /** Préfixe d'identifiant, unique dans la page. */
  idPrefix: string;
  shape: SectionShape;
  dims: Dims;
  onShapeChange: (shape: SectionShape) => void;
  /** Reçoit la cote modifiée, en SI (`undefined` si vide, `NaN` si invalide). */
  onDimChange: (key: string, value_m: number | undefined) => void;
}

/**
 * Choix de la forme de section (liste, aperçu des formes au survol du bouton ⓘ) et saisie
 * de ses cotes avec unités. Partagé par les pages Poutres et Contraintes.
 */
export function SectionShapeFields({
  idPrefix,
  shape,
  dims,
  onShapeChange,
  onDimChange,
}: SectionShapeFieldsProps) {
  const labelId = `${idPrefix}-forme`;
  return (
    <>
      <div className="flex flex-col gap-1 text-sm text-slate-700">
        <span className="flex items-center gap-1.5">
          <span id={labelId}>Forme de la section</span>
          <InfoTip label="Aperçu des formes de section">
            <span className="grid grid-cols-4 gap-2">
              {SHAPES.map((s) => (
                <span
                  key={s.shape}
                  className={`flex w-20 flex-col items-center gap-1 rounded-md p-1 text-center text-xs ${s.shape === shape ? 'bg-sky-50 text-sky-900 ring-1 ring-sky-300' : 'text-slate-600'}`}
                >
                  <ShapeThumbnail shape={s.shape} />
                  {s.label}
                </span>
              ))}
            </span>
          </InfoTip>
        </span>
        <select
          aria-labelledby={labelId}
          value={shape}
          onChange={(e) => {
            const next = SHAPES.find((s) => s.shape === e.target.value);
            if (next) onShapeChange(next.shape);
          }}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5"
        >
          {SHAPES.map((s) => (
            <option key={s.shape} value={s.shape}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {shapeSpec(shape).dims.map((d) => (
          <UnitInput
            key={`${shape}-${d.key}`}
            label={d.label}
            symbol={d.symbol}
            quantity="length"
            defaultUnit="mm"
            initialSI={dims[d.key]}
            onChange={(v) => onDimChange(d.key, v)}
          />
        ))}
      </div>
    </>
  );
}
