/**
 * État de la page Poutres ↔ forme partageable (lien).
 * Les identifiants d'affichage (clés React) ne sont pas partagés : ils sont
 * renumérotés à l'ouverture (appuis d'abord, puis charges).
 */
import type { SectionShape } from '@core/sections';
import type { UnitOf } from '@core/units';
import type { SharedMaterial, SharedState, SharedStateInput } from '@share/schemas';
import { fromSharedSection, toSharedSection, type Dims } from '@ui/sections/sectionShare';
import type { BeamForm } from './beamForm';

type Field = number | undefined;

/** État de la page Poutres, hors matériau (géré par `usePageMaterial`). */
export interface BeamPageState {
  form: BeamForm;
  /** Prochain identifiant d'appui ou de charge. */
  nextId: number;
  lengthUnit: UnitOf<'length'>;
  manualE: Field;
  inertiaMode: 'section' | 'directe';
  shape: SectionShape;
  dimsByShape: Partial<Record<SectionShape, Dims>>;
  manualI: Field;
  manualMass: Field;
  /** Seuil du coefficient de sécurité de la vérification. */
  threshold: Field;
  /** Flèche admissible : L / deflectionLimit. */
  deflectionLimit: Field;
}

/** Forme partageable de l'état de la page (seules les cotes de la forme choisie). */
export function toSharedBeam(
  p: Omit<BeamPageState, 'nextId' | 'dimsByShape'> & { dims: Dims },
  material: SharedMaterial,
): SharedStateInput<'poutres'> {
  return {
    length_m: p.form.length_m,
    rightEnd_m: p.form.rightEnd_m,
    lengthUnit: p.lengthUnit,
    supports: p.form.supports.map((s) => ({ kind: s.kind, x_m: s.x_m })),
    selfWeight: p.form.selfWeight,
    loads: p.form.loads.map((l) => ({
      kind: l.kind,
      color: l.color,
      x_m: l.x_m,
      value: l.value,
      value2: l.value2,
      fullLength: l.fullLength,
      x1_m: l.x1_m,
      x2_m: l.x2_m,
    })),
    material,
    manualE_Pa: p.manualE,
    inertiaMode: p.inertiaMode,
    section: toSharedSection(p.shape, p.dims),
    manualI_m4: p.manualI,
    manualMass_kg_m: p.manualMass,
    threshold: p.threshold,
    deflectionLimit: p.deflectionLimit,
  };
}

/** État de la page reconstruit depuis un lien. */
export function fromSharedBeam(s: SharedState<'poutres'>): BeamPageState {
  let id = 1;
  const supports = s.supports.map((sup) => ({ ...sup, id: id++ }));
  const loads = s.loads.map((l) => ({ ...l, id: id++ }));
  const { shape, dimsByShape } = fromSharedSection(s.section);
  return {
    form: {
      length_m: s.length_m,
      rightEnd_m: s.rightEnd_m,
      supports,
      selfWeight: s.selfWeight,
      loads,
    },
    nextId: id,
    lengthUnit: s.lengthUnit,
    manualE: s.manualE_Pa,
    inertiaMode: s.inertiaMode,
    shape,
    dimsByShape,
    manualI: s.manualI_m4,
    manualMass: s.manualMass_kg_m,
    threshold: s.threshold,
    deflectionLimit: s.deflectionLimit,
  };
}
