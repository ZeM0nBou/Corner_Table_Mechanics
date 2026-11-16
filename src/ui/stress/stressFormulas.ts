/**
 * Formules (LaTeX) de la page Contraintes, avec application numérique.
 *
 * Présentation seulement : la valeur qui termine chaque application numérique vient du
 * moteur (`@core/stress`), jamais d'un recalcul ici. Unités de l'application numérique :
 * N, N·mm, mm, mm², mm³, mm⁴ et MPa (1 MPa = 1 N/mm²).
 */
import type { SectionInput, SectionResult } from '@core/sections';
import {
  COMBINED_SOURCES,
  rectangleTorsionFactor,
  STRESS_SOURCES,
  type CombinedStresses,
  type PointStress,
  type SectionEfforts,
} from '@core/stress';
import type { CheckFormula } from '@ui/beams/beamCheckFormulas';
import { tex } from '@ui/sections/sectionFormulas';

export type StressKey =
  | 'sigmaN'
  | 'traction'
  | 'compression'
  | 'tauV'
  | 'tauT'
  | 'tau'
  | 'vonMises'
  | 'tresca'
  | 'sigma1';

const MPa = (v_Pa: number) => `${tex(v_Pa / 1e6)}\\text{ MPa}`;
const N = (v_N: number) => `${tex(v_N)}\\text{ N}`;
const Nmm = (v_Nm: number) => `${tex(v_Nm * 1e3)}\\text{ N·mm}`;
const mm = (v_m: number) => `${tex(v_m * 1e3)}\\text{ mm}`;
const mm2 = (v_m2: number) => `${tex(v_m2 * 1e6)}\\text{ mm}^2`;
const mm3 = (v_m3: number) => `${tex(v_m3 * 1e9)}\\text{ mm}^3`;
const mm4 = (v_m4: number) => `${tex(v_m4 * 1e12)}\\text{ mm}^4`;
/** Valeur entre parenthèses si elle est négative (lisibilité des produits). */
const par = (s: string, v: number) => (v < 0 ? `(${s})` : s);

function normalFormula(
  p: PointStress,
  s: CombinedStresses,
  section: SectionResult,
  e: SectionEfforts,
): CheckFormula {
  const nA = `\\dfrac{${N(e.N_N)}}{${mm2(section.A_m2)}}`;
  if (!s.unsymmetric) {
    return {
      latex: '\\sigma = \\dfrac{N}{A} - \\dfrac{M_y\\, z}{I_y}',
      application: `= ${nA} - \\dfrac{${par(Nmm(e.My_Nm), e.My_Nm)} \\times ${par(mm(p.z_m), p.z_m)}}{${mm4(section.Iy_m4)}} = ${MPa(p.sigma_Pa)}`,
      source: `${STRESS_SOURCES.navier} ${COMBINED_SOURCES.normal}`,
    };
  }
  return {
    latex: '\\sigma = \\dfrac{N}{A} + \\dfrac{M_y\\,(I_{yz}\\, y - I_z\\, z)}{I_y I_z - I_{yz}^2}',
    application: `= ${nA} + \\dfrac{${par(Nmm(e.My_Nm), e.My_Nm)} \\times (${mm4(section.Iyz_m4)} \\times ${par(mm(p.y_m), p.y_m)} - ${mm4(section.Iz_m4)} \\times ${par(mm(p.z_m), p.z_m)})}{${mm4(section.Iy_m4)} \\times ${mm4(section.Iz_m4)} - (${mm4(section.Iyz_m4)})^2} = ${MPa(p.sigma_Pa)}`,
    source: COMBINED_SOURCES.normal,
  };
}

