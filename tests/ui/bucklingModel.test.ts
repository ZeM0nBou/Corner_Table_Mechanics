/**
 * Tests de la préparation de la page Flambement (fonction pure).
 * Référence : rond Ø 20 mm, L = 1 m, E = 210 GPa, bi-articulé : λ = 200,
 * Ncr = π² E I / L² ≈ 16 278 N (Euler, Timoshenko & Gere ; calcul à la main).
 */
import { describe, expect, it } from 'vitest';
import { computeSection, type SectionInput } from '@core/sections';
import { bucklingAxes, evaluateBuckling, type BucklingPageInput } from '@ui/buckling/bucklingModel';
import { expectRelClose } from '../helpers';

const ROND = computeSection({ shape: 'rond', d_m: 0.02 });

function input(p: Partial<BucklingPageInput> = {}): BucklingPageInput {
  return {
    section: ROND,
    length_m: 1,
    E_Pa: 210e9,
    Re_Pa: 235e6,
    K: [1, 1],
    N_N: 5_000,
    threshold: 1.5,
    ...p,
  };
}

describe('bucklingAxes', () => {
  it('section symétrique : plans y et z', () => {
    const I = computeSection({ shape: 'I', h_m: 0.2, b_m: 0.1, tw_m: 0.0056, tf_m: 0.0085 });
    const { axes, principal } = bucklingAxes(I, [1, 0.5]);
    expect(principal).toBe(false);
    expect(axes.map((a) => a.axis)).toEqual(['y', 'z']);
    expect(axes[0]?.I_m4).toBe(I.Iy_m4);
    expect(axes[1]?.K).toBe(0.5);
  });

  it('cornière : axes principaux u et v (Iv < min(Iy, Iz))', () => {
    const L = computeSection({ shape: 'L', h_m: 0.1, b_m: 0.1, t_m: 0.01 } as SectionInput);
    const { axes, principal } = bucklingAxes(L, [1, 1]);
    expect(principal).toBe(true);
    expect(axes.map((a) => a.axis)).toEqual(['u', 'v']);
    expect(axes[1]?.I_m4).toBeLessThan(Math.min(L.Iy_m4, L.Iz_m4));
  });
});

describe('evaluateBuckling', () => {
  it('rond élancé : Euler, Ncr ≈ 16 278 N, n = Ncr / N', () => {
    const r = evaluateBuckling(input());
    if (r.kind !== 'ok') throw new Error('attendu ok');
    expectRelClose(r.result.governing.Ncr_N, 16_278, 1e-4);
    expect(r.result.governing.model).toBe('euler');
    expectRelClose(r.result.safetyFactor ?? NaN, r.result.governing.Ncr_N / 5_000);
    expect(r.safety?.verdict).toBe('ok');
    expect(r.formulas[0]?.critical.latex).toContain('\\pi^2');
    expect(r.formulas[0]?.slenderness.application).toContain('\\lambda = 200');
  });

  it('barre trapue : formule de Johnson et remarque sur les imperfections', () => {
    const r = evaluateBuckling(input({ length_m: 0.3 }));
    if (r.kind !== 'ok') throw new Error('attendu ok');
    expect(r.result.governing.model).toBe('johnson');
    expect(r.formulas[0]?.critical.latex).toContain('R_e');
    expect(r.notes.join(' ')).toMatch(/imperfections/);
  });

  it('sans Re : Euler seul, remarque', () => {
    const r = evaluateBuckling(input({ Re_Pa: undefined, length_m: 0.3 }));
    if (r.kind !== 'ok') throw new Error('attendu ok');
    expect(r.result.governing.model).toBe('euler');
    expect(r.notes.join(' ')).toMatch(/Euler seul/);
  });

  it('cornière : remarques axes principaux et flexion-torsion', () => {
    const L = computeSection({ shape: 'L', h_m: 0.08, b_m: 0.08, t_m: 0.008 });
    const r = evaluateBuckling(input({ section: L }));
    if (r.kind !== 'ok') throw new Error('attendu ok');
    expect(r.result.governing.axis).toBe('v');
    expect(r.notes.join(' ')).toMatch(/axes principaux/);
    expect(r.notes.join(' ')).toMatch(/flexion-torsion/);
  });

  it('N vide : Ncr seul, pas de coefficient de sécurité', () => {
    const r = evaluateBuckling(input({ N_N: undefined }));
    if (r.kind !== 'ok') throw new Error('attendu ok');
    expect(r.result.safetyFactor).toBeUndefined();
    expect(r.safety).toBeUndefined();
  });

  it.each([
    ['longueur nulle', { length_m: 0 }],
    ['E absent', { E_Pa: undefined }],
    ['K invalide', { K: [Number.NaN, 1] as const }],
    ['N négatif', { N_N: -1 }],
  ])('%s → indisponible', (_, p) => {
    expect(evaluateBuckling(input(p)).kind).toBe('indisponible');
  });
});
