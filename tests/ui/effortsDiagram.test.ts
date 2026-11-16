/**
 * Tests du schéma des efforts (page Contraintes) : sens des flèches selon les signes, et
 * cohérence avec le moteur. Le moment dessiné doit être la résultante des contraintes σ
 * calculées par `normalStress_Pa` sur la facette de normale +x (vecteur ∫ r × σ·ex dA).
 * Cas : rectangle plein 100 × 200 mm.
 */
import { describe, expect, it } from 'vitest';
import { computeSection } from '@core/sections';
import { normalStress_Pa, type SectionEfforts } from '@core/stress';
import {
  effortArrows,
  project,
  rotationArc,
  rotationBasis,
  type Vec3,
} from '@ui/stress/effortsDiagram';
import { expectRelClose } from '../helpers';

const efforts = (e: Partial<SectionEfforts>): SectionEfforts => ({
  N_N: 0,
  My_Nm: 0,
  Vz_N: 0,
  T_Nm: 0,
  ...e,
});

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

describe('effortArrows', () => {
  it('aucun effort : aucune flèche', () => {
    expect(effortArrows(efforts({}))).toEqual([]);
  });

  it('un effort non fini n’est pas dessiné', () => {
    expect(effortArrows(efforts({ N_N: NaN, T_Nm: Infinity }))).toEqual([]);
  });

  it('efforts positifs : N selon +x, Vz vers le bas, My selon −y, T selon +x', () => {
    expect(effortArrows(efforts({ N_N: 1, Vz_N: 1, My_Nm: 1, T_Nm: 1 }))).toEqual([
      { key: 'N', kind: 'force', axis: 'x', sign: 1 },
      { key: 'Vz', kind: 'force', axis: 'z', sign: -1 },
      { key: 'My', kind: 'moment', axis: 'y', sign: -1 },
      { key: 'T', kind: 'moment', axis: 'x', sign: 1 },
    ]);
  });

  it('efforts négatifs : tous les sens s’inversent', () => {
    expect(
      effortArrows(efforts({ N_N: -1, Vz_N: -1, My_Nm: -1, T_Nm: -1 })).map((a) => a.sign),
    ).toEqual([-1, 1, 1, -1]);
  });

  it('le moment dessiné est la résultante des σ du moteur (My > 0 et My < 0)', () => {
    const section = computeSection({ shape: 'rectangle', b_m: 0.1, h_m: 0.2 });
    for (const My of [11_250, -11_250]) {
      // ∫ r × (σ ex) dA avec r = (0, y, z) : composante y = ∫ σ z dA (intégration par bandes,
      // σ·z est quadratique en z : la règle du point milieu avec 2000 bandes donne
      // l’intégrale à mieux que 1e-6 près).
      const n = 2000;
      const dz = 0.2 / n;
      let My_vector = 0;
      for (let i = 0; i < n; i++) {
        const z = -0.1 + (i + 0.5) * dz;
        My_vector += normalStress_Pa(section, 0, My, 0, z) * z * 0.1 * dz;
      }
      const arrow = effortArrows(efforts({ My_Nm: My })).find((a) => a.key === 'My');
      expect(arrow?.axis).toBe('y');
      expect(Math.sign(My_vector)).toBe(arrow?.sign);
      expectRelClose(My_vector, -My, 1e-6);
    }
  });
});

describe('rotationArc', () => {
  it.each(['x', 'y', 'z'] as const)('base directe autour de %s', (axis) => {
    const [u, v] = rotationBasis(axis);
    const w = cross(u, v);
    expect(w).toEqual(axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1]);
  });

  it.each([1, -1] as const)('sens de rotation (main droite), signe %i', (sign) => {
    for (const axis of ['x', 'y', 'z'] as const) {
      const pts = rotationArc(axis, sign, [0, 0, 0], 1);
      const a = pts[0];
      const b = pts[1];
      if (!a || !b) throw new Error('arc vide');
      // r × dr est porté par l'axe, dans le sens `sign`.
      const w = cross(a, [b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
      const k = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
      expect(Math.sign(w[k])).toBe(sign);
      expect(pts).toHaveLength(37);
      for (const p of pts) expectRelClose(Math.hypot(...p), 1, 1e-12);
    }
  });
});

describe('project', () => {
  it('y vers la droite, z vers le haut, x vers le bas à gauche', () => {
    expect(project([0, 1, 0], 10)).toEqual({ x: 10, y: 0 });
    expect(project([0, 0, 1], 10)).toEqual({ x: 0, y: -10 });
    const p = project([1, 0, 0], 10);
    expect(p.x).toBeLessThan(0);
    expect(p.y).toBeGreaterThan(0);
    expectRelClose(Math.hypot(p.x, p.y), 5, 1e-12);
  });
});
