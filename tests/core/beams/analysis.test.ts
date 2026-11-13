/**
 * Tests des extremums et de l'échantillonnage des poutres.
 * Références : mêmes tables que `solver.test.ts` (Roark 8e éd., tab. 8.1 ; Gere & Goodno,
 * annexe « Deflections and Slopes of Beams » ; AISC, tab. 3-23) pour la position et la
 * valeur des maximums.
 */
import { describe, expect, it } from 'vitest';
import {
  beamExtrema,
  breakpoints,
  sampleBeam,
  solveBeam,
  type Load,
  type Support,
} from '@core/beams';
import { expectRelClose } from '../../helpers';

const L = 2;
const EI = 210e9 * 1.943e-5;
const F = 12_000;
const q = 5_000;

const DEUX_APPUIS: Support[] = [
  { kind: 'appui', x_m: 0 },
  { kind: 'appui', x_m: L },
];
const solve = (loads: Load[], supports = DEUX_APPUIS, withEI = true) =>
  solveBeam({ length_m: L, EI_Nm2: withEI ? EI : undefined, supports, loads });

/** Tolérance sur les abscisses trouvées par dichotomie (plan : 1e-6). */
const TOL_X = 1e-6;

describe('beamExtrema', () => {
  it('charge uniforme sur deux appuis : M_max = qL²/8 et flèche maximale au milieu', () => {
    const e = beamExtrema(solve([{ kind: 'repartie', x1_m: 0, x2_m: L, q1_N_m: -q, q2_N_m: -q }]));
    expectRelClose(e.moment_Nm.max.value, (q * L ** 2) / 8, 1e-9);
    expectRelClose(e.moment_Nm.max.x_m, L / 2, TOL_X);
    expect(Math.abs(e.moment_Nm.min.value)).toBeLessThan(1e-6);
    expectRelClose(e.shear_N.max.value, (q * L) / 2, 1e-9);
    expectRelClose(e.shear_N.min.value, (-q * L) / 2, 1e-9);
    expectRelClose(e.deflection_m?.min.value ?? NaN, (-5 * q * L ** 4) / (384 * EI), 1e-9);
    expectRelClose(e.deflection_m?.min.x_m ?? NaN, L / 2, TOL_X);
    expectRelClose(e.slope_rad?.max.value ?? NaN, (q * L ** 3) / (24 * EI), 1e-9);
    expectRelClose(e.slope_rad?.max.x_m ?? NaN, L, TOL_X);
  });

  it('force excentrée : flèche maximale en √((L² − b²)/3), pas sous la charge', () => {
    const a = 1.4;
    const b = L - a;
    const e = beamExtrema(solve([{ kind: 'ponctuelle', x_m: a, Fz_N: -F }]));
    expectRelClose(e.deflection_m?.min.x_m ?? NaN, Math.sqrt((L ** 2 - b ** 2) / 3), TOL_X);
    expectRelClose(
      e.deflection_m?.min.value ?? NaN,
      (-F * b * (L ** 2 - b ** 2) ** 1.5) / (9 * Math.sqrt(3) * EI * L),
      1e-9,
    );
    expectRelClose(e.moment_Nm.max.value, (F * a * b) / L, 1e-9);
    expectRelClose(e.moment_Nm.max.x_m, a, TOL_X);
    expectRelClose(e.shear_N.max.value, (F * b) / L, 1e-9);
    expectRelClose(e.shear_N.min.value, (-F * a) / L, 1e-9);
  });

  it('charge triangulaire : M_max = qL²/(9√3) en L/√3 ; flèche maximale en 0,5193 L', () => {
    const e = beamExtrema(solve([{ kind: 'repartie', x1_m: 0, x2_m: L, q1_N_m: 0, q2_N_m: -q }]));
    expectRelClose(e.moment_Nm.max.x_m, L / Math.sqrt(3), TOL_X);
    expectRelClose(e.moment_Nm.max.value, (q * L ** 2) / (9 * Math.sqrt(3)), 1e-9);
    // Racine de 15x⁴ − 30L²x² + 7L⁴ = 0 : x = L·√(1 − √(8/15)).
    const xMax = L * Math.sqrt(1 - Math.sqrt(8 / 15));
    expectRelClose(e.deflection_m?.min.x_m ?? NaN, xMax, TOL_X);
    expectRelClose(e.deflection_m?.min.value ?? NaN, (-0.00652 * q * L ** 4) / EI, 1e-3);
  });

  it('console : extremums à l’encastrement (M) et en bout (flèche, rotation)', () => {
    const e = beamExtrema(
      solve([{ kind: 'ponctuelle', x_m: L, Fz_N: -F }], [{ kind: 'encastrement', x_m: 0 }]),
    );
    expectRelClose(e.moment_Nm.min.value, -F * L, 1e-9);
    expect(e.moment_Nm.min.x_m).toBe(0);
    expectRelClose(e.deflection_m?.min.value ?? NaN, (-F * L ** 3) / (3 * EI), 1e-9);
    expect(e.deflection_m?.min.x_m).toBe(L);
    expectRelClose(e.slope_rad?.min.value ?? NaN, (-F * L ** 2) / (2 * EI), 1e-9);
  });

  it('charge répartie changeant de signe : extremum de V là où q s’annule', () => {
    // q varie de −q à +q : V = qL/6 aux appuis, V(L/2) = qL/6 − qL/4 = −qL/12 (minimum).
    const e = beamExtrema(solve([{ kind: 'repartie', x1_m: 0, x2_m: L, q1_N_m: -q, q2_N_m: q }]));
    expectRelClose(e.shear_N.min.value, (-q * L) / 12, 1e-9);
    expectRelClose(e.shear_N.min.x_m, L / 2, TOL_X);
    expectRelClose(e.shear_N.max.value, (q * L) / 6, 1e-9);
  });

  it('sans EI : pas de rotation ni de flèche', () => {
    const e = beamExtrema(solve([{ kind: 'ponctuelle', x_m: 1, Fz_N: -F }], DEUX_APPUIS, false));
    expect(e.deflection_m).toBeUndefined();
    expect(e.slope_rad).toBeUndefined();
    expectRelClose(e.moment_Nm.max.value, (F * L) / 4, 1e-9);
  });
});

