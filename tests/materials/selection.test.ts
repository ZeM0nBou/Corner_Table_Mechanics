import { describe, expect, it } from 'vitest';
import {
  COST_INDICES,
  COST_SCALE,
  PROCESS_GROUPS,
  PROCESS_KEYS,
  PROCESS_LABELS,
  SECTOR_KEYS,
} from '@materials/selection';

describe('listes de l’aide au choix', () => {
  it('17 procédés, clés uniques, chacun avec un libellé', () => {
    expect(PROCESS_KEYS).toHaveLength(17);
    expect(new Set(PROCESS_KEYS).size).toBe(17);
    for (const k of PROCESS_KEYS) expect(PROCESS_LABELS[k].length).toBeGreaterThan(3);
  });

  it('chaque groupe de procédés est non vide', () => {
    for (const g of PROCESS_GROUPS) expect(g.processes.length).toBeGreaterThan(0);
  });

  it('une plage de prix pour chaque indice de 1 à 5', () => {
    expect([...COST_INDICES]).toEqual([1, 2, 3, 4, 5]);
    for (const i of COST_INDICES) expect(COST_SCALE[i]).toMatch(/€\/kg/);
  });

  it('secteurs : clés uniques', () => {
    expect(new Set(SECTOR_KEYS).size).toBe(SECTOR_KEYS.length);
  });
});
