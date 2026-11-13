/**
 * Tests du moteur de sections composées de rectangles.
 * Références : formules fermées du rectangle (b h³/12, b h²/6, b h²/4 — Roark 8e éd.,
 * chap. 2 ; Timoshenko & Gere) et calculs à la main détaillés dans les tests.
 */
import { describe, expect, it } from 'vitest';
import { compositeProperties, principalAxes, type Rect } from '@core/sections/composite';
import { expectRelClose } from '../../helpers';

const rect = (y0: number, y1: number, z0: number, z1: number): Rect => ({ y0, y1, z0, z1 });

describe('rectangle seul (formules fermées)', () => {
  // b = 100 mm, h = 200 mm
  const p = compositeProperties([rect(0, 0.1, 0, 0.2)]);

  it('A, centre de gravité, boîte englobante', () => {
    expectRelClose(p.A_m2, 0.02);
    expectRelClose(p.yG_m, 0.05);
    expectRelClose(p.zG_m, 0.1);
    expectRelClose(p.width_m, 0.1);
    expectRelClose(p.height_m, 0.2);
  });

  it('Iy = b h³/12, Iz = h b³/12, Iyz = 0', () => {
    expectRelClose(p.Iy_m4, (0.1 * 0.2 ** 3) / 12);
    expectRelClose(p.Iz_m4, (0.2 * 0.1 ** 3) / 12);
    expect(Math.abs(p.Iyz_m4)).toBeLessThan(1e-20);
  });

  it('Wel = b h²/6, Wpl = b h²/4 (facteur de forme 1,5)', () => {
    expectRelClose(p.Wel_y_m3, (0.1 * 0.2 ** 2) / 6);
    expectRelClose(p.Wpl_y_m3, (0.1 * 0.2 ** 2) / 4, 1e-9);
    expectRelClose(p.Wpl_z_m3, (0.2 * 0.1 ** 2) / 4, 1e-9);
    expectRelClose(p.Wpl_y_m3 / p.Wel_y_m3, 1.5, 1e-9);
  });

  it('axes principaux confondus avec y et z', () => {
    expectRelClose(p.principal.Iu_m4, p.Iy_m4);
    expectRelClose(p.principal.Iv_m4, p.Iz_m4);
    expect(p.principal.alpha_rad).toBe(0);
  });
});

describe('invariance par découpage', () => {
  it('un rectangle découpé en deux donne les mêmes propriétés', () => {
    const whole = compositeProperties([rect(0, 0.1, 0, 0.2)]);
    const split = compositeProperties([rect(0, 0.1, 0, 0.07), rect(0, 0.1, 0.07, 0.2)]);
    for (const k of ['A_m2', 'Iy_m4', 'Iz_m4', 'Wel_y_m3', 'Wpl_y_m3', 'Wpl_z_m3'] as const) {
      expectRelClose(split[k], whole[k], 1e-9);
    }
  });

  it('la position absolue n’a pas d’effet (centre de gravité relatif à la boîte)', () => {
    const a = compositeProperties([rect(0, 0.1, 0, 0.2)]);
    const b = compositeProperties([rect(5, 5.1, -3, -2.8)]);
    expectRelClose(b.yG_m, a.yG_m, 1e-9);
    expectRelClose(b.Iy_m4, a.Iy_m4, 1e-6);
  });
});

describe('cornière à ailes égales 100 × 100 × 10 (sans congé), calcul à la main', () => {
  // Aile horizontale R1 = [0;100]×[0;10] mm, aile verticale R2 = [0;10]×[10;100] mm.
  const R1 = { A: 1e-3, y: 0.05, z: 0.005 };
  const R2 = { A: 9e-4, y: 0.005, z: 0.055 };
  const A = R1.A + R2.A;
  const yG = (R1.A * R1.y + R2.A * R2.y) / A; // 28,684 mm
  const Iyz = R1.A * (R1.y - yG) * (R1.z - yG) + R2.A * (R2.y - yG) * (R2.z - yG);
  const p = compositeProperties([rect(0, 0.1, 0, 0.01), rect(0, 0.01, 0.01, 0.1)]);

  it('centre de gravité sur la bissectrice', () => {
    expectRelClose(p.yG_m, yG);
    expectRelClose(p.zG_m, yG);
    expectRelClose(yG, 0.0286842, 1e-5);
  });

  it('produit d’inertie négatif (ailes selon +y et +z)', () => {
    expectRelClose(p.Iyz_m4, Iyz);
    expect(p.Iyz_m4).toBeLessThan(0);
  });

  it('axes principaux à 45°, Iu = I + |Iyz|, Iv = I − |Iyz|', () => {
    expectRelClose(p.Iy_m4, p.Iz_m4, 1e-12);
    expectRelClose(p.principal.alpha_rad, Math.PI / 4, 1e-12);
    expectRelClose(p.principal.Iu_m4, p.Iy_m4 + Math.abs(Iyz));
    expectRelClose(p.principal.Iv_m4, p.Iy_m4 - Math.abs(Iyz));
  });

  it('invariant : Iu + Iv = Iy + Iz', () => {
    expectRelClose(p.principal.Iu_m4 + p.principal.Iv_m4, p.Iy_m4 + p.Iz_m4);
  });

  it('module plastique : axe neutre plastique partageant l’aire en deux (Wpl > Wel)', () => {
    expect(p.Wpl_y_m3).toBeGreaterThan(p.Wel_y_m3);
  });
});

describe('principalAxes', () => {
  it('Iy > Iz sans produit : u = y', () => {
    expect(principalAxes(2, 1, 0)).toEqual({ Iu_m4: 2, Iv_m4: 1, alpha_rad: 0 });
  });

  it('Iz > Iy sans produit : u = z (α = 90°)', () => {
    const r = principalAxes(1, 2, 0);
    expect(r.Iu_m4).toBe(2);
    expectRelClose(r.alpha_rad, Math.PI / 2);
  });
});

describe('cas limites', () => {
  it('section vide → erreur', () => {
    expect(() => compositeProperties([])).toThrow(/vide/);
  });

  it.each([
    ['largeur nulle', rect(0, 0, 0, 1)],
    ['hauteur négative', rect(0, 1, 1, 0)],
    ['valeur non finie', rect(0, NaN, 0, 1)],
  ])('rectangle dégénéré (%s) → erreur', (_l, r) => {
    expect(() => compositeProperties([r])).toThrow(/dégénéré/);
  });
});
