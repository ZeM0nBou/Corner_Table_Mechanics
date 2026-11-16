/**
 * Formules (LaTeX) de la vérification d'une poutre, avec application numérique.
 *
 * Présentation seulement : la valeur qui termine chaque application numérique vient du
 * moteur (`@core/stress`), jamais d'un recalcul ici. Unités de l'application numérique :
 * N·mm, N, mm, mm², mm⁴ et MPa (1 MPa = 1 N/mm²).
 */
import {
  STRESS_SOURCES,
  type BeamStresses,
  type DeflectionCheck,
  type FibreStress,
  type StrengthCheck,
} from '@core/stress';
import { tex } from '@ui/sections/sectionFormulas';

export interface CheckFormula {
  latex: string;
  application: string;
  source: string;
}

export type CheckKey = 'traction' | 'compression' | 'tau' | 'equivalent' | 'n' | 'deflection';

const MPa = (v_Pa: number) => `${tex(v_Pa / 1e6)}\\text{ MPa}`;
const Nmm = (M_Nm: number) => `${tex(Math.abs(M_Nm) * 1e3)}\\text{ N·mm}`;
const mm = (v_m: number) => `${tex(Math.abs(v_m) * 1e3)}\\text{ mm}`;
const mm4 = (v_m4: number) => `${tex(v_m4 * 1e12)}\\text{ mm}^4`;
const mm2 = (v_m2: number) => `${tex(v_m2 * 1e6)}\\text{ mm}^2`;

function navier(s: FibreStress, Iy_m4: number): CheckFormula {
  return {
    latex: '|\\sigma| = \\dfrac{|M| \\cdot |z|}{I_y}',
    application: `= \\dfrac{${Nmm(s.M_Nm)} \\times ${mm(s.z_m)}}{${mm4(Iy_m4)}} = ${MPa(Math.abs(s.sigma_Pa))}`,
    source: STRESS_SOURCES.navier,
  };
}

/**
 * Formules de la vérification de résistance (et de flèche si `deflection` est fourni).
 * `Av_m2` est l'aire de cisaillement utilisée (absente : pas de formule pour τ).
 */
export function checkFormulas(
  stresses: BeamStresses,
  check: StrengthCheck,
  Iy_m4: number,
  Av_m2: number | undefined,
  deflection?: { result: DeflectionCheck; length_m: number; limit: number },
): Partial<Record<CheckKey, CheckFormula>> {
  const f: Partial<Record<CheckKey, CheckFormula>> = {
    traction: navier(stresses.tension, Iy_m4),
    compression: navier(stresses.compression, Iy_m4),
  };
  if (stresses.shear && Av_m2 !== undefined) {
    f.tau = {
      latex: '\\tau = \\dfrac{|V|_{max}}{A_{v}}',
      application: `= \\dfrac{${tex(Math.abs(stresses.shear.V_N))}\\text{ N}}{${mm2(Av_m2)}} = ${MPa(stresses.shear.tau_Pa)}`,
      source: STRESS_SOURCES.shear,
    };
  }
  const s = MPa(check.sigma_Pa);
  const t = MPa(check.tau_Pa);
  f.equivalent =
    check.criterion === 'vonMises'
      ? {
          latex: '\\sigma_{eq} = \\sqrt{\\sigma^2 + 3\\,\\tau^2}',
          application: `= \\sqrt{(${s})^2 + 3 \\times (${t})^2} = ${MPa(check.equivalent_Pa)}`,
          source: STRESS_SOURCES.vonMises,
        }
      : {
          latex:
            '\\sigma_1 = \\dfrac{\\sigma}{2} + \\sqrt{\\left(\\dfrac{\\sigma}{2}\\right)^2 + \\tau^2}',
          application: `= \\dfrac{${s}}{2} + \\sqrt{\\left(\\dfrac{${s}}{2}\\right)^2 + (${t})^2} = ${MPa(check.equivalent_Pa)}`,
          source: STRESS_SOURCES.rankine,
        };
  const R = check.basis.kind === 'ductile' ? 'R_e' : 'R_m';
  const sym = check.criterion === 'vonMises' ? '\\sigma_{eq}' : '\\sigma_1';
  f.n = {
    latex: `n = \\dfrac{${R}}{${sym}}`,
    application: `= \\dfrac{${MPa(check.strength_Pa)}}{${MPa(check.equivalent_Pa)}} = ${Number.isFinite(check.safetyFactor) ? tex(check.safetyFactor) : '\\infty'}`,
    source: STRESS_SOURCES.safety,
  };
  if (deflection) {
    const { result, length_m, limit } = deflection;
    f.deflection = {
      latex:
        '\\delta_{adm} = \\dfrac{L}{\\text{limite}} \\qquad |\\delta|_{max} \\le \\delta_{adm}',
      application: `\\delta_{adm} = \\dfrac{${mm(length_m)}}{${tex(limit)}} = ${mm(result.allowable_m)} \\qquad |\\delta|_{max} = ${mm(result.deflection_m)}`,
      source:
        'Critère de service usuel : la limite est fixée par le projet (EN 1990 annexe A1.4 et annexes nationales). TODO: à vérifier — paragraphe exact.',
    };
  }
  return f;
}
