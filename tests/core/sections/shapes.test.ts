/**
 * Tests des sections usuelles.
 * Références :
 * - formules fermées des sections planes (Roark 8e éd. ; Timoshenko & Gere) ;
 * - coefficients de torsion du rectangle β (J = β h b³) : 0,141 (h/b = 1),
 *   0,229 (2), 0,263 (3), 0,312 (10), 1/3 (∞) — Timoshenko & Goodier,
 *   Theory of Elasticity, tableau de la torsion des barres rectangulaires ;
 * - cas limites analytiques (tube plein = rond, tube carré mince : J/Ip → 3/4).
 */
import { describe, expect, it } from 'vitest';
import {
  computeSection,
  SectionGeometryError,
  torsionConstantRectangle,
  type SectionInput,
} from '@core/sections';
import { expectRelClose } from '../../helpers';

const mm = (x: number) => x / 1000;

describe('rectangle plein', () => {
  const s = computeSection({ shape: 'rectangle', b_m: mm(100), h_m: mm(200) });

  it('A, Iy, Iz, Wel, Wpl, i', () => {
    expectRelClose(s.A_m2, 0.02);
    expectRelClose(s.Iy_m4, (0.1 * 0.2 ** 3) / 12);
    expectRelClose(s.Iz_m4, (0.2 * 0.1 ** 3) / 12);
    expectRelClose(s.Wel_y_m3, (0.1 * 0.2 ** 2) / 6);
    expectRelClose(s.Wpl_y_m3, (0.1 * 0.2 ** 2) / 4, 1e-9);
    expectRelClose(s.iy_m, 0.2 / Math.sqrt(12));
  });

  // Tolérance 1 % : la formule de Roark est une approximation (< 4 % selon Roark),
  // les coefficients tabulés sont donnés à 3 chiffres.
  it.each([
    [1, 0.141],
    [2, 0.229],
    [3, 0.263],
    [10, 0.312],
  ])('J = β h b³ avec h/b = %d → β ≈ %d', (ratio, beta) => {
    const b = 0.01;
    const h = ratio * b;
    expectRelClose(torsionConstantRectangle(b, h), beta * h * b ** 3, 0.01);
  });

  it('J tend vers h b³/3 pour un plat très mince', () => {
    expectRelClose(torsionConstantRectangle(0.001, 1), (1 * 0.001 ** 3) / 3, 0.001);
  });

  it('J symétrique en b et h', () => {
    expect(torsionConstantRectangle(0.02, 0.05)).toBe(torsionConstantRectangle(0.05, 0.02));
  });

  it('Av = A', () => {
    expect(s.Av_z_m2).toBe(s.A_m2);
  });
});

describe('rond plein et tube', () => {
  const D = mm(50);
  const rond = computeSection({ shape: 'rond', d_m: D });

  it('rond : I = π D⁴/64, Wel = π D³/32, Wpl = D³/6, J = π D⁴/32', () => {
    expectRelClose(rond.A_m2, (Math.PI * D ** 2) / 4);
    expectRelClose(rond.Iy_m4, (Math.PI * D ** 4) / 64);
    expectRelClose(rond.Wel_y_m3, (Math.PI * D ** 3) / 32);
    expectRelClose(rond.Wpl_y_m3, D ** 3 / 6);
    expectRelClose(rond.J_m4, (Math.PI * D ** 4) / 32);
    expectRelClose(rond.iy_m, D / 4);
  });

  it('tube d’épaisseur D/2 = rond plein', () => {
    const t = computeSection({ shape: 'tube', d_m: D, t_m: D / 2 });
    for (const k of ['A_m2', 'Iy_m4', 'Wpl_y_m3', 'J_m4'] as const) expectRelClose(t[k], rond[k]);
  });

  it('tube : I = π (D⁴ − d⁴)/64, Av = 2A/π', () => {
    const t = computeSection({ shape: 'tube', d_m: mm(60.3), t_m: mm(4) });
    const d = mm(60.3 - 8);
    expectRelClose(t.Iy_m4, (Math.PI * (mm(60.3) ** 4 - d ** 4)) / 64);
    expectRelClose(t.Av_z_m2 ?? NaN, (2 * t.A_m2) / Math.PI);
  });
});

