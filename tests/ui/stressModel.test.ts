/**
 * Tests de la préparation de la page Contraintes (fonction pure) et de ses formules.
 * Cas de référence : rectangle 100 × 200 mm, N = 100 kN et My = 11,25 kN·m →
 * σ = 5 ± 16,875 MPa (traction simple + Navier, Wel = b h²/6) ; arbre plein en torsion
 * τ = 16 T / (π d³) (Timoshenko & Gere).
 */
import { describe, expect, it } from 'vitest';
import { computeSection, type SectionInput } from '@core/sections';
import type { SectionEfforts } from '@core/stress';
import { evaluateStress, type StressPageInput } from '@ui/stress/stressModel';
import { expectRelClose } from '../helpers';

const S235 = { name: 'S235JR', Re_Pa: 235e6, Rm_Pa: 360e6 };
const GJL = { name: 'EN-GJL-250', Rm_Pa: 250e6 };

function input(
  sectionInput: SectionInput,
  e: Partial<SectionEfforts>,
  extra: Partial<StressPageInput> = {},
): StressPageInput {
  return {
    sectionInput,
    section: computeSection(sectionInput),
    efforts: { N_N: 0, My_Nm: 0, Vz_N: 0, T_Nm: 0, ...e },
    material: S235,
    threshold: 1.5,
    ...extra,
  };
}

const RECT: SectionInput = { shape: 'rectangle', b_m: 0.1, h_m: 0.2 };

describe('evaluateStress', () => {
  it('flexion composée sur rectangle : σ = 21,875 / −11,875 MPa, n = Re / σVM', () => {
    const r = evaluateStress(input(RECT, { N_N: 100_000, My_Nm: 11_250 }));
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expectRelClose(r.stresses.tension.sigma_Pa, 21.875e6, 1e-12);
    expectRelClose(r.stresses.compression.sigma_Pa, -11.875e6, 1e-12);
    expect(r.check?.criterion).toBe('vonMises');
    expectRelClose(r.check?.safetyFactor ?? NaN, 235 / 21.875, 1e-12);
    expect(r.check?.verdict).toBe('ok');
    expect(r.formulas.traction?.application).toContain('= 21{,}87\\text{ MPa}'); // 4 chiffres significatifs
    expect(r.formulas.n).toBeDefined();
    expect(r.notes).toEqual([]);
  });

  it('torsion d’un arbre plein : τT dans la formule circulaire', () => {
    const r = evaluateStress(input({ shape: 'rond', d_m: 0.05 }, { T_Nm: 1_000 }));
    if (r.kind !== 'ok') throw new Error('attendu ok');
    expectRelClose(r.stresses.tauT_Pa, 16_000 / (Math.PI * 0.05 ** 3), 1e-12);
    expect(r.formulas.tauT?.latex).toContain('J');
  });

  it('sans matériau : contraintes données, pas de vérification', () => {
    const r = evaluateStress(input(RECT, { My_Nm: 1_000 }, { material: undefined }));
    if (r.kind !== 'ok') throw new Error('attendu ok');
    expect(r.check).toBeUndefined();
    expect(r.checkMessage).toMatch(/matériau/);
    expect(r.formulas.n).toBeUndefined();
  });

  it('seuil invalide : pas de vérification, message clair', () => {
    const r = evaluateStress(input(RECT, { My_Nm: 1_000 }, { threshold: 0.5 }));
    if (r.kind !== 'ok') throw new Error('attendu ok');
    expect(r.check).toBeUndefined();
    expect(r.checkMessage).toMatch(/seuil/);
  });

  it('matériau fragile : σ1 comparée à Rm, remarque sur la compression', () => {
    const r = evaluateStress(input(RECT, { My_Nm: 11_250 }, { material: GJL }));
    if (r.kind !== 'ok') throw new Error('attendu ok');
    expect(r.check?.criterion).toBe('rankine');
    expectRelClose(r.check?.safetyFactor ?? NaN, 250 / 16.875, 1e-12);
    expect(r.notes.some((n) => n.includes('fragile'))).toBe(true);
  });

  it('cornière : remarques flexion déviée, Av et centre de cisaillement', () => {
    const r = evaluateStress(
      input({ shape: 'L', h_m: 0.1, b_m: 0.1, t_m: 0.01 }, { My_Nm: 1_000, Vz_N: 1_000, T_Nm: 10 }),
    );
    if (r.kind !== 'ok') throw new Error('attendu ok');
    expect(r.stresses.unsymmetric).toBe(true);
    expect(r.formulas.traction?.latex).toContain('I_{yz}');
    expect(r.formulas.tauV).toBeUndefined();
    expect(r.notes.join(' ')).toMatch(/flexion déviée/);
    expect(r.notes.join(' ')).toMatch(/Aire de cisaillement/);
    expect(r.notes.join(' ')).toMatch(/Centre de cisaillement/);
    expect(r.notes.join(' ')).toMatch(/Profil mince ouvert/);
  });

  it('formule de torsion adaptée à chaque forme', () => {
    const latex = (s: SectionInput) => {
      const r = evaluateStress(input(s, { T_Nm: 100 }));
      return r.kind === 'ok' ? (r.formulas.tauT?.latex ?? '') : '';
    };
    expect(latex(RECT)).toContain('k');
    expect(latex({ shape: 'rectangleCreux', b_m: 0.1, h_m: 0.15, t_m: 0.005 })).toContain('A_m');
    expect(latex({ shape: 'I', h_m: 0.2, b_m: 0.1, tw_m: 0.0056, tf_m: 0.0085 })).toContain(
      't_{max}',
    );
  });

  it('effort non numérique → indisponible', () => {
    const r = evaluateStress(input(RECT, { N_N: Number.NaN }));
    expect(r.kind).toBe('indisponible');
  });
});
