/**
 * Cotes à dessiner sur le schéma de chaque forme (repère : origine O au coin
 * inférieur gauche, y vers la droite, z vers le haut, en mètres).
 */
import type { SectionShape } from '@core/sections';

/** Cote horizontale (mesure selon y) ou verticale (mesure selon z). */
export type Annotation =
  | {
      kind: 'h';
      symbol: string;
      key: string;
      from: number;
      to: number;
      /** Cote z de la ligne de cote. */
      at: number;
      /** Décalage de la ligne en pixels : négatif = vers le bas, 0 = sur la matière. */
      offsetPx: number;
      /** Pour une cote courte : libellé à gauche (« start ») ou à droite (défaut). */
      labelSide?: 'start' | 'end';
    }
  | {
      kind: 'v';
      symbol: string;
      key: string;
      from: number;
      to: number;
      /** Abscisse y de la ligne de cote. */
      at: number;
      /** Décalage en pixels : négatif = vers la gauche. */
      offsetPx: number;
    };

const OUT = 24; // décalage des cotes hors tout (px)

/**
 * Règle de lisibilité : aucune cote intérieure à la hauteur du centre de gravité,
 * où passe l'axe y. Les épaisseurs d'âme sont cotées à 30 % de la hauteur libre,
 * l'épaisseur du tube sur la paroi gauche (l'axe y part de G vers la droite).
 */
const WEB_DIM_LEVEL = 0.3;

/** Cotes de la forme, à partir des dimensions saisies (m). */
export function sectionAnnotations(
  shape: SectionShape,
  d: Readonly<Record<string, number>>,
): Annotation[] {
  const b = d.b_m ?? 0;
  const h = d.h_m ?? 0;
  const t = d.t_m ?? 0;
  const tw = d.tw_m ?? 0;
  const tf = d.tf_m ?? 0;
  const D = d.d_m ?? 0;
  const bOut: Annotation = {
    kind: 'h',
    symbol: 'b',
    key: 'b_m',
    from: 0,
    to: b,
    at: 0,
    offsetPx: -OUT,
  };
  const hOut: Annotation = {
    kind: 'v',
    symbol: 'h',
    key: 'h_m',
    from: 0,
    to: h,
    at: 0,
    offsetPx: -OUT,
  };

  switch (shape) {
    case 'rectangle':
      return [bOut, hOut];
    case 'rectangleCreux':
      return [
        bOut,
        hOut,
        { kind: 'v', symbol: 't', key: 't_m', from: h - t, to: h, at: b, offsetPx: 16 },
      ];
    case 'rond':
      return [{ kind: 'h', symbol: 'd', key: 'd_m', from: 0, to: D, at: 0, offsetPx: -OUT }];
    case 'tube':
      return [
        { kind: 'h', symbol: 'D', key: 'd_m', from: 0, to: D, at: 0, offsetPx: -OUT },
        {
          kind: 'h',
          symbol: 't',
          key: 't_m',
          from: 0,
          to: t,
          at: D / 2,
          offsetPx: 0,
          labelSide: 'start',
        },
      ];
    case 'I':
      return [
        bOut,
        hOut,
        { kind: 'v', symbol: 'tf', key: 'tf_m', from: h - tf, to: h, at: b, offsetPx: 16 },
        {
          kind: 'h',
          symbol: 'tw',
          key: 'tw_m',
          from: (b - tw) / 2,
          to: (b + tw) / 2,
          at: tf + WEB_DIM_LEVEL * (h - 2 * tf),
          offsetPx: 0,
        },
      ];
    case 'U':
      return [
        bOut,
        hOut,
        { kind: 'v', symbol: 'tf', key: 'tf_m', from: h - tf, to: h, at: b, offsetPx: 16 },
        {
          kind: 'h',
          symbol: 'tw',
          key: 'tw_m',
          from: 0,
          to: tw,
          at: tf + WEB_DIM_LEVEL * (h - 2 * tf),
          offsetPx: 0,
        },
      ];
    case 'L':
      return [
        bOut,
        hOut,
        { kind: 'v', symbol: 't', key: 't_m', from: 0, to: t, at: b, offsetPx: 16 },
      ];
    case 'T':
      return [
        { ...bOut, at: h, offsetPx: OUT },
        hOut,
        { kind: 'v', symbol: 'tf', key: 'tf_m', from: h - tf, to: h, at: b, offsetPx: 16 },
        {
          kind: 'h',
          symbol: 'tw',
          key: 'tw_m',
          from: (b - tw) / 2,
          to: (b + tw) / 2,
          at: 0,
          offsetPx: -OUT,
        },
      ];
  }
}
