/**
 * Poids propre : q = m′ · g₀, g₀ = 9,806 65 m/s² (BIPM, Brochure SI, 9ᵉ éd. ; 3ᵉ CGPM, 1901).
 */
import { describe, expect, it } from 'vitest';
import { selfWeight_N_m, STANDARD_GRAVITY_m_s2 } from '@core/beams';
import { linearMass_kg_m } from '@core/sections';
import { expectRelClose } from '../../helpers';

describe('poids propre', () => {
  it('g₀ exact par définition', () => {
    expect(STANDARD_GRAVITY_m_s2).toBe(9.80665);
  });

  it('1 kg/m → 9,806 65 N/m ; 0 → 0', () => {
    expectRelClose(selfWeight_N_m(1), 9.80665);
    expect(selfWeight_N_m(0)).toBe(0);
  });

  it('acier ρ = 7850 kg/m³, A = 28,5 cm² : m′ = 22,37 kg/m, q = 219,4 N/m', () => {
    const m = linearMass_kg_m(28.5e-4, 7850);
    expectRelClose(m, 22.3725);
    expectRelClose(selfWeight_N_m(m), 22.3725 * 9.80665);
  });

  it.each([-1, NaN, Infinity])('masse linéique invalide (%s) → erreur', (bad) => {
    expect(() => selfWeight_N_m(bad)).toThrow(RangeError);
  });
});
