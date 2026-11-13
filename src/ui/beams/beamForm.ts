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

export type SupportKind = Support['kind'];
export type LoadKind = 'ponctuelle' | 'couple' | 'uniforme' | 'lineaire';

type Field = number | undefined;

export interface SupportDraft {
  /** Identifiant stable pour l'affichage (clé React). */
  id: number;
  kind: SupportKind;
  /** Position depuis l'extrémité gauche. */
  x_m: Field;
}

export interface LoadDraft {
  /** Identifiant stable pour l'affichage (clé React). */
  id: number;
  kind: LoadKind;
  /** Couleur de la charge : indice dans `LOAD_COLORS`, fixé à la création. */
  color: number;
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
  /** Dernière longueur valide : les appuis placés à cette abscisse suivent l'extrémité droite. */
  rightEnd_m: number;
  supports: SupportDraft[];
  /** Ajoute le poids propre (masse linéique × g) aux charges. */
  selfWeight: boolean;
  loads: LoadDraft[];
}

/**
 * Couleurs des charges (palette catégorielle à 8 teintes, ordre fixe ; séparation
 * vérifiée pour les daltonismes). Chaque charge porte aussi son numéro sur le schéma :
 * la couleur n'est jamais le seul moyen de l'identifier.
 */
export const LOAD_COLORS = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#6250d6',
  '#e34948',
] as const;

/** Couleur du poids propre : gris neutre, distinct des charges saisies. */
export const SELF_WEIGHT_COLOR = '#64748b';

/** Couleur d'une charge. */
export function loadColor(load: Pick<LoadDraft, 'color'>): string {
  return LOAD_COLORS[load.color % LOAD_COLORS.length] ?? LOAD_COLORS[0];
}

/** Première couleur libre ; au-delà de 8 charges, les couleurs se répètent. */
export function nextColor(loads: readonly Pick<LoadDraft, 'color'>[]): number {
  const used = new Set(loads.map((l) => l.color % LOAD_COLORS.length));
  for (let i = 0; i < LOAD_COLORS.length; i++) if (!used.has(i)) return i;
  return loads.length % LOAD_COLORS.length;
}

export const SUPPORT_KINDS: readonly { kind: SupportKind; label: string }[] = [
  { kind: 'appui', label: 'Appui simple' },
  { kind: 'encastrement', label: 'Encastrement' },
];

export type SupportPreset =
  'deuxAppuis' | 'consoleGauche' | 'consoleDroite' | 'encastreeAppuyee' | 'biEncastree';

export const SUPPORT_PRESETS: readonly { preset: SupportPreset; label: string }[] = [
  { preset: 'deuxAppuis', label: 'Deux appuis' },
  { preset: 'consoleGauche', label: 'Console à gauche' },
  { preset: 'consoleDroite', label: 'Console à droite' },
  { preset: 'encastreeAppuyee', label: 'Encastrée-appuyée' },
  { preset: 'biEncastree', label: 'Bi-encastrée' },
];

const positiveLength = (length_m: Field) =>
  length_m !== undefined && Number.isFinite(length_m) && length_m > 0 ? length_m : 1;

/** Appuis d'une configuration usuelle ; les identifiants commencent à `firstId`. */
export function presetSupports(
  preset: SupportPreset,
  length_m: Field,
  firstId: number,
): SupportDraft[] {
  const L = positiveLength(length_m);
  const make = (kinds: [SupportKind, number][]) =>
    kinds.map(([kind, x_m], i) => ({ id: firstId + i, kind, x_m }));
  switch (preset) {
    case 'deuxAppuis':
      return make([
        ['appui', 0],
        ['appui', L],
      ]);
    case 'consoleGauche':
      return make([['encastrement', 0]]);
    case 'consoleDroite':
      return make([['encastrement', L]]);
    case 'encastreeAppuyee':
      return make([
        ['encastrement', 0],
        ['appui', L],
      ]);
    case 'biEncastree':
      return make([
        ['encastrement', 0],
        ['encastrement', L],
      ]);
  }
}

/**
 * Position proposée pour un nouvel appui : milieu du plus grand intervalle libre entre
 * les extrémités et les appuis existants (valeurs valides seulement).
 */
