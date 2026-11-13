/**
 * Formulaire des poutres : état saisi par l'utilisateur, valeurs par défaut et
 * conversion vers l'entrée du moteur de calcul.
 *
 * CONVENTION DE SAISIE : les forces et les charges réparties sont saisies positives
 * vers le BAS (charges de gravité) ; le moteur les attend positives vers le haut, le
 * signe est donc inversé ici, et seulement ici. Les couples gardent la convention du
 * moteur (positifs dans le sens trigonométrique).
 * Toutes les valeurs sont en SI (les conversions d'unités se font dans les champs).
 */
import type { BeamModel, Load, Support } from '@core/beams';

export type SupportMode = 'appuis' | 'consoleGauche' | 'consoleDroite';
export type LoadKind = 'ponctuelle' | 'couple' | 'uniforme' | 'lineaire';

type Field = number | undefined;

export interface LoadDraft {
  /** Identifiant stable pour l'affichage (clé React). */
  id: number;
  kind: LoadKind;
  /** Position d'une force ou d'un couple, depuis l'extrémité gauche. */
  x_m: Field;
  /** Force (N, vers le bas), couple (N·m, trigonométrique), q ou q1 (N/m, vers le bas). */
  value: Field;
  /** q2 d'une charge linéaire (N/m, vers le bas). */
  value2: Field;
  /** Charge répartie sur toute la longueur ; sinon de x1 à x2. */
  fullLength: boolean;
  x1_m: Field;
  x2_m: Field;
}

export interface BeamForm {
  length_m: Field;
  supportMode: SupportMode;
  /** Porte-à-faux : distance de l'appui A à l'extrémité gauche, de B à l'extrémité droite. */
  overhangLeft_m: Field;
  overhangRight_m: Field;
  loads: LoadDraft[];
}

export const SUPPORT_MODES: readonly { mode: SupportMode; label: string }[] = [
  { mode: 'appuis', label: 'Sur deux appuis' },
  { mode: 'consoleGauche', label: 'Console, encastrée à gauche' },
  { mode: 'consoleDroite', label: 'Console, encastrée à droite' },
];

export const LOAD_KINDS: readonly { kind: LoadKind; label: string }[] = [
  { kind: 'ponctuelle', label: 'Force ponctuelle' },
  { kind: 'uniforme', label: 'Charge uniforme' },
  { kind: 'lineaire', label: 'Charge linéaire (triangle, trapèze)' },
  { kind: 'couple', label: 'Couple' },
];

export function loadKindLabel(kind: LoadKind): string {
  return LOAD_KINDS.find((k) => k.kind === kind)?.label ?? kind;
}

/** Nouvelle charge avec des valeurs d'exemple (fictives), placée au milieu de la poutre. */
export function newLoad(kind: LoadKind, id: number, length_m: Field): LoadDraft {
  const L = length_m !== undefined && Number.isFinite(length_m) && length_m > 0 ? length_m : 1;
  const base: LoadDraft = {
    id,
    kind,
    x_m: L / 2,
    value: undefined,
    value2: undefined,
    fullLength: true,
    x1_m: 0,
    x2_m: L,
  };
  switch (kind) {
    case 'ponctuelle':
      return { ...base, value: 10_000 };
    case 'couple':
      return { ...base, value: 5_000 };
    case 'uniforme':
      return { ...base, value: 5_000 };
    case 'lineaire':
      return { ...base, value: 0, value2: 5_000 };
  }
}

/** Exemple d'ouverture : poutre de 3 m sur deux appuis, charge uniforme de 5 kN/m. */
export function defaultForm(): BeamForm {
  return {
    length_m: 3,
    supportMode: 'appuis',
    overhangLeft_m: 0,
    overhangRight_m: 0,
    loads: [newLoad('uniforme', 1, 3)],
  };
}

const valid = (v: Field): v is number => v !== undefined && Number.isFinite(v);

/** `-0` → `0`, pour ne pas afficher « -0 ». */
const neg = (v: number) => -v + 0;

function buildLoad(draft: LoadDraft, length_m: number): Load | null {
  switch (draft.kind) {
    case 'ponctuelle':
      if (!valid(draft.x_m) || !valid(draft.value)) return null;
      return { kind: 'ponctuelle', x_m: draft.x_m, Fz_N: neg(draft.value) };
    case 'couple':
      if (!valid(draft.x_m) || !valid(draft.value)) return null;
      return { kind: 'couple', x_m: draft.x_m, C_Nm: draft.value };
    case 'uniforme':
    case 'lineaire': {
      const q1 = draft.value;
      const q2 = draft.kind === 'uniforme' ? draft.value : draft.value2;
      const x1 = draft.fullLength ? 0 : draft.x1_m;
      const x2 = draft.fullLength ? length_m : draft.x2_m;
      if (!valid(q1) || !valid(q2) || !valid(x1) || !valid(x2)) return null;
      return { kind: 'repartie', x1_m: x1, x2_m: x2, q1_N_m: neg(q1), q2_N_m: neg(q2) };
    }
  }
}

function buildSupports(form: BeamForm, length_m: number): Support[] | null {
  switch (form.supportMode) {
    case 'consoleGauche':
      return [{ kind: 'encastrement', x_m: 0 }];
    case 'consoleDroite':
      return [{ kind: 'encastrement', x_m: length_m }];
    case 'appuis':
      if (!valid(form.overhangLeft_m) || !valid(form.overhangRight_m)) return null;
      return [
        { kind: 'appui', x_m: form.overhangLeft_m },
        { kind: 'appui', x_m: length_m - form.overhangRight_m },
      ];
  }
}

export type BuildResult =
  { model: BeamModel; error?: undefined } | { model?: undefined; error: string };

/**
 * Construit l'entrée du moteur, ou un message si un champ est vide ou invalide.
 * Les incohérences (charge hors de la poutre, appuis confondus…) sont détectées par le moteur.
 *
 * @param EI_Nm2 rigidité de flexion, ou `undefined` pour ne calculer que les réactions, V et M.
 */
export function buildBeamModel(form: BeamForm, EI_Nm2: number | undefined): BuildResult {
  if (!valid(form.length_m)) return { error: 'Renseignez la longueur de la poutre.' };
  const supports = buildSupports(form, form.length_m);
  if (!supports) return { error: 'Renseignez les deux porte-à-faux (0 si l’appui est en bout).' };
  if (form.supportMode === 'appuis' && (form.overhangLeft_m ?? 0) < 0) {
    return { error: 'Le porte-à-faux gauche ne peut pas être négatif.' };
  }
  if (form.supportMode === 'appuis' && (form.overhangRight_m ?? 0) < 0) {
    return { error: 'Le porte-à-faux droit ne peut pas être négatif.' };
  }
  const loads: Load[] = [];
  for (const [i, draft] of form.loads.entries()) {
    const load = buildLoad(draft, form.length_m);
    if (!load)
      return { error: `Charge n° ${i + 1} : renseignez tous les champs avec des nombres valides.` };
    loads.push(load);
  }
  return { model: { length_m: form.length_m, EI_Nm2, supports, loads } };
}

/** Nom d'un appui dans l'UI : A, B, C… dans l'ordre des abscisses. */
export function supportName(index: number): string {
  return String.fromCharCode(65 + index);
}