describe('rectangle creux', () => {
  const b = mm(100);
  const h = mm(150);
  const t = mm(5);
  const s = computeSection({ shape: 'rectangleCreux', b_m: b, h_m: h, t_m: t });

  it('Iy, Wpl par différence de rectangles', () => {
    expectRelClose(s.Iy_m4, (b * h ** 3 - (b - 2 * t) * (h - 2 * t) ** 3) / 12);
    expectRelClose(s.Wpl_y_m3, (b * h ** 2 - (b - 2 * t) * (h - 2 * t) ** 2) / 4, 1e-9);
  });

  it('Av,z = A h/(b + h)', () => {
    expectRelClose(s.Av_z_m2 ?? NaN, (s.A_m2 * h) / (b + h));
  });

  it('tube carré très mince : J (Bredt) / Ip → 3/4 (calcul à la main)', () => {
    const q = computeSection({ shape: 'rectangleCreux', b_m: 1, h_m: 1, t_m: 0.0005 });
    expectRelClose(q.J_m4 / (q.Iy_m4 + q.Iz_m4), 0.75, 0.002);
  });
});

describe('profilé en I (h = 200, b = 100, tw = 5,6, tf = 8,5 mm, sans congés)', () => {
  const [h, b, tw, tf] = [mm(200), mm(100), mm(5.6), mm(8.5)];
  const s = computeSection({ shape: 'I', h_m: h, b_m: b, tw_m: tw, tf_m: tf });
  const hw = h - 2 * tf;

  it('formules fermées de l’I symétrique', () => {
    expectRelClose(s.A_m2, 2 * b * tf + hw * tw);
    expectRelClose(s.Iy_m4, (b * h ** 3 - (b - tw) * hw ** 3) / 12);
    expectRelClose(s.Iz_m4, (2 * tf * b ** 3 + hw * tw ** 3) / 12);
    expectRelClose(s.Wpl_y_m3, b * tf * (h - tf) + (tw * hw ** 2) / 4, 1e-9);
    expectRelClose(s.J_m4, (2 * b * tf ** 3 + hw * tw ** 3) / 3);
  });

  it('centre de gravité au milieu, Iyz nul', () => {
    expectRelClose(s.yG_m, b / 2);
    expectRelClose(s.zG_m, h / 2);
    expect(Math.abs(s.Iyz_m4)).toBeLessThan(1e-18);
  });

  it('Av,z = max(A − 2 b tf + tw tf ; hw tw)', () => {
    expectRelClose(s.Av_z_m2 ?? NaN, Math.max(s.A_m2 - 2 * b * tf + tw * tf, hw * tw));
  });

  it('âme nulle (tw → 0) : deux semelles seules (contrôle du théorème de Huygens)', () => {
    const p = computeSection({ shape: 'I', h_m: h, b_m: b, tw_m: 1e-9, tf_m: tf });
    const d = h / 2 - tf / 2;
    expectRelClose(p.Iy_m4, 2 * ((b * tf ** 3) / 12 + b * tf * d ** 2), 1e-6);
  });
});

describe('profilé en U', () => {
  const [h, b, tw, tf] = [mm(200), mm(75), mm(8.5), mm(11.5)];
  const s = computeSection({ shape: 'U', h_m: h, b_m: b, tw_m: tw, tf_m: tf });

  it('même Iy qu’un I de mêmes cotes (mêmes distances à l’axe y)', () => {
    const i = computeSection({ shape: 'I', h_m: h, b_m: b, tw_m: tw, tf_m: tf });
    expectRelClose(s.Iy_m4, i.Iy_m4);
  });

  it('centre de gravité décalé vers l’âme', () => {
    const A = h * tw + 2 * (b - tw) * tf;
    const yG = (h * tw * (tw / 2) + 2 * (b - tw) * tf * ((b + tw) / 2)) / A;
    expectRelClose(s.yG_m, yG);
    expect(s.yG_m).toBeLessThan(b / 2);
  });
});

