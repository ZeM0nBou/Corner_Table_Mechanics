/**
 * Tests du solveur de poutres (fonctions de singularité).
 *
 * Cas de référence : formules fermées des tables de poutres —
 * - Roark's Formulas for Stress and Strain, 8e éd., tableau 8.1 (cas 1 : force ponctuelle,
 *   2 : charge répartie, 3 : couple ; a : console, c : encastrée-appuyée, d : bi-encastrée,
 *   e : sur deux appuis). TODO: à vérifier — numérotation exacte des cas ;
 * - Gere & Goodno, Mechanics of Materials, annexe « Deflections and Slopes of Beams » ;
 * - AISC Steel Construction Manual, tableau 3-23 (« Shears, Moments and Deflections »).
 * Ces formules sont indépendantes de la méthode du solveur (Macaulay + système linéaire) :
 * l'accord à 1e-9 près vaut recoupement des deux.
 *
 * Conventions du moteur : forces et flèche positives vers le HAUT, couples positifs dans
 * le sens trigonométrique, M > 0 quand la fibre inférieure est tendue. Les charges de
 * gravité des tables sont donc saisies avec un signe négatif.
 */
import { describe, expect, it } from 'vitest';
import {
  BeamModelError,
  classifyBeam,
  combineSolutions,
  deflection_m,
  moment_Nm,
  shear_N,
  slope_rad,
  solveBeam,
  type BeamModel,
  type Load,
  type Support,
} from '@core/beams';
import { expectRelClose } from '../../helpers';

/** Tolérance relative : formules fermées contre solveur (quelques opérations flottantes). */
const TOL = 1e-9;

// Valeurs fictives : L = 2 m, E = 210 GPa, I = 1943 cm⁴ (ordre de grandeur d'un IPE 200).
const L = 2;
const EI = 210e9 * 1.943e-5;
const F = 12_000;
const q = 5_000;
const C0 = 3_000;

const CONSOLE: Support[] = [{ kind: 'encastrement', x_m: 0 }];
const DEUX_APPUIS: Support[] = [
  { kind: 'appui', x_m: 0 },
  { kind: 'appui', x_m: L },
];

function beam(supports: Support[], loads: Load[], length_m = L): BeamModel {
  return { length_m, EI_Nm2: EI, supports, loads };
}

/** Vérifie une valeur attendue nulle à une tolérance absolue rapportée à une échelle. */
function expectZero(actual: number, scale: number): void {
  expect(Math.abs(actual)).toBeLessThanOrEqual(TOL * Math.abs(scale));
}

