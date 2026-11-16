/**
 * Section paramétrique ↔ forme partageable (lien). Commun aux pages Sections,
 * Poutres, Contraintes et Flambement.
 */
import type { SectionShape } from '@core/sections';
import type { SharedSection } from '@share/schemas';
import { shapeSpec } from './sectionForm';

export type Dims = Record<string, number | undefined>;

/** Forme choisie et ses cotes (en m) ; seules les cotes de la forme sont partagées. */
export function toSharedSection(shape: SectionShape, dims: Dims): SharedSection {
  const out: Dims = {};
  for (const d of shapeSpec(shape).dims) out[d.key] = dims[d.key];
  return { shape, dims: out };
}

/**
 * État de page reconstruit depuis un lien : seules les cotes de la forme sont reprises,
 * une cote absente reste vide.
 */
export function fromSharedSection(s: SharedSection): {
  shape: SectionShape;
  dimsByShape: Partial<Record<SectionShape, Dims>>;
} {
  const shared: Dims = s.dims;
  const dims: Dims = {};
  for (const d of shapeSpec(s.shape).dims) dims[d.key] = shared[d.key];
  return { shape: s.shape, dimsByShape: { [s.shape]: dims } };
}
