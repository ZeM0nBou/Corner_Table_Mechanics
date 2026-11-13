import { expect } from 'vitest';

/**
 * Vérifie que `actual` est égal à `expected` à une tolérance RELATIVE près.
 * `toBeCloseTo` de Vitest travaille en décimales absolues, inadapté à des
 * valeurs SI qui vont de 1e-12 (m⁴) à 1e11 (Pa).
 *
 * @param rel tolérance relative ; 1e-12 par défaut (quelques ulp de double précision,
 *            largement suffisant pour des produits/quotients par des puissances de dix).
 */
export function expectRelClose(actual: number, expected: number, rel = 1e-12): void {
  if (expected === 0) {
    expect(Math.abs(actual)).toBeLessThanOrEqual(rel);
    return;
  }
  const err = Math.abs(actual - expected) / Math.abs(expected);
  expect(err, `${actual} ≉ ${expected} (erreur relative ${err})`).toBeLessThanOrEqual(rel);
}
