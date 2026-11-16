import { describe, expect, it } from 'vitest';
import { BeamStateSchema, type SharedMaterial } from '@share/schemas';
import { decodeShare, encodeShare } from '@share/share';
import { buildBeamModel, defaultForm, newLoad, presetSupports } from '@ui/beams/beamForm';
import { fromSharedBeam, toSharedBeam, type BeamPageState } from '@ui/beams/beamShare';
import { defaultDims } from '@ui/sections/sectionForm';

const material: SharedMaterial = null;

/** État de page fictif : console encastrée à droite, 4 charges de types différents. */
function samplePage(): BeamPageState {
  const form = {
    length_m: 4,
    rightEnd_m: 4,
    supports: presetSupports('consoleDroite', 4, 10),
    selfWeight: false,
    loads: [
      newLoad('ponctuelle', 20, 4, 0),
      newLoad('couple', 21, 4, 1),
      { ...newLoad('uniforme', 22, 4, 2), fullLength: false, x1_m: 1, x2_m: 3 },
      newLoad('lineaire', 23, 4, 5),
    ],
  };
  return {
    form,
    nextId: 24,
    lengthUnit: 'mm',
    manualE: undefined,
    inertiaMode: 'section',
    shape: 'U',
    dimsByShape: { U: defaultDims('U') },
    manualI: undefined,
    manualMass: undefined,
    threshold: 2,
    deflectionLimit: 150,
  };
}

const share = (p: BeamPageState) =>
  toSharedBeam({ ...p, dims: p.dimsByShape[p.shape] ?? defaultDims(p.shape) }, material);

describe('poutre ↔ lien', () => {
  it('l’état partagé respecte le schéma', () => {
    expect(BeamStateSchema.safeParse(share(samplePage())).success).toBe(true);
  });

  it('aller-retour : même modèle de calcul et mêmes réglages, identifiants renumérotés', async () => {
    const page = samplePage();
    const back = fromSharedBeam(
      await decodeShare(await encodeShare('poutres', share(page)), 'poutres'),
    );
    // Le moteur reçoit exactement le même modèle.
    expect(buildBeamModel(back.form, 1e6)).toEqual(buildBeamModel(page.form, 1e6));
    expect(back.form.supports.map((s) => s.id)).toEqual([1]);
    expect(back.form.loads.map((l) => l.id)).toEqual([2, 3, 4, 5]);
    expect(back.nextId).toBe(6);
    expect(back.form.loads.map((l) => l.color)).toEqual([0, 1, 2, 5]);
    expect({ ...back, form: page.form, nextId: page.nextId }).toEqual(page);
  });

  it('formulaire par défaut : aller-retour sans perte', async () => {
    const page = { ...samplePage(), form: defaultForm() };
    const back = fromSharedBeam(
      await decodeShare(await encodeShare('poutres', share(page)), 'poutres'),
    );
    expect(back.form).toEqual({
      ...defaultForm(),
      supports: defaultForm().supports.map((s, i) => ({ ...s, id: i + 1 })),
      loads: defaultForm().loads.map((l, i) => ({ ...l, id: i + 3 })),
    });
  });

  it('saisie directe de I et champs vides', async () => {
    const page: BeamPageState = {
      ...samplePage(),
      inertiaMode: 'directe',
      manualE: 70e9,
      manualI: 8e-6,
      manualMass: undefined,
      threshold: undefined,
      form: { ...samplePage().form, length_m: undefined },
    };
    const back = fromSharedBeam(
      await decodeShare(await encodeShare('poutres', share(page)), 'poutres'),
    );
    expect(back.inertiaMode).toBe('directe');
    expect(back.manualE).toBe(70e9);
    expect(back.manualI).toBe(8e-6);
    expect(back.manualMass).toBeUndefined();
    expect(back.threshold).toBeUndefined();
    expect(back.form.length_m).toBeUndefined();
    expect(back.form.rightEnd_m).toBe(4);
  });
});