describe('breakpoints et sampleBeam', () => {
  const s = solve([
    { kind: 'ponctuelle', x_m: 0.5, Fz_N: -F },
    { kind: 'couple', x_m: 1.2, C_Nm: 2000 },
  ]);

  it('tronçons : extrémités, appuis et points d’application, sans doublon', () => {
    expect(breakpoints(s)).toEqual([0, 0.5, 1.2, 2]);
  });

  it('points doublés aux discontinuités : saut de V sous la force, saut de M au couple', () => {
    const pts = sampleBeam(s, 40);
    expect(pts[0]?.x_m).toBe(0);
    expect(pts[pts.length - 1]?.x_m).toBe(L);
    const at = (x: number) => pts.filter((p) => p.x_m === x);
    const force = at(0.5);
    expect(force).toHaveLength(2);
    expectRelClose((force[0]?.V_N ?? NaN) - (force[1]?.V_N ?? NaN), F, 1e-9);
    const couple = at(1.2);
    expect(couple).toHaveLength(2);
    // Un couple trigonométrique C fait sauter M de −C.
    expectRelClose((couple[1]?.M_Nm ?? NaN) - (couple[0]?.M_Nm ?? NaN), -2000, 1e-9);
    // Abscisses croissantes (au sens large).
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i]?.x_m ?? NaN).toBeGreaterThanOrEqual(pts[i - 1]?.x_m ?? NaN);
    }
    expect(pts.length).toBeGreaterThanOrEqual(40);
    expect(pts.every((p) => p.w_m !== undefined && p.theta_rad !== undefined)).toBe(true);
  });

  it('sans EI : V et M seulement', () => {
    const pts = sampleBeam(solve([{ kind: 'ponctuelle', x_m: 1, Fz_N: -F }], DEUX_APPUIS, false));
    expect(pts.every((p) => p.w_m === undefined && p.theta_rad === undefined)).toBe(true);
  });

  it('nombre de points invalide → erreur', () => {
    expect(() => sampleBeam(s, 1)).toThrow(RangeError);
    expect(() => sampleBeam(s, NaN)).toThrow(RangeError);
  });
});
