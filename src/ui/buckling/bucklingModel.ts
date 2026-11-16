/**
 * Préparation de la page Flambement pour l'UI (fonction pure, testable) : choix des plans
 * de flambement selon la section, appel du moteur `@core/buckling`, formules et remarques.
 *
 * Présentation seulement : la valeur qui termine chaque application numérique vient du
 * moteur, jamais d'un recalcul ici. Unités de l'application numérique : N, mm, mm², mm⁴, MPa.
 */
import {
  BUCKLING_SOURCES,
  BucklingInputError,
  bucklingCheck,
  type BucklingAxisInput,
  type BucklingAxisResult,
  type BucklingResult,
} from '@core/buckling';
import type { SectionResult } from '@core/sections';
import { verdict, type Verdict } from '@core/stress';
import type { CheckFormula } from '@ui/beams/beamCheckFormulas';
import { tex } from '@ui/sections/sectionFormulas';

export interface BucklingPageInput {
  section: SectionResult;
  length_m: number | undefined;
  E_Pa: number | undefined;
  Re_Pa: number | undefined;
  /** Coefficients K des deux plans : le premier pour y (ou u), le second pour z (ou v). */
  K: readonly [number | undefined, number | undefined];
  /** Effort de compression (> 0) ; `undefined` si vide (Ncr seul). */
  N_N: number | undefined;
  threshold: number | undefined;
}

export interface AxisFormulas {
  slenderness: CheckFormula;
  critical: CheckFormula;
}

export type BucklingEvaluation =
  | { kind: 'indisponible'; message: string }
  | {
      kind: 'ok';
      result: BucklingResult;
      /** Vrai si les plans sont les axes principaux u, v (section sans axe de symétrie). */
      principal: boolean;
      formulas: AxisFormulas[];
      safety: { formula: CheckFormula; verdict: Verdict } | undefined;
      notes: string[];
    };

const N = (v: number) => `${tex(v)}\\text{ N}`;
const mm = (v_m: number) => `${tex(v_m * 1e3)}\\text{ mm}`;
const mm2 = (v_m2: number) => `${tex(v_m2 * 1e6)}\\text{ mm}^2`;
const mm4 = (v_m4: number) => `${tex(v_m4 * 1e12)}\\text{ mm}^4`;
const MPa = (v_Pa: number) => `${tex(v_Pa / 1e6)}\\text{ MPa}`;

/**
 * Plans de flambement : autour de y et z si ce sont des axes principaux (Iyz = 0),
 * sinon autour des axes principaux u (inertie maximale) et v (inertie minimale).
 */
export function bucklingAxes(
  section: SectionResult,
  K: readonly [number, number],
): { axes: BucklingAxisInput[]; principal: boolean } {
  const principal = Math.abs(section.Iyz_m4) > 1e-9 * Math.sqrt(section.Iy_m4 * section.Iz_m4);
  return principal
    ? {
        principal,
        axes: [
          { axis: 'u', I_m4: section.principal.Iu_m4, K: K[0] },
          { axis: 'v', I_m4: section.principal.Iv_m4, K: K[1] },
        ],
      }
    : {
        principal,
        axes: [
          { axis: 'y', I_m4: section.Iy_m4, K: K[0] },
          { axis: 'z', I_m4: section.Iz_m4, K: K[1] },
        ],
      };
}

function axisFormulas(
  a: BucklingAxisResult,
  A_m2: number,
  L_m: number,
  E_Pa: number,
  Re_Pa: number | undefined,
): AxisFormulas {
  const slenderness: CheckFormula = {
    latex: '\\lambda = \\dfrac{L_k}{i} = \\dfrac{K\\,L}{\\sqrt{I/A}}',
    application: `L_k = ${tex(a.K)} \\times ${mm(L_m)} = ${mm(a.Lk_m)} \\qquad i = \\sqrt{\\dfrac{${mm4(a.I_m4)}}{${mm2(A_m2)}}} = ${mm(a.i_m)} \\qquad \\lambda = ${tex(a.slenderness)}`,
    source: `${BUCKLING_SOURCES.lengths} ${BUCKLING_SOURCES.slenderness}`,
  };
  const critical: CheckFormula =
    a.model === 'euler'
      ? {
          latex: 'N_{cr} = \\dfrac{\\pi^2 E I}{L_k^2}, \\quad \\sigma_{cr} = \\dfrac{N_{cr}}{A}',
          application: `N_{cr} = \\dfrac{\\pi^2 \\times ${MPa(E_Pa)} \\times ${mm4(a.I_m4)}}{(${mm(a.Lk_m)})^2} = ${N(a.Ncr_N)} \\qquad \\sigma_{cr} = ${MPa(a.sigmaCr_Pa)}`,
          source: BUCKLING_SOURCES.euler,
        }
      : {
          latex:
            '\\sigma_{cr} = R_e - \\dfrac{1}{E}\\left(\\dfrac{R_e\\,\\lambda}{2\\pi}\\right)^2, \\quad N_{cr} = \\sigma_{cr}\\, A',
          application: `\\sigma_{cr} = ${MPa(Re_Pa ?? NaN)} - \\dfrac{1}{${MPa(E_Pa)}}\\left(\\dfrac{${MPa(Re_Pa ?? NaN)} \\times ${tex(a.slenderness)}}{2\\pi}\\right)^2 = ${MPa(a.sigmaCr_Pa)} \\qquad N_{cr} = ${MPa(a.sigmaCr_Pa)} \\times ${mm2(A_m2)} = ${N(a.Ncr_N)}`,
          source: BUCKLING_SOURCES.johnson,
        };
  return { slenderness, critical };
}

