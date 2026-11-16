/**
 * Tests des contraintes sous efforts combinés (N, My, Vz, T).
 * Références :
 * - traction simple σ = N/A ; Navier σ = M/Wel, Wel = b h²/6 pour un rectangle
 *   (Timoshenko & Gere, Mechanics of Materials) ; flexion composée par superposition ;
 * - arbre circulaire plein τ = 16 T / (π d³), tube τ = T (D/2) / Ip (Timoshenko & Gere) ;
 * - rectangle plein τ = T / (α h t²) avec α tabulé : 0,208 (h/t = 1), 0,246 (2), 0,267 (3),
 *   0,312 (10) — Timoshenko & Goodier, Theory of Elasticity, torsion des barres rectangulaires
 *   (valeurs arrondies au millième, d'où une tolérance de 0,5 %) ;
 * - tube mince fermé, Bredt τ = T / (2 Am t) ; profil mince ouvert τ = T tmax / J ;
 * - flexion déviée : vérifiée par l'équilibre (intégration numérique de σ sur la section).
 */
import { describe, expect, it } from 'vitest';
import { computeSection, type SectionInput } from '@core/sections';
import {
  checkStrength,
  combinedStresses,
  normalStress_Pa,
  rectangleTorsionFactor,
  StressInputError,
  torsionModulus,
  type SectionEfforts,
} from '@core/stress';
import { expectRelClose } from '../../helpers';

const efforts = (e: Partial<SectionEfforts>): SectionEfforts => ({
  N_N: 0,
  My_Nm: 0,
  Vz_N: 0,
  T_Nm: 0,
  ...e,
});

function run(input: SectionInput, e: Partial<SectionEfforts>) {
  return combinedStresses(input, computeSection(input), efforts(e));
}

const RECT: SectionInput = { shape: 'rectangle', b_m: 0.1, h_m: 0.2 };

describe('combinedStresses — contraintes normales', () => {
  it('traction simple : N = 100 kN sur 100 × 200 mm → σ = 5 MPa partout', () => {
    const r = run(RECT, { N_N: 100_000 });
    expectRelClose(r.sigmaN_Pa, 5e6);
    expectRelClose(r.tension.sigma_Pa, 5e6);
    expect(r.compression.sigma_Pa).toBe(0); // toute la section est tendue
    expectRelClose(r.vonMises_Pa, 5e6);
    expect(r.unsymmetric).toBe(false);
  });

  it('compression simple : N = −100 kN → σ = −5 MPa, traction ramenée à 0', () => {
    const r = run(RECT, { N_N: -100_000 });
    expectRelClose(r.compression.sigma_Pa, -5e6);
    expect(r.tension.sigma_Pa).toBe(0);
    expectRelClose(r.sigmaAbsMax_Pa, 5e6);
  });

  it('flexion simple : My = 11,25 kN·m → ±16,875 MPa, fibre inférieure tendue', () => {
    // Wel = 0,1 × 0,2² / 6 = 6,667e-4 m³ ; σ = 11 250 / 6,667e-4 = 16,875 MPa.
    const r = run(RECT, { My_Nm: 11_250 });
    expectRelClose(r.tension.sigma_Pa, 16.875e6, 1e-12);
    expectRelClose(r.compression.sigma_Pa, -16.875e6, 1e-12);
    expectRelClose(r.tension.z_m, -0.1);
    expectRelClose(r.compression.z_m, 0.1);
  });

  it('flexion composée : N = 100 kN et My = 11,25 kN·m → +21,875 / −11,875 MPa', () => {
    const r = run(RECT, { N_N: 100_000, My_Nm: 11_250 });
    expectRelClose(r.tension.sigma_Pa, 21.875e6, 1e-12);
    expectRelClose(r.compression.sigma_Pa, -11.875e6, 1e-12);
    expectRelClose(r.sigmaAbsMax_Pa, 21.875e6, 1e-12);
  });

  it('T non symétrique : fibres extrêmes à h − zG et −zG', () => {
    const input: SectionInput = { shape: 'T', h_m: 0.2, b_m: 0.15, tw_m: 0.01, tf_m: 0.015 };
    const s = computeSection(input);
    const M = 5_000;
    const r = combinedStresses(input, s, efforts({ My_Nm: M }));
    expectRelClose(r.tension.sigma_Pa, (M * s.zG_m) / s.Iy_m4, 1e-12);
    expectRelClose(r.compression.sigma_Pa, (-M * (s.height_m - s.zG_m)) / s.Iy_m4, 1e-12);
  });

  it('cornière (Iyz ≠ 0) : σ vérifie l’équilibre ∫σ dA = N, ∫σ z dA = −My, ∫σ y dA = 0', () => {
    const input: SectionInput = { shape: 'L', h_m: 0.1, b_m: 0.06, t_m: 0.008 };
    const s = computeSection(input);
    const N = 20_000;
    const My = 1_500;
    expect(s.geometry.kind).toBe('rects');
    if (s.geometry.kind !== 'rects') return;
    // Intégration par la méthode du point milieu : exacte pour un intégrande bilinéaire
    // en (y, z) par rectangle ; σ·y et σ·z contiennent y² et z², d'où une petite erreur
    // en 1/n² (n = 200 → tolérance 1e-4).
    const n = 200;
    let F = 0;
    let Mz = 0;
    let My_ = 0;
    for (const rc of s.geometry.rects) {
      const dy = (rc.y1 - rc.y0) / n;
      const dz = (rc.z1 - rc.z0) / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const y = rc.y0 + (i + 0.5) * dy - s.yG_m;
          const z = rc.z0 + (j + 0.5) * dz - s.zG_m;
          const sig = normalStress_Pa(s, N, My, y, z);
          F += sig * dy * dz;
          My_ += sig * z * dy * dz;
          Mz += sig * y * dy * dz;
        }
      }
    }
    expectRelClose(F, N, 1e-9);
    expectRelClose(My_, -My, 1e-4);
    expect(Math.abs(Mz) / My).toBeLessThan(1e-4);
    expect(combinedStresses(input, s, efforts({ My_Nm: My })).unsymmetric).toBe(true);
  });

  it('cornière : la formule déviée diffère de −My·z/Iy (Iyz pris en compte)', () => {
    const input: SectionInput = { shape: 'L', h_m: 0.1, b_m: 0.1, t_m: 0.01 };
    const s = computeSection(input);
    const r = combinedStresses(input, s, efforts({ My_Nm: 1_000 }));
    const naive = (1_000 * s.zG_m) / s.Iy_m4;
    expect(Math.abs(r.tension.sigma_Pa - naive) / naive).toBeGreaterThan(0.1);
  });
});

