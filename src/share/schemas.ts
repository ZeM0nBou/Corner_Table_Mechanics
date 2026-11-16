/**
 * Schémas Zod de l'état partagé de chaque page (format de lien, version 1).
 *
 * Un lien reçu est une ENTRÉE NON FIABLE : objets stricts (champ inconnu refusé),
 * nombres finis, listes bornées. Les valeurs sont en SI, comme dans les pages.
 *
 * Un champ numérique vide ou invalide dans la page (`undefined` ou `NaN`) est écrit
 * `null` dans le lien (ou omis) et relu `undefined` : le champ revient vide.
 *
 * COMPATIBILITÉ : un lien déjà partagé doit rester lisible. Toute modification
 * incompatible de ces schémas impose d'incrémenter `SHARE_VERSION` et de garder un
 * décodeur pour l'ancienne version.
 */
import { z } from 'zod';
import { BUCKLING_CASES, type BucklingCase } from '@core/buckling';
import type { SectionShape } from '@core/sections';
import { UNITS } from '@core/units';
import { MaterialSchema } from '@materials/schema';

/** Version du format des liens. */
export const SHARE_VERSION = 1;

/** Nombre maximal d'appuis et de charges dans un lien de poutre. */
export const MAX_SUPPORTS = 20;
export const MAX_LOADS = 100;

/** Champ numérique de formulaire : nombre fini, ou vide (`null` / absent → `undefined`). */
const field = z
  .number()
  .finite()
  .nullish()
  .transform((v) => v ?? undefined);

const nonEmptyEnum = <T extends string>(values: readonly T[]) => z.enum(values as [T, ...T[]]);

/** Liste exhaustive des formes (le type `Record` force à suivre `SectionShape`). */
const SHAPE_SET: Record<SectionShape, true> = {
  rectangle: true,
  rectangleCreux: true,
  rond: true,
  tube: true,
  I: true,
  U: true,
  L: true,
  T: true,
};
export const SHAPE_KEYS = Object.keys(SHAPE_SET) as SectionShape[];

/** Clés de cotes connues (voir `ui/sections/sectionForm.ts`). */
export const DIM_KEYS = ['b_m', 'h_m', 't_m', 'd_m', 'tw_m', 'tf_m'] as const;

export const SharedSectionSchema = z.strictObject({
  shape: nonEmptyEnum(SHAPE_KEYS),
  /** Cotes de la forme choisie, en m. */
  dims: z.partialRecord(z.enum(DIM_KEYS), field),
});

const positive = z.number().finite().positive();
const slug = z
  .string()
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/**
 * Matériau de la base de référence : identifiant + instantané des propriétés utilisées
 * par les calculs. À l'ouverture, un écart avec la base actuelle est signalé et les
 * valeurs du lien sont reprises (reproductibilité du calcul partagé).
 */
export const SharedReferenceMaterialSchema = z.strictObject({
  kind: z.literal('reference'),
  id: slug,
  name: z.string().trim().min(1).max(100),
  E_Pa: positive,
  nu: z.number().finite().min(0).lt(0.5),
  rho_kg_m3: positive,
  Re_Pa: positive.optional(),
  Rm_Pa: positive.optional(),
});

/** Matériau personnalisé : toutes ses propriétés (même schéma que l'import JSON). */
export const SharedCustomMaterialSchema = z.strictObject({
  kind: z.literal('custom'),
  material: MaterialSchema,
});

/** Matériau choisi, ou `null` si aucun. */
export const SharedMaterialSchema = z
  .discriminatedUnion('kind', [SharedReferenceMaterialSchema, SharedCustomMaterialSchema])
  .nullable();

export type SharedSection = z.output<typeof SharedSectionSchema>;
export type SharedMaterial = z.output<typeof SharedMaterialSchema>;
export type SharedReferenceMaterial = z.output<typeof SharedReferenceMaterialSchema>;

// --- Pages ---------------------------------------------------------------

export const SectionsStateSchema = z.strictObject({
  section: SharedSectionSchema,
  material: SharedMaterialSchema,
});

const threshold = field;

export const StressStateSchema = z.strictObject({
  material: SharedMaterialSchema,
  section: SharedSectionSchema,
  efforts: z.strictObject({ N_N: field, My_Nm: field, Vz_N: field, T_Nm: field }),
  threshold,
});

const CASE_KEYS = Object.keys(BUCKLING_CASES) as BucklingCase[];
const PlaneSchema = z.strictObject({
  choice: nonEmptyEnum<BucklingCase | 'libre'>([...CASE_KEYS, 'libre']),
  freeK: field,
});

export const BucklingStateSchema = z.strictObject({
  material: SharedMaterialSchema,
  manualE_Pa: field,
  section: SharedSectionSchema,
  length_m: field,
  planes: z.tuple([PlaneSchema, PlaneSchema]),
  N_N: field,
  threshold,
});

const LENGTH_UNITS = Object.keys(UNITS.length) as (keyof typeof UNITS.length)[];

export const BeamStateSchema = z.strictObject({
  length_m: field,
  /** Dernière longueur valide (les appuis à cette abscisse suivent l'extrémité droite). */
  rightEnd_m: z.number().finite(),
  lengthUnit: nonEmptyEnum(LENGTH_UNITS),
  supports: z
    .array(z.strictObject({ kind: z.enum(['appui', 'encastrement']), x_m: field }))
    .max(MAX_SUPPORTS),
  selfWeight: z.boolean(),
  loads: z
    .array(
      z.strictObject({
        kind: z.enum(['ponctuelle', 'couple', 'uniforme', 'lineaire']),
        color: z.number().int().min(0).max(1000),
        x_m: field,
        value: field,
        value2: field,
        fullLength: z.boolean(),
        x1_m: field,
        x2_m: field,
      }),
    )
    .max(MAX_LOADS),
  material: SharedMaterialSchema,
  manualE_Pa: field,
  inertiaMode: z.enum(['section', 'directe']),
  section: SharedSectionSchema,
  manualI_m4: field,
  manualMass_kg_m: field,
  /** Seuil du coefficient de sécurité et limite de flèche (L/limite) de la vérification. */
  threshold,
  deflectionLimit: field,
});

/** Schéma de l'état de chaque page partageable (la clé est la route). */
export const STATE_SCHEMAS = {
  sections: SectionsStateSchema,
  poutres: BeamStateSchema,
  contraintes: StressStateSchema,
  flambement: BucklingStateSchema,
} as const;

export type SharedPage = keyof typeof STATE_SCHEMAS;
export const SHARED_PAGES = Object.keys(STATE_SCHEMAS) as SharedPage[];

/** État relu d'un lien (champs vides → `undefined`). */
export type SharedState<P extends SharedPage> = z.output<(typeof STATE_SCHEMAS)[P]>;
/** État à écrire dans un lien (`undefined` et `NaN` acceptés pour un champ vide). */
export type SharedStateInput<P extends SharedPage> = z.input<(typeof STATE_SCHEMAS)[P]>;
