/**
 * Tests des contraintes et des critères.
 * Références :
 * - Navier : σ = M/Wel pour un rectangle, Wel = b h²/6 (Timoshenko & Gere, Mechanics of
 *   Materials, flexure formula) ;
 * - von Mises en cisaillement pur : σ_eq = √3 τ, d'où la limite de cisaillement fy/√3
 *   de l'EN 1993-1-1 §6.2.6(2) ;
 * - Tresca en cisaillement pur : σ_eq = 2τ ; contraintes principales en état plan
 *   (cercle de Mohr : σ₁ = τ en cisaillement pur, σ₁ = σ en traction simple).
 */
import { describe, expect, it } from 'vitest';
import { computeSection } from '@core/sections';
import {
  averageShearStress_Pa,
  bendingStress_Pa,
  extremeFibres,
  maxPrincipalStress_Pa,
  safetyFactor,
  StressInputError,
  tresca_Pa,
  verdict,
  vonMises_Pa,
} from '@core/stress';
import { expectRelClose } from '../../helpers';

describe('Navier', () => {
  // Rectangle 100 × 200 mm : Iy = b h³/12 = 6,667e-5 m⁴, Wel = 6,667e-4 m³.
  const Iy = (0.1 * 0.2 ** 3) / 12;
  const M = 10_000;

  it('rectangle, M = 10 kN·m : ±15 MPa aux fibres extrêmes (M/Wel)', () => {
    expectRelClose(bendingStress_Pa(M, Iy, -0.1), 15e6);
    expectRelClose(bendingStress_Pa(M, Iy, 0.1), -15e6);
  });

  it('convention : M > 0 tend la fibre inférieure ; M < 0 tend la fibre supérieure', () => {
    expect(bendingStress_Pa(M, Iy, -0.1)).toBeGreaterThan(0);
    expect(bendingStress_Pa(-M, Iy, 0.1)).toBeGreaterThan(0);
  });

  it('nulle sur l’axe neutre et linéaire dans la hauteur', () => {
    expect(bendingStress_Pa(M, Iy, 0)).toBe(0);
    expect(Object.is(bendingStress_Pa(M, Iy, 0), -0)).toBe(false);
    expectRelClose(bendingStress_Pa(M, Iy, -0.05), 7.5e6);
  });

  it('section en T : contraintes des deux fibres dans le rapport des distances à G', () => {
    const s = computeSection({ shape: 'T', h_m: 0.1, b_m: 0.1, tw_m: 0.01, tf_m: 0.01 });
    const f = extremeFibres(s.height_m, s.zG_m);
    const top = bendingStress_Pa(M, s.Iy_m4, f.zTop_m);
    const bottom = bendingStress_Pa(M, s.Iy_m4, f.zBottom_m);
    expectRelClose(-top / bottom, f.zTop_m / -f.zBottom_m, 1e-12);
    // La fibre la plus éloignée de G donne la contrainte maximale : M / Wel,y (Wel minimal).
    expectRelClose(Math.max(Math.abs(top), Math.abs(bottom)), M / s.Wel_y_m3, 1e-9);
    // T semelle en haut : G est au-dessus de mi-hauteur, la fibre inférieure est la plus loin.
    expect(-f.zBottom_m).toBeGreaterThan(f.zTop_m);
  });

  it('données invalides', () => {
    expect(() => bendingStress_Pa(M, 0, 0.1)).toThrow(StressInputError);
    expect(() => bendingStress_Pa(NaN, Iy, 0.1)).toThrow(/moment/);
    expect(() => bendingStress_Pa(M, Iy, Infinity)).toThrow(/cote/);
  });
});

describe('fibres extrêmes', () => {
  it('z_sup = h − zG, z_inf = −zG', () => {
    expect(extremeFibres(0.2, 0.1)).toEqual({ zTop_m: 0.1, zBottom_m: -0.1 });
    const f = extremeFibres(0.1, 0.07);
    expectRelClose(f.zTop_m, 0.03);
    expect(f.zBottom_m).toBe(-0.07);
  });

  it.each([
    [0, 0],
    [0.2, 0],
    [0.2, 0.2],
    [0.2, -0.01],
    [-1, 0.1],
  ])('h = %s, zG = %s → erreur', (h, zG) => {
    expect(() => extremeFibres(h, zG)).toThrow(StressInputError);
  });
});

