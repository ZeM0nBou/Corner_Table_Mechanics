import { describe, expect, it } from 'vitest';
import { solveBeam } from '@core/beams';
import {
  buildBeamModel,
  defaultForm,
  LOAD_KINDS,
  newLoad,
  supportName,
  type BeamForm,
} from '@ui/beams/beamForm';

const base = (): BeamForm => ({ ...defaultForm(), loads: [] });

describe('formulaire des poutres', () => {
  it('l’exemple d’ouverture est calculable', () => {
    const built = buildBeamModel(defaultForm(), 4e6);
    expect(built.error).toBeUndefined();
    if (built.model) {
      const model = built.model;
      expect(() => solveBeam(model)).not.toThrow();
    }
  });

  it('chaque type de charge a des valeurs par défaut calculables', () => {
    for (const k of LOAD_KINDS) {
      const built = buildBeamModel({ ...base(), loads: [newLoad(k.kind, 1, 3)] }, undefined);
      expect(built.error, k.kind).toBeUndefined();
      if (built.model) {
        const model = built.model;
        expect(() => solveBeam(model), k.kind).not.toThrow();
      }
    }
  });

  it('charges saisies vers le bas : négatives pour le moteur ; le couple garde son signe', () => {
    const built = buildBeamModel(
      {
        ...base(),
        loads: [
          { ...newLoad('ponctuelle', 1, 3), x_m: 1, value: 10_000 },
          { ...newLoad('couple', 2, 3), x_m: 2, value: 5_000 },
          { ...newLoad('uniforme', 3, 3), value: 2_000 },
          {
            ...newLoad('lineaire', 4, 3),
            value: 0,
            value2: 4_000,
            fullLength: false,
            x1_m: 0.5,
            x2_m: 2.5,
          },
        ],
      },
      undefined,
    );
    expect(built.model?.loads).toEqual([
      { kind: 'ponctuelle', x_m: 1, Fz_N: -10_000 },
      { kind: 'couple', x_m: 2, C_Nm: 5_000 },
      { kind: 'repartie', x1_m: 0, x2_m: 3, q1_N_m: -2_000, q2_N_m: -2_000 },
      { kind: 'repartie', x1_m: 0.5, x2_m: 2.5, q1_N_m: 0, q2_N_m: -4_000 },
    ]);
  });

  it('porte-à-faux mesurés depuis chaque extrémité ; consoles à gauche et à droite', () => {
    const appuis = buildBeamModel(
      { ...base(), overhangLeft_m: 0.5, overhangRight_m: 0.25 },
      undefined,
    );
    expect(appuis.model?.supports).toEqual([
      { kind: 'appui', x_m: 0.5 },
      { kind: 'appui', x_m: 2.75 },
    ]);
    expect(
      buildBeamModel({ ...base(), supportMode: 'consoleGauche' }, undefined).model?.supports,
    ).toEqual([{ kind: 'encastrement', x_m: 0 }]);
    expect(
      buildBeamModel({ ...base(), supportMode: 'consoleDroite' }, undefined).model?.supports,
    ).toEqual([{ kind: 'encastrement', x_m: 3 }]);
  });

  it('EI est transmis tel quel (undefined : pas de flèche)', () => {
    expect(buildBeamModel(base(), 123).model?.EI_Nm2).toBe(123);
    expect(buildBeamModel(base(), undefined).model?.EI_Nm2).toBeUndefined();
  });

  it('champ vide ou invalide → message, pas de modèle', () => {
    const err = (form: BeamForm) => buildBeamModel(form, undefined).error;
    expect(err({ ...base(), length_m: undefined })).toMatch(/longueur/);
    expect(err({ ...base(), length_m: NaN })).toMatch(/longueur/);
    expect(err({ ...base(), overhangLeft_m: undefined })).toMatch(/porte-à-faux/);
    expect(err({ ...base(), overhangRight_m: -0.1 })).toMatch(/négatif/);
    const incomplete = { ...newLoad('ponctuelle', 1, 3), value: undefined };
    expect(err({ ...base(), loads: [incomplete] })).toMatch(/Charge n° 1/);
    const nan = { ...newLoad('lineaire', 1, 3), value2: NaN };
    expect(err({ ...base(), loads: [nan] })).toMatch(/Charge n° 1/);
  });

  it('une console ignore les porte-à-faux, même vides', () => {
    const built = buildBeamModel(
      { ...base(), supportMode: 'consoleGauche', overhangLeft_m: undefined },
      undefined,
    );
    expect(built.error).toBeUndefined();
  });

  it('noms des appuis', () => {
    expect([0, 1, 2].map(supportName)).toEqual(['A', 'B', 'C']);
  });
});