describe('console (encastrement en x = 0) — Roark tab. 8.1 cas 1a, 2a, 3a', () => {
  it('force en bout : R = F, M_enc = −FL, δ = FL³/3EI, θ = FL²/2EI', () => {
    const s = solveBeam(beam(CONSOLE, [{ kind: 'ponctuelle', x_m: L, Fz_N: -F }]));
    expect(s.reactions).toHaveLength(1);
    expectRelClose(s.reactions[0]?.Fz_N ?? NaN, F, TOL);
    expectRelClose(s.reactions[0]?.C_Nm ?? NaN, F * L, TOL);
    expectRelClose(moment_Nm(s, 0), -F * L, TOL);
    expectRelClose(shear_N(s, L / 2), F, TOL);
    expectRelClose(deflection_m(s, L), (-F * L ** 3) / (3 * EI), TOL);
    expectRelClose(slope_rad(s, L), (-F * L ** 2) / (2 * EI), TOL);
  });

  it('force à l’abscisse a : δ_bout = F a² (3L − a) / 6EI', () => {
    const a = 0.7;
    const s = solveBeam(beam(CONSOLE, [{ kind: 'ponctuelle', x_m: a, Fz_N: -F }]));
    expectRelClose(deflection_m(s, L), (-F * a ** 2 * (3 * L - a)) / (6 * EI), TOL);
    expectRelClose(deflection_m(s, a), (-F * a ** 3) / (3 * EI), TOL);
    expectZero(moment_Nm(s, (a + L) / 2), F * L);
  });

  it('charge uniforme : M_enc = −qL²/2, δ = qL⁴/8EI, θ = qL³/6EI', () => {
    const s = solveBeam(
      beam(CONSOLE, [{ kind: 'repartie', x1_m: 0, x2_m: L, q1_N_m: -q, q2_N_m: -q }]),
    );
    expectRelClose(s.reactions[0]?.Fz_N ?? NaN, q * L, TOL);
    expectRelClose(moment_Nm(s, 0), (-q * L ** 2) / 2, TOL);
    expectRelClose(deflection_m(s, L), (-q * L ** 4) / (8 * EI), TOL);
    expectRelClose(slope_rad(s, L), (-q * L ** 3) / (6 * EI), TOL);
  });

  it('couple en bout : V = 0, M = C constant, δ = CL²/2EI, θ = CL/EI', () => {
    const s = solveBeam(beam(CONSOLE, [{ kind: 'couple', x_m: L, C_Nm: C0 }]));
    expectZero(s.reactions[0]?.Fz_N ?? NaN, C0 / L);
    expectRelClose(s.reactions[0]?.C_Nm ?? NaN, -C0, TOL);
    expectZero(shear_N(s, L / 3), C0 / L);
    expectRelClose(moment_Nm(s, L / 3), C0, TOL);
    expectRelClose(deflection_m(s, L), (C0 * L ** 2) / (2 * EI), TOL);
    expectRelClose(slope_rad(s, L), (C0 * L) / EI, TOL);
  });

  it('charge triangulaire, maximum à l’encastrement : M_enc = −qL²/6, δ = qL⁴/30EI', () => {
    const s = solveBeam(
      beam(CONSOLE, [{ kind: 'repartie', x1_m: 0, x2_m: L, q1_N_m: -q, q2_N_m: 0 }]),
    );
    expectRelClose(s.reactions[0]?.Fz_N ?? NaN, (q * L) / 2, TOL);
    expectRelClose(moment_Nm(s, 0), (-q * L ** 2) / 6, TOL);
    expectRelClose(deflection_m(s, L), (-q * L ** 4) / (30 * EI), TOL);
  });

  it('charge triangulaire, maximum en bout : M_enc = −qL²/3, δ = 11qL⁴/120EI', () => {
    const s = solveBeam(
      beam(CONSOLE, [{ kind: 'repartie', x1_m: 0, x2_m: L, q1_N_m: 0, q2_N_m: -q }]),
    );
    expectRelClose(moment_Nm(s, 0), (-q * L ** 2) / 3, TOL);
    expectRelClose(deflection_m(s, L), (-11 * q * L ** 4) / (120 * EI), TOL);
  });

  it('encastrement à droite : image miroir (δ identique, θ et couple de signe opposé)', () => {
    const s = solveBeam(
      beam([{ kind: 'encastrement', x_m: L }], [{ kind: 'ponctuelle', x_m: 0, Fz_N: -F }]),
    );
    expectRelClose(s.reactions[0]?.Fz_N ?? NaN, F, TOL);
    expectRelClose(s.reactions[0]?.C_Nm ?? NaN, -F * L, TOL);
    expectRelClose(moment_Nm(s, L, 'gauche'), -F * L, TOL);
    expectRelClose(shear_N(s, L / 2), -F, TOL);
    expectRelClose(deflection_m(s, 0), (-F * L ** 3) / (3 * EI), TOL);
    expectRelClose(slope_rad(s, 0), (F * L ** 2) / (2 * EI), TOL);
  });
});

