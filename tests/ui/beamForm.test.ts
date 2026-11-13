import { describe, expect, it } from 'vitest';
import { solveBeam } from '@core/beams';
import {
  buildBeamModel,
  defaultForm,
  LOAD_COLORS,
  LOAD_KINDS,
  loadColor,
  newLoad,
  newSupportPosition,
  nextColor,
  presetSupports,
  SUPPORT_PRESETS,
  supportName,
  withLength,
  type BeamForm,
} from '@ui/beams/beamForm';

const base = (): BeamForm => ({ ...defaultForm(), loads: [], selfWeight: false });

describe('formulaire des poutres', () => {
  it('l’exemple d’ouverture est calculable, poids propre activé', () => {
    const form = defaultForm();
    expect(form.selfWeight).toBe(true);
    const built = buildBeamModel(form, 4e6, 220);
    expect(built.error).toBeUndefined();
    expect(built.selfWeightIncluded).toBe(true);
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

  it('EI est transmis tel quel (undefined : pas de flèche)', () => {
    expect(buildBeamModel(base(), 123).model?.EI_Nm2).toBe(123);
    expect(buildBeamModel(base(), undefined).model?.EI_Nm2).toBeUndefined();
  });

  it('champ vide ou invalide → message, pas de modèle', () => {
    const err = (form: BeamForm) => buildBeamModel(form, undefined).error;
    expect(err({ ...base(), length_m: undefined })).toMatch(/longueur/);
    expect(err({ ...base(), length_m: NaN })).toMatch(/longueur/);
    const supports = base().supports.map((s, i) => (i === 1 ? { ...s, x_m: undefined } : s));
    expect(err({ ...base(), supports })).toMatch(/Appui B/);
    const incomplete = { ...newLoad('ponctuelle', 1, 3), value: undefined };
    expect(err({ ...base(), loads: [incomplete] })).toMatch(/Charge n° 1/);
    const nan = { ...newLoad('lineaire', 1, 3), value2: NaN };
    expect(err({ ...base(), loads: [nan] })).toMatch(/Charge n° 1/);
  });
});

describe('poids propre', () => {
  it('ajouté en dernière charge, uniforme vers le bas sur toute la longueur', () => {
    const form: BeamForm = { ...base(), selfWeight: true, loads: [newLoad('ponctuelle', 1, 3)] };
    const built = buildBeamModel(form, undefined, 250);
    expect(built.selfWeightIncluded).toBe(true);
    expect(built.model?.loads).toHaveLength(2);
    expect(built.model?.loads[1]).toEqual({
      kind: 'repartie',
      x1_m: 0,
      x2_m: 3,
      q1_N_m: -250,
      q2_N_m: -250,
    });
  });

  it('ignoré s’il est désactivé ou inconnu', () => {
    expect(buildBeamModel(base(), undefined, 250).selfWeightIncluded).toBe(false);
    const on = { ...base(), selfWeight: true };
    const built = buildBeamModel(on, undefined, undefined);
    expect(built.selfWeightIncluded).toBe(false);
    expect(built.model?.loads).toEqual([]);
  });
});

describe('appuis', () => {
  it('configurations usuelles : appuis et encastrements aux extrémités', () => {
    const kinds = (p: (typeof SUPPORT_PRESETS)[number]['preset']) =>
      presetSupports(p, 4, 10).map((s) => [s.kind, s.x_m]);
    expect(kinds('deuxAppuis')).toEqual([
      ['appui', 0],
      ['appui', 4],
    ]);
    expect(kinds('consoleGauche')).toEqual([['encastrement', 0]]);
    expect(kinds('consoleDroite')).toEqual([['encastrement', 4]]);
    expect(kinds('encastreeAppuyee')).toEqual([
      ['encastrement', 0],
      ['appui', 4],
    ]);
    expect(kinds('biEncastree')).toEqual([
      ['encastrement', 0],
      ['encastrement', 4],
    ]);
    expect(presetSupports('deuxAppuis', 4, 10).map((s) => s.id)).toEqual([10, 11]);
  });

  it('les configurations à plusieurs liaisons donnent des poutres calculables', () => {
    for (const { preset } of SUPPORT_PRESETS) {
      const form: BeamForm = { ...base(), supports: presetSupports(preset, 3, 1) };
      const built = buildBeamModel(form, undefined);
      if (built.model) {
        const model = built.model;
        expect(() => solveBeam(model, { allowHyperstatic: true }), preset).not.toThrow();
      }
    }
  });

  it('appuis transmis dans l’ordre de la liste (A, B, C…), y compris intermédiaires', () => {
    const form: BeamForm = {
      ...base(),
      supports: [
        { id: 1, kind: 'appui', x_m: 3 },
        { id: 2, kind: 'encastrement', x_m: 0 },
        { id: 3, kind: 'appui', x_m: 1.5 },
      ],
    };
    expect(buildBeamModel(form, undefined).model?.supports).toEqual([
      { kind: 'appui', x_m: 3 },
      { kind: 'encastrement', x_m: 0 },
      { kind: 'appui', x_m: 1.5 },
    ]);
  });

  it('nouvel appui au milieu du plus grand intervalle libre', () => {
    const at = (xs: number[]) =>
      newSupportPosition(
        xs.map((x_m, i) => ({ id: i, kind: 'appui' as const, x_m })),
        4,
      );
    expect(at([0, 4])).toBe(2);
    expect(at([0, 2, 4])).toBe(1);
    expect(at([])).toBe(2);
    expect(at([0, 1])).toBe(2.5);
  });

  it('changer la longueur : les appuis de l’extrémité droite suivent, les autres restent', () => {
    const form: BeamForm = {
      ...base(),
      supports: [
        { id: 1, kind: 'appui', x_m: 0 },
        { id: 2, kind: 'appui', x_m: 1.2 },
        { id: 3, kind: 'encastrement', x_m: 3 },
      ],
    };
    const next = withLength(form, 5, 20);
    expect(next.form.supports.map((s) => s.x_m)).toEqual([0, 1.2, 5]);
    expect(next.form.supports.map((s) => s.id)).toEqual([1, 2, 20]);
    expect(next.nextId).toBe(21);
    expect(next.form.rightEnd_m).toBe(5);
  });

  it('longueur vide pendant la saisie : rien ne bouge, l’extrémité est retrouvée ensuite', () => {
    const vide = withLength(base(), undefined, 5);
    expect(vide.form.length_m).toBeUndefined();
    expect(vide.form.supports.map((s) => s.x_m)).toEqual([0, 3]);
    const ensuite = withLength(vide.form, 4, vide.nextId);
    expect(ensuite.form.supports.map((s) => s.x_m)).toEqual([0, 4]);
  });

  it('extrémité droite reconnue malgré l’arrondi des conversions (3000 mm)', () => {
    const form: BeamForm = {
      ...base(),
      supports: [{ id: 1, kind: 'appui', x_m: 3000 * 1e-3 }],
    };
    expect(withLength(form, 6, 9).form.supports[0]?.x_m).toBe(6);
  });

  it('noms des appuis', () => {
    expect([0, 1, 2].map(supportName)).toEqual(['A', 'B', 'C']);
  });
});

describe('couleurs des charges', () => {
  it('première couleur libre, puis répétition au-delà de 8 charges', () => {
    expect(nextColor([])).toBe(0);
    expect(nextColor([{ color: 0 }, { color: 2 }])).toBe(1);
    const all = LOAD_COLORS.map((_, color) => ({ color }));
    expect(nextColor(all)).toBe(0);
  });

  it('la couleur suit la charge : supprimer une charge ne recolore pas les autres', () => {
    const loads = [newLoad('ponctuelle', 1, 3, 0), newLoad('couple', 2, 3, 1)];
    const restantes = loads.slice(1);
    expect(loadColor(restantes[0] ?? { color: -1 })).toBe(LOAD_COLORS[1]);
    // La couleur libérée est réutilisée par la charge suivante.
    expect(nextColor(restantes)).toBe(0);
  });
});
