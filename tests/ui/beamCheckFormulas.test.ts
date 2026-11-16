/**
 * Formules de la vérification : chaque application numérique se termine par la valeur
 * du moteur, et chaque formule a une source.
 * Cas : rectangle 100 × 200 mm, M = 10 kN·m → σ = 15 MPa (Navier, M/Wel).
 */
import { describe, expect, it } from 'vitest';
import { computeSection } from '@core/sections';
import { beamStresses, checkBeamStrength, checkDeflection, extremeFibres } from '@core/stress';
import { checkFormulas } from '@ui/beams/beamCheckFormulas';

const rect = computeSection({ shape: 'rectangle', b_m: 0.1, h_m: 0.2 });
const stresses = beamStresses({
  momentMax: { value: 10_000, x_m: 1.5 },
  momentMin: { value: 0, x_m: 0 },
  shearAbsMax: { value: 20_000, x_m: 0 },
  Iy_m4: rect.Iy_m4,
  fibres: extremeFibres(rect.height_m, rect.zG_m),
  Av_m2: 1e-3,
});

describe('formules de vérification', () => {
  it('matériau ductile : Navier, τ, von Mises, n et flèche', () => {
    const check = checkBeamStrength(stresses, { kind: 'ductile', Re_Pa: 235e6 }, 1.5);
    const f = checkFormulas(stresses, check, rect.Iy_m4, 1e-3, {
      result: checkDeflection(-0.008, 3, 300),
      length_m: 3,
      limit: 300,
    });
    expect(f.traction?.application).toMatch(/= 15\\text\{ MPa\}$/);
    expect(f.compression?.application).toMatch(/= 15\\text\{ MPa\}$/);
    expect(f.tau?.application).toMatch(/= 20\\text\{ MPa\}$/);
    expect(f.equivalent?.latex).toContain('3\\,\\tau^2');
    expect(f.n?.latex).toContain('R_e');
    expect(f.deflection?.application).toContain('= 10\\text{ mm}');
    for (const formula of Object.values(f)) expect(formula.source).not.toBe('');
  });

  it('matériau fragile : contrainte principale et Rm', () => {
    const check = checkBeamStrength(stresses, { kind: 'fragile', Rm_Pa: 250e6 }, 1.5);
    const f = checkFormulas(stresses, check, rect.Iy_m4, 1e-3);
    expect(f.equivalent?.latex).toContain('\\sigma_1');
    expect(f.n?.latex).toContain('R_m');
    expect(f.deflection).toBeUndefined();
  });

  it('sans aire de cisaillement : pas de formule pour τ ; n infini affiché ∞', () => {
    const plain = beamStresses({
      momentMax: { value: 0, x_m: 0 },
      momentMin: { value: 0, x_m: 0 },
      shearAbsMax: { value: 0, x_m: 0 },
      Iy_m4: rect.Iy_m4,
      fibres: extremeFibres(rect.height_m, rect.zG_m),
    });
    const check = checkBeamStrength(plain, { kind: 'ductile', Re_Pa: 235e6 }, 1.5);
    const f = checkFormulas(plain, check, rect.Iy_m4, undefined);
    expect(f.tau).toBeUndefined();
    expect(f.n?.application).toMatch(/\\infty$/);
  });
});