describe('poutre sur deux appuis — Roark tab. 8.1 cas 1e, 2e, 3e', () => {
  it('force au milieu : R = F/2, M = FL/4, δ = FL³/48EI, θ = FL²/16EI', () => {
    const s = solveBeam(beam(DEUX_APPUIS, [{ kind: 'ponctuelle', x_m: L / 2, Fz_N: -F }]));
    expectRelClose(s.reactions[0]?.Fz_N ?? NaN, F / 2, TOL);
    expectRelClose(s.reactions[1]?.Fz_N ?? NaN, F / 2, TOL);
    expect(s.reactions[0]?.C_Nm).toBeUndefined();
    expectRelClose(moment_Nm(s, L / 2), (F * L) / 4, TOL);
    expectRelClose(shear_N(s, L / 2, 'gauche'), F / 2, TOL);
    expectRelClose(shear_N(s, L / 2, 'droite'), -F / 2, TOL);
    expectRelClose(deflection_m(s, L / 2), (-F * L ** 3) / (48 * EI), TOL);
    expectRelClose(slope_rad(s, 0), (-F * L ** 2) / (16 * EI), TOL);
    expectRelClose(slope_rad(s, L), (F * L ** 2) / (16 * EI), TOL);
  });

  it('force en a (b = L − a) : R_A = Fb/L, M = Fab/L, δ(a) = Fa²b²/3EIL, δ_max', () => {
    const a = 1.3;
    const b = L - a;
    const s = solveBeam(beam(DEUX_APPUIS, [{ kind: 'ponctuelle', x_m: a, Fz_N: -F }]));
    expectRelClose(s.reactions[0]?.Fz_N ?? NaN, (F * b) / L, TOL);
    expectRelClose(s.reactions[1]?.Fz_N ?? NaN, (F * a) / L, TOL);
    expectRelClose(moment_Nm(s, a), (F * a * b) / L, TOL);
    expectRelClose(deflection_m(s, a), (-F * a ** 2 * b ** 2) / (3 * EI * L), TOL);
    // Flèche maximale (a > b) en x = √((L² − b²)/3) : F b (L² − b²)^(3/2) / (9√3 EI L).
    const xMax = Math.sqrt((L ** 2 - b ** 2) / 3);
    expectRelClose(
      deflection_m(s, xMax),
      (-F * b * (L ** 2 - b ** 2) ** 1.5) / (9 * Math.sqrt(3) * EI * L),
      TOL,
    );
    expectZero(slope_rad(s, xMax), (F * L ** 2) / EI);
  });

  it('charge uniforme : R = qL/2, M = qL²/8, δ = 5qL⁴/384EI, θ = qL³/24EI', () => {
    const s = solveBeam(
      beam(DEUX_APPUIS, [{ kind: 'repartie', x1_m: 0, x2_m: L, q1_N_m: -q, q2_N_m: -q }]),
    );
    expectRelClose(s.reactions[0]?.Fz_N ?? NaN, (q * L) / 2, TOL);
    expectRelClose(moment_Nm(s, L / 2), (q * L ** 2) / 8, TOL);
    expectRelClose(deflection_m(s, L / 2), (-5 * q * L ** 4) / (384 * EI), TOL);
    expectRelClose(slope_rad(s, 0), (-q * L ** 3) / (24 * EI), TOL);
  });

  it('couple à l’extrémité B : θ_B = CL/3EI, θ_A = CL/6EI, δ_max = CL²/(9√3 EI) en L/√3', () => {
    const s = solveBeam(beam(DEUX_APPUIS, [{ kind: 'couple', x_m: L, C_Nm: C0 }]));
    expectRelClose(s.reactions[0]?.Fz_N ?? NaN, C0 / L, TOL);
    expectRelClose(s.reactions[1]?.Fz_N ?? NaN, -C0 / L, TOL);
    expectRelClose(moment_Nm(s, L, 'gauche'), C0, TOL);
    expectRelClose(slope_rad(s, L), (C0 * L) / (3 * EI), TOL);
    expectRelClose(slope_rad(s, 0), (-C0 * L) / (6 * EI), TOL);
    expectRelClose(
      deflection_m(s, L / Math.sqrt(3)),
      (-C0 * L ** 2) / (9 * Math.sqrt(3) * EI),
      TOL,
    );
  });

  it('couple au milieu : R = ±C/L, saut de M de C, flèche nulle au milieu', () => {
    const s = solveBeam(beam(DEUX_APPUIS, [{ kind: 'couple', x_m: L / 2, C_Nm: C0 }]));
    expectRelClose(s.reactions[0]?.Fz_N ?? NaN, C0 / L, TOL);
    expectRelClose(s.reactions[1]?.Fz_N ?? NaN, -C0 / L, TOL);
    expectRelClose(moment_Nm(s, L / 2, 'gauche'), C0 / 2, TOL);
    expectRelClose(moment_Nm(s, L / 2, 'droite'), -C0 / 2, TOL);
    expectZero(deflection_m(s, L / 2), (C0 * L ** 2) / EI);
  });

  it('charge triangulaire 0 → q : R = qL/6 et qL/3, M_max = qL²/(9√3), δ_max ≈ 0,00652 qL⁴/EI', () => {
    const s = solveBeam(
      beam(DEUX_APPUIS, [{ kind: 'repartie', x1_m: 0, x2_m: L, q1_N_m: 0, q2_N_m: -q }]),
    );
    expectRelClose(s.reactions[0]?.Fz_N ?? NaN, (q * L) / 6, TOL);
    expectRelClose(s.reactions[1]?.Fz_N ?? NaN, (q * L) / 3, TOL);
    expectRelClose(moment_Nm(s, L / Math.sqrt(3)), (q * L ** 2) / (9 * Math.sqrt(3)), TOL);
    // Déformée : w(x) = −q x (7L⁴ − 10L²x² + 3x⁴) / (360 EI L).
    for (const x of [0.3, 0.9, 1.4, 1.9]) {
      expectRelClose(
        deflection_m(s, x),
        (-q * x * (7 * L ** 4 - 10 * L ** 2 * x ** 2 + 3 * x ** 4)) / (360 * EI * L),
        TOL,
      );
    }
    // Coefficient tabulé à 3 chiffres (0,00652 en x = 0,5193 L) : tolérance 1e-3.
    expectRelClose(deflection_m(s, 0.5193 * L), (-0.00652 * q * L ** 4) / EI, 1e-3);
  });

  it('deux forces symétriques à a des appuis : M = Fa constant, δ_max = Fa(3L² − 4a²)/24EI', () => {
    const a = 0.5;
    const s = solveBeam(
      beam(DEUX_APPUIS, [
        { kind: 'ponctuelle', x_m: a, Fz_N: -F },
        { kind: 'ponctuelle', x_m: L - a, Fz_N: -F },
      ]),
    );
    expectRelClose(moment_Nm(s, L / 2), F * a, TOL);
    expectRelClose(moment_Nm(s, 0.8), F * a, TOL);
    expectZero(shear_N(s, L / 2), F);
    expectRelClose(deflection_m(s, L / 2), (-F * a * (3 * L ** 2 - 4 * a ** 2)) / (24 * EI), TOL);
  });

  it('porte-à-faux a, force en bout (AISC 3-23) : R, M_B = −Fa, δ_bout = Fa²(L + a)/3EI', () => {
    const a = 0.6;
    const s = solveBeam(beam(DEUX_APPUIS, [{ kind: 'ponctuelle', x_m: L + a, Fz_N: -F }], L + a));
    expectRelClose(s.reactions[0]?.Fz_N ?? NaN, (-F * a) / L, TOL);
    expectRelClose(s.reactions[1]?.Fz_N ?? NaN, (F * (L + a)) / L, TOL);
    expectRelClose(moment_Nm(s, L), -F * a, TOL);
    expectRelClose(deflection_m(s, L + a), (-F * a ** 2 * (L + a)) / (3 * EI), TOL);
    // Flèche maximale vers le haut entre appuis : F a L² / (9√3 EI) en x = L/√3.
    expectRelClose(
      deflection_m(s, L / Math.sqrt(3)),
      (F * a * L ** 2) / (9 * Math.sqrt(3) * EI),
      TOL,
    );
  });
});

