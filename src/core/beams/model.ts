/**
 * Poutres droites en flexion plane : description du problème (géométrie, appuis,
 * charges), validation et degré d'hyperstaticité.
 *
 * REPÈRE ET CONVENTIONS DE SIGNE (communs à tout le module `beams`)
 * - x le long de la poutre, de 0 (extrémité gauche) à L ; z vertical vers le haut
 *   (repère de l'EN 1993-1-1 §1.7, comme le module `sections`).
 * - Forces ponctuelles, charges réparties et réactions : positives selon +z (vers le HAUT).
 *   L'UI saisit les charges positives vers le bas et change le signe à sa frontière.
 * - Couples appliqués et couples d'encastrement : positifs dans le sens trigonométrique
 *   (anti-horaire) quand on regarde la poutre avec x vers la droite et z vers le haut.
 * - Flèche w : positive vers le haut. Rotation θ = dw/dx : positive dans le sens trigonométrique.
 * - Effort tranchant V(x) : somme des forces selon +z appliquées à GAUCHE de la coupe.
 * - Moment fléchissant M(x) : positif quand la fibre inférieure est tendue.
 * Avec ces conventions : dV/dx = q, dM/dx = V, EI·w″ = M.
 *
 * Hypothèses : poutre droite de rigidité EI constante, théorie d'Euler-Bernoulli
 * (déformation d'effort tranchant négligée), petites déformations, matériau élastique
 * linéaire. Pas d'effort normal : articulation et appui à rouleau sont donc confondus.
 * Unités SI en entrée et en sortie.
 */

/** Appui ponctuel : `appui` bloque la flèche, `encastrement` bloque la flèche et la rotation. */
export type Support = { kind: 'appui'; x_m: number } | { kind: 'encastrement'; x_m: number };

export type Load =
  /** Force ponctuelle, positive vers le haut. */
  | { kind: 'ponctuelle'; x_m: number; Fz_N: number }
  /** Couple ponctuel, positif dans le sens trigonométrique. */
  | { kind: 'couple'; x_m: number; C_Nm: number }
  /**
   * Charge répartie variant linéairement de q1 (en x1) à q2 (en x2), positive vers le haut.
   * Couvre la charge uniforme (q1 = q2), triangulaire, trapézoïdale et partielle.
   */
  | { kind: 'repartie'; x1_m: number; x2_m: number; q1_N_m: number; q2_N_m: number };

export interface BeamModel {
  length_m: number;
  /**
   * Rigidité de flexion E·I (constante). Facultative : sans elle, les réactions, V et M
   * restent calculables (elles n'en dépendent pas), mais ni la rotation ni la flèche.
   */
  EI_Nm2?: number | undefined;
  supports: readonly Support[];
  loads: readonly Load[];
}

/** Problème mal posé : géométrie impossible, charge hors de la poutre, mécanisme… */
export class BeamModelError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = 'BeamModelError';
  }
}

export type BeamStaticity =
  | { kind: 'isostatique'; degree: 0 }
  | { kind: 'hyperstatique'; degree: number }
  | { kind: 'mecanisme'; degree: number };

/** Deux abscisses sont confondues en deçà de cette fraction de la longueur. */
export const POSITION_TOLERANCE = 1e-9;

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new BeamModelError(message);
}

function finite(name: string, value: number): void {
  check(Number.isFinite(value), `${name} doit être un nombre fini.`);
}

function onBeam(name: string, x_m: number, length_m: number): void {
  finite(name, x_m);
  check(x_m >= 0 && x_m <= length_m, `${name} est en dehors de la poutre (0 ≤ x ≤ L).`);
}

/**
 * Vérifie les données d'une poutre et lève une `BeamModelError` explicite sinon.
 * Ne juge pas la stabilité : voir `classifyBeam`.
 */
export function validateBeamModel(model: BeamModel): void {
  const L = model.length_m;
  check(Number.isFinite(L) && L > 0, 'La longueur de la poutre doit être strictement positive.');
  if (model.EI_Nm2 !== undefined) {
    check(
      Number.isFinite(model.EI_Nm2) && model.EI_Nm2 > 0,
      'La rigidité de flexion EI doit être strictement positive.',
    );
  }

  model.supports.forEach((s, i) => onBeam(`La position de l’appui n° ${i + 1}`, s.x_m, L));
  const xs = model.supports.map((s) => s.x_m).sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) {
    check(
      (xs[i] ?? 0) - (xs[i - 1] ?? 0) > POSITION_TOLERANCE * L,
      'Deux appuis sont à la même position.',
    );
  }

  model.loads.forEach((load, i) => {
    const name = `charge n° ${i + 1}`;
    switch (load.kind) {
      case 'ponctuelle':
        onBeam(`La position de la ${name}`, load.x_m, L);
        finite(`L’intensité de la ${name}`, load.Fz_N);
        break;
      case 'couple':
        onBeam(`La position de la ${name}`, load.x_m, L);
        finite(`L’intensité de la ${name}`, load.C_Nm);
        break;
      case 'repartie':
        onBeam(`Le début de la ${name}`, load.x1_m, L);
        onBeam(`La fin de la ${name}`, load.x2_m, L);
        check(
          load.x2_m - load.x1_m > POSITION_TOLERANCE * L,
          `La ${name} doit finir après son début (x1 < x2).`,
        );
        finite(`L’intensité de la ${name}`, load.q1_N_m);
        finite(`L’intensité de la ${name}`, load.q2_N_m);
        break;
    }
  });
}

/**
 * Degré d'hyperstaticité d'une poutre plane sans effort normal.
 *
 * Formule : h = r − 2, avec r le nombre d'inconnues de liaison (1 par appui, 2 par
 * encastrement) et 2 équations d'équilibre (ΣFz = 0, ΣM = 0).
 * h < 0 : mécanisme ; h = 0 : isostatique ; h > 0 : hyperstatique de degré h.
 * Source : statique des poutres planes (Gere & Goodno, Mechanics of Materials, chap.
 * « Statically Indeterminate Beams » — TODO: à vérifier, n° de paragraphe).
 * Limites : suppose des appuis à des positions distinctes (vérifié par `validateBeamModel`),
 * auquel cas h ≥ 0 garantit la stabilité en flexion plane.
 */
export function classifyBeam(model: Pick<BeamModel, 'supports'>): BeamStaticity {
  const r = model.supports.reduce((n, s) => n + (s.kind === 'encastrement' ? 2 : 1), 0);
  const degree = r - 2;
  if (degree < 0) return { kind: 'mecanisme', degree };
  if (degree === 0) return { kind: 'isostatique', degree: 0 };
  return { kind: 'hyperstatique', degree };
}
