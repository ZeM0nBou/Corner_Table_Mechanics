/**
 * Propriétés des sections usuelles : rectangle plein ou creux, rond plein, tube,
 * profilés I/H, U, L, T paramétriques.
 *
 * CONVENTION D'AXES (EN 1993-1-1 §1.7) : y horizontal, z vertical vers le haut,
 * x le long de la poutre. Iy : flexion autour de y (axe fort d'un I), Iz autour de z.
 * Centre de gravité repéré depuis le coin inférieur gauche de la boîte englobante.
 * Unités SI en entrée et en sortie.
 *
 * Hypothèses : matériau homogène ; profilés paramétriques SANS congés de raccordement
 * ni arrondis d'angle (écart de quelques % avec les catalogues de profilés laminés) ;
 * torsion de Saint-Venant uniquement (gauchissement non pris en compte).
 */
import { compositeProperties, type PrincipalAxes, type Rect } from './composite';

export type SectionShape = 'rectangle' | 'rectangleCreux' | 'rond' | 'tube' | 'I' | 'U' | 'L' | 'T';

export type SectionInput =
  | { shape: 'rectangle'; b_m: number; h_m: number }
  | { shape: 'rectangleCreux'; b_m: number; h_m: number; t_m: number }
  | { shape: 'rond'; d_m: number }
  | { shape: 'tube'; d_m: number; t_m: number }
  | { shape: 'I'; h_m: number; b_m: number; tw_m: number; tf_m: number }
  | { shape: 'U'; h_m: number; b_m: number; tw_m: number; tf_m: number }
  | { shape: 'L'; h_m: number; b_m: number; t_m: number }
  | { shape: 'T'; h_m: number; b_m: number; tw_m: number; tf_m: number };

/** Formule utilisée pour une grandeur, avec sa source (traçabilité, CLAUDE.md). */
export interface FormulaNote {
  quantity: string;
  formula: string;
  source: string;
}

export type SectionGeometry =
  { kind: 'rects'; rects: Rect[] } | { kind: 'circle'; d_m: number; dInner_m: number };

export interface SectionResult {
  shape: SectionShape;
  A_m2: number;
  yG_m: number;
  zG_m: number;
  width_m: number;
  height_m: number;
  Iy_m4: number;
  Iz_m4: number;
  Iyz_m4: number;
  Wel_y_m3: number;
  Wel_z_m3: number;
  Wpl_y_m3: number;
  Wpl_z_m3: number;
  iy_m: number;
  iz_m: number;
  principal: PrincipalAxes & { iu_m: number; iv_m: number };
  /** Constante de torsion de Saint-Venant. */
  J_m4: number;
  /** Aire de cisaillement pour un effort tranchant Vz (vertical) ; undefined si non définie. */
  Av_z_m2: number | undefined;
  /** Aire de cisaillement pour un effort tranchant Vy (horizontal) ; undefined si non définie. */
  Av_y_m2: number | undefined;
  geometry: SectionGeometry;
  formulas: FormulaNote[];
  assumptions: string[];
}

/** Géométrie impossible ou incohérente. */
export class SectionGeometryError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = 'SectionGeometryError';
  }
}

// --- Sources -----------------------------------------------------------------

const SRC = {
  plane:
    'Roark’s Formulas for Stress and Strain, 8e éd., propriétés des sections planes ; Timoshenko & Gere, Mechanics of Materials. TODO: à vérifier — n° de tableau.',
  huygens:
    'Décomposition en rectangles et théorème de Huygens (Timoshenko & Gere, Mechanics of Materials).',
  wpl: 'EN 1993-1-1:2005 §6.2.5 ; axe neutre plastique partageant l’aire en deux moitiés égales.',
  torsionRect:
    'Roark 8e éd., chap. 10, section rectangulaire pleine. TODO: à vérifier — n° de tableau. Coefficients recoupés : 0,141 (carré), 1/3 (plat mince).',
  torsionRound: 'Torsion des arbres circulaires (Timoshenko & Gere, Mechanics of Materials).',
  bredt:
    'Formule de Bredt, tube mince fermé (Timoshenko & Goodier, Theory of Elasticity ; Roark 8e éd., chap. 10). TODO: à vérifier — paragraphe.',
  open: 'Profil mince ouvert, J ≈ Σ bᵢ tᵢ³ / 3 (Roark 8e éd., chap. 10 ; Timoshenko & Goodier). Congés et jonctions négligés.',
  av: 'EN 1993-1-1:2005 §6.2.6(3).',
} as const;

