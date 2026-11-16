/**
 * Tests du flambement.
 * Références :
 * - Euler, barre bi-articulée : Ncr = π² E I / L² (Timoshenko & Gere, Theory of Elastic
 *   Stability) ; rond Ø 20 mm, L = 1 m, E = 210 GPa : I = π d⁴/64 = 7 854 mm⁴,
 *   Ncr = π² × 210 000 × 7 854 / 1 000² ≈ 16 278 N (calcul à la main) ;
 * - longueurs de flambement : Ncr ∝ 1/K², d'où les rapports 4, 1, ≈ 2,04 et 1/4 pour
 *   K = 0,5 ; 1 ; 0,7 ; 2 ;
 * - Johnson (Shigley) : tangence avec Euler en λc = π √(2E/Re) où σcr = Re/2, et σcr → Re
 *   quand λ → 0 ; S235 (E = 210 GPa, Re = 235 MPa) : λc = π √(2 × 210 000 / 235) ≈ 132,8.
 */
import { describe, expect, it } from 'vitest';
import {
  BUCKLING_CASES,
  BucklingInputError,
  bucklingCheck,
  criticalStress,
  eulerCriticalLoad_N,
  transitionSlenderness,
} from '@core/buckling';
import { expectRelClose } from '../../helpers';

const E = 210e9;
const d = 0.02;
const I_rond = (Math.PI * d ** 4) / 64;
const A_rond = (Math.PI * d ** 2) / 4;

describe('eulerCriticalLoad_N', () => {
  it('rond Ø 20 mm, L = 1 m, bi-articulé : Ncr ≈ 16 278 N', () => {
    expectRelClose(eulerCriticalLoad_N(E, I_rond, 1), 16_278, 1e-4);
  });

  it('rapports entre les cas usuels : Ncr ∝ 1/K²', () => {
    const ref = eulerCriticalLoad_N(E, I_rond, 1);
    expectRelClose(eulerCriticalLoad_N(E, I_rond, BUCKLING_CASES.biEncastree.K), 4 * ref);
    expectRelClose(eulerCriticalLoad_N(E, I_rond, BUCKLING_CASES.console.K), ref / 4);
    expectRelClose(eulerCriticalLoad_N(E, I_rond, BUCKLING_CASES.encastreeArticulee.K), ref / 0.49);
  });

  it.each([
    [0, I_rond, 1],
    [E, -1, 1],
    [E, I_rond, 0],
    [E, I_rond, Number.NaN],
  ])('données invalides (%d, %d, %d) → BucklingInputError', (e, i, l) => {
    expect(() => eulerCriticalLoad_N(e, i, l)).toThrow(BucklingInputError);
  });
});

describe('Johnson et transition', () => {
  it('S235 : λc ≈ 132,8', () => {
    expectRelClose(transitionSlenderness(E, 235e6), Math.PI * Math.sqrt((2 * 210e9) / 235e6));
    expectRelClose(transitionSlenderness(E, 235e6), 132.8, 1e-3);
  });

  it('continuité en λc : Euler et Johnson valent Re/2', () => {
    const Re = 235e6;
    const lc = transitionSlenderness(E, Re);
    expectRelClose(criticalStress(E, Re, lc).sigma_Pa, Re / 2, 1e-12);
    const below = criticalStress(E, Re, lc * (1 - 1e-9));
    expect(below.model).toBe('johnson');
    expectRelClose(below.sigma_Pa, Re / 2, 1e-6);
  });

  it('λ → 0 : σcr → Re ; Johnson toujours sous Euler', () => {
    const Re = 355e6;
    expectRelClose(criticalStress(E, Re, 1e-3).sigma_Pa, Re, 1e-9);
    for (const l of [10, 40, 80]) {
      const j = criticalStress(E, Re, l);
      expect(j.model).toBe('johnson');
      expect(j.sigma_Pa).toBeLessThan((Math.PI ** 2 * E) / l ** 2);
      expect(j.sigma_Pa).toBeLessThanOrEqual(Re);
    }
  });

  it('au-delà de λc ou sans Re : Euler σcr = π² E / λ²', () => {
    expect(criticalStress(E, 235e6, 200).model).toBe('euler');
    expectRelClose(criticalStress(E, 235e6, 200).sigma_Pa, (Math.PI ** 2 * E) / 200 ** 2);
    const fragile = criticalStress(110e9, undefined, 20);
    expect(fragile.model).toBe('euler');
    expectRelClose(fragile.sigma_Pa, (Math.PI ** 2 * 110e9) / 400);
  });
});