const isPos = (v: number | undefined): v is number =>
  v !== undefined && Number.isFinite(v) && v > 0;

export function evaluateBuckling(p: BucklingPageInput): BucklingEvaluation {
  const { section, length_m: L, E_Pa: E, Re_Pa: Re, N_N: Nc, threshold } = p;
  if (!isPos(L)) return { kind: 'indisponible', message: 'La longueur doit être positive.' };
  if (!isPos(E)) {
    return { kind: 'indisponible', message: 'Choisissez un matériau ou saisissez E.' };
  }
  const [K1, K2] = p.K;
  if (!isPos(K1) || !isPos(K2)) {
    return { kind: 'indisponible', message: 'Les coefficients K doivent être positifs.' };
  }
  if (Nc !== undefined && (!Number.isFinite(Nc) || Nc < 0)) {
    return {
      kind: 'indisponible',
      message: 'L’effort de compression doit être un nombre positif ou nul.',
    };
  }
  try {
    const { axes, principal } = bucklingAxes(section, [K1, K2]);
    const result = bucklingCheck({
      length_m: L,
      A_m2: section.A_m2,
      E_Pa: E,
      Re_Pa: Re,
      axes,
      N_N: Nc,
    });
    const formulas = result.axes.map((a) => axisFormulas(a, section.A_m2, L, E, Re));

    let safety: { formula: CheckFormula; verdict: Verdict } | undefined;
    const n = result.safetyFactor;
    if (n !== undefined && Nc !== undefined && threshold !== undefined && threshold >= 1) {
      safety = {
        formula: {
          latex: 'n = \\dfrac{N_{cr,min}}{N}',
          application: `= \\dfrac{${N(result.governing.Ncr_N)}}{${N(Nc)}} = ${Number.isFinite(n) ? tex(n) : '\\infty'}`,
          source: BUCKLING_SOURCES.safety,
        },
        verdict: verdict(n, threshold),
      };
    }

    const notes: string[] = [];
    if (principal) {
      notes.push(
        'Section sans axe de symétrie : la barre flambe autour des axes principaux u (inertie maximale) et v (inertie minimale), inclinés par rapport à y et z.',
      );
    }
    if (Re === undefined) {
      notes.push(
        'Pas de limite élastique pour ce matériau : Euler seul, sans plafonnement de σcr pour les barres trapues. Vérifiez aussi l’écrasement N/A.',
      );
    }
    if (['L', 'T', 'U'].includes(section.shape)) {
      notes.push(
        'Profil mince ouvert : le flambement par torsion ou par flexion-torsion, non calculé ici, peut être plus défavorable que le flambement par flexion.',
      );
    }
    if (
      result.transitionSlenderness !== undefined &&
      result.governing.slenderness > 0.2 * result.transitionSlenderness &&
      result.governing.slenderness < 1.5 * result.transitionSlenderness
    ) {
      notes.push(
        'Élancement intermédiaire : les imperfections réelles (défaut de rectitude, excentricité, contraintes résiduelles) réduisent nettement la charge de ruine sous Ncr. Pour une structure en acier, la vérification de l’EN 1993-1-1 §6.3.1 (courbes de flambement) est à privilégier.',
      );
    }
    return { kind: 'ok', result, principal, formulas, safety, notes };
  } catch (e) {
    if (e instanceof BucklingInputError) return { kind: 'indisponible', message: e.message };
    throw e;
  }
}
