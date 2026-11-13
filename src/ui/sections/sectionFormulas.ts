/**
 * Formules (LaTeX) et applications numériques des résultats de section.
 *
 * Présentation seulement : les valeurs affichées en fin d'application numérique
 * viennent du moteur (`computeSection`), jamais d'un recalcul ici. Les termes
 * intermédiaires sont les cotes saisies et les rectangles de la décomposition.
 * Application numérique en millimètres (mm, mm², mm³, mm⁴).
 */
import { linearMass_kg_m, type SectionResult, type SectionShape } from '@core/sections';

export type ResultKey =
  | 'A'
  | 'm'
  | 'yG'
  | 'zG'
  | 'Iy'
  | 'Iz'
  | 'Wely'
  | 'Welz'
  | 'Wply'
  | 'Wplz'
  | 'iy'
  | 'iz'
  | 'Iyz'
  | 'Iu'
  | 'Iv'
  | 'alpha'
  | 'iv'
  | 'J'
  | 'Avz'
  | 'Avy';

export interface ResultFormula {
  /** Formule littérale (LaTeX). */
  latex: string;
  /** Application numérique (LaTeX), terminée par le résultat. */
  application: string;
}

const NF = new Intl.NumberFormat('fr-FR', { maximumSignificantDigits: 4 });

/** Nombre au format LaTeX français : virgule décimale, puissance de 10 au-delà de 10⁶. */
export function tex(x: number): string {
  if (!Number.isFinite(x)) return '\\text{—}';
  const abs = Math.abs(x);
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-3)) {
    const e = Math.floor(Math.log10(abs));
    const m = x / 10 ** e;
    return `${tex(Number(m.toPrecision(4)))} \\times 10^{${e}}`;
  }
  // Ordre important : la virgule décimale d’abord, sinon le « , » de « \, » serait remplacé.
  return NF.format(x).replace(',', '{,}').replace(/\s/g, '\\,').replace(/−/g, '-');
}

const MM = 1e3;
/** Longueur (m) → mm ; une distance nulle au bruit d'arrondi près (< 1 nm) s'affiche 0. */
const L = (x: number) => tex(Math.abs(x) < 1e-9 ? 0 : x * MM);
const unit = (p: 1 | 2 | 3 | 4) => (p === 1 ? '\\text{ mm}' : `\\text{ mm}^{${p}}`);
/** Résultat final en mm^p. */
const R = (x: number, p: 1 | 2 | 3 | 4) => `${tex(x * MM ** p)}${unit(p)}`;

type Dims = Readonly<Record<string, number>>;

function radii(s: SectionResult): Partial<Record<ResultKey, ResultFormula>> {
  return {
    iy: {
      latex: 'i_y = \\sqrt{I_y / A}',
      application: `= \\sqrt{${tex(s.Iy_m4 * MM ** 4)} / ${tex(s.A_m2 * MM ** 2)}} = ${R(s.iy_m, 1)}`,
    },
    iz: {
      latex: 'i_z = \\sqrt{I_z / A}',
      application: `= \\sqrt{${tex(s.Iz_m4 * MM ** 4)} / ${tex(s.A_m2 * MM ** 2)}} = ${R(s.iz_m, 1)}`,
    },
  };
}