describe('combinedStresses — cisaillement et torsion', () => {
  it('Vz sur rectangle plein : τ = V / A (Av = A)', () => {
    const r = run(RECT, { Vz_N: 20_000 });
    expectRelClose(r.tauV_Pa ?? NaN, 1e6);
    expectRelClose(r.tau_Pa, 1e6);
    expectRelClose(r.vonMises_Pa, Math.sqrt(3) * 1e6);
    expectRelClose(r.tresca_Pa, 2e6);
    expectRelClose(r.sigma1_Pa, 1e6);
  });

  it('Vz sur cornière : τ_V non définie', () => {
    const r = run({ shape: 'L', h_m: 0.1, b_m: 0.1, t_m: 0.01 }, { Vz_N: 1_000 });
    expect(r.tauV_Pa).toBeUndefined();
    expect(r.tau_Pa).toBe(0);
  });

  it('arbre plein d = 50 mm, T = 1 kN·m : τ = 16 T / (π d³) = 40,74 MPa', () => {
    const r = run({ shape: 'rond', d_m: 0.05 }, { T_Nm: 1_000 });
    expectRelClose(r.tauT_Pa, (16 * 1_000) / (Math.PI * 0.05 ** 3), 1e-12);
    expect(r.torsion.method).toBe('circulaire');
  });

  it('tube D = 60 mm, t = 5 mm : τ = T (D/2) / Ip', () => {
    const D = 0.06;
    const d = 0.05;
    const Ip = (Math.PI * (D ** 4 - d ** 4)) / 32;
    const r = run({ shape: 'tube', d_m: D, t_m: 0.005 }, { T_Nm: -800 });
    expectRelClose(r.tauT_Pa, (800 * D) / 2 / Ip, 1e-12);
  });

  it.each([
    [1, 0.208],
    [2, 0.246],
    [3, 0.267],
    [10, 0.312],
  ])('rectangle plein h/t = %d : τ = T / (α h t²), α = %d (tolérance 0,5 %)', (ratio, alpha) => {
    const t = 0.02;
    const h = ratio * t;
    const T = 500;
    const r = run({ shape: 'rectangle', b_m: t, h_m: h }, { T_Nm: T });
    expectRelClose(r.tauT_Pa, T / (alpha * h * t ** 2), 5e-3);
    // Même résultat quelle que soit l'orientation du rectangle.
    const r2 = run({ shape: 'rectangle', b_m: h, h_m: t }, { T_Nm: T });
    expectRelClose(r2.tauT_Pa, r.tauT_Pa);
  });

  it('rectangle creux 100 × 100 × 5 mm (Bredt) : τ = T / (2 Am t), Am = 95²', () => {
    const r = run({ shape: 'rectangleCreux', b_m: 0.1, h_m: 0.1, t_m: 0.005 }, { T_Nm: 2_000 });
    expectRelClose(r.tauT_Pa, 2_000 / (2 * 0.095 ** 2 * 0.005), 1e-12);
    expect(r.torsion.method).toBe('bredt');
    expectRelClose(r.torsion.Am_m2 ?? NaN, 0.095 ** 2, 1e-12);
  });

  it('profilé I : τ = T tmax / J, paroi la plus épaisse (semelle)', () => {
    const input: SectionInput = { shape: 'I', h_m: 0.2, b_m: 0.1, tw_m: 0.0056, tf_m: 0.0085 };
    const s = computeSection(input);
    const r = combinedStresses(input, s, efforts({ T_Nm: 50 }));
    expectRelClose(r.tauT_Pa, (50 * 0.0085) / s.J_m4, 1e-12);
    expect(torsionModulus(input, s).t_m).toBe(0.0085);
  });

  it('cornière : τ = T t / J', () => {
    const input: SectionInput = { shape: 'L', h_m: 0.08, b_m: 0.06, t_m: 0.006 };
    const s = computeSection(input);
    expectRelClose(torsionModulus(input, s).Wt_m3, s.J_m4 / 0.006, 1e-12);
  });

  it('majorant : von Mises avec |σ|max et τ_V + τ_T', () => {
    const r = run(RECT, { N_N: -50_000, My_Nm: 8_000, Vz_N: 30_000, T_Nm: 1_500 });
    const sigma = Math.max(r.tension.sigma_Pa, -r.compression.sigma_Pa);
    const tau = (r.tauV_Pa ?? 0) + r.tauT_Pa;
    expectRelClose(r.tau_Pa, tau);
    expectRelClose(r.vonMises_Pa, Math.sqrt(sigma ** 2 + 3 * tau ** 2));
    expectRelClose(r.tresca_Pa, Math.sqrt(sigma ** 2 + 4 * tau ** 2));
    expect(r.tresca_Pa).toBeGreaterThan(r.vonMises_Pa);
  });

  it('efforts nuls : toutes les contraintes sont nulles', () => {
    const r = run(RECT, {});
    expect(r.vonMises_Pa).toBe(0);
    expect(r.tension.sigma_Pa).toBe(0);
    expect(r.compression.sigma_Pa).toBe(0);
  });
});

