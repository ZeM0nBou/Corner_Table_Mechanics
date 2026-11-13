/**
 * Brouillon du formulaire de matériau personnalisé et sa conversion en
 * matériau validé par le schéma Zod (avec messages d'erreur par champ).
 */
import { MaterialSchema, type Material } from '@materials/schema';
import type { ProcessKey, Rating, SectorKey } from '@materials/selection';

/** Aptitude à un procédé en cours de saisie. */
export interface ProcessDraft {
  rating: Rating;
  note: string;
}

/** Valeurs en cours de saisie. Nombres en SI : `undefined` = vide, `NaN` = saisie invalide. */
export interface MaterialDraft {
  // Aide au choix (facultatif)
  costIndex: number | undefined;
  costNote: string;
  sectors: SectorKey[];
  applicationNotes: string;
  processes: Partial<Record<ProcessKey, ProcessDraft>>;
  selectionSource: string;

  name: string;
  family: string;
  standard: string;
  condition: string;
  source: string;
  notes: string;
  E_Pa: number | undefined;
  nu: number | undefined;
  rho_kg_m3: number | undefined;
  Re_Pa: number | undefined;
  Rm_Pa: number | undefined;
  A_percent: number | undefined;
  alpha_1_K: number | undefined;
  tMin_m: number | undefined;
  tMax_m: number | undefined;
  verified: boolean;
}

export type DraftField = keyof MaterialDraft;
export type DraftErrors = Partial<Record<DraftField, string>>;

export function emptyDraft(): MaterialDraft {
  return {
    name: '',
    family: '',
    standard: '',
    condition: '',
    source: '',
    notes: '',
    E_Pa: undefined,
    nu: undefined,
    rho_kg_m3: undefined,
    Re_Pa: undefined,
    Rm_Pa: undefined,
    A_percent: undefined,
    alpha_1_K: undefined,
    tMin_m: undefined,
    tMax_m: undefined,
    verified: false,
    costIndex: undefined,
    costNote: '',
    sectors: [],
    applicationNotes: '',
    processes: {},
    selectionSource: '',
  };
}

export function draftFromMaterial(m: Material): MaterialDraft {
  return {
    name: m.name,
    family: m.family,
    standard: m.standard ?? '',
    condition: m.condition ?? '',
    source: m.source,
    notes: m.notes ?? '',
    E_Pa: m.E_Pa,
    nu: m.nu,
    rho_kg_m3: m.rho_kg_m3,
    Re_Pa: m.Re_Pa,
    Rm_Pa: m.Rm_Pa,
    A_percent: m.A_percent,
    alpha_1_K: m.alpha_1_K,
    tMin_m: m.thicknessRange_m?.[0],
    tMax_m: m.thicknessRange_m?.[1],
    verified: m.verified,
    costIndex: m.costIndex,
    costNote: m.costNote ?? '',
    sectors: [...(m.sectors ?? [])],
    applicationNotes: m.applicationNotes ?? '',
    processes: Object.fromEntries(
      Object.entries(m.processes ?? {}).map(([k, v]) => [
        k,
        { rating: v.rating, note: v.note ?? '' },
      ]),
    ),
    selectionSource: m.selectionSource ?? '',
  };
}

const REQUIRED_NUMBERS = ['E_Pa', 'nu', 'rho_kg_m3'] as const;
const OPTIONAL_NUMBERS = ['Re_Pa', 'Rm_Pa', 'A_percent', 'alpha_1_K'] as const;
const OPTIONAL_TEXTS = [
  'standard',
  'condition',
  'notes',
  'costNote',
  'applicationNotes',
  'selectionSource',
] as const;

/** Champ du schéma → champ du formulaire qui porte l'erreur. */
function fieldOf(path: readonly PropertyKey[]): DraftField {
  const key = path[0];
  if (key === 'thicknessRange_m') return 'tMin_m';
  if (typeof key === 'string' && key in emptyDraft()) return key as DraftField;
  return 'name';
}

/** Champs liés par un contrôle croisé (Re ≤ Rm, bornes d'épaisseur). */
const LINKED: Partial<Record<DraftField, readonly DraftField[]>> = {
  Re_Pa: ['Rm_Pa'],
  Rm_Pa: ['Re_Pa'],
  tMin_m: ['tMax_m'],
  tMax_m: ['tMin_m'],
  // La source devient obligatoire dès qu'une indication d'aide au choix est saisie.
  selectionSource: ['costIndex', 'costNote', 'sectors', 'applicationNotes', 'processes'],
};

/**
 * Erreurs à afficher : celles des champs déjà quittés (ou d'un champ lié déjà quitté),
 * ou toutes après une tentative d'enregistrement.
 */
export function visibleErrors(
  errors: DraftErrors,
  touched: ReadonlySet<DraftField>,
  submitted: boolean,
): DraftErrors {
  if (submitted) return errors;
  const visible: DraftErrors = {};
  for (const [field, message] of Object.entries(errors) as [DraftField, string][]) {
    const linked = LINKED[field] ?? [];
    if (touched.has(field) || linked.some((f) => touched.has(f))) visible[field] = message;
  }
  return visible;
}

export type BuildResult = { ok: true; material: Material } | { ok: false; errors: DraftErrors };

/** Construit et valide un matériau à partir du brouillon. */
export function buildMaterial(draft: MaterialDraft, id: string): BuildResult {
  const errors: DraftErrors = {};

  for (const k of REQUIRED_NUMBERS) {
    if (draft[k] === undefined) errors[k] = 'Obligatoire.';
  }
  for (const k of [...REQUIRED_NUMBERS, ...OPTIONAL_NUMBERS, 'tMin_m', 'tMax_m'] as const) {
    if (Number.isNaN(draft[k])) errors[k] = 'Nombre invalide.';
  }
  if ((draft.tMin_m === undefined) !== (draft.tMax_m === undefined)) {
    errors.tMin_m = 'Renseigner les deux bornes, ou aucune.';
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const candidate: Record<string, unknown> = {
    id,
    name: draft.name.trim(),
    family: draft.family.trim(),
    source: draft.source.trim(),
    verified: draft.verified,
  };
  for (const k of [...REQUIRED_NUMBERS, ...OPTIONAL_NUMBERS] as const) {
    if (draft[k] !== undefined) candidate[k] = draft[k];
  }
  for (const k of OPTIONAL_TEXTS) {
    const v = draft[k].trim();
    if (v !== '') candidate[k] = v;
  }
  if (draft.tMin_m !== undefined && draft.tMax_m !== undefined) {
    candidate.thicknessRange_m = [draft.tMin_m, draft.tMax_m];
  }
  if (draft.costIndex !== undefined) candidate.costIndex = draft.costIndex;
  if (draft.sectors.length > 0) candidate.sectors = draft.sectors;
  const processes = Object.entries(draft.processes).map(([k, p]) => {
    const note = p.note.trim();
    return [k, note === '' ? { rating: p.rating } : { rating: p.rating, note }] as const;
  });
  if (processes.length > 0) candidate.processes = Object.fromEntries(processes);

  const result = MaterialSchema.safeParse(candidate);
  if (result.success) return { ok: true, material: result.data };

  for (const issue of result.error.issues) {
    const field = fieldOf(issue.path);
    errors[field] ??= issue.message;
  }
  return { ok: false, errors };
}
