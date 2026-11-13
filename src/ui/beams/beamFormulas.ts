/**
 * Formules (LaTeX) affichées avec les résultats de poutre.
 *
 * - `GENERAL_FORMULAS` : équations de la méthode, valables pour tout chargement.
 * - `knownCase` : quand la poutre correspond à un cas de table (une seule charge sur une
 *   console ou sur deux appuis en bout), formule fermée du moment et de la flèche maximaux.
 *
 * Présentation seulement : la valeur affichée en fin d'application numérique vient du
 * moteur. `closedForm` est la valeur de la formule fermée (SI, en valeur absolue), utilisée
 * par les tests pour vérifier que le cas reconnu est le bon.
 * Applications numériques en kN et m.
 */
import {
  BEAM_SOURCES,
  type BeamExtrema,
  type BeamModel,
  type Extremum,
  type Range,
} from '@core/beams';
import { tex } from '@ui/sections/sectionFormulas';

export interface BeamFormula {
  latex: string;
  application: string;
  source: string;
  /** Valeur de la formule fermée, en SI et en valeur absolue. */
  closedForm: number;
}

export interface KnownCase {
  name: string;
  moment: BeamFormula;
  /** Absente si EI n'est pas fourni. */
  deflection?: BeamFormula;
}

export const GENERAL_FORMULAS: readonly { label: string; latex: string; source: string }[] = [
  {
    label: 'Équilibre (réactions d’appui)',
    latex: '\\sum F_z = 0 \\qquad \\sum M = 0',
    source: BEAM_SOURCES.equations,
  },
  {
    label: 'Efforts intérieurs et déformée',
    latex:
      '\\dfrac{dV}{dx} = q \\qquad \\dfrac{dM}{dx} = V \\qquad EI\\,\\dfrac{d^2 w}{dx^2} = M \\qquad \\theta = \\dfrac{dw}{dx}',
    source: BEAM_SOURCES.equations,
  },
  {
    label: 'Intégration par fonctions de singularité',
    latex:
      'M(x) = \\sum_i F_i\\,\\langle x - a_i \\rangle^{1} - \\sum_j C_j\\,\\langle x - a_j \\rangle^{0} + \\sum_k \\dfrac{q_k}{2}\\,\\langle x - a_k \\rangle^{2} + \\dots \\qquad \\langle x - a \\rangle^{n} = \\begin{cases} (x-a)^n & x > a \\\\ 0 & x \\le a \\end{cases}',
    source: BEAM_SOURCES.method,
  },
];

/** Extremum de plus grande valeur absolue d'une plage. */
export function absExtremum(range: Range): Extremum {
  return Math.abs(range.min.value) > Math.abs(range.max.value) ? range.min : range.max;
}

const kN = (v_N: number) => tex(Math.abs(v_N) / 1e3);
const m = (v_m: number) => tex(v_m);
const SRC = BEAM_SOURCES.tables;

/**
 * Reconnaît un cas de table et renvoie ses formules fermées, ou `null`.
 * Cas reconnus (une seule charge) : console avec force, charge uniforme complète ou couple
 * en bout ; poutre sur deux appuis en bout avec force ou charge uniforme complète.
 */