describe('combinedStresses — erreurs', () => {
  it.each(['N_N', 'My_Nm', 'Vz_N', 'T_Nm'] as const)('%s non fini → StressInputError', (k) => {
    expect(() => run(RECT, { [k]: Number.NaN })).toThrow(StressInputError);
    expect(() => run(RECT, { [k]: Infinity })).toThrow(StressInputError);
  });

  it('propriétés de section invalides → StressInputError', () => {
    expect(() => normalStress_Pa({ A_m2: 0, Iy_m4: 1, Iz_m4: 1, Iyz_m4: 0 }, 1, 0, 0, 0)).toThrow(
      StressInputError,
    );
    expect(() => normalStress_Pa({ A_m2: 1, Iy_m4: 1, Iz_m4: 1, Iyz_m4: 1 }, 1, 0, 0, 0)).toThrow(
      StressInputError,
    );
  });

  it('rapport b/a hors de ]0 ; 1] → StressInputError', () => {
    expect(() => rectangleTorsionFactor(0)).toThrow(StressInputError);
    expect(() => rectangleTorsionFactor(1.2)).toThrow(StressInputError);
    expect(() => rectangleTorsionFactor(Number.NaN)).toThrow(StressInputError);
  });
});

describe('checkStrength', () => {
  it('ductile : n = Re / von Mises, compression comptée', () => {
    const c = checkStrength(100e6, -200e6, 0, { kind: 'ductile', Re_Pa: 300e6 }, 1.5);
    expectRelClose(c.equivalent_Pa, 200e6);
    expectRelClose(c.safetyFactor, 1.5);
    expect(c.verdict).toBe('ok');
  });

  it('fragile : n = Rm / σ₁, compression ignorée', () => {
    const c = checkStrength(50e6, -200e6, 0, { kind: 'fragile', Rm_Pa: 250e6 }, 1.5);
    expectRelClose(c.equivalent_Pa, 50e6);
    expectRelClose(c.safetyFactor, 5);
    expect(c.compressionNotChecked).toBe(true);
  });
});
