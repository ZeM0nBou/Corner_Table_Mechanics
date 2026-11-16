/**
 * Préparation de la vérification : cas indisponibles et cas complet.
 * Cas complet : deux appuis, L = 3 m, q = 10 kN/m, rectangle 100 × 200 mm, acier Re = 235 MPa.
 * M = qL²/8 = 11,25 kN·m → σ = M/Wel = 16,875 MPa (Roark tab. 8.1 ; Navier).
 */
import { describe, expect, it } from 'vitest';
import { beamExtrema, solveBeam } from '@core/beams';
import { computeSection } from '@core/sections';
import { evaluateCheck, type CheckInput } from '@ui/beams/beamCheckModel';
import { expectRelClose } from '../helpers';

const L = 3;
const q = 10_000;
const EI = 210e9 * ((0.1 * 0.2 ** 3) / 12);
const solution = solveBeam({
  length_m: L,
  EI_Nm2: EI,
  supports: [
    { kind: 'appui', x_m: 0 },
    { kind: 'appui', x_m: L },
  ],
  loads: [{ kind: 'repartie', x1_m: 0, x2_m: L, q1_N_m: -q, q2_N_m: -q }],
});
const rect = computeSection({ shape: 'rectangle', b_m: 0.1, h_m: 0.2 });

const base: CheckInput = {
  length_m: L,
  extrema: beamExtrema(solution),
  refForce_N: q * L,
  section: rect,
  material: { name: 'Acier fictif', Re_Pa: 235e6, Rm_Pa: 360e6 },
  threshold: 1.5,
  deflectionLimit: 300,
};

describe('evaluateCheck', () => {
  it('cas complet : σ = 16,875 MPa, von Mises, n, flèche', () => {
    const e = evaluateCheck(base);
    expect(e.kind).toBe('ok');
    if (e.kind !== 'ok') return;
    expectRelClose(e.stresses.tension.sigma_Pa, 16.875e6, 1e-9);
    expect(e.check.criterion).toBe('vonMises');
    expect(e.check.verdict).toBe('ok');
    // δ = 5qL⁴/384EI comparée à L/300 = 10 mm.
    expectRelClose(e.deflection?.result.deflection_m ?? NaN, (5 * q * L ** 4) / (384 * EI), 1e-9);
    expectRelClose(e.deflection?.result.allowable_m ?? NaN, 0.01, 1e-12);
    expect(e.notes).toEqual([]);
    expect(e.formulas.traction?.source).toMatch(/Navier/);
  });

  it('fragile : remarque sur la compression non vérifiée', () => {
    const e = evaluateCheck({ ...base, material: { name: 'Fonte fictive', Rm_Pa: 250e6 } });
    expect(e.kind === 'ok' && e.check.criterion).toBe('rankine');
    expect(e.kind === 'ok' && e.notes.join(' ')).toMatch(/compression n’est pas vérifiée/);
  });

  it('sans limite de flèche valide : remarque, pas de vérification de flèche', () => {
    const e = evaluateCheck({ ...base, deflectionLimit: undefined });
    expect(e.kind === 'ok' && e.deflection).toBeUndefined();
    expect(e.kind === 'ok' && e.notes.join(' ')).toMatch(/limite L/);
  });

  it.each([
    ['saisie directe de I', { section: undefined }, /section paramétrique/],
    ['sans matériau', { material: undefined }, /Choisissez un matériau/],
    ['matériau sans Re ni Rm', { material: { name: 'X' } }, /ni Re ni Rm/],
    ['seuil < 1', { threshold: 0.8 }, /au moins égal à 1/],
    ['seuil vide', { threshold: undefined }, /au moins égal à 1/],
  ] as const)('%s → indisponible avec message', (_nom, patch, message) => {
    const e = evaluateCheck({ ...base, ...patch });
    expect(e.kind).toBe('indisponible');
    expect(e.kind === 'indisponible' && e.message).toMatch(message);
  });
});