describe('poutres hyperstatiques (solveur seul) — Roark tab. 8.1 cas 1d, 2c, 2d', () => {
  const uniforme: Load[] = [{ kind: 'repartie', x1_m: 0, x2_m: L, q1_N_m: -q, q2_N_m: -q }];
  const opts = { allowHyperstatic: true };

  it('encastrée-appuyée, charge uniforme : R_appui = 3qL/8, M_enc = −qL²/8, M_max = 9qL²/128', () => {
    const s = solveBeam(
      beam(
        [
          { kind: 'encastrement', x_m: 0 },
          { kind: 'appui', x_m: L },
        ],
        uniforme,
      ),
      opts,
    );
    expect(s.staticity).toEqual({ kind: 'hyperstatique', degree: 1 });
    expectRelClose(s.reactions[0]?.Fz_N ?? NaN, (5 * q * L) / 8, TOL);
    expectRelClose(s.reactions[1]?.Fz_N ?? NaN, (3 * q * L) / 8, TOL);
    expectRelClose(moment_Nm(s, 0), (-q * L ** 2) / 8, TOL);
    expectRelClose(moment_Nm(s, (5 * L) / 8), (9 * q * L ** 2) / 128, TOL);
    // Déformée, x′ mesuré depuis l'appui : w = −q x′ (L³ − 3L x′² + 2x′³) / 48EI.
    for (const xp of [0.4, 1.0, 1.7]) {
      expectRelClose(
        deflection_m(s, L - xp),
        (-q * xp * (L ** 3 - 3 * L * xp ** 2 + 2 * xp ** 3)) / (48 * EI),
        TOL,
      );
    }
    // Coefficient tabulé : δ_max = qL⁴/185EI en x′ = 0,4215 L (3 chiffres).
    expectRelClose(deflection_m(s, L - 0.4215 * L), (-q * L ** 4) / (185 * EI), 2e-3);
  });

  it('bi-encastrée, charge uniforme : M_enc = −qL²/12, M_milieu = qL²/24, δ = qL⁴/384EI', () => {
    const s = solveBeam(
      beam(
        [
          { kind: 'encastrement', x_m: 0 },
          { kind: 'encastrement', x_m: L },
        ],
        uniforme,
      ),
      opts,
    );
    expect(s.staticity).toEqual({ kind: 'hyperstatique', degree: 2 });
    expectRelClose(s.reactions[0]?.Fz_N ?? NaN, (q * L) / 2, TOL);
    expectRelClose(moment_Nm(s, 0), (-q * L ** 2) / 12, TOL);
    expectRelClose(moment_Nm(s, L, 'gauche'), (-q * L ** 2) / 12, TOL);
    expectRelClose(moment_Nm(s, L / 2), (q * L ** 2) / 24, TOL);
    expectRelClose(deflection_m(s, L / 2), (-q * L ** 4) / (384 * EI), TOL);
  });

  it('bi-encastrée, force au milieu : M = ∓FL/8, δ = FL³/192EI', () => {
    const s = solveBeam(
      beam(
        [
          { kind: 'encastrement', x_m: 0 },
          { kind: 'encastrement', x_m: L },
        ],
        [{ kind: 'ponctuelle', x_m: L / 2, Fz_N: -F }],
      ),
      opts,
    );
    expectRelClose(moment_Nm(s, 0), (-F * L) / 8, TOL);
    expectRelClose(moment_Nm(s, L / 2), (F * L) / 8, TOL);
    expectRelClose(deflection_m(s, L / 2), (-F * L ** 3) / (192 * EI), TOL);
  });

  it('poutre continue à deux travées égales, charge uniforme : R = 3qL/8, 10qL/8, 3qL/8 ; M_appui = −qL²/8', () => {
    // AISC, tableau 3-23 (poutre continue à deux travées égales).
    const s = solveBeam(
      beam(
        [
          { kind: 'appui', x_m: 0 },
          { kind: 'appui', x_m: L },
          { kind: 'appui', x_m: 2 * L },
        ],
        [{ kind: 'repartie', x1_m: 0, x2_m: 2 * L, q1_N_m: -q, q2_N_m: -q }],
        2 * L,
      ),
      opts,
    );
    expectRelClose(s.reactions[0]?.Fz_N ?? NaN, (3 * q * L) / 8, TOL);
    expectRelClose(s.reactions[1]?.Fz_N ?? NaN, (10 * q * L) / 8, TOL);
    expectRelClose(s.reactions[2]?.Fz_N ?? NaN, (3 * q * L) / 8, TOL);
    expectRelClose(moment_Nm(s, L), (-q * L ** 2) / 8, TOL);
  });

  it('refusée par défaut (étape 4 : poutres isostatiques seulement)', () => {
    const model = beam(
      [
        { kind: 'encastrement', x_m: 0 },
        { kind: 'appui', x_m: L },
      ],
      uniforme,
    );
    expect(() => solveBeam(model)).toThrow(BeamModelError);
    expect(() => solveBeam(model)).toThrow(/hyperstatique de degré 1/);
  });
});