export function knownCase(model: BeamModel, extrema: BeamExtrema): KnownCase | null {
  const load = model.loads.length === 1 ? model.loads[0] : undefined;
  if (!load) return null;
  const L = model.length_m;
  const EI = model.EI_Nm2;
  const eps = 1e-9 * L;
  const at = (x: number, target: number) => Math.abs(x - target) <= eps;
  const Mmax = absExtremum(extrema.moment_Nm).value;
  const wmax = extrema.deflection_m ? absExtremum(extrema.deflection_m).value : undefined;

  const resM = `${tex(Math.abs(Mmax) / 1e3)}\\text{ kN·m}`;
  const resW =
    wmax === undefined
      ? ''
      : `${tex(Math.abs(wmax))}\\text{ m} = ${tex(Math.abs(wmax) * 1e3)}\\text{ mm}`;
  const ei = EI === undefined ? '' : tex(EI / 1e3);

  const make = (
    name: string,
    moment: { latex: string; app: string; value: number },
    deflection: { latex: string; app: string; value: number } | undefined,
  ): KnownCase => ({
    name,
    moment: {
      latex: moment.latex,
      application: `= ${moment.app} = ${resM}`,
      source: SRC,
      closedForm: moment.value,
    },
    ...(deflection &&
      EI !== undefined && {
        deflection: {
          latex: deflection.latex,
          application: `= ${deflection.app} = ${resW}`,
          source: SRC,
          closedForm: deflection.value,
        },
      }),
  });
  /** Dénominateur EI de l'application numérique (ignoré si EI est absent). */
  const E = EI ?? NaN;

  const [s1, s2] = model.supports;

  // --- Console ---------------------------------------------------------------
  if (s1 && !s2 && s1.kind === 'encastrement' && (at(s1.x_m, 0) || at(s1.x_m, L))) {
    const free = at(s1.x_m, 0) ? L : 0;
    if (load.kind === 'ponctuelle') {
      const F = Math.abs(load.Fz_N);
      const a = Math.abs(load.x_m - s1.x_m);
      if (at(load.x_m, free)) {
        return make(
          'Console, force en bout',
          { latex: '|M|_{max} = F\\,L', app: `${kN(F)} \\times ${m(L)}`, value: F * L },
          {
            latex: '\\delta_{max} = \\dfrac{F\\,L^3}{3\\,EI}',
            app: `\\dfrac{${kN(F)} \\times ${m(L)}^3}{3 \\times ${ei}}`,
            value: (F * L ** 3) / (3 * E),
          },
        );
      }
      return make(
        'Console, force à la distance a de l’encastrement',
        { latex: '|M|_{max} = F\\,a', app: `${kN(F)} \\times ${m(a)}`, value: F * a },
        {
          latex: '\\delta_{max} = \\dfrac{F\\,a^2\\,(3L - a)}{6\\,EI}',
          app: `\\dfrac{${kN(F)} \\times ${m(a)}^2 \\times (3 \\times ${m(L)} - ${m(a)})}{6 \\times ${ei}}`,
          value: (F * a ** 2 * (3 * L - a)) / (6 * E),
        },
      );
    }
    if (load.kind === 'couple' && at(load.x_m, free)) {
      const C = Math.abs(load.C_Nm);
      return make(
        'Console, couple en bout',
        { latex: '|M|_{max} = C', app: `${kN(C)}\\text{ kN·m}`, value: C },
        {
          latex: '\\delta_{max} = \\dfrac{C\\,L^2}{2\\,EI}',
          app: `\\dfrac{${kN(C)} \\times ${m(L)}^2}{2 \\times ${ei}}`,
          value: (C * L ** 2) / (2 * E),
        },
      );
    }
    if (isFullUniform(load, L, eps)) {
      const q = Math.abs(load.q1_N_m);
      return make(
        'Console, charge uniforme',
        {
          latex: '|M|_{max} = \\dfrac{q\\,L^2}{2}',
          app: `\\dfrac{${kN(q)} \\times ${m(L)}^2}{2}`,
          value: (q * L ** 2) / 2,
        },
        {
          latex: '\\delta_{max} = \\dfrac{q\\,L^4}{8\\,EI}',
          app: `\\dfrac{${kN(q)} \\times ${m(L)}^4}{8 \\times ${ei}}`,
          value: (q * L ** 4) / (8 * E),
        },
      );
    }
    return null;
  }

  // --- Deux appuis en bout -----------------------------------------------------
  if (
    s1 &&
    s2 &&
    model.supports.length === 2 &&
    s1.kind === 'appui' &&
    s2.kind === 'appui' &&
    at(Math.min(s1.x_m, s2.x_m), 0) &&
    at(Math.max(s1.x_m, s2.x_m), L)
  ) {
    if (load.kind === 'ponctuelle') {
      const F = Math.abs(load.Fz_N);
      const a = Math.max(load.x_m, L - load.x_m);
      const b = L - a;
      if (b <= eps) return null; // force sur un appui : rien à montrer
      if (at(a, b)) {
        return make(
          'Deux appuis, force au milieu',
          {
            latex: 'M_{max} = \\dfrac{F\\,L}{4}',
            app: `\\dfrac{${kN(F)} \\times ${m(L)}}{4}`,
            value: (F * L) / 4,
          },
          {
            latex: '\\delta_{max} = \\dfrac{F\\,L^3}{48\\,EI}',
            app: `\\dfrac{${kN(F)} \\times ${m(L)}^3}{48 \\times ${ei}}`,
            value: (F * L ** 3) / (48 * E),
          },
        );
      }
      return make(
        'Deux appuis, force excentrée (a ≥ b, distances aux appuis)',
        {
          latex: 'M_{max} = \\dfrac{F\\,a\\,b}{L}',
          app: `\\dfrac{${kN(F)} \\times ${m(a)} \\times ${m(b)}}{${m(L)}}`,
          value: (F * a * b) / L,
        },
        {
          latex: '\\delta_{max} = \\dfrac{F\\,b\\,(L^2 - b^2)^{3/2}}{9\\sqrt{3}\\,EI\\,L}',
          app: `\\dfrac{${kN(F)} \\times ${m(b)} \\times (${m(L)}^2 - ${m(b)}^2)^{3/2}}{9\\sqrt{3} \\times ${ei} \\times ${m(L)}}`,
          value: (F * b * (L ** 2 - b ** 2) ** 1.5) / (9 * Math.sqrt(3) * E * L),
        },
      );
    }
    if (isFullUniform(load, L, eps)) {
      const q = Math.abs(load.q1_N_m);
      return make(
        'Deux appuis, charge uniforme',
        {
          latex: 'M_{max} = \\dfrac{q\\,L^2}{8}',
          app: `\\dfrac{${kN(q)} \\times ${m(L)}^2}{8}`,
          value: (q * L ** 2) / 8,
        },
        {
          latex: '\\delta_{max} = \\dfrac{5\\,q\\,L^4}{384\\,EI}',
          app: `\\dfrac{5 \\times ${kN(q)} \\times ${m(L)}^4}{384 \\times ${ei}}`,
          value: (5 * q * L ** 4) / (384 * E),
        },
      );
    }
  }
  return null;
}

function isFullUniform(
  load: BeamModel['loads'][number],
  L: number,
  eps: number,
): load is Extract<BeamModel['loads'][number], { kind: 'repartie' }> {
  return (
    load.kind === 'repartie' &&
    Math.abs(load.x1_m) <= eps &&
    Math.abs(load.x2_m - L) <= eps &&
    load.q1_N_m === load.q2_N_m
  );
}
