/**
 * Aide au choix d'un matériau : indice de prix, aptitude aux procédés de
 * fabrication, secteurs d'utilisation. Listes fixes (vocabulaire contrôlé)
 * pour une saisie, une recherche et un affichage homogènes.
 *
 * Ces indications sont QUALITATIVES : elles servent d'aide-mémoire en
 * pré-dimensionnement et ne remplacent ni une fiche fournisseur, ni un devis,
 * ni une procédure de soudage qualifiée.
 */

/** Indice de prix : 1 à 5 symboles €. */
export const COST_INDICES = [1, 2, 3, 4, 5] as const;
export type CostIndex = (typeof COST_INDICES)[number];

/**
 * Échelle de l'indice de prix : prix indicatif d'un demi-produit (tôle, barre,
 * profilé ; pièce brute pour les fontes) acheté en petite quantité chez un
 * distributeur, hors usinage, transport et TVA. Ordres de grandeur seulement :
 * les cours varient fortement (alliages, surcharges, quantités).
 */
export const COST_SCALE: Record<CostIndex, string> = {
  1: '< 2 €/kg',
  2: '2 à 5 €/kg',
  3: '5 à 15 €/kg',
  4: '15 à 40 €/kg',
  5: '> 40 €/kg',
};

/** Niveaux d'aptitude à un procédé. */
export const RATINGS = ['excellent', 'bon', 'precautions', 'deconseille'] as const;
export type Rating = (typeof RATINGS)[number];

export const RATING_LABELS: Record<Rating, string> = {
  excellent: 'Excellent',
  bon: 'Bon',
  precautions: 'Possible avec précautions',
  deconseille: 'Déconseillé',
};

/** Procédés de fabrication, par groupe (ordre d'affichage). */
export const PROCESS_GROUPS = [
  {
    label: 'Découpe',
    processes: [
      { key: 'decoupeLaser', label: 'Découpe laser' },
      { key: 'jetEau', label: 'Découpe jet d’eau' },
      { key: 'plasma', label: 'Découpe plasma' },
      { key: 'oxycoupage', label: 'Oxycoupage' },
    ],
  },
  {
    label: 'Usinage et assemblage',
    processes: [
      { key: 'usinage', label: 'Usinage' },
      { key: 'soudage', label: 'Soudage' },
      { key: 'brasage', label: 'Brasage' },
    ],
  },
  {
    label: 'Mise en forme',
    processes: [
      { key: 'pliage', label: 'Pliage, formage à froid' },
      { key: 'emboutissage', label: 'Emboutissage' },
      { key: 'forgeage', label: 'Forgeage' },
      { key: 'filage', label: 'Filage (extrusion)' },
    ],
  },
  {
    label: 'Fonderie, fabrication additive, traitements',
    processes: [
      { key: 'fonderie', label: 'Fonderie' },
      { key: 'fabricationAdditive', label: 'Fabrication additive' },
      { key: 'traitementThermique', label: 'Traitement thermique' },
    ],
  },
  {
    label: 'Traitements de surface',
    processes: [
      { key: 'anodisation', label: 'Anodisation' },
      { key: 'galvanisation', label: 'Galvanisation à chaud' },
      { key: 'peinture', label: 'Peinture, thermolaquage' },
    ],
  },
] as const;

export type ProcessKey = (typeof PROCESS_GROUPS)[number]['processes'][number]['key'];

export const PROCESS_KEYS = PROCESS_GROUPS.flatMap((g) => g.processes.map((p) => p.key)) as [
  ProcessKey,
  ...ProcessKey[],
];

export const PROCESS_LABELS = Object.fromEntries(
  PROCESS_GROUPS.flatMap((g) => g.processes.map((p) => [p.key, p.label])),
) as Record<ProcessKey, string>;

/** Secteurs d'utilisation. */
export const SECTORS = {
  aeronautique: 'Aéronautique et spatial',
  automobile: 'Automobile',
  ferroviaire: 'Ferroviaire',
  naval: 'Naval et offshore',
  medical: 'Médical',
  agroalimentaire: 'Agroalimentaire',
  chimie: 'Chimie et pharmacie',
  energie: 'Énergie',
  btp: 'BTP et charpente',
  architecture: 'Architecture et mobilier',
  mecanique: 'Mécanique générale',
  sport: 'Sport et loisirs',
} as const;

export type SectorKey = keyof typeof SECTORS;
export const SECTOR_KEYS = Object.keys(SECTORS) as [SectorKey, ...SectorKey[]];
