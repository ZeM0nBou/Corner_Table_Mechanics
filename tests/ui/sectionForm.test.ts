import { describe, expect, it } from 'vitest';
import { computeSection } from '@core/sections';
import { buildSectionInput, defaultDims, SHAPES } from '@ui/sections/sectionForm';

describe('formulaire des sections', () => {
  it('8 formes, chacune avec des valeurs par défaut calculables', () => {
    expect(SHAPES).toHaveLength(8);
    for (const s of SHAPES) {
      const input = buildSectionInput(s.shape, defaultDims(s.shape));
      expect(input, s.shape).not.toBeNull();
      if (input) expect(() => computeSection(input), s.shape).not.toThrow();
    }
  });

  it('valeurs par défaut converties en mètres', () => {
    expect(defaultDims('rectangle')).toEqual({ b_m: 0.1, h_m: 0.2 });
  });

  it('renvoie null si une cote est vide ou invalide', () => {
    expect(buildSectionInput('rectangle', { b_m: 0.1 })).toBeNull();
    expect(buildSectionInput('rectangle', { b_m: 0.1, h_m: NaN })).toBeNull();
  });

  it('construit l’entrée attendue par le moteur', () => {
    expect(buildSectionInput('tube', { d_m: 0.06, t_m: 0.004 })).toEqual({
      shape: 'tube',
      d_m: 0.06,
      t_m: 0.004,
    });
  });
});