describe('bucklingCheck', () => {
  it('rond élancé (λ = 200), bi-articulé : Ncr d’Euler, n = Ncr / N', () => {
    // i = d/4 = 5 mm ; L = 1 m → λ = 200 > λc (S235).
    const r = bucklingCheck({
      length_m: 1,
      A_m2: A_rond,
      E_Pa: E,
      Re_Pa: 235e6,
      axes: [
        { axis: 'y', I_m4: I_rond, K: 1 },
        { axis: 'z', I_m4: I_rond, K: 1 },
      ],
      N_N: 5_000,
    });
    expectRelClose(r.governing.slenderness, 200, 1e-12);
    expect(r.governing.model).toBe('euler');
    expectRelClose(r.governing.Ncr_N, eulerCriticalLoad_N(E, I_rond, 1), 1e-12);
    expectRelClose(r.safetyFactor ?? NaN, r.governing.Ncr_N / 5_000);
    expectRelClose(r.sigma_Pa ?? NaN, 5_000 / A_rond);
  });

  it('rond trapu (L = 0,2 m, λ = 40) : Johnson, Ncr < Ncr Euler', () => {
    const r = bucklingCheck({
      length_m: 0.2,
      A_m2: A_rond,
      E_Pa: E,
      Re_Pa: 235e6,
      axes: [{ axis: 'y', I_m4: I_rond, K: 1 }],
    });
    expect(r.governing.model).toBe('johnson');
    expect(r.governing.Ncr_N).toBeLessThan(r.governing.NcrEuler_N);
    expect(r.safetyFactor).toBeUndefined();
  });

  it('deux plans, K différents : le plan de plus petit Ncr gouverne', () => {
    // Iy = 4 Iz ; Ky = 1, Kz = 0,5 → Ncr,y = Ncr,z (égalité) ; Kz = 0,4 → y gouverne.
    const base = { length_m: 5, A_m2: 1e-3, E_Pa: E, Re_Pa: 235e6 };
    const r = bucklingCheck({
      ...base,
      axes: [
        { axis: 'y', I_m4: 4e-6, K: 1 },
        { axis: 'z', I_m4: 1e-6, K: 0.4 },
      ],
    });
    expect(r.governing.axis).toBe('y');
    const r2 = bucklingCheck({
      ...base,
      axes: [
        { axis: 'y', I_m4: 4e-6, K: 1 },
        { axis: 'z', I_m4: 1e-6, K: 1 },
      ],
    });
    expect(r2.governing.axis).toBe('z');
  });

  it('N = 0 : n infini', () => {
    const r = bucklingCheck({
      length_m: 1,
      A_m2: A_rond,
      E_Pa: E,
      axes: [{ axis: 'y', I_m4: I_rond, K: 1 }],
      N_N: 0,
    });
    expect(r.safetyFactor).toBe(Infinity);
    expect(r.transitionSlenderness).toBeUndefined();
  });

  it('données invalides → BucklingInputError', () => {
    const ok = {
      length_m: 1,
      A_m2: A_rond,
      E_Pa: E,
      axes: [{ axis: 'y' as const, I_m4: I_rond, K: 1 }],
    };
    expect(() => bucklingCheck({ ...ok, length_m: 0 })).toThrow(BucklingInputError);
    expect(() => bucklingCheck({ ...ok, N_N: -1 })).toThrow(BucklingInputError);
    expect(() => bucklingCheck({ ...ok, Re_Pa: 0 })).toThrow(BucklingInputError);
    expect(() => bucklingCheck({ ...ok, axes: [] })).toThrow(BucklingInputError);
    expect(() => bucklingCheck({ ...ok, axes: [{ axis: 'y', I_m4: I_rond, K: 0 }] })).toThrow(
      BucklingInputError,
    );
  });
});
