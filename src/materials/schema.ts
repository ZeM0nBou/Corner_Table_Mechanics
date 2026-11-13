/**
 * Schéma Zod d'un matériau (format défini dans CLAUDE.md, § Base de données matériaux).
 *
 * Toutes les grandeurs sont en unités SI. Le schéma vérifie aussi la
 * cohérence physique minimale des valeurs (signes, bornes, Re ≤ Rm…).
 * Il sert à la base de référence ET aux matériaux importés par l'utilisateur
 * (entrée non fiable) : les champs inconnus sont donc rejetés.
 */
import { z } from 'zod';

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
  })
  .refine((m) => m.Re_Pa === undefined || m.Rm_Pa === undefined || m.Re_Pa <= m.Rm_Pa, {
    message: 'Re doit être ≤ Rm.',
    path: ['Re_Pa'],
  });

export type Material = z.infer<typeof MaterialSchema>;
