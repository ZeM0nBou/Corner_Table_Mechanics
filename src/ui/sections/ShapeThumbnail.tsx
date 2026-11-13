import { computeSection, type SectionShape } from '@core/sections';
import { buildSectionInput, defaultDims } from './sectionForm';

const BOX = 40;

/**
 * Vignette d'une forme de section (contour seul, sans cotes), dessinée à partir des
 * valeurs par défaut de la forme et du même moteur que le schéma coté.
 */
export function ShapeThumbnail({ shape, size = 48 }: { shape: SectionShape; size?: number }) {
  const input = buildSectionInput(shape, defaultDims(shape));
  if (!input) return null;
  const s = computeSection(input);
  const scale = BOX / Math.max(s.width_m, s.height_m);
  const ox = (BOX - s.width_m * scale) / 2 + 4;
  const oy = (BOX - s.height_m * scale) / 2 + 4;
  const X = (y: number) => ox + y * scale;
  const Y = (z: number) => oy + (s.height_m - z) * scale;

  return (
    <svg
      viewBox={`0 0 ${BOX + 8} ${BOX + 8}`}
      width={size}
      height={size}
      aria-hidden="true"
      className="fill-sky-100 stroke-sky-700"
    >
      {s.geometry.kind === 'rects' ? (
        s.geometry.rects.map((r, i) => (
          <rect
            key={i}
            x={X(r.y0)}
            y={Y(r.z1)}
            width={(r.y1 - r.y0) * scale}
            height={(r.z1 - r.z0) * scale}
            strokeWidth={0}
          />
        ))
      ) : (
        <>
          <circle
            cx={X(s.width_m / 2)}
            cy={Y(s.height_m / 2)}
            r={(s.geometry.d_m * scale) / 2}
            strokeWidth={1.2}
          />
          {s.geometry.dInner_m > 0 && (
            <circle
              cx={X(s.width_m / 2)}
              cy={Y(s.height_m / 2)}
              r={(s.geometry.dInner_m * scale) / 2}
              className="fill-white"
              strokeWidth={1.2}
            />
          )}
        </>
      )}
      {/* Contour des formes à rectangles : rectangle creux évidé, sinon remplissage seul. */}
      {s.geometry.kind === 'rects' && shape === 'rectangleCreux' && (
        <rect
          x={X(0)}
          y={Y(s.height_m)}
          width={s.width_m * scale}
          height={s.height_m * scale}
          fill="none"
          strokeWidth={1.2}
        />
      )}
    </svg>
  );
}
