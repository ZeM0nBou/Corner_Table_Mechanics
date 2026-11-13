import { describe, expect, it } from 'vitest';
import {
  buildMaterial,
  draftFromMaterial,
  emptyDraft,
  visibleErrors,
  type DraftErrors,
  type DraftField,
} from '@ui/materials/materialDraft';
import type { Material } from '@materials/schema';

/** Brouillon complet avec des valeurs fictives. */
const valid = () => ({
  ...emptyDraft(),
  name: '  Acier X  ',
  family: 'acier',
  source: 'Fiche fournisseur (fictive)',
  E_Pa: 200e9,
  nu: 0.3,
  rho_kg_m3: 7800,
});

describe('buildMaterial', () => {
  it('construit un matériau valide, champs texte nettoyés, champs vides omis', () => {
    const r = buildMaterial(valid(), 'perso-acier-x');
    expect(r).toEqual({
      ok: true,
      material: {
        id: 'perso-acier-x',
        name: 'Acier X',
        family: 'acier',
        source: 'Fiche fournisseur (fictive)',
        verified: false,
        E_Pa: 200e9,
        nu: 0.3,
        rho_kg_m3: 7800,
      },
    });
  });

  it('signale les champs numériques obligatoires manquants', () => {
    const r = buildMaterial({ ...valid(), E_Pa: undefined, nu: undefined }, 'perso-x');
    expect(r).toEqual({ ok: false, errors: { E_Pa: 'Obligatoire.', nu: 'Obligatoire.' } });
  });

  it('signale une saisie invalide (NaN)', () => {
    const r = buildMaterial({ ...valid(), Re_Pa: NaN }, 'perso-x');
    expect(r.ok === false && r.errors.Re_Pa).toBe('Nombre invalide.');
  });

  it('signale une seule borne d’épaisseur renseignée', () => {
    const r = buildMaterial({ ...valid(), tMax_m: 0.01 }, 'perso-x');
    expect(r.ok === false && r.errors.tMin_m).toMatch(/deux bornes/);
  });

  it('reporte les erreurs du schéma sur le bon champ', () => {
    const r = buildMaterial({ ...valid(), Re_Pa: 400e6, Rm_Pa: 300e6, nu: 0.6 }, 'perso-x');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.Re_Pa).toBe('Re doit être ≤ Rm.');
      expect(r.errors.nu).toMatch(/< 0,5/);
    }
  });

  it('rattache une plage d’épaisseur inversée au champ de la borne min', () => {
    const r = buildMaterial({ ...valid(), tMin_m: 0.04, tMax_m: 0.01 }, 'perso-x');
    expect(r.ok === false && r.errors.tMin_m).toMatch(/minimum/);
  });

  it('exige la source (traçabilité)', () => {
    const r = buildMaterial({ ...valid(), source: '   ' }, 'perso-x');
    expect(r.ok === false && r.errors.source).toMatch(/source/);
  });
});

describe('draftFromMaterial', () => {
  it('aller-retour matériau → brouillon → matériau sans perte', () => {
    const m: Material = {
      id: 'perso-complet',
      name: 'Complet',
      family: 'test',
      standard: 'Norme',
      condition: 'état',
      E_Pa: 70e9,
      nu: 0.33,
      rho_kg_m3: 2700,
      Re_Pa: 250e6,
      Rm_Pa: 300e6,
      A_percent: 8,
      alpha_1_K: 23e-6,
      thicknessRange_m: [0, 0.025],
      source: 'Valeurs fictives',
      verified: true,
      notes: 'note',
    };
    expect(buildMaterial(draftFromMaterial(m), m.id)).toEqual({ ok: true, material: m });
  });
});

describe('visibleErrors (contrôle à la sortie du champ)', () => {
  const errors: DraftErrors = {
    name: 'Le nom est obligatoire.',
    E_Pa: 'Obligatoire.',
    Re_Pa: 'Re doit être ≤ Rm.',
    tMin_m: 'Renseigner les deux bornes, ou aucune.',
  };
  const touched = (...f: DraftField[]) => new Set<DraftField>(f);

  it('aucune erreur tant qu’aucun champ n’a été quitté', () => {
    expect(visibleErrors(errors, touched(), false)).toEqual({});
  });

  it('affiche l’erreur d’un champ quitté, et seulement celle-là', () => {
    expect(visibleErrors(errors, touched('E_Pa'), false)).toEqual({ E_Pa: 'Obligatoire.' });
  });

  it('Re ≤ Rm : l’erreur (portée par Re) apparaît dès que Rm est quitté', () => {
    expect(visibleErrors(errors, touched('Rm_Pa'), false)).toEqual({
      Re_Pa: 'Re doit être ≤ Rm.',
    });
  });

  it('bornes d’épaisseur : l’erreur apparaît dès que la borne max est quittée', () => {
    expect(visibleErrors(errors, touched('tMax_m'), false)).toEqual({
      tMin_m: 'Renseigner les deux bornes, ou aucune.',
    });
  });

  it('toutes les erreurs après une tentative d’enregistrement', () => {
    expect(visibleErrors(errors, touched(), true)).toEqual(errors);
  });
});