/** Formules par sommes sur les rectangles (profilés dissymétriques U, L, T). */
function composite(s: SectionResult): Partial<Record<ResultKey, ResultFormula>> {
  if (s.geometry.kind !== 'rects') return {};
  const rs = s.geometry.rects.map((r) => {
    const b = r.y1 - r.y0;
    const h = r.z1 - r.z0;
    return { b, h, A: b * h, y: (r.y0 + r.y1) / 2, z: (r.z0 + r.z1) / 2 };
  });
  const sum = (f: (r: (typeof rs)[number]) => string) => rs.map(f).join(' + ');
  const H = s.height_m;
  const W = s.width_m;
  return {
    A: {
      latex: 'A = \\sum A_i = \\sum b_i\\,h_i',
      application: `= ${sum((r) => `${L(r.b)} \\times ${L(r.h)}`)} = ${R(s.A_m2, 2)}`,
    },
    yG: {
      latex: 'y_G = \\dfrac{\\sum A_i\\,y_i}{A}',
      application: `= \\dfrac{${sum((r) => `${tex(r.A * MM ** 2)} \\times ${L(r.y)}`)}}{${tex(s.A_m2 * MM ** 2)}} = ${R(s.yG_m, 1)}`,
    },
    zG: {
      latex: 'z_G = \\dfrac{\\sum A_i\\,z_i}{A}',
      application: `= \\dfrac{${sum((r) => `${tex(r.A * MM ** 2)} \\times ${L(r.z)}`)}}{${tex(s.A_m2 * MM ** 2)}} = ${R(s.zG_m, 1)}`,
    },
    Iy: {
      latex: 'I_y = \\sum \\left( \\dfrac{b_i h_i^3}{12} + A_i\\,(z_i - z_G)^2 \\right)',
      application: `= ${sum((r) => `\\left(\\tfrac{${L(r.b)} \\times ${L(r.h)}^3}{12} + ${tex(r.A * MM ** 2)} \\times (${L(r.z - s.zG_m)})^2\\right)`)} = ${R(s.Iy_m4, 4)}`,
    },
    Iz: {
      latex: 'I_z = \\sum \\left( \\dfrac{h_i b_i^3}{12} + A_i\\,(y_i - y_G)^2 \\right)',
      application: `= ${sum((r) => `\\left(\\tfrac{${L(r.h)} \\times ${L(r.b)}^3}{12} + ${tex(r.A * MM ** 2)} \\times (${L(r.y - s.yG_m)})^2\\right)`)} = ${R(s.Iz_m4, 4)}`,
    },
    Wely: {
      latex: 'W_{el,y} = \\dfrac{I_y}{\\max(z_G\\,;\\,h - z_G)}',
      application: `= \\dfrac{${tex(s.Iy_m4 * MM ** 4)}}{\\max(${L(s.zG_m)}\\,;\\,${L(H - s.zG_m)})} = ${R(s.Wel_y_m3, 3)}`,
    },
    Welz: {
      latex: 'W_{el,z} = \\dfrac{I_z}{\\max(y_G\\,;\\,b - y_G)}',
      application: `= \\dfrac{${tex(s.Iz_m4 * MM ** 4)}}{\\max(${L(s.yG_m)}\\,;\\,${L(W - s.yG_m)})} = ${R(s.Wel_z_m3, 3)}`,
    },
    Wply: {
      latex: 'W_{pl,y} = \\int |z - z_{pl}|\\,dA, \\quad A(z < z_{pl}) = A/2',
      application: `z_{pl} = ${R(s.zPl_m, 1)} \\;\\Rightarrow\\; W_{pl,y} = ${R(s.Wpl_y_m3, 3)}`,
    },
    Wplz: {
      latex: 'W_{pl,z} = \\int |y - y_{pl}|\\,dA, \\quad A(y < y_{pl}) = A/2',
      application: `y_{pl} = ${R(s.yPl_m, 1)} \\;\\Rightarrow\\; W_{pl,z} = ${R(s.Wpl_z_m3, 3)}`,
    },
    Iyz: {
      latex: 'I_{yz} = \\sum A_i\\,(y_i - y_G)(z_i - z_G)',
      application: `= ${sum((r) => `${tex(r.A * MM ** 2)} \\times (${L(r.y - s.yG_m)}) \\times (${L(r.z - s.zG_m)})`)} = ${R(s.Iyz_m4, 4)}`,
    },
  };
}

