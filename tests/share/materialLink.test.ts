import { describe, expect, it } from 'vitest';
import type { Material } from '@materials/schema';
import { MaterialSchema } from '@materials/schema';
import { REFERENCE_MATERIALS } from '@materials/index';
import {
  addLinkedMaterial,
  linkedMaterialConflicts,
  resolveSharedMaterial,
  toSharedMaterial,
} from '@share/materialLink';
import type { SharedReferenceMaterial } from '@share/schemas';

/** Matériaux fictifs (valeurs de test, sans signification physique particulière). */
const ref: Material = {
  id: 'acier-test',
  name: 'Acier test',
  family: 'acier de construction',
  standard: 'Norme fictive',
  E_Pa: 210e9,
  nu: 0.3,
  rho_kg_m3: 7850,
  Re_Pa: 235e6,
  Rm_Pa: 360e6,
  source: 'Valeurs fictives pour test',
  verified: true,
  notes: 'Note de la base',
};
const fonte: Material = {
  id: 'fonte-test',
  name: 'Fonte test',
  family: 'fonte',
  E_Pa: 110e9,
  nu: 0.26,
  rho_kg_m3: 7200,
  Rm_Pa: 250e6,
  source: 'Valeurs fictives pour test',
  verified: false,
};
const perso: Material = {
  id: 'perso-alu-maison',
  name: 'Alu maison',
  family: 'aluminium',
  E_Pa: 70e9,
  nu: 0.33,
  rho_kg_m3: 2700,
  Re_Pa: 200e6,
  source: 'Essai interne fictif',
  verified: false,
};
const REFERENCE = [ref, fonte];

const snapshotOf = (m: Material) => toSharedMaterial(m, REFERENCE) as SharedReferenceMaterial;

describe('toSharedMaterial', () => {
  it('aucun matériau → null', () => {
    expect(toSharedMaterial(undefined, REFERENCE)).toBeNull();
  });

  it('matériau de référence → identifiant et instantané des propriétés de calcul', () => {
    expect(toSharedMaterial(ref, REFERENCE)).toEqual({
      kind: 'reference',
      id: 'acier-test',
      name: 'Acier test',
      E_Pa: 210e9,
      nu: 0.3,
      rho_kg_m3: 7850,
      Re_Pa: 235e6,
      Rm_Pa: 360e6,
    });
  });

  it('propriété absente (Re d’une fonte grise) → absente de l’instantané', () => {
    expect(toSharedMaterial(fonte, REFERENCE)).not.toHaveProperty('Re_Pa');
  });

  it('matériau personnalisé → matériau complet', () => {
    expect(toSharedMaterial(perso, REFERENCE)).toEqual({ kind: 'custom', material: perso });
  });
});

describe('resolveSharedMaterial : matériau de référence', () => {
  it('lien sans matériau → undefined', () => {
    expect(resolveSharedMaterial(null, REFERENCE, [])).toBeUndefined();
  });

  it('valeurs identiques → matériau de la base, sans temporaire', () => {
    const r = resolveSharedMaterial(snapshotOf(ref), REFERENCE, []);
    expect(r?.material).toBe(ref);
    expect(r?.temporary).toBeUndefined();
    expect(r?.status).toEqual({ kind: 'reference' });
  });

  it('base modifiée depuis → valeurs du lien retenues, écart listé', () => {
    const shared = { ...snapshotOf(ref), Re_Pa: 225e6 };
    const r = resolveSharedMaterial(shared, REFERENCE, []);
    expect(r?.status).toEqual({
      kind: 'reference-modifiee',
      differences: [{ key: 'Re_Pa', link: 225e6, current: 235e6 }],
    });
    expect(r?.material.Re_Pa).toBe(225e6);
    expect(r?.material.id).toBe('lien-acier-test');
    expect(r?.material.name).toBe('Acier test (valeurs du lien)');
    expect(r?.material.verified).toBe(false);
    expect(r?.temporary).toBe(r?.material);
    // Le matériau de la base n'est pas modifié.
    expect(ref.Re_Pa).toBe(235e6);
    expect(MaterialSchema.safeParse(r?.material).success).toBe(true);
  });

  it('propriété retirée dans le lien → retirée du matériau temporaire', () => {
    const withoutRm = { ...snapshotOf(ref) };
    delete withoutRm.Rm_Pa;
    const r = resolveSharedMaterial(withoutRm, REFERENCE, []);
    expect(r?.status.kind).toBe('reference-modifiee');
    expect(r?.material).not.toHaveProperty('Rm_Pa');
  });

  it('matériau absent de la base → reconstitué depuis le lien, non vérifié', () => {
    const shared = { ...snapshotOf(ref), id: 'acier-disparu', name: 'Acier disparu' };
    const r = resolveSharedMaterial(shared, REFERENCE, []);
    expect(r?.status).toEqual({ kind: 'reference-inconnue' });
    expect(r?.material).toMatchObject({
      id: 'lien-acier-disparu',
      name: 'Acier disparu (issu du lien)',
      E_Pa: 210e9,
      Re_Pa: 235e6,
      verified: false,
    });
    expect(MaterialSchema.safeParse(r?.material).success).toBe(true);
  });

  it('identifiant temporaire déjà pris → suffixe', () => {
    const taken: Material = { ...perso, id: 'lien-acier-test' };
    const shared = { ...snapshotOf(ref), E_Pa: 200e9 };
    expect(resolveSharedMaterial(shared, REFERENCE, [taken])?.material.id).toBe(
      'lien-acier-test-2',
    );
  });
});