describe('propriétés générales', () => {
  const charges: Load[] = [
    { kind: 'ponctuelle', x_m: 0.4, Fz_N: -F },
    { kind: 'ponctuelle', x_m: 2.3, Fz_N: 0.4 * F },
    { kind: 'couple', x_m: 1.1, C_Nm: C0 },
    { kind: 'repartie', x1_m: 0.2, x2_m: 1.6, q1_N_m: -q, q2_N_m: -2.5 * q },
    { kind: 'repartie', x1_m: 1.8, x2_m: 2.5, q1_N_m: 0.5 * q, q2_N_m: -q },
  ];
  const appuis: Support[] = [
    { kind: 'appui', x_m: 0.3 },
    { kind: 'appui', x_m: 2.0 },
  ];
  const model: BeamModel = { length_m: 2.5, EI_Nm2: EI, supports: appuis, loads: charges };
  const s = solveBeam(model);

  it('équilibre : ΣFz = 0 et ΣM = 0, calculés indépendamment du solveur', () => {
    // Résultante et moment en x = 0 de chaque charge (trapèze = rectangle + triangle).
    let force = 0;
    let moment = 0; // sens trigonométrique
    for (const c of charges) {
      if (c.kind === 'ponctuelle') {
        force += c.Fz_N;
        moment += c.Fz_N * c.x_m;
      } else if (c.kind === 'couple') {
        moment += c.C_Nm;
      } else {
        const len = c.x2_m - c.x1_m;
        const rect = c.q1_N_m * len;
        const tri = ((c.q2_N_m - c.q1_N_m) * len) / 2;
        force += rect + tri;
        moment += rect * (c.x1_m + len / 2) + tri * (c.x1_m + (2 * len) / 3);
      }
    }
    for (const r of s.reactions) {
      force += r.Fz_N;
      moment += r.Fz_N * r.x_m + (r.C_Nm ?? 0);
    }
    expectZero(force, F);
    expectZero(moment, F * L);
    expectZero(s.residualForce_N, F);
    expectZero(s.residualMoment_Nm, F * L);
  });

  it('extrémités libres : V et M nuls en 0⁻ et en L⁺', () => {
    expectZero(shear_N(s, 0, 'gauche'), F);
    expectZero(moment_Nm(s, 0, 'gauche'), F * L);
    expectZero(shear_N(s, 2.5, 'droite'), F);
    expectZero(moment_Nm(s, 2.5, 'droite'), F * L);
  });

  it('flèche nulle aux appuis', () => {
    const scale = (F * L ** 3) / EI;
    expectZero(deflection_m(s, 0.3), scale);
    expectZero(deflection_m(s, 2.0), scale);
  });

  it('relations différentielles dM/dx = V et EI·w″ = M (différences finies centrées)', () => {
    const h = 1e-4;
    for (const x of [0.25, 0.7, 1.35, 1.7, 2.2]) {
      const dM = (moment_Nm(s, x + h) - moment_Nm(s, x - h)) / (2 * h);
      // Erreur de troncature en h² : tolérance 1e-6.
      expectRelClose(dM, shear_N(s, x), 1e-6);
      const h2 = 1e-3;
      const d2w =
        (deflection_m(s, x + h2) - 2 * deflection_m(s, x) + deflection_m(s, x - h2)) / h2 ** 2;
      // Différence seconde : troncature en h²·q/12 (≈ 1e-4 de M ici) et arrondi, tolérance 1e-3.
      expectRelClose(EI * d2w, moment_Nm(s, x), 1e-3);
    }
  });

  it('réactions, V et M indépendants de EI ; flèche inversement proportionnelle à EI', () => {
    const sansEI = solveBeam({ ...model, EI_Nm2: undefined });
    const raide = solveBeam({ ...model, EI_Nm2: 10 * EI });
    expectRelClose(sansEI.reactions[0]?.Fz_N ?? NaN, s.reactions[0]?.Fz_N ?? NaN, TOL);
    expectRelClose(moment_Nm(sansEI, 1.2), moment_Nm(s, 1.2), TOL);
    expectRelClose(deflection_m(raide, 1.2), deflection_m(s, 1.2) / 10, TOL);
    expect(() => deflection_m(sansEI, 1.2)).toThrow(/rigidité EI/);
    expect(() => slope_rad(sansEI, 1.2)).toThrow(BeamModelError);
  });

  it('symétrie miroir : x → L − x conserve M et w, change le signe de V et θ', () => {
    const Lm = 2.5;
    const miroir = solveBeam({
      length_m: Lm,
      EI_Nm2: EI,
      supports: appuis.map((a) => ({ ...a, x_m: Lm - a.x_m })),
      loads: charges.map((c): Load => {
        if (c.kind === 'ponctuelle') return { ...c, x_m: Lm - c.x_m };
        if (c.kind === 'couple') return { ...c, x_m: Lm - c.x_m, C_Nm: -c.C_Nm };
        return {
          kind: 'repartie',
          x1_m: Lm - c.x2_m,
          x2_m: Lm - c.x1_m,
          q1_N_m: c.q2_N_m,
          q2_N_m: c.q1_N_m,
        };
      }),
    });
    for (const x of [0.15, 0.9, 1.5, 2.2]) {
      expectRelClose(moment_Nm(miroir, Lm - x), moment_Nm(s, x), 1e-8);
      expectRelClose(shear_N(miroir, Lm - x), -shear_N(s, x), 1e-8);
      expectRelClose(deflection_m(miroir, Lm - x), deflection_m(s, x), 1e-8);
      expectRelClose(slope_rad(miroir, Lm - x), -slope_rad(s, x), 1e-8);
    }
  });

  it('superposition : solve(A + B) = solve(A) + solve(B), et proportionnalité', () => {
    const A = solveBeam({ ...model, loads: charges.slice(0, 2) });
    const B = solveBeam({ ...model, loads: charges.slice(2) });
    const somme = combineSolutions([
      { solution: A, factor: 1 },
      { solution: B, factor: 1 },
    ]);
    const double = combineSolutions([{ solution: s, factor: 2 }]);
    for (const x of [0.1, 0.8, 1.3, 2.4]) {
      expectRelClose(shear_N(somme, x), shear_N(s, x), 1e-8);
      expectRelClose(moment_Nm(somme, x), moment_Nm(s, x), 1e-8);
      expectRelClose(deflection_m(somme, x), deflection_m(s, x), 1e-8);
      expectRelClose(slope_rad(double, x), 2 * slope_rad(s, x), 1e-8);
    }
    somme.reactions.forEach((r, i) => expectRelClose(r.Fz_N, s.reactions[i]?.Fz_N ?? NaN, 1e-8));
  });

  it('combinaison pondérée 1,35 G + 1,5 Q sur une console (réaction et couple d’encastrement)', () => {
    const G = solveBeam(
      beam(CONSOLE, [{ kind: 'repartie', x1_m: 0, x2_m: L, q1_N_m: -q, q2_N_m: -q }]),
    );
    const Q = solveBeam(beam(CONSOLE, [{ kind: 'ponctuelle', x_m: L, Fz_N: -F }]));
    const c = combineSolutions([
      { solution: G, factor: 1.35 },
      { solution: Q, factor: 1.5 },
    ]);
    expectRelClose(c.reactions[0]?.Fz_N ?? NaN, 1.35 * q * L + 1.5 * F, TOL);
    expectRelClose(c.reactions[0]?.C_Nm ?? NaN, (1.35 * q * L ** 2) / 2 + 1.5 * F * L, TOL);
    expectRelClose(
      deflection_m(c, L),
      (-1.35 * q * L ** 4) / (8 * EI) - (1.5 * F * L ** 3) / (3 * EI),
      TOL,
    );
  });

  it('combinaison refusée entre poutres différentes ou sans cas', () => {
    const autre = solveBeam(beam(DEUX_APPUIS, []));
    const console_ = solveBeam(beam(CONSOLE, []));
    expect(() =>
      combineSolutions([
        { solution: autre, factor: 1 },
        { solution: console_, factor: 1 },
      ]),
    ).toThrow(/même poutre/);
    expect(() => combineSolutions([])).toThrow(BeamModelError);
    expect(() => combineSolutions([{ solution: autre, factor: NaN }])).toThrow(/non fini/);
  });

  it('poutre sans charge : tout est nul', () => {
    const vide = solveBeam(beam(DEUX_APPUIS, []));
    expect(vide.reactions.map((r) => r.Fz_N)).toEqual([0, 0]);
    expect(moment_Nm(vide, 1)).toBe(0);
    expect(deflection_m(vide, 1)).toBe(0);
  });
});

