/**
 * Schéma Zod d'un matériau (format défini dans CLAUDE.md, § Base de données matériaux).
 *
 * Toutes les grandeurs sont en unités SI. Le schéma vérifie aussi la
 * cohérence physique minimale des valeurs (signes, bornes, Re ≤ Rm…).
 * Il sert à la base de référence ET aux matériaux importés par l'utilisateur
 * (entrée non fiable) : les champs inconnus sont donc rejetés.
 */
import { z } from 'zod';
import { PROCESS_KEYS, RATINGS, SECTOR_KEYS } from './selection';

const ProcessAptitudeSchema = z.strictObject({
  rating: z.enum(RATINGS, { error: 'Niveau d’aptitude inconnu.' }),
  /** Aide-mémoire court (précautions, alternatives…). */
  note: z.string().trim().min(1).max(300).optional(),
});

const positive = (label: string) =>
  z
    .number({ error: `${label} doit être un nombre.` })
    .finite()
    .positive(`${label} doit être > 0.`);

export const MaterialSchema = z
  .strictObject({
    /** Slug unique : minuscules, chiffres et tirets (ex. « s235jr-t16 »). */
    id: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'id : minuscules, chiffres et tirets uniquement.'),
    name: z.string().trim().min(1, 'Le nom est obligatoire.').max(100),
    family: z.string().trim().min(1, 'La famille est obligatoire.').max(100),
    standard: z.string().trim().min(1).max(200).optional(),
    condition: z.string().trim().min(1).max(100).optional(),

    E_Pa: positive('E'),
    /**
     * Coefficient de Poisson. Pour un matériau isotrope stable : -1 < ν < 0,5
     * (Timoshenko & Goodier, *Theory of Elasticity*, 3ᵉ éd., §6). On restreint à
     * 0 ≤ ν < 0,5, seul domaine des matériaux techniques usuels.
     */
    nu: z
      .number()
      .finite()
      .min(0, 'ν doit être ≥ 0.')
      .lt(0.5, 'ν doit être < 0,5 (matériau compressible).'),
    rho_kg_m3: positive('ρ'),

    Re_Pa: positive('Re').optional(),
    Rm_Pa: positive('Rm').optional(),
    A_percent: z.number().finite().min(0).max(100).optional(),
    alpha_1_K: positive('α').optional(),
    thicknessRange_m: z
      .tuple([z.number().finite().min(0), z.number().finite().positive()])
      .refine(([min, max]) => min < max, 'thicknessRange_m : le minimum doit être < au maximum.')
      .optional(),

    source: z.string().trim().min(1, 'La source est obligatoire.').max(500),
    verified: z.boolean(),
    notes: z.string().max(2000).optional(),

    // --- Aide au choix (qualitatif, facultatif) — voir selection.ts ---
    /** Indice de prix de 1 (€) à 5 (€€€€€), échelle COST_SCALE. */
    costIndex: z
      .number()
      .int('L’indice de prix doit être un entier.')
      .min(1, 'L’indice de prix va de 1 à 5.')
      .max(5, 'L’indice de prix va de 1 à 5.')
      .optional(),
    /** Justification de l'indice de prix (forme de produit, fourchette relevée…). */
    costNote: z.string().trim().min(1).max(500).optional(),
    /** Aptitude aux procédés de fabrication (procédés non listés = non renseignés). */
    processes: z.partialRecord(z.enum(PROCESS_KEYS), ProcessAptitudeSchema).optional(),
    /** Secteurs d'utilisation principaux. */
    sectors: z
      .array(z.enum(SECTOR_KEYS, { error: 'Secteur inconnu.' }))
      .refine((s) => new Set(s).size === s.length, 'Secteur en double.')
      .optional(),
    /** Exemples d'emplois typiques. */
    applicationNotes: z.string().trim().min(1).max(1000).optional(),
    /** Atouts du matériau : quelques points courts. */
    pros: z
      .array(z.string().trim().min(1).max(150, 'Point trop long (150 caractères max.).'))
      .min(1)
      .max(6, '6 points au maximum.')
      .optional(),
    /** Limites du matériau : quelques points courts. */
    cons: z
      .array(z.string().trim().min(1).max(150, 'Point trop long (150 caractères max.).'))
      .min(1)
      .max(6, '6 points au maximum.')
      .optional(),
    /** Source des indications qualitatives (prix, procédés, secteurs). */
    selectionSource: z.string().trim().min(1).max(500).optional(),
  })
  .refine((m) => m.Re_Pa === undefined || m.Rm_Pa === undefined || m.Re_Pa <= m.Rm_Pa, {
    message: 'Re doit être ≤ Rm.',
    path: ['Re_Pa'],
  })
  .refine(
    (m) =>
      m.selectionSource !== undefined ||
      (m.costIndex === undefined &&
        m.processes === undefined &&
        m.sectors === undefined &&
        m.applicationNotes === undefined &&
        m.pros === undefined &&
        m.cons === undefined),
    {
      message: 'Indiquez la source du prix, des procédés ou des secteurs.',
      path: ['selectionSource'],
    },
  );

export type Material = z.infer<typeof MaterialSchema>;