const BASE_ASSUMPTIONS = [
  'Matériau homogène ; petites déformations.',
  'Axes EN 1993 : y horizontal, z vertical ; centre de gravité repéré depuis le coin inférieur gauche.',
];
const NO_FILLETS =
  'Profilé paramétrique sans congés de raccordement : écart de quelques % avec les catalogues de profilés laminés.';
const SAINT_VENANT = 'Torsion de Saint-Venant (gauchissement non pris en compte).';

// --- Validation --------------------------------------------------------------

function positive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new SectionGeometryError(`${name} doit être un nombre strictement positif.`);
  }
}

function check(condition: boolean, message: string): void {
  if (!condition) throw new SectionGeometryError(message);
}

// --- Constantes de torsion -----------------------------------------------------

/**
 * Constante de torsion d'un rectangle plein.
 *
 * Formule : K = a b³ [16/3 − 3,36 (b/a)(1 − b⁴/(12 a⁴))], a ≥ b demi-côtés.
 * Source : Roark 8e éd., chap. 10 (section rectangulaire pleine) — TODO: à vérifier n° de tableau.
 * Précision : erreur inférieure à 4 % selon Roark ; coefficient 0,141 pour un carré.
 */
export function torsionConstantRectangle(b_m: number, h_m: number): number {
  const a = Math.max(b_m, h_m) / 2;
  const b = Math.min(b_m, h_m) / 2;
  return a * b ** 3 * (16 / 3 - 3.36 * (b / a) * (1 - b ** 4 / (12 * a ** 4)));
}

// --- Assemblage du résultat ----------------------------------------------------

function fromRects(
  shape: SectionShape,
  rects: Rect[],
  extra: {
    J_m4: number;
    Av_z_m2: number | undefined;
    Av_y_m2: number | undefined;
    formulas: FormulaNote[];
    assumptions: string[];
  },
): SectionResult {
  const p = compositeProperties(rects);
  return {
    shape,
    ...p,
    iy_m: Math.sqrt(p.Iy_m4 / p.A_m2),
    iz_m: Math.sqrt(p.Iz_m4 / p.A_m2),
    principal: {
      ...p.principal,
      iu_m: Math.sqrt(p.principal.Iu_m4 / p.A_m2),
      iv_m: Math.sqrt(p.principal.Iv_m4 / p.A_m2),
    },
    geometry: { kind: 'rects', rects },
    ...extra,
    formulas: [
      {
        quantity: 'A, yG, zG, Iy, Iz, Iyz, Wel',
        formula: 'A = Σ Aᵢ ; Iy = Σ (bᵢ hᵢ³/12 + Aᵢ dzᵢ²) ; Wel = I / v_max',
        source: SRC.huygens,
      },
      {
        quantity: 'Wpl',
        formula: 'Wpl = ∫ |d − dp| dA, dp tel que A(d < dp) = A/2',
        source: SRC.wpl,
      },
      ...extra.formulas,
    ],
    assumptions: [...BASE_ASSUMPTIONS, ...extra.assumptions],
  };
}

const r = (y0: number, y1: number, z0: number, z1: number): Rect => ({ y0, y1, z0, z1 });

// --- Formes -------------------------------------------------------------------

/**
 * Calcule les propriétés d'une section.
 * @throws SectionGeometryError si les dimensions sont nulles, négatives ou incompatibles.
 */
