import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { computeSection } from '@core/sections';
import { buildSectionInput, defaultDims, SHAPES } from '@ui/sections/sectionForm';
import { resultFormulas, tex, type ResultKey } from '@ui/sections/sectionFormulas';

/** Résultats affichés pour toutes les formes. */
const ALWAYS: ResultKey[] = [
  'A',
  'yG',
  'zG',
  'Iy',
  'Iz',
  'Wely',
  'Welz',
  'Wply',
  'Wplz',
  'iy',
  'iz',
  'J',
];

describe('tex (nombres en LaTeX)', () => {
  it.each([
    [235, '235'],
    [0.3, '0{,}3'],
    [-12.5, '-12{,}5'],
    [18_460_000, '1{,}846 \\times 10^{7}'],
    [0.000012, '1{,}2 \\times 10^{-5}'],
  ])('%d → %s', (x, expected) => {
    expect(tex(x)).toBe(expected);
  });

  it('séparateur de milliers en espace fine LaTeX', () => {
    expect(tex(7850)).toBe('7\\,850');
  });
});

describe('formules des résultats de section', () => {
  for (const spec of SHAPES) {
    const dims = defaultDims(spec.shape);
    const input = buildSectionInput(spec.shape, dims);
    if (!input) throw new Error(spec.shape);
    const s = computeSection(input);
    const formulas = resultFormulas(spec.shape, dims, s, 7850);

    it(`${spec.shape} : une formule pour chaque résultat affiché`, () => {
      const expected: ResultKey[] = [...ALWAYS, 'm'];
      if (s.Av_z_m2 !== undefined) expected.push('Avz');
      if (s.Av_y_m2 !== undefined) expected.push('Avy');
      if (spec.shape === 'L') expected.push('Iyz', 'Iu', 'Iv', 'alpha', 'iv');
      for (const k of expected) expect(formulas[k], `${spec.shape} / ${k}`).toBeDefined();
    });

    it(`${spec.shape} : toutes les formules sont du LaTeX valide pour KaTeX`, () => {
      for (const [k, f] of Object.entries(formulas)) {
        for (const src of [f.latex, f.application]) {
          expect(
            () => katex.renderToString(src, { throwOnError: true }),
            `${k}: ${src}`,
          ).not.toThrow();
        }
      }
    });

    it(`${spec.shape} : l’application numérique se termine par le résultat du moteur (A en mm²)`, () => {
      expect(formulas.A?.application.endsWith(`${tex(s.A_m2 * 1e6)}\\text{ mm}^{2}`)).toBe(true);
    });
  }
});

describe('lisibilité de l’application numérique', () => {
  it('pas de bruit d’arrondi (×10⁻¹⁴) dans les distances au centre de gravité', () => {
    const dims = defaultDims('U');
    const input = buildSectionInput('U', dims);
    if (!input) throw new Error('U');
    const f = resultFormulas('U', dims, computeSection(input));
    expect(f.Iy?.application).not.toMatch(/10\^\{-1[0-9]\}/);
  });
});

describe('traçabilité', () => {
  it('chaque formule affichée porte une source', () => {
    for (const spec of SHAPES) {
      const dims = defaultDims(spec.shape);
      const input = buildSectionInput(spec.shape, dims);
      if (!input) throw new Error(spec.shape);
      const f = resultFormulas(spec.shape, dims, computeSection(input), 7850);
      for (const [k, v] of Object.entries(f)) {
        expect(v.source?.length, `${spec.shape} / ${k}`).toBeGreaterThan(10);
      }
    }
  });
});
