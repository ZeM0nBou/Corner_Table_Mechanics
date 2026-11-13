import { describe, expect, it } from 'vitest';
import { sectionAnnotations } from '@ui/sections/annotations';
import { computeSection } from '@core/sections';
import { buildSectionInput, defaultDims, SHAPES } from '@ui/sections/sectionForm';

describe('cotes du schéma', () => {
  it('chaque cote saisie apparaît une fois sur le schéma, avec son symbole', () => {
    for (const s of SHAPES) {
      const annotations = sectionAnnotations(s.shape, defaultDims(s.shape));
      expect(annotations.map((a) => a.key).sort(), s.shape).toEqual(
        s.dims.map((d) => d.key).sort(),
      );
      for (const a of annotations) {
        const spec = s.dims.find((d) => d.key === a.key);
        expect(a.symbol, `${s.shape} ${a.key}`).toBe(spec?.symbol);
      }
    }
  });

  it('la longueur cotée est égale à la cote saisie', () => {
    for (const s of SHAPES) {
      const dims = defaultDims(s.shape);
      for (const a of sectionAnnotations(s.shape, dims)) {
        expect(a.to - a.from, `${s.shape} ${a.key}`).toBeCloseTo(dims[a.key] ?? NaN, 12);
      }
    }
  });
});

describe('lisibilité du schéma', () => {
  it('aucune cote intérieure (sur la matière) à la hauteur du centre de gravité', () => {
    for (const s of SHAPES) {
      const dims = defaultDims(s.shape);
      const input = buildSectionInput(s.shape, dims);
      if (!input) throw new Error(s.shape);
      const zG = computeSection(input).zG_m;
      for (const a of sectionAnnotations(s.shape, dims)) {
        if (a.kind === 'h' && a.offsetPx === 0) {
          // L'axe y part de G vers la droite : une cote à gauche de G est admise.
          const leftOfG = a.labelSide === 'start';
          expect(
            leftOfG || Math.abs(a.at - zG) > 0.1 * (dims.h_m ?? dims.d_m ?? 1),
            `${s.shape} ${a.key}`,
          ).toBe(true);
        }
      }
    }
  });
});