export function computeSection(input: SectionInput): SectionResult {
  switch (input.shape) {
    case 'rectangle': {
      const { b_m: b, h_m: h } = input;
      positive('La largeur b', b);
      positive('La hauteur h', h);
      const A = b * h;
      return fromRects('rectangle', [r(0, b, 0, h)], {
        J_m4: torsionConstantRectangle(b, h),
        // EN 1993-1-1 §6.2.6(3) h) « plats et barres pleines » : Av = A. TODO: à vérifier.
        Av_z_m2: A,
        Av_y_m2: A,
        formulas: [
          {
            quantity: 'Iy, Wel,y, Wpl,y',
            formula: 'Iy = b h³/12 ; Wel,y = b h²/6 ; Wpl,y = b h²/4',
            source: SRC.plane,
          },
          {
            quantity: 'J',
            formula: 'J = a b³ [16/3 − 3,36 (b/a)(1 − b⁴/(12 a⁴))], a ≥ b demi-côtés',
            source: SRC.torsionRect,
          },
          {
            quantity: 'Av',
            formula: 'Av = A (barre pleine)',
            source: `${SRC.av} TODO: à vérifier.`,
          },
        ],
        assumptions: [SAINT_VENANT],
      });
    }

    case 'rectangleCreux': {
      const { b_m: b, h_m: h, t_m: t } = input;
      positive('La largeur b', b);
      positive('La hauteur h', h);
      positive('L’épaisseur t', t);
      check(2 * t < Math.min(b, h), 'L’épaisseur t doit être inférieure à la moitié de b et de h.');
      const rects = [r(0, b, 0, t), r(0, b, h - t, h), r(0, t, t, h - t), r(b - t, b, t, h - t)];
      const Am = (b - t) * (h - t);
      const pm = 2 * (b - t + h - t);
      const A = b * h - (b - 2 * t) * (h - 2 * t);
      return fromRects('rectangleCreux', rects, {
        J_m4: (4 * Am ** 2 * t) / pm,
        Av_z_m2: (A * h) / (b + h),
        Av_y_m2: (A * b) / (b + h),
        formulas: [
          { quantity: 'Iy', formula: 'Iy = [b h³ − (b − 2t)(h − 2t)³] / 12', source: SRC.plane },
          {
            quantity: 'J',
            formula: 'J = 4 Am² t / pm, Am = (b − t)(h − t), pm = 2 (b + h − 2t)',
            source: SRC.bredt,
          },
          {
            quantity: 'Av',
            formula: 'Av,z = A h / (b + h) ; Av,y = A b / (b + h)',
            source: `${SRC.av} TODO: à vérifier.`,
          },
        ],
        assumptions: [
          'Angles vifs (rayons d’angle des tubes du commerce négligés).',
          'J par la formule de Bredt : valable pour une paroi mince (t ≪ b, h).',
          SAINT_VENANT,
        ],
      });
    }

    case 'rond':
    case 'tube': {
      const D = input.d_m;
      positive('Le diamètre d', D);
      let d = 0;
      if (input.shape === 'tube') {
        positive('L’épaisseur t', input.t_m);
        check(input.t_m <= D / 2, 'L’épaisseur t ne peut pas dépasser le rayon extérieur.');
        d = D - 2 * input.t_m;
      }
      const A = (Math.PI / 4) * (D ** 2 - d ** 2);
      const I = (Math.PI / 64) * (D ** 4 - d ** 4);
      const Wpl = (D ** 3 - d ** 3) / 6;
      const i = Math.sqrt(I / A);
      const tube = input.shape === 'tube';
      // EN 1993-1-1 §6.2.6(3) : tubes Av = 2A/π ; barres pleines Av = A. TODO: à vérifier.
      const Av = tube ? (2 * A) / Math.PI : A;
      return {
        shape: input.shape,
        A_m2: A,
        yG_m: D / 2,
        zG_m: D / 2,
        width_m: D,
        height_m: D,
        Iy_m4: I,
        Iz_m4: I,
        Iyz_m4: 0,
        Wel_y_m3: I / (D / 2),
        Wel_z_m3: I / (D / 2),
        Wpl_y_m3: Wpl,
        Wpl_z_m3: Wpl,
        iy_m: i,
        iz_m: i,
        principal: { Iu_m4: I, Iv_m4: I, alpha_rad: 0, iu_m: i, iv_m: i },
        J_m4: 2 * I,
        Av_z_m2: Av,
        Av_y_m2: Av,
        geometry: { kind: 'circle', d_m: D, dInner_m: d },
        formulas: [
          {
            quantity: 'A, I',
            formula: 'A = π (D² − d²)/4 ; I = π (D⁴ − d⁴)/64',
            source: SRC.plane,
          },
          { quantity: 'Wel, Wpl', formula: 'Wel = 2 I / D ; Wpl = (D³ − d³)/6', source: SRC.plane },
          { quantity: 'J', formula: 'J = Ip = π (D⁴ − d⁴)/32 (exact)', source: SRC.torsionRound },
          {
            quantity: 'Av',
            formula: tube ? 'Av = 2 A / π' : 'Av = A (barre pleine)',
            source: `${SRC.av} TODO: à vérifier.`,
          },
        ],
        assumptions: [
          ...BASE_ASSUMPTIONS,
          'Section circulaire : tous les axes centraux sont principaux.',
        ],
      };
    }

    case 'I': {
      const { h_m: h, b_m: b, tw_m: tw, tf_m: tf } = input;
      positive('La hauteur h', h);
      positive('La largeur b', b);
      positive('L’épaisseur d’âme tw', tw);
      positive('L’épaisseur de semelle tf', tf);
      check(2 * tf < h, 'Les deux semelles (2 tf) doivent être moins hautes que le profilé h.');
      check(tw <= b, 'L’âme tw ne peut pas être plus large que les semelles b.');
      const hw = h - 2 * tf;
      const rects = [r(0, b, 0, tf), r(0, b, h - tf, h), r((b - tw) / 2, (b + tw) / 2, tf, h - tf)];
      const A = 2 * b * tf + hw * tw;
      return fromRects('I', rects, {
        J_m4: (2 * b * tf ** 3 + hw * tw ** 3) / 3,
        Av_z_m2: Math.max(A - 2 * b * tf + tw * tf, hw * tw),
        Av_y_m2: A - hw * tw,
        formulas: [
          { quantity: 'Iy', formula: 'Iy = [b h³ − (b − tw)(h − 2tf)³] / 12', source: SRC.plane },
          {
            quantity: 'Wpl,y',
            formula: 'Wpl,y = b tf (h − tf) + tw (h − 2tf)² / 4',
            source: SRC.wpl,
          },
          { quantity: 'J', formula: 'J ≈ [2 b tf³ + (h − 2tf) tw³] / 3', source: SRC.open },
          {
            quantity: 'Av',
            formula: 'Av,z = max(A − 2 b tf + tw tf ; hw tw) (r = 0, η = 1) ; Av,y = A − hw tw',
            source: SRC.av,
          },
        ],
        assumptions: [
          NO_FILLETS,
          'Av,z : η = 1 (valeur prudente admise par l’EN 1993-1-1).',
          SAINT_VENANT,
        ],
      });
    }

    case 'U': {
      const { h_m: h, b_m: b, tw_m: tw, tf_m: tf } = input;
      positive('La hauteur h', h);
      positive('La largeur b', b);
      positive('L’épaisseur d’âme tw', tw);
      positive('L’épaisseur d’aile tf', tf);
      check(2 * tf < h, 'Les deux ailes (2 tf) doivent être moins hautes que le profilé h.');
      check(tw < b, 'L’âme tw doit être moins large que les ailes b.');
      const hw = h - 2 * tf;
      // Âme à gauche sur toute la hauteur, ailes vers la droite.
      const rects = [r(0, tw, 0, h), r(tw, b, 0, tf), r(tw, b, h - tf, h)];
      const A = h * tw + 2 * (b - tw) * tf;
      return fromRects('U', rects, {
        J_m4: (2 * b * tf ** 3 + hw * tw ** 3) / 3,
        Av_z_m2: A - 2 * b * tf + tw * tf,
        Av_y_m2: A - hw * tw,
        formulas: [
          { quantity: 'Iy', formula: 'Iy = [b h³ − (b − tw)(h − 2tf)³] / 12', source: SRC.plane },
          { quantity: 'J', formula: 'J ≈ [2 b tf³ + (h − 2tf) tw³] / 3', source: SRC.open },
          {
            quantity: 'Av',
            formula: 'Av,z = A − 2 b tf + tw tf (r = 0) ; Av,y = A − hw tw',
            source: SRC.av,
          },
        ],
        assumptions: [
          NO_FILLETS,
          'Centre de cisaillement non calculé : une charge passant par le centre de gravité fait tordre un U.',
          SAINT_VENANT,
        ],
      });
    }

    case 'L': {
      const { h_m: h, b_m: b, t_m: t } = input;
      positive('La hauteur d’aile h', h);
      positive('La largeur d’aile b', b);
      positive('L’épaisseur t', t);
      check(t < Math.min(b, h), 'L’épaisseur t doit être inférieure à la longueur des deux ailes.');
      // Aile horizontale en bas, aile verticale à gauche.
      const rects = [r(0, b, 0, t), r(0, t, t, h)];
      return fromRects('L', rects, {
        J_m4: ((b + h - t) * t ** 3) / 3,
        Av_z_m2: undefined,
        Av_y_m2: undefined,
        formulas: [
          {
            quantity: 'Iu, Iv, α',
            formula: 'Iu,v = (Iy + Iz)/2 ± √[((Iy − Iz)/2)² + Iyz²] ; α = ½ atan2(−2 Iyz, Iy − Iz)',
            source: SRC.plane,
          },
          { quantity: 'J', formula: 'J ≈ (b + h − t) t³ / 3', source: SRC.open },
        ],
        assumptions: [
          NO_FILLETS,
          'Axes principaux inclinés : la flexion autour de y ou z est déviée ; le flambement se fait autour de l’axe v (iv minimal).',
          'Aire de cisaillement non définie par l’EN 1993-1-1 pour les cornières.',
          SAINT_VENANT,
        ],
      });
    }

    case 'T': {
      const { h_m: h, b_m: b, tw_m: tw, tf_m: tf } = input;
      positive('La hauteur h', h);
      positive('La largeur b', b);
      positive('L’épaisseur d’âme tw', tw);
      positive('L’épaisseur de semelle tf', tf);
      check(tf < h, 'La semelle tf doit être moins haute que le profilé h.');
      check(tw <= b, 'L’âme tw ne peut pas être plus large que la semelle b.');
      // Semelle en haut, âme centrée en dessous.
      const rects = [r(0, b, h - tf, h), r((b - tw) / 2, (b + tw) / 2, 0, h - tf)];
      const A = b * tf + (h - tf) * tw;
      return fromRects('T', rects, {
        J_m4: (b * tf ** 3 + (h - tf) * tw ** 3) / 3,
        Av_z_m2: A - b * tf + (tw * tf) / 2,
        Av_y_m2: undefined,
        formulas: [
          {
            quantity: 'zG',
            formula: 'zG = [b tf (h − tf/2) + (h − tf) tw (h − tf)/2] / A',
            source: SRC.huygens,
          },
          { quantity: 'J', formula: 'J ≈ [b tf³ + (h − tf) tw³] / 3', source: SRC.open },
          {
            quantity: 'Av,z',
            formula: 'Av,z = A − b tf + tw tf / 2 (T laminé, r = 0)',
            source: `${SRC.av} TODO: à vérifier.`,
          },
        ],
        assumptions: [
          NO_FILLETS,
          'Wel minimal : fibre la plus éloignée du centre de gravité (pied d’âme).',
          SAINT_VENANT,
        ],
      });
    }
  }
}
