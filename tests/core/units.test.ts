/**
 * Tests des conversions d'unités.
 * Référence : BIPM, Brochure SI, 9ᵉ éd. (2019), tableau 7 — facteurs exacts par définition.
 */
import { describe, expect, it } from 'vitest';
import { fromSI, SI_UNIT, toSI, UNITS, unitsOf, type Quantity } from '@core/units';
import { expectRelClose } from '../helpers';

describe('toSI — valeurs de référence', () => {
  it.each([
    ['length', 'mm', 1, 1e-3],
    ['length', 'cm', 250, 2.5],
    ['force', 'daN', 1, 10],
    ['force', 'kN', 12.5, 12_500],
    ['stress', 'MPa', 235, 235e6],
    ['stress', 'GPa', 210, 210e9],
    ['stress', 'kPa', 1, 1e3],
    ['moment', 'N·mm', 1e6, 1e3],
    ['moment', 'kN·m', 1, 1e3],
    ['area', 'mm²', 1, 1e-6],
    ['area', 'cm²', 1, 1e-4],
    ['sectionModulus', 'cm³', 1, 1e-6],
    ['sectionModulus', 'mm³', 1, 1e-9],
    ['secondMomentOfArea', 'cm⁴', 1, 1e-8],
    ['secondMomentOfArea', 'mm⁴', 1, 1e-12],
    ['density', 'g/cm³', 7.85, 7850],
    ['linearMass', 'g/m', 7850, 7.85],
    ['thermalExpansion', '10⁻⁶/K', 12, 12e-6],
    ['lineLoad', 'kN/m', 2.5, 2500],
    ['lineLoad', 'N/mm', 1, 1000],
    ['lineLoad', 'daN/m', 150, 1500],
    ['angle', 'mrad', 5, 5e-3],
    ['angle', '°', 180, Math.PI],
  ] as const)('%s : %d → SI', (quantity, unit, value, expected) => {
    // Cast nécessaire : it.each perd la corrélation grandeur/unité.
    expectRelClose(toSI(value, quantity as Quantity, unit as never), expected);
  });

  it('1943 cm⁴ = 1,943e-5 m⁴ = 1,943e7 mm⁴ (cohérence cm⁴ ↔ mm⁴)', () => {
    const I_m4 = toSI(1943, 'secondMomentOfArea', 'cm⁴');
    expectRelClose(I_m4, 1.943e-5);
    expectRelClose(fromSI(I_m4, 'secondMomentOfArea', 'mm⁴'), 1.943e7);
  });
});

describe('fromSI', () => {
  it('2,35e8 Pa → 235 MPa', () => {
    expectRelClose(fromSI(2.35e8, 'stress', 'MPa'), 235);
  });

  it('aller-retour exact à la précision machine pour toutes les unités', () => {
    const samples = [1, -3.7, 0.001, 123_456.789, 1e-9, 7.85e9];
    for (const quantity of Object.keys(UNITS) as Quantity[]) {
      for (const unit of unitsOf(quantity)) {
        for (const x of samples) {
          expectRelClose(fromSI(toSI(x, quantity, unit), quantity, unit), x);
        }
      }
    }
  });
});

describe('cohérence des tables', () => {
  it('l’unité SI de chaque grandeur a un facteur exactement égal à 1', () => {
    for (const quantity of Object.keys(UNITS) as Quantity[]) {
      // Cast : en itérant sur l'union des grandeurs, TS ne relie plus grandeur et unité.
      const si = SI_UNIT[quantity] as never;
      expect(toSI(1, quantity, si)).toBe(1);
    }
  });

  it('unitsOf liste les unités dans l’ordre de déclaration', () => {
    expect(unitsOf('stress')).toEqual(['Pa', 'kPa', 'MPa', 'GPa']);
  });
});

describe('cas limites', () => {
  it('zéro reste zéro', () => {
    expect(toSI(0, 'force', 'kN')).toBe(0);
    expect(fromSI(0, 'stress', 'MPa')).toBe(0);
  });

  it('les valeurs négatives sont converties (ex. effort de compression)', () => {
    expectRelClose(toSI(-5, 'force', 'kN'), -5000);
  });

  it.each([NaN, Infinity, -Infinity])('lève une erreur claire pour %s', (bad) => {
    expect(() => toSI(bad, 'length', 'mm')).toThrow(RangeError);
    expect(() => fromSI(bad, 'length', 'mm')).toThrow(/non finie/);
  });

  it('lève une erreur pour une unité inconnue (appel non typé, ex. donnée importée)', () => {
    expect(() => toSI(1, 'length', 'pouce' as never)).toThrow(/Unité inconnue/);
  });
});
