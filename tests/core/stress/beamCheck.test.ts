/**
 * Tests de la vérification d'une poutre.
 * Cas de référence : poutre sur deux appuis, charge uniforme, M_max = qL²/8 et
 * V_max = qL/2 (Roark 8e éd., tab. 8.1 ; voir tests/core/beams), section rectangulaire
 * 100 × 200 mm : σ = M/Wel avec Wel = b h²/6 (Navier).
 */
import { describe, expect, it } from 'vitest';
import { beamExtrema, solveBeam } from '@core/beams';
import { computeSection } from '@core/sections';
import {
  beamStresses,
  checkBeamStrength,
  checkDeflection,
  extremeFibres,
  strengthBasis,
  StressInputError,
  type BeamStressInput,
} from '@core/stress';
import { expectRelClose } from '../../helpers';

const rect = computeSection({ shape: 'rectangle', b_m: 0.1, h_m: 0.2 });
const fibres = extremeFibres(rect.height_m, rect.zG_m);

function input(Mmax: number, Mmin: number, V: number, Av?: number): BeamStressInput {
  return {
    momentMax: { value: Mmax, x_m: 1.5 },
    momentMin: { value: Mmin, x_m: 0 },
    shearAbsMax: { value: V, x_m: 0 },
    Iy_m4: rect.Iy_m4,
    fibres,
    Av_m2: Av,
  };
}

describe('beamStresses', () => {
  it('deux appuis, q = 10 kN/m, L = 3 m : M = 11,25 kN·m → σ = ±16,875 MPa', () => {
    const q = 10_000;
    const L = 3;
    const sol = solveBeam({
      length_m: L,
      supports: [
        { kind: 'appui', x_m: 0 },
        { kind: 'appui', x_m: L },
      ],
      loads: [{ kind: 'repartie', x1_m: 0, x2_m: L, q1_N_m: -q, q2_N_m: -q }],
    });
    const e = beamExtrema(sol);
    const V =
      Math.abs(e.shear_N.max.value) > Math.abs(e.shear_N.min.value) ? e.shear_N.max : e.shear_N.min;
    const s = beamStresses({
      momentMax: e.moment_Nm.max,
      momentMin: e.moment_Nm.min,
      shearAbsMax: V,
      Iy_m4: rect.Iy_m4,
      fibres,
      Av_m2: rect.Av_z_m2,
    });
    const sigma = (q * L ** 2) / 8 / ((0.1 * 0.2 ** 2) / 6);
    expectRelClose(s.tension.sigma_Pa, sigma, 1e-9);
    expect(s.tension.fibre).toBe('inferieure');
    expectRelClose(s.tension.x_m, L / 2, 1e-6);
    expectRelClose(s.compression.sigma_Pa, -sigma, 1e-9);
    expect(s.compression.fibre).toBe('superieure');
    // τ moyen = (qL/2) / Av ; Av du rectangle plein fournie par le module sections.
    expectRelClose(s.shear?.tau_Pa ?? NaN, (q * L) / 2 / (rect.Av_z_m2 ?? NaN), 1e-9);
  });

  it('console (M < 0 partout) : traction en fibre supérieure', () => {
    const s = beamStresses(input(0, -10_000, 5_000));
    expect(s.tension.fibre).toBe('superieure');
    expectRelClose(s.tension.sigma_Pa, 15e6);
    expect(s.compression.fibre).toBe('inferieure');
    expectRelClose(s.compression.sigma_Pa, -15e6);
    expect(s.shear).toBeUndefined();
  });

  it('moments des deux signes : on retient le plus défavorable pour chaque signe de σ', () => {
    const s = beamStresses(input(4_000, -10_000, 0));
    expectRelClose(s.tension.sigma_Pa, 15e6);
    expect(s.tension.M_Nm).toBe(-10_000);
    expectRelClose(s.compression.sigma_Pa, -15e6);
  });

  it('section en T : la fibre éloignée de G gouverne, traction ≠ compression', () => {
    const t = computeSection({ shape: 'T', h_m: 0.1, b_m: 0.1, tw_m: 0.01, tf_m: 0.01 });
    const s = beamStresses({
      momentMax: { value: 2_000, x_m: 1 },
      momentMin: { value: 0, x_m: 0 },
      shearAbsMax: { value: 0, x_m: 0 },
      Iy_m4: t.Iy_m4,
      fibres: extremeFibres(t.height_m, t.zG_m),
    });
    // M > 0 : fibre inférieure (âme, loin de G) tendue → traction > |compression|.
    expect(s.tension.fibre).toBe('inferieure');
    expect(s.tension.sigma_Pa).toBeGreaterThan(-s.compression.sigma_Pa);
    expectRelClose(s.tension.sigma_Pa, 2_000 / t.Wel_y_m3, 1e-9);
  });

  it('poutre non fléchie : contraintes nulles (sans −0)', () => {
    const s = beamStresses(input(0, 0, 0, 1e-3));
    expect(s.tension.sigma_Pa).toBe(0);
    expect(s.compression.sigma_Pa).toBe(0);
    expect(Object.is(s.compression.sigma_Pa, -0)).toBe(false);
    expect(s.shear?.tau_Pa).toBe(0);
  });
});

