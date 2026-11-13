/**
 * Les cas de table reconnus par l'UI doivent donner la même valeur que le moteur :
 * la formule fermée affichée est alors bien celle du cas calculé.
 * Références des formules : voir tests/core/beams/solver.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { beamExtrema, solveBeam, type BeamModel, type Load, type Support } from '@core/beams';
import { absExtremum, GENERAL_FORMULAS, knownCase } from '@ui/beams/beamFormulas';
import { expectRelClose } from '../helpers';

const L = 3;
const EI = 4.08e6;
const APPUIS: Support[] = [
  { kind: 'appui', x_m: 0 },
  { kind: 'appui', x_m: L },
];
const uniforme: Load = { kind: 'repartie', x1_m: 0, x2_m: L, q1_N_m: -5000, q2_N_m: -5000 };

function check(supports: Support[], load: Load, name: RegExp, withEI = true) {
  const model: BeamModel = {
    length_m: L,
    EI_Nm2: withEI ? EI : undefined,
    supports,
    loads: [load],
  };
  const extrema = beamExtrema(solveBeam(model));
  const known = knownCase(model, extrema);
  expect(known?.name).toMatch(name);
  if (!known) return known;
  expectRelClose(known.moment.closedForm, Math.abs(absExtremum(extrema.moment_Nm).value), 1e-9);
  if (extrema.deflection_m) {
    expect(known.deflection).toBeDefined();
    expectRelClose(
      known.deflection?.closedForm ?? NaN,
      Math.abs(absExtremum(extrema.deflection_m).value),
      1e-9,
    );
  }
  return known;
}

describe('cas de table reconnus : formule fermée = valeur du moteur', () => {
  const gauche: Support[] = [{ kind: 'encastrement', x_m: 0 }];
  const droite: Support[] = [{ kind: 'encastrement', x_m: L }];

  it('console, force en bout (encastrement à gauche ou à droite)', () => {
    check(gauche, { kind: 'ponctuelle', x_m: L, Fz_N: -8000 }, /force en bout/);
    check(droite, { kind: 'ponctuelle', x_m: 0, Fz_N: 8000 }, /force en bout/);
  });

  it('console, force intermédiaire', () => {
    check(gauche, { kind: 'ponctuelle', x_m: 1.2, Fz_N: -8000 }, /distance a/);
    check(droite, { kind: 'ponctuelle', x_m: 1.2, Fz_N: -8000 }, /distance a/);
  });

  it('console, charge uniforme et couple en bout', () => {
    check(gauche, uniforme, /Console, charge uniforme/);
    check(droite, { kind: 'couple', x_m: 0, C_Nm: -2000 }, /couple en bout/);
  });

  it('deux appuis : force au milieu, force excentrée (des deux côtés), charge uniforme', () => {
    check(APPUIS, { kind: 'ponctuelle', x_m: L / 2, Fz_N: -8000 }, /au milieu/);
    check(APPUIS, { kind: 'ponctuelle', x_m: 0.8, Fz_N: -8000 }, /excentrée/);
    check(APPUIS, { kind: 'ponctuelle', x_m: 2.3, Fz_N: -8000 }, /excentrée/);
    check(APPUIS, uniforme, /Deux appuis, charge uniforme/);
  });

  it('sans EI : formule du moment seulement', () => {
    const known = check(APPUIS, uniforme, /charge uniforme/, false);
    expect(known?.deflection).toBeUndefined();
  });

  it('application numérique terminée par la valeur du moteur (5 kN/m sur 3 m : 5,625 kN·m)', () => {
    const known = check(APPUIS, uniforme, /charge uniforme/);
    expect(known?.moment.application).toContain('= 5{,}625\\text{ kN·m}');
    expect(known?.moment.source).toMatch(/Roark/);
  });
});

describe('cas non reconnus', () => {
  const none = (supports: Support[], loads: Load[], length_m = L) => {
    const model: BeamModel = { length_m, EI_Nm2: EI, supports, loads };
    return knownCase(model, beamExtrema(solveBeam(model)));
  };

  it('plusieurs charges, charge partielle ou triangulaire, porte-à-faux, couples', () => {
    expect(none(APPUIS, [uniforme, uniforme])).toBeNull();
    expect(none(APPUIS, [])).toBeNull();
    expect(none(APPUIS, [{ ...uniforme, x2_m: 2 }])).toBeNull();
    expect(none(APPUIS, [{ ...uniforme, q1_N_m: 0 }])).toBeNull();
    expect(none(APPUIS, [{ kind: 'couple', x_m: 1, C_Nm: 100 }])).toBeNull();
    expect(none(APPUIS, [uniforme], L + 1)).toBeNull();
    expect(
      none([{ kind: 'encastrement', x_m: 0 }], [{ kind: 'couple', x_m: 1, C_Nm: 100 }]),
    ).toBeNull();
    expect(none(APPUIS, [{ kind: 'ponctuelle', x_m: 0, Fz_N: -1 }])).toBeNull();
  });
});

describe('formules générales', () => {
  it('chaque formule a un libellé, du LaTeX et une source', () => {
    expect(GENERAL_FORMULAS.length).toBeGreaterThanOrEqual(3);
    for (const f of GENERAL_FORMULAS) {
      expect(f.label).not.toBe('');
      expect(f.latex).not.toBe('');
      expect(f.source).not.toBe('');
    }
  });
});