describe('cisaillement moyen', () => {
  it('τ = |V| / Av : 10 kN sur 1000 mm² → 10 MPa, signe de V indifférent', () => {
    expectRelClose(averageShearStress_Pa(10_000, 1e-3), 10e6);
    expectRelClose(averageShearStress_Pa(-10_000, 1e-3), 10e6);
  });

  it('Av nulle ou négative → erreur', () => {
    expect(() => averageShearStress_Pa(1, 0)).toThrow(StressInputError);
    expect(() => averageShearStress_Pa(1, -1)).toThrow(/aire de cisaillement/);
  });
});

describe('critères', () => {
  it('von Mises : traction simple σ ; cisaillement pur √3 τ ; cas combiné', () => {
    expectRelClose(vonMises_Pa(200e6, 0), 200e6);
    expectRelClose(vonMises_Pa(-200e6, 0), 200e6);
    expectRelClose(vonMises_Pa(0, 100e6), Math.sqrt(3) * 100e6);
    expectRelClose(vonMises_Pa(120e6, 50e6), Math.sqrt(120e6 ** 2 + 3 * 50e6 ** 2));
  });

  it('cisaillement pur : la limite élastique de von Mises est Re/√3 (EN 1993-1-1 §6.2.6)', () => {
    const Re = 235e6;
    expectRelClose(vonMises_Pa(0, Re / Math.sqrt(3)), Re);
  });

  it('Tresca : cisaillement pur 2τ ; toujours ≥ von Mises, au plus de 2/√3', () => {
    expectRelClose(tresca_Pa(0, 100e6), 200e6);
    expectRelClose(tresca_Pa(150e6, 0), 150e6);
    for (const [s, t] of [
      [100e6, 30e6],
      [0, 50e6],
      [-80e6, 80e6],
    ] as const) {
      expect(tresca_Pa(s, t)).toBeGreaterThanOrEqual(vonMises_Pa(s, t));
      expect(tresca_Pa(s, t) / vonMises_Pa(s, t)).toBeLessThanOrEqual(2 / Math.sqrt(3) + 1e-12);
    }
  });

  it('contrainte principale maximale : traction σ, cisaillement pur τ, compression simple 0', () => {
    expectRelClose(maxPrincipalStress_Pa(100e6, 0), 100e6);
    expectRelClose(maxPrincipalStress_Pa(0, 40e6), 40e6);
    expect(maxPrincipalStress_Pa(-100e6, 0)).toBe(0);
    // Cercle de Mohr : σ = 60, τ = 40 → σ₁ = 30 + 50 = 80 MPa.
    expectRelClose(maxPrincipalStress_Pa(60e6, 40e6), 80e6);
  });

  it('valeurs non finies → erreur', () => {
    expect(() => vonMises_Pa(NaN, 0)).toThrow(StressInputError);
    expect(() => tresca_Pa(0, Infinity)).toThrow(StressInputError);
    expect(() => maxPrincipalStress_Pa(NaN, 0)).toThrow(StressInputError);
  });
});

describe('coefficient de sécurité et verdict', () => {
  it('n = R / σ ; +∞ sans contrainte', () => {
    expectRelClose(safetyFactor(235e6, 100e6), 2.35);
    expect(safetyFactor(235e6, 0)).toBe(Infinity);
  });

  it('données invalides', () => {
    expect(() => safetyFactor(0, 1)).toThrow(/résistance/);
    expect(() => safetyFactor(235e6, -1)).toThrow(/positif ou nul/);
    expect(() => safetyFactor(235e6, NaN)).toThrow(StressInputError);
  });

  it('ok ≥ seuil > limite ≥ 1 > ko, bornes incluses', () => {
    expect(verdict(2, 1.5)).toBe('ok');
    expect(verdict(1.5, 1.5)).toBe('ok');
    expect(verdict(1.49, 1.5)).toBe('limite');
    expect(verdict(1, 1.5)).toBe('limite');
    expect(verdict(0.99, 1.5)).toBe('ko');
    expect(verdict(Infinity, 1.5)).toBe('ok');
    expect(verdict(1, 1)).toBe('ok');
  });

  it('seuil invalide (< 1 ou non fini) ou n invalide → erreur', () => {
    expect(() => verdict(2, 0.9)).toThrow(/seuil/);
    expect(() => verdict(2, NaN)).toThrow(StressInputError);
    expect(() => verdict(NaN, 1.5)).toThrow(StressInputError);
  });
});