describe('strengthBasis', () => {
  it('Re connue → ductile ; Rm seule → fragile ; rien → indéfini', () => {
    expect(strengthBasis({ Re_Pa: 235e6, Rm_Pa: 360e6 })).toEqual({
      kind: 'ductile',
      Re_Pa: 235e6,
    });
    expect(strengthBasis({ Rm_Pa: 250e6 })).toEqual({ kind: 'fragile', Rm_Pa: 250e6 });
    expect(strengthBasis({})).toBeUndefined();
    expect(strengthBasis({ Re_Pa: 0, Rm_Pa: undefined })).toBeUndefined();
  });
});

describe('checkBeamStrength', () => {
  it('ductile : von Mises sur |σ| maximale, n = Re / σ_eq', () => {
    const s = beamStresses(input(10_000, -4_000, 20_000, 1e-3));
    const c = checkBeamStrength(s, { kind: 'ductile', Re_Pa: 235e6 }, 1.5);
    const eq = Math.sqrt(15e6 ** 2 + 3 * 20e6 ** 2);
    expect(c.criterion).toBe('vonMises');
    expectRelClose(c.equivalent_Pa, eq);
    expectRelClose(c.safetyFactor, 235e6 / eq);
    expect(c.verdict).toBe('ok');
    expect(c.compressionNotChecked).toBe(false);
  });

  it('fragile : contrainte principale de traction comparée à Rm, compression non vérifiée', () => {
    const s = beamStresses(input(10_000, 0, 20_000, 1e-3));
    const c = checkBeamStrength(s, { kind: 'fragile', Rm_Pa: 250e6 }, 1.5);
    const s1 = 7.5e6 + Math.sqrt(7.5e6 ** 2 + 20e6 ** 2);
    expect(c.criterion).toBe('rankine');
    expectRelClose(c.equivalent_Pa, s1);
    expectRelClose(c.safetyFactor, 250e6 / s1);
    expect(c.compressionNotChecked).toBe(true);
  });

  it('verdicts : ok, limite, ko selon le seuil', () => {
    // Re = 30 MPa ; M = 10 kN·m → σ = 15 MPa → n = 2.
    const basis = { kind: 'ductile' as const, Re_Pa: 30e6 };
    const at = (M: number, threshold: number) =>
      checkBeamStrength(beamStresses(input(M, 0, 0)), basis, threshold);
    expectRelClose(at(10_000, 1.5).safetyFactor, 2);
    expect(at(10_000, 1.5).verdict).toBe('ok');
    expect(at(10_000, 2).verdict).toBe('ok');
    expect(at(10_000, 2.5).verdict).toBe('limite');
    // M = 25 kN·m → σ = 37,5 MPa → n = 0,8.
    expect(at(25_000, 1.5).verdict).toBe('ko');
  });

  it('sans aire de cisaillement : τ = 0 dans le critère', () => {
    const c = checkBeamStrength(
      beamStresses(input(10_000, 0, 50_000)),
      { kind: 'ductile', Re_Pa: 235e6 },
      1.5,
    );
    expect(c.tau_Pa).toBe(0);
    expectRelClose(c.equivalent_Pa, 15e6);
  });
});

describe('checkDeflection', () => {
  it('L = 3 m, L/300 = 10 mm : 8 mm ok, 12 mm ko', () => {
    const ok = checkDeflection(-0.008, 3, 300);
    expectRelClose(ok.allowable_m, 0.01);
    expectRelClose(ok.ratio, 0.8);
    expect(ok.verdict).toBe('ok');
    expect(checkDeflection(0.012, 3, 300).verdict).toBe('ko');
    expect(checkDeflection(-0.01, 3, 300).verdict).toBe('ok');
  });

  it('données invalides', () => {
    expect(() => checkDeflection(NaN, 3, 300)).toThrow(StressInputError);
    expect(() => checkDeflection(0.01, 0, 300)).toThrow(/longueur/);
    expect(() => checkDeflection(0.01, 3, 0)).toThrow(/limite/);
  });
});