describe('profilé en T', () => {
  const [h, b, tw, tf] = [mm(100), mm(100), mm(10), mm(10)];
  const s = computeSection({ shape: 'T', h_m: h, b_m: b, tw_m: tw, tf_m: tf });

  it('centre de gravité (calcul à la main)', () => {
    const A = b * tf + (h - tf) * tw;
    const zG = (b * tf * (h - tf / 2) + (h - tf) * tw * ((h - tf) / 2)) / A;
    expectRelClose(s.zG_m, zG);
    // A = 100×10 + 90×10 = 1900 mm² ; zG = (1000×95 + 900×45) / 1900 = 71,316 mm
    expectRelClose(zG, 0.0713158, 1e-5);
  });

  it('Wel minimal sur la fibre la plus éloignée (pied d’âme), Wpl > Wel', () => {
    expectRelClose(s.Wel_y_m3, s.Iy_m4 / s.zG_m);
    expect(s.Wpl_y_m3).toBeGreaterThan(s.Wel_y_m3);
  });
});

describe('cornière', () => {
  it('ailes égales : axes principaux à 45°, iv < iy', () => {
    const s = computeSection({ shape: 'L', h_m: mm(100), b_m: mm(100), t_m: mm(10) });
    expectRelClose(s.principal.alpha_rad, Math.PI / 4, 1e-9);
    expect(s.principal.iv_m).toBeLessThan(s.iy_m);
    expect(s.Av_z_m2).toBeUndefined();
  });

  it('inverser les ailes échange Iy et Iz', () => {
    const a = computeSection({ shape: 'L', h_m: mm(120), b_m: mm(80), t_m: mm(8) });
    const b = computeSection({ shape: 'L', h_m: mm(80), b_m: mm(120), t_m: mm(8) });
    expectRelClose(a.Iy_m4, b.Iz_m4);
    expectRelClose(a.Iz_m4, b.Iy_m4);
  });
});

describe('géométries impossibles → erreur claire', () => {
  it.each<[string, SectionInput, RegExp]>([
    ['b nul', { shape: 'rectangle', b_m: 0, h_m: 1 }, /strictement positif/],
    ['h négatif', { shape: 'rectangle', b_m: 1, h_m: -1 }, /strictement positif/],
    ['NaN', { shape: 'rond', d_m: NaN }, /strictement positif/],
    ['creux trop épais', { shape: 'rectangleCreux', b_m: 0.1, h_m: 0.2, t_m: 0.05 }, /moitié/],
    ['tube trop épais', { shape: 'tube', d_m: 0.05, t_m: 0.03 }, /rayon/],
    [
      'I : semelles trop hautes',
      { shape: 'I', h_m: 0.1, b_m: 0.1, tw_m: 0.01, tf_m: 0.05 },
      /semelles/,
    ],
    ['I : âme trop large', { shape: 'I', h_m: 0.2, b_m: 0.1, tw_m: 0.2, tf_m: 0.01 }, /âme/],
    ['U : âme ≥ ailes', { shape: 'U', h_m: 0.2, b_m: 0.05, tw_m: 0.05, tf_m: 0.01 }, /âme/],
    ['L : épaisseur ≥ aile', { shape: 'L', h_m: 0.1, b_m: 0.05, t_m: 0.05 }, /épaisseur/],
    [
      'T : semelle ≥ hauteur',
      { shape: 'T', h_m: 0.05, b_m: 0.1, tw_m: 0.01, tf_m: 0.05 },
      /semelle/,
    ],
  ])('%s', (_label, input, message) => {
    expect(() => computeSection(input)).toThrow(SectionGeometryError);
    expect(() => computeSection(input)).toThrow(message);
  });
});
