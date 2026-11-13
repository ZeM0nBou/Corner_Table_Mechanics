import { describe, expect, it } from 'vitest';
import { sectionAnnotations } from '@ui/sections/annotations';
import { defaultDims, SHAPES } from '@ui/sections/sectionForm';

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