function principal(s: SectionResult): Partial<Record<ResultKey, ResultFormula>> {
  const mean = `\\tfrac{${tex(s.Iy_m4 * MM ** 4)} + ${tex(s.Iz_m4 * MM ** 4)}}{2}`;
  const rad = `\\sqrt{\\left(\\tfrac{${tex(s.Iy_m4 * MM ** 4)} - ${tex(s.Iz_m4 * MM ** 4)}}{2}\\right)^2 + (${tex(s.Iyz_m4 * MM ** 4)})^2}`;
  return {
    Iu: {
      latex:
        'I_u = \\dfrac{I_y + I_z}{2} + \\sqrt{\\left(\\dfrac{I_y - I_z}{2}\\right)^2 + I_{yz}^2}',
      application: `= ${mean} + ${rad} = ${R(s.principal.Iu_m4, 4)}`,
    },
    Iv: {
      latex:
        'I_v = \\dfrac{I_y + I_z}{2} - \\sqrt{\\left(\\dfrac{I_y - I_z}{2}\\right)^2 + I_{yz}^2}',
      application: `= ${mean} - ${rad} = ${R(s.principal.Iv_m4, 4)}`,
    },
    alpha: {
      latex: '\\alpha = \\tfrac{1}{2}\\,\\operatorname{atan2}(-2 I_{yz},\\; I_y - I_z)',
      application: `= \\tfrac{1}{2}\\,\\operatorname{atan2}(${tex(-2 * s.Iyz_m4 * MM ** 4)},\\; ${tex((s.Iy_m4 - s.Iz_m4) * MM ** 4)}) = ${tex((s.principal.alpha_rad * 180) / Math.PI)}^\\circ`,
    },
    iv: {
      latex: 'i_v = \\sqrt{I_v / A}',
      application: `= \\sqrt{${tex(s.principal.Iv_m4 * MM ** 4)} / ${tex(s.A_m2 * MM ** 2)}} = ${R(s.principal.iv_m, 1)}`,
    },
  };
}

/**
 * Formules et applications numériques de chaque résultat.
 * @param rho masse volumique (kg/m³) si un matériau est choisi (masse linéique).
 */