describe('resolveSharedMaterial : matériau personnalisé', () => {
  it('déjà présent à l’identique chez le destinataire → matériau local', () => {
    // Ordre des clés différent : même contenu.
    const reordered = Object.fromEntries(Object.entries(perso).reverse()) as Material;
    const r = resolveSharedMaterial({ kind: 'custom', material: reordered }, REFERENCE, [perso]);
    expect(r?.material).toBe(perso);
    expect(r?.temporary).toBeUndefined();
    expect(r?.status).toEqual({ kind: 'perso-local' });
  });

  it('absent chez le destinataire → temporaire, même identifiant', () => {
    const r = resolveSharedMaterial({ kind: 'custom', material: perso }, REFERENCE, []);
    expect(r?.status).toEqual({ kind: 'perso-lien', original: perso });
    expect(r?.material).toEqual(perso);
    expect(r?.temporary).toBe(r?.material);
  });

  it('même identifiant, contenu différent → temporaire renommé, matériau local intact', () => {
    const local = { ...perso, E_Pa: 69e9 };
    const r = resolveSharedMaterial({ kind: 'custom', material: perso }, REFERENCE, [local]);
    expect(r?.status.kind).toBe('perso-lien');
    expect(r?.material.id).toBe('perso-alu-maison-2');
    expect(r?.material.E_Pa).toBe(70e9);
    expect(local.E_Pa).toBe(69e9);
  });

  it('identifiant forgé égal à celui d’un matériau de référence → pas de collision', () => {
    const forged = { ...perso, id: 'acier-test' };
    const r = resolveSharedMaterial({ kind: 'custom', material: forged }, REFERENCE, []);
    expect(r?.material.id).toBe('acier-test-2');
  });
});

describe('base de référence réelle', () => {
  it('chaque matériau de référence fait l’aller-retour sans écart', () => {
    for (const m of REFERENCE_MATERIALS) {
      const r = resolveSharedMaterial(
        toSharedMaterial(m, REFERENCE_MATERIALS),
        REFERENCE_MATERIALS,
        [],
      );
      expect(r?.status, m.id).toEqual({ kind: 'reference' });
      expect(r?.material).toBe(m);
    }
  });
});

describe('addLinkedMaterial', () => {
  const other: Material = { ...perso, id: 'perso-autre', name: 'Autre' };

  it('sans conflit : ajouté en fin de liste, même identifiant', () => {
    expect(linkedMaterialConflicts([other], perso)).toBe(false);
    const r = addLinkedMaterial([other], perso, 'keep-both');
    expect(r.materials).toEqual([other, perso]);
    expect(r.id).toBe('perso-alu-maison');
  });

  it('identifiant sans préfixe (lien forgé ou matériau temporaire) → préfixe « perso- »', () => {
    const r = addLinkedMaterial([], { ...perso, id: 'lien-acier-test' }, 'keep-both');
    expect(r.id).toBe('perso-lien-acier-test');
    expect(r.materials[0]?.id).toBe('perso-lien-acier-test');
  });

  it('conflit, « remplacer » : remplacé sur place', () => {
    const local = { ...perso, E_Pa: 69e9 };
    expect(linkedMaterialConflicts([local, other], perso)).toBe(true);
    const r = addLinkedMaterial([local, other], perso, 'replace');
    expect(r.materials).toEqual([perso, other]);
    expect(r.id).toBe('perso-alu-maison');
  });

  it('conflit, « garder les deux » : ajouté sous un nouvel identifiant', () => {
    const local = { ...perso, E_Pa: 69e9 };
    const r = addLinkedMaterial([local], perso, 'keep-both');
    expect(r.materials).toHaveLength(2);
    expect(r.materials[0]).toBe(local);
    expect(r.id).toBe('perso-alu-maison-2');
    expect(r.materials[1]).toEqual({ ...perso, id: 'perso-alu-maison-2' });
  });
});
