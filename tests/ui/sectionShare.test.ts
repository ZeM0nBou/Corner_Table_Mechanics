import { describe, expect, it } from 'vitest';
import { SharedSectionSchema } from '@share/schemas';
import { defaultDims, SHAPES } from '@ui/sections/sectionForm';
import { fromSharedSection, toSharedSection } from '@ui/sections/sectionShare';

describe('section ↔ lien', () => {
  it.each(SHAPES.map((s) => s.shape))('aller-retour, forme %s (valeurs par défaut)', (shape) => {
    const dims = defaultDims(shape);
    const shared = SharedSectionSchema.parse(toSharedSection(shape, dims));
    expect(fromSharedSection(shared)).toEqual({ shape, dimsByShape: { [shape]: dims } });
  });

  it('seules les cotes de la forme choisie sont partagées', () => {
    const shared = toSharedSection('tube', { d_m: 0.06, t_m: 0.004, h_m: 0.2, b_m: 0.1 });
    expect(shared).toEqual({ shape: 'tube', dims: { d_m: 0.06, t_m: 0.004 } });
  });

  it('une cote vide reste vide', () => {
    const shared = SharedSectionSchema.parse(
      JSON.parse(JSON.stringify(toSharedSection('L', { h_m: 0.1, b_m: undefined, t_m: NaN }))),
    );
    expect(fromSharedSection(shared).dimsByShape.L).toEqual({
      h_m: 0.1,
      b_m: undefined,
      t_m: undefined,
    });
  });

  it('une cote d’une autre forme reçue par le lien est ignorée', () => {
    const shared = SharedSectionSchema.parse({ shape: 'rond', dims: { d_m: 0.05, h_m: 1 } });
    expect(fromSharedSection(shared).dimsByShape).toEqual({ rond: { d_m: 0.05 } });
  });
});