export function resultFormulas(
  shape: SectionShape,
  d: Dims,
  s: SectionResult,
  rho?: number,
): Partial<Record<ResultKey, ResultFormula>> {
  const b = L(d.b_m ?? NaN);
  const h = L(d.h_m ?? NaN);
  const t = L(d.t_m ?? NaN);
  const tw = L(d.tw_m ?? NaN);
  const tf = L(d.tf_m ?? NaN);
  const A = tex(s.A_m2 * MM ** 2);
  const out: Partial<Record<ResultKey, ResultFormula>> = { ...radii(s) };

  const half = (key: 'yG' | 'zG', sym: string, v: string, value: number) =>
    (out[key] = {
      latex: `${key === 'yG' ? 'y_G' : 'z_G'} = ${sym}/2`,
      application: `= ${v}/2 = ${R(value, 1)}`,
    });

  switch (shape) {
    case 'rectangle':
      Object.assign(out, {
        A: { latex: 'A = b\\,h', application: `= ${b} \\times ${h} = ${R(s.A_m2, 2)}` },
        Iy: {
          latex: 'I_y = \\dfrac{b\\,h^3}{12}',
          application: `= \\dfrac{${b} \\times ${h}^3}{12} = ${R(s.Iy_m4, 4)}`,
        },
        Iz: {
          latex: 'I_z = \\dfrac{h\\,b^3}{12}',
          application: `= \\dfrac{${h} \\times ${b}^3}{12} = ${R(s.Iz_m4, 4)}`,
        },
        Wely: {
          latex: 'W_{el,y} = \\dfrac{b\\,h^2}{6}',
          application: `= \\dfrac{${b} \\times ${h}^2}{6} = ${R(s.Wel_y_m3, 3)}`,
        },
        Welz: {
          latex: 'W_{el,z} = \\dfrac{h\\,b^2}{6}',
          application: `= \\dfrac{${h} \\times ${b}^2}{6} = ${R(s.Wel_z_m3, 3)}`,
        },
        Wply: {
          latex: 'W_{pl,y} = \\dfrac{b\\,h^2}{4}',
          application: `= \\dfrac{${b} \\times ${h}^2}{4} = ${R(s.Wpl_y_m3, 3)}`,
        },
        Wplz: {
          latex: 'W_{pl,z} = \\dfrac{h\\,b^2}{4}',
          application: `= \\dfrac{${h} \\times ${b}^2}{4} = ${R(s.Wpl_z_m3, 3)}`,
        },
        J: {
          latex:
            'J = a\\,c^3 \\left[\\dfrac{16}{3} - 3{,}36\\,\\dfrac{c}{a}\\left(1 - \\dfrac{c^4}{12\\,a^4}\\right)\\right],\\; a = \\tfrac{\\max(b,h)}{2},\\; c = \\tfrac{\\min(b,h)}{2}',
          application: (() => {
            const a = L(Math.max(d.b_m ?? 0, d.h_m ?? 0) / 2);
            const c = L(Math.min(d.b_m ?? 0, d.h_m ?? 0) / 2);
            return `= ${a} \\times ${c}^3 \\left[\\tfrac{16}{3} - 3{,}36 \\times \\tfrac{${c}}{${a}}\\left(1 - \\tfrac{${c}^4}{12 \\times ${a}^4}\\right)\\right] = ${R(s.J_m4, 4)}`;
          })(),
        },
        Avz: { latex: 'A_{v,z} = A', application: `= ${R(s.A_m2, 2)}` },
        Avy: { latex: 'A_{v,y} = A', application: `= ${R(s.A_m2, 2)}` },
      });
      half('yG', 'b', b, s.yG_m);
      half('zG', 'h', h, s.zG_m);
      break;

    case 'rectangleCreux': {
      const bi = `(${b} - 2 \\times ${t})`;
      const hi = `(${h} - 2 \\times ${t})`;
      Object.assign(out, {
        A: {
          latex: 'A = b\\,h - (b - 2t)(h - 2t)',
          application: `= ${b} \\times ${h} - ${bi} \\times ${hi} = ${R(s.A_m2, 2)}`,
        },
        Iy: {
          latex: 'I_y = \\dfrac{b\\,h^3 - (b - 2t)(h - 2t)^3}{12}',
          application: `= \\dfrac{${b} \\times ${h}^3 - ${bi} \\times ${hi}^3}{12} = ${R(s.Iy_m4, 4)}`,
        },
        Iz: {
          latex: 'I_z = \\dfrac{h\\,b^3 - (h - 2t)(b - 2t)^3}{12}',
          application: `= \\dfrac{${h} \\times ${b}^3 - ${hi} \\times ${bi}^3}{12} = ${R(s.Iz_m4, 4)}`,
        },
        Wely: {
          latex: 'W_{el,y} = \\dfrac{2\\,I_y}{h}',
          application: `= \\dfrac{2 \\times ${tex(s.Iy_m4 * MM ** 4)}}{${h}} = ${R(s.Wel_y_m3, 3)}`,
        },
        Welz: {
          latex: 'W_{el,z} = \\dfrac{2\\,I_z}{b}',
          application: `= \\dfrac{2 \\times ${tex(s.Iz_m4 * MM ** 4)}}{${b}} = ${R(s.Wel_z_m3, 3)}`,
        },
        Wply: {
          latex: 'W_{pl,y} = \\dfrac{b\\,h^2 - (b - 2t)(h - 2t)^2}{4}',
          application: `= \\dfrac{${b} \\times ${h}^2 - ${bi} \\times ${hi}^2}{4} = ${R(s.Wpl_y_m3, 3)}`,
        },
        Wplz: {
          latex: 'W_{pl,z} = \\dfrac{h\\,b^2 - (h - 2t)(b - 2t)^2}{4}',
          application: `= \\dfrac{${h} \\times ${b}^2 - ${hi} \\times ${bi}^2}{4} = ${R(s.Wpl_z_m3, 3)}`,
        },
        J: {
          latex:
            'J = \\dfrac{4\\,A_m^2\\,t}{p_m},\\; A_m = (b - t)(h - t),\\; p_m = 2\\,(b + h - 2t)',
          application: `= \\dfrac{4 \\times [(${b} - ${t})(${h} - ${t})]^2 \\times ${t}}{2 \\times (${b} + ${h} - 2 \\times ${t})} = ${R(s.J_m4, 4)}`,
        },
        Avz: {
          latex: 'A_{v,z} = \\dfrac{A\\,h}{b + h}',
          application: `= \\dfrac{${A} \\times ${h}}{${b} + ${h}} = ${R(s.Av_z_m2 ?? NaN, 2)}`,
        },
        Avy: {
          latex: 'A_{v,y} = \\dfrac{A\\,b}{b + h}',
          application: `= \\dfrac{${A} \\times ${b}}{${b} + ${h}} = ${R(s.Av_y_m2 ?? NaN, 2)}`,
        },
      });
      half('yG', 'b', b, s.yG_m);
      half('zG', 'h', h, s.zG_m);
      break;
    }

    case 'rond':
    case 'tube': {
      const D = L(d.d_m ?? NaN);
      const tube = shape === 'tube';
      const di = tube ? `(${D} - 2 \\times ${t})` : '';
      const pow = (p: number) => (tube ? `(${D}^${p} - ${di}^${p})` : `${D}^${p}`);
      const sym = (p: number) => (tube ? `(D^${p} - d^${p})` : `D^${p}`);
      const I = {
        latex: `I_y = I_z = \\dfrac{\\pi\\,${sym(4)}}{64}`,
        application: `= \\dfrac{\\pi \\times ${pow(4)}}{64} = ${R(s.Iy_m4, 4)}`,
      };
      const Wel = {
        latex: 'W_{el} = \\dfrac{2\\,I}{D}',
        application: `= \\dfrac{2 \\times ${tex(s.Iy_m4 * MM ** 4)}}{${D}} = ${R(s.Wel_y_m3, 3)}`,
      };
      const Wpl = {
        latex: `W_{pl} = \\dfrac{${sym(3)}}{6}`,
        application: `= \\dfrac{${pow(3)}}{6} = ${R(s.Wpl_y_m3, 3)}`,
      };
      const Av = tube
        ? {
            latex: 'A_v = \\dfrac{2\\,A}{\\pi}',
            application: `= \\dfrac{2 \\times ${A}}{\\pi} = ${R(s.Av_z_m2 ?? NaN, 2)}`,
          }
        : { latex: 'A_v = A', application: `= ${R(s.A_m2, 2)}` };
      Object.assign(out, {
        A: {
          latex: `A = \\dfrac{\\pi\\,${sym(2)}}{4}`,
          application: `= \\dfrac{\\pi \\times ${pow(2)}}{4} = ${R(s.A_m2, 2)}`,
        },
        Iy: I,
        Iz: I,
        Wely: Wel,
        Welz: Wel,
        Wply: Wpl,
        Wplz: Wpl,
        J: {
          latex: `J = \\dfrac{\\pi\\,${sym(4)}}{32}`,
          application: `= \\dfrac{\\pi \\times ${pow(4)}}{32} = ${R(s.J_m4, 4)}`,
        },
        Avz: Av,
        Avy: Av,
      });
      half('yG', 'D', D, s.yG_m);
      half('zG', 'D', D, s.zG_m);
      break;
    }

    case 'I': {
      const hw = `(${h} - 2 \\times ${tf})`;
      Object.assign(out, {
        A: {
          latex: 'A = 2\\,b\\,t_f + (h - 2t_f)\\,t_w',
          application: `= 2 \\times ${b} \\times ${tf} + ${hw} \\times ${tw} = ${R(s.A_m2, 2)}`,
        },
        Iy: {
          latex: 'I_y = \\dfrac{b\\,h^3 - (b - t_w)(h - 2t_f)^3}{12}',
          application: `= \\dfrac{${b} \\times ${h}^3 - (${b} - ${tw}) \\times ${hw}^3}{12} = ${R(s.Iy_m4, 4)}`,
        },
        Iz: {
          latex: 'I_z = \\dfrac{2\\,t_f\\,b^3 + (h - 2t_f)\\,t_w^3}{12}',
          application: `= \\dfrac{2 \\times ${tf} \\times ${b}^3 + ${hw} \\times ${tw}^3}{12} = ${R(s.Iz_m4, 4)}`,
        },
        Wely: {
          latex: 'W_{el,y} = \\dfrac{2\\,I_y}{h}',
          application: `= \\dfrac{2 \\times ${tex(s.Iy_m4 * MM ** 4)}}{${h}} = ${R(s.Wel_y_m3, 3)}`,
        },
        Welz: {
          latex: 'W_{el,z} = \\dfrac{2\\,I_z}{b}',
          application: `= \\dfrac{2 \\times ${tex(s.Iz_m4 * MM ** 4)}}{${b}} = ${R(s.Wel_z_m3, 3)}`,
        },
        Wply: {
          latex: 'W_{pl,y} = b\\,t_f\\,(h - t_f) + \\dfrac{t_w\\,(h - 2t_f)^2}{4}',
          application: `= ${b} \\times ${tf} \\times (${h} - ${tf}) + \\dfrac{${tw} \\times ${hw}^2}{4} = ${R(s.Wpl_y_m3, 3)}`,
        },
        Wplz: {
          latex: 'W_{pl,z} = \\dfrac{t_f\\,b^2}{2} + \\dfrac{(h - 2t_f)\\,t_w^2}{4}',
          application: `= \\dfrac{${tf} \\times ${b}^2}{2} + \\dfrac{${hw} \\times ${tw}^2}{4} = ${R(s.Wpl_z_m3, 3)}`,
        },
        J: {
          latex: 'J \\approx \\dfrac{2\\,b\\,t_f^3 + (h - 2t_f)\\,t_w^3}{3}',
          application: `= \\dfrac{2 \\times ${b} \\times ${tf}^3 + ${hw} \\times ${tw}^3}{3} = ${R(s.J_m4, 4)}`,
        },
        Avz: {
          latex: 'A_{v,z} = \\max\\left(A - 2\\,b\\,t_f + t_w\\,t_f\\;;\\; h_w\\,t_w\\right)',
          application: `= \\max(${A} - 2 \\times ${b} \\times ${tf} + ${tw} \\times ${tf}\\;;\\; ${hw} \\times ${tw}) = ${R(s.Av_z_m2 ?? NaN, 2)}`,
        },
        Avy: {
          latex: 'A_{v,y} = A - h_w\\,t_w',
          application: `= ${A} - ${hw} \\times ${tw} = ${R(s.Av_y_m2 ?? NaN, 2)}`,
        },
      });
      half('yG', 'b', b, s.yG_m);
      half('zG', 'h', h, s.zG_m);
      break;
    }

    case 'U':
    case 'L':
    case 'T': {
      Object.assign(out, composite(s));
      if (shape === 'L') {
        Object.assign(out, principal(s), {
          J: {
            latex: 'J \\approx \\dfrac{(b + h - t)\\,t^3}{3}',
            application: `= \\dfrac{(${b} + ${h} - ${t}) \\times ${t}^3}{3} = ${R(s.J_m4, 4)}`,
          },
        });
      } else if (shape === 'U') {
        const hw = `(${h} - 2 \\times ${tf})`;
        Object.assign(out, {
          J: {
            latex: 'J \\approx \\dfrac{2\\,b\\,t_f^3 + (h - 2t_f)\\,t_w^3}{3}',
            application: `= \\dfrac{2 \\times ${b} \\times ${tf}^3 + ${hw} \\times ${tw}^3}{3} = ${R(s.J_m4, 4)}`,
          },
          Avz: {
            latex: 'A_{v,z} = A - 2\\,b\\,t_f + t_w\\,t_f',
            application: `= ${A} - 2 \\times ${b} \\times ${tf} + ${tw} \\times ${tf} = ${R(s.Av_z_m2 ?? NaN, 2)}`,
          },
          Avy: {
            latex: 'A_{v,y} = A - h_w\\,t_w',
            application: `= ${A} - ${hw} \\times ${tw} = ${R(s.Av_y_m2 ?? NaN, 2)}`,
          },
        });
      } else {
        Object.assign(out, {
          J: {
            latex: 'J \\approx \\dfrac{b\\,t_f^3 + (h - t_f)\\,t_w^3}{3}',
            application: `= \\dfrac{${b} \\times ${tf}^3 + (${h} - ${tf}) \\times ${tw}^3}{3} = ${R(s.J_m4, 4)}`,
          },
          Avz: {
            latex: 'A_{v,z} = A - b\\,t_f + \\dfrac{t_w\\,t_f}{2}',
            application: `= ${A} - ${b} \\times ${tf} + \\dfrac{${tw} \\times ${tf}}{2} = ${R(s.Av_z_m2 ?? NaN, 2)}`,
          },
        });
      }
      break;
    }
  }

  if (rho !== undefined) {
    out.m = {
      latex: "m' = \\rho\\,A",
      application: `= ${tex(rho)}\\text{ kg/m}^3 \\times ${tex(s.A_m2)}\\text{ m}^2 = ${tex(linearMass_kg_m(s.A_m2, rho))}\\text{ kg/m}`,
    };
  }
  return out;
}
