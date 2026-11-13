/**
 * Description des formes pour l'UI (libellés, cotes à saisir, valeurs par défaut)
 * et conversion de la saisie en entrée du moteur de calcul.
 */
import type { SectionInput, SectionShape } from '@core/sections';

export interface DimensionSpec {
  key: string;
  label: string;
  symbol: string;
  /** Valeur par défaut en mm. */
  default_mm: number;
}

export interface ShapeSpec {
  shape: SectionShape;
  label: string;
  dims: readonly DimensionSpec[];
}

const h = (label = 'Hauteur', d = 200): DimensionSpec => ({
  key: 'h_m',
  label,
  symbol: 'h',
  default_mm: d,
});
const b = (label = 'Largeur', d = 100): DimensionSpec => ({
  key: 'b_m',
  label,
  symbol: 'b',
  default_mm: d,
});
const t = (label = 'Épaisseur', d = 5): DimensionSpec => ({
  key: 't_m',
  label,
  symbol: 't',
  default_mm: d,
});
const tw = (d: number): DimensionSpec => ({
  key: 'tw_m',
  label: 'Épaisseur d’âme',
  symbol: 'tw',
  default_mm: d,
});
const tf = (label: string, d: number): DimensionSpec => ({
  key: 'tf_m',
  label,
  symbol: 'tf',
  default_mm: d,
});

/** Formes proposées, dans l'ordre d'affichage. Valeurs par défaut : exemples courants. */
export const SHAPES: readonly ShapeSpec[] = [
  { shape: 'rectangle', label: 'Rectangle plein', dims: [b(), h()] },
  { shape: 'rectangleCreux', label: 'Rectangle creux', dims: [b(), h('Hauteur', 150), t()] },
  {
    shape: 'rond',
    label: 'Rond plein',
    dims: [{ key: 'd_m', label: 'Diamètre', symbol: 'd', default_mm: 50 }],
  },
  {
    shape: 'tube',
    label: 'Tube rond',
    dims: [
      { key: 'd_m', label: 'Diamètre extérieur', symbol: 'D', default_mm: 60.3 },
      t('Épaisseur', 4),
    ],
  },
  {
    shape: 'I',
    label: 'Profilé I / H',
    dims: [h(), b(), tw(5.6), tf('Épaisseur de semelle', 8.5)],
  },
  {
    shape: 'U',
    label: 'Profilé U',
    dims: [h(), b('Largeur d’aile', 75), tw(8.5), tf('Épaisseur d’aile', 11.5)],
  },
  {
    shape: 'L',
    label: 'Cornière L',
    dims: [h('Aile verticale', 100), b('Aile horizontale', 100), t('Épaisseur', 10)],
  },
  {
    shape: 'T',
    label: 'Profilé T',
    dims: [h('Hauteur', 100), b('Largeur de semelle', 100), tw(10), tf('Épaisseur de semelle', 10)],
  },
];

export function shapeSpec(shape: SectionShape): ShapeSpec {
  const spec = SHAPES.find((s) => s.shape === shape);
  if (!spec) throw new Error(`Forme inconnue : ${shape}`);
  return spec;
}

/** Valeurs par défaut d'une forme, en mètres. */
export function defaultDims(shape: SectionShape): Record<string, number> {
  return Object.fromEntries(shapeSpec(shape).dims.map((d) => [d.key, d.default_mm / 1000]));
}

/**
 * Construit l'entrée du moteur, ou `null` si une cote est vide ou invalide.
 * Les incohérences géométriques (épaisseur trop grande…) sont détectées par le moteur.
 */
export function buildSectionInput(
  shape: SectionShape,
  dims: Readonly<Record<string, number | undefined>>,
): SectionInput | null {
  const values: Record<string, number> = {};
  for (const d of shapeSpec(shape).dims) {
    const v = dims[d.key];
    if (v === undefined || Number.isNaN(v)) return null;
    values[d.key] = v;
  }
  return { shape, ...values } as SectionInput;
}
