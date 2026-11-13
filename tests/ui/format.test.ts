import { describe, expect, it } from 'vitest';
import { formatInput, parseDecimal } from '@ui/format';

describe('parseDecimal', () => {
  it.each([
    ['235', 235],
    ['0,3', 0.3],
    ['0.3', 0.3],
    ['-12,5', -12.5],
    ['+4', 4],
    [',5', 0.5],
    ['7 850', 7850],
    ['7 850', 7850], // espace fine insécable produite par Intl fr-FR
    ['2,1e5', 210000],
    ['1E-6', 1e-6],
    ['  42  ', 42],
  ])('%j → %d', (text, expected) => {
    expect(parseDecimal(text)).toBe(expected);
  });

  it.each(['', '   '])('champ vide %j → undefined', (text) => {
    expect(parseDecimal(text)).toBeUndefined();
  });

  it.each(['abc', '1,2,3', '12a', 'e5', '1e', '--1', '0x10', 'Infinity'])(
    'saisie invalide %j → NaN',
    (text) => {
      expect(parseDecimal(text)).toBeNaN();
    },
  );
});

describe('formatInput', () => {
  it('utilise la virgule décimale, sans séparateur de milliers', () => {
    expect(formatInput(7850)).toBe('7850');
    expect(formatInput(0.3)).toBe('0,3');
  });

  it('relit sans perte ce qu’il produit (6 chiffres significatifs)', () => {
    for (const x of [235, 0.275, 113.8, 12.5, 1e-6, 210000]) {
      expect(parseDecimal(formatInput(x))).toBe(x);
    }
  });
});