export function newSupportPosition(supports: readonly SupportDraft[], length_m: Field): number {
  const L = positiveLength(length_m);
  const xs = [0, L, ...supports.map((s) => s.x_m).filter(valid)]
    .filter((x) => x >= 0 && x <= L)
    .sort((a, b) => a - b);
  let best = { gap: -1, mid: L / 2 };
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1] ?? 0;
    const b = xs[i] ?? 0;
    if (b - a > best.gap) best = { gap: b - a, mid: (a + b) / 2 };
  }
  return best.mid;
}

/**
 * Change la longueur de la poutre. Les appuis placés à l'extrémité droite (à la dernière
 * longueur valide, à 1e-9 près) la suivent ; ils reçoivent un nouvel identifiant pour que
 * leur champ de saisie affiche la nouvelle position.
 */
export function withLength(
  form: BeamForm,
  length_m: Field,
  nextId: number,
): { form: BeamForm; nextId: number } {
  if (!valid(length_m) || length_m <= 0) return { form: { ...form, length_m }, nextId };
  let id = nextId;
  const end = form.rightEnd_m;
  const supports = form.supports.map((s) =>
    valid(s.x_m) && Math.abs(s.x_m - end) <= 1e-9 * end ? { ...s, id: id++, x_m: length_m } : s,
  );
  return { form: { ...form, length_m, rightEnd_m: length_m, supports }, nextId: id };
}

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
export function newLoad(kind: LoadKind, id: number, length_m: Field, color = 0): LoadDraft {
  const L = positiveLength(length_m);
  const base: LoadDraft = {
    id,
    kind,
    color,
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

/**
 * Exemple d'ouverture : poutre de 3 m sur deux appuis, charge uniforme de 5 kN/m,
 * poids propre activé. Identifiants : appuis 1 et 2, charge 3.
 */
export function defaultForm(): BeamForm {
  return {
    length_m: 3,
    rightEnd_m: 3,
    supports: presetSupports('deuxAppuis', 3, 1),
    selfWeight: true,
    loads: [newLoad('uniforme', 3, 3, 0)],
  };
}

function valid(v: Field): v is number {
  return v !== undefined && Number.isFinite(v);
}

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

export type BuildResult =
  | { model: BeamModel; selfWeightIncluded: boolean; error?: undefined }
  | { model?: undefined; selfWeightIncluded?: undefined; error: string };

/**
 * Construit l'entrée du moteur, ou un message si un champ est vide ou invalide.
 * Les appuis gardent l'ordre de la liste (A, B, C…). Le poids propre, s'il est demandé
 * et connu, est ajouté en DERNIÈRE charge (uniforme, sur toute la longueur, vers le bas).
 * Les incohérences (charge hors de la poutre, appuis confondus, mécanisme…) sont
 * détectées par le moteur.
 *
 * @param EI_Nm2 rigidité de flexion, ou `undefined` pour ne calculer que les réactions, V et M.
 * @param selfWeight_N_m intensité du poids propre, ou `undefined` si elle est inconnue.
 */
export function buildBeamModel(
  form: BeamForm,
  EI_Nm2: number | undefined,
  selfWeight_N_m?: number,
): BuildResult {
  if (!valid(form.length_m)) return { error: 'Renseignez la longueur de la poutre.' };
  const supports: Support[] = [];
  for (const [i, s] of form.supports.entries()) {
    if (!valid(s.x_m)) return { error: `Appui ${supportName(i)} : renseignez sa position.` };
    supports.push({ kind: s.kind, x_m: s.x_m });
  }
  const loads: Load[] = [];
  for (const [i, draft] of form.loads.entries()) {
    const load = buildLoad(draft, form.length_m);
    if (!load) {
      return { error: `Charge n° ${i + 1} : renseignez tous les champs avec des nombres valides.` };
    }
    loads.push(load);
  }
  const selfWeightIncluded =
    form.selfWeight && selfWeight_N_m !== undefined && Number.isFinite(selfWeight_N_m);
  if (selfWeightIncluded) {
    const q = neg(selfWeight_N_m);
    loads.push({ kind: 'repartie', x1_m: 0, x2_m: form.length_m, q1_N_m: q, q2_N_m: q });
  }
  return { model: { length_m: form.length_m, EI_Nm2, supports, loads }, selfWeightIncluded };
}

/** Nom d'un appui dans l'UI : A, B, C… dans l'ordre de la liste. */
export function supportName(index: number): string {
  return String.fromCharCode(65 + index);
}