function torsionFormula(
  input: SectionInput,
  section: SectionResult,
  s: CombinedStresses,
  T_Nm: number,
): CheckFormula {
  const tail = `\\qquad \\tau_T = \\dfrac{${Nmm(Math.abs(T_Nm))}}{${mm3(s.torsion.Wt_m3)}} = ${MPa(s.tauT_Pa)}`;
  const Wt = mm3(s.torsion.Wt_m3);
  switch (s.torsion.method) {
    case 'circulaire': {
      const r = input.shape === 'rond' || input.shape === 'tube' ? input.d_m / 2 : NaN;
      return {
        latex: '\\tau_T = \\dfrac{|T|\\, r}{J} = \\dfrac{|T|}{W_t}, \\quad W_t = \\dfrac{J}{D/2}',
        application: `W_t = \\dfrac{${mm4(section.J_m4)}}{${mm(r)}} = ${Wt}${tail}`,
        source: COMBINED_SOURCES.torsionRound,
      };
    }
    case 'rectanglePlein': {
      const [a, b] =
        input.shape === 'rectangle'
          ? [Math.max(input.b_m, input.h_m) / 2, Math.min(input.b_m, input.h_m) / 2]
          : [NaN, NaN];
      return {
        latex:
          '\\tau_T = \\dfrac{3\\,|T|}{8\\,a\\,b^2}\\, k\\!\\left(\\tfrac{b}{a}\\right) = \\dfrac{|T|}{W_t}, \\quad a \\ge b \\text{ demi-côtés}',
        application: `k = ${tex(rectangleTorsionFactor(b / a))} \\qquad W_t = \\dfrac{8 \\times ${mm(a)} \\times (${mm(b)})^2}{3 \\times ${tex(rectangleTorsionFactor(b / a))}} = ${Wt}${tail}`,
        source: COMBINED_SOURCES.torsionRect,
      };
    }
    case 'bredt':
      return {
        latex: '\\tau_T = \\dfrac{|T|}{2\\, A_m\\, t}, \\quad A_m = (b - t)(h - t)',
        application: `W_t = 2 \\times ${mm2(s.torsion.Am_m2 ?? NaN)} \\times ${mm(s.torsion.t_m ?? NaN)} = ${Wt}${tail}`,
        source: COMBINED_SOURCES.torsionBredt,
      };
    case 'paroiMinceOuverte':
      return {
        latex: '\\tau_T = \\dfrac{|T|\\, t_{max}}{J}',
        application: `W_t = \\dfrac{${mm4(section.J_m4)}}{${mm(s.torsion.t_m ?? NaN)}} = ${Wt}${tail}`,
        source: COMBINED_SOURCES.torsionOpen,
      };
  }
}

/** Formules de toutes les grandeurs calculées par `combinedStresses`. */
export function stressFormulas(
  input: SectionInput,
  section: SectionResult,
  efforts: SectionEfforts,
  s: CombinedStresses,
): Partial<Record<StressKey, CheckFormula>> {
  const sig = MPa(s.sigmaAbsMax_Pa);
  const tau = MPa(s.tau_Pa);
  const f: Partial<Record<StressKey, CheckFormula>> = {
    sigmaN: {
      latex: '\\sigma_N = \\dfrac{N}{A}',
      application: `= \\dfrac{${N(efforts.N_N)}}{${mm2(section.A_m2)}} = ${MPa(s.sigmaN_Pa)}`,
      source: COMBINED_SOURCES.normal,
    },
    traction: normalFormula(s.tension, s, section, efforts),
    compression: normalFormula(s.compression, s, section, efforts),
    tauT: torsionFormula(input, section, s, efforts.T_Nm),
    tau: {
      latex: '\\tau = \\tau_V + \\tau_T \\quad \\text{(majorant)}',
      application: `= ${MPa(s.tauV_Pa ?? 0)} + ${MPa(s.tauT_Pa)} = ${tau}`,
      source:
        'Majorant : les maxima de τ dus à l’effort tranchant et à la torsion sont additionnés, même s’ils ne sont pas atteints au même point.',
    },
    vonMises: {
      latex: '\\sigma_{VM} = \\sqrt{\\sigma^2 + 3\\,\\tau^2}, \\quad \\sigma = |\\sigma|_{max}',
      application: `= \\sqrt{(${sig})^2 + 3 \\times (${tau})^2} = ${MPa(s.vonMises_Pa)}`,
      source: STRESS_SOURCES.vonMises,
    },
    tresca: {
      latex: '\\sigma_{T} = \\sqrt{\\sigma^2 + 4\\,\\tau^2}, \\quad \\sigma = |\\sigma|_{max}',
      application: `= \\sqrt{(${sig})^2 + 4 \\times (${tau})^2} = ${MPa(s.tresca_Pa)}`,
      source: STRESS_SOURCES.tresca,
    },
    sigma1: {
      latex:
        '\\sigma_1 = \\dfrac{\\sigma_t}{2} + \\sqrt{\\left(\\dfrac{\\sigma_t}{2}\\right)^2 + \\tau^2}',
      application: `= \\dfrac{${MPa(s.tension.sigma_Pa)}}{2} + \\sqrt{\\left(\\dfrac{${MPa(s.tension.sigma_Pa)}}{2}\\right)^2 + (${tau})^2} = ${MPa(s.sigma1_Pa)}`,
      source: STRESS_SOURCES.rankine,
    },
  };
  if (s.tauV_Pa !== undefined && section.Av_z_m2 !== undefined) {
    f.tauV = {
      latex: '\\tau_V = \\dfrac{|V_z|}{A_{v,z}}',
      application: `= \\dfrac{${N(Math.abs(efforts.Vz_N))}}{${mm2(section.Av_z_m2)}} = ${MPa(s.tauV_Pa)}`,
      source: STRESS_SOURCES.shear,
    };
  }
  return f;
}
