import { describe, expect, it } from 'vitest';
import { areaPath, linearScale, linePath, niceTicks } from '@ui/beams/diagram';

describe('niceTicks', () => {
  it('pas de 1, 2 ou 5 × 10ⁿ couvrant l’intervalle', () => {
    expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(0, 7.5, 4)).toEqual([0, 2, 4, 6, 8]);
    // Étendue 8,8 / 4 = 2,2 : le pas rond supérieur est 5.
    expect(niceTicks(-3.2, 5.6, 4)).toEqual([-5, 0, 5, 10]);
    expect(niceTicks(-3.2, 5.6, 8)).toEqual([-4, -2, 0, 2, 4, 6]);
    expect(niceTicks(0, 0.3, 3)).toEqual([0, 0.1, 0.2, 0.3]);
  });

  it('contient zéro quand l’intervalle le contient, sans -0', () => {
    const ticks = niceTicks(-1.29, 0, 4);
    expect(ticks).toContain(0);
    expect(ticks.some((t) => Object.is(t, -0))).toBe(false);
    expect(ticks[0]).toBeLessThanOrEqual(-1.29);
  });

  it('intervalle dégénéré ou non fini : au moins deux graduations', () => {
    expect(niceTicks(0, 0)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(niceTicks(5, 5).length).toBeGreaterThanOrEqual(2);
    expect(niceTicks(-5, -5)).toContain(0);
    expect(niceTicks(NaN, 1)).toEqual([0, 1]);
  });

  it('bornes inversées acceptées', () => {
    expect(niceTicks(10, 0, 5)).toEqual([0, 2, 4, 6, 8, 10]);
  });
});

describe('échelle et chemins SVG', () => {
  it('échelle linéaire, y compris axe inversé et domaine nul', () => {
    const s = linearScale(0, 10, 100, 200);
    expect(s(0)).toBe(100);
    expect(s(5)).toBe(150);
    expect(linearScale(-1, 1, 180, 20)(1)).toBe(20);
    expect(linearScale(2, 2, 0, 10)(2)).toBe(5);
  });

  it('ligne brisée et aire fermée sur la ligne de base', () => {
    const pts = [
      { x: 0, y: 10 },
      { x: 5.126, y: 20 },
      { x: 10, y: 10 },
    ];
    expect(linePath(pts)).toBe('M0 10 L5.13 20 L10 10');
    expect(areaPath(pts, 50)).toBe('M0 50 L0 10 L5.13 20 L10 10 L10 50 Z');
    expect(areaPath([], 50)).toBe('');
  });
});