describe('classification et données invalides', () => {
  it('degré d’hyperstaticité h = r − 2', () => {
    expect(classifyBeam({ supports: [] })).toEqual({ kind: 'mecanisme', degree: -2 });
    expect(classifyBeam({ supports: [{ kind: 'appui', x_m: 0 }] }).kind).toBe('mecanisme');
    expect(classifyBeam({ supports: CONSOLE })).toEqual({ kind: 'isostatique', degree: 0 });
    expect(classifyBeam({ supports: DEUX_APPUIS })).toEqual({ kind: 'isostatique', degree: 0 });
    expect(classifyBeam({ supports: [...DEUX_APPUIS, { kind: 'encastrement', x_m: 1 }] })).toEqual({
      kind: 'hyperstatique',
      degree: 2,
    });
  });

  const charge: Load[] = [{ kind: 'ponctuelle', x_m: 1, Fz_N: -F }];

  it.each([
    ['longueur nulle', { ...beam(DEUX_APPUIS, charge), length_m: 0 }, /longueur/],
    ['longueur négative', { ...beam(DEUX_APPUIS, charge), length_m: -1 }, /longueur/],
    ['longueur non finie', { ...beam(DEUX_APPUIS, charge), length_m: NaN }, /longueur/],
    ['EI nul', { ...beam(DEUX_APPUIS, charge), EI_Nm2: 0 }, /EI/],
    ['EI négatif', { ...beam(DEUX_APPUIS, charge), EI_Nm2: -5 }, /EI/],
    ['aucun appui', beam([], charge), /mécanisme/],
    ['un seul appui', beam([{ kind: 'appui', x_m: 0 }], charge), /mécanisme/],
    [
      'deux appuis confondus',
      beam(
        [
          { kind: 'appui', x_m: 1 },
          { kind: 'appui', x_m: 1 },
        ],
        charge,
      ),
      /même position/,
    ],
    ['appui hors de la poutre', beam([{ kind: 'encastrement', x_m: 2.5 }], charge), /en dehors/],
    [
      'force hors de la poutre',
      beam(DEUX_APPUIS, [{ kind: 'ponctuelle', x_m: -0.1, Fz_N: 1 }]),
      /en dehors/,
    ],
    [
      'couple hors de la poutre',
      beam(DEUX_APPUIS, [{ kind: 'couple', x_m: 3, C_Nm: 1 }]),
      /en dehors/,
    ],
    [
      'charge répartie inversée (x1 > x2)',
      beam(DEUX_APPUIS, [{ kind: 'repartie', x1_m: 1.5, x2_m: 0.5, q1_N_m: 1, q2_N_m: 1 }]),
      /x1 < x2/,
    ],
    [
      'charge répartie de longueur nulle',
      beam(DEUX_APPUIS, [{ kind: 'repartie', x1_m: 1, x2_m: 1, q1_N_m: 1, q2_N_m: 1 }]),
      /x1 < x2/,
    ],
    [
      'charge répartie débordante',
      beam(DEUX_APPUIS, [{ kind: 'repartie', x1_m: 1, x2_m: 2.2, q1_N_m: 1, q2_N_m: 1 }]),
      /en dehors/,
    ],
    [
      'intensité non finie',
      beam(DEUX_APPUIS, [{ kind: 'ponctuelle', x_m: 1, Fz_N: Infinity }]),
      /nombre fini/,
    ],
  ] as const)('%s → BeamModelError', (_nom, model, message) => {
    expect(() => solveBeam(model)).toThrow(BeamModelError);
    expect(() => solveBeam(model)).toThrow(message);
  });
});
