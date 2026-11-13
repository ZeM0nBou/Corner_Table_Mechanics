# CLAUDE.md — Calculs RDM « coin de table »

## Objectif du projet

Application web de **pré-dimensionnement en résistance des matériaux** : les calculs analytiques rapides qu'un ingénieur fait à la main avant une simulation éléments finis.
Public : ingénieurs et techniciens en mécanique et structure.
L'outil doit être **fiable, traçable et facilement partageable** (un simple lien, sans installation).

Ce n'est PAS un logiciel de calcul réglementaire certifié. L'interface doit toujours le rappeler.

## Stack imposée

- **TypeScript strict** (`"strict": true`), sans `any`
- **Vite + React** pour le front
- **Tailwind CSS** pour le style
- **Vitest** pour les tests
- **Zod** pour valider les données (base matériaux, entrées utilisateur)
- **Recharts** (ou équivalent léger) pour les diagrammes (effort tranchant, moment fléchissant, flèche)
- **Application 100 % statique** : aucun serveur, tous les calculs s'exécutent dans le navigateur
- Déploiement sur **GitHub Pages** (ou Netlify / Vercel) via GitHub Actions

Ne pas ajouter de dépendance sans l'expliquer et me demander d'abord.

## Architecture

```
src/
  core/              # Moteur de calcul : TypeScript pur, AUCUNE dépendance à React
    units.ts         # Conversions d'unités
    sections/        # Propriétés de sections (A, I, W, i, J…)
    beams/           # Poutres : réactions, V, M, flèche
    stress/          # Contraintes, von Mises, Tresca, coefficients de sécurité
    buckling/        # Flambement (Euler, Johnson…)
    ...              # Autres modules ajoutés au fil de l'eau
  materials/
    data/*.json      # Base de données matériaux (une famille par fichier)
    schema.ts        # Schéma Zod d'un matériau
    index.ts         # Chargement et validation
  ui/                # Composants React, un dossier par module de calcul
  share/             # Encodage et décodage d'un calcul dans l'URL
tests/               # Miroir de src/core et src/materials
```

**Règle absolue : `core/` ne connaît pas l'UI.** Chaque fonction de calcul est pure : entrées typées, sorties typées, pas d'effet de bord. Le moteur reste ainsi testable et réutilisable (et portable vers un autre front ou vers Python si besoin).

## Conventions de calcul

- **Unités SI en interne** : m, N, Pa, kg, K. Les conversions (mm, MPa, kN, GPa…) se font **uniquement** dans l'UI.
- Chaque grandeur physique porte son unité dans son nom ou dans son type (ex. `length_m`, `force_N`), ou passe par des types dédiés.
- **Conventions de signe** à documenter en tête de chaque module (ex. poutres : moment positif quand la fibre inférieure est tendue). Elles sont aussi rappelées dans l'UI à l'aide d'un petit schéma.
- Hypothèses par défaut, à afficher avec chaque résultat : petites déformations, matériau élastique linéaire homogène isotrope, théorie d'Euler-Bernoulli (sauf indication contraire).

## Traçabilité des formules (obligatoire)

Chaque fonction de calcul du `core` contient un commentaire JSDoc qui précise :
- la **formule** utilisée ;
- sa **source** (ex. *Roark's Formulas for Stress and Strain, 8e éd., tableau 8.1, cas 2a* ; *Timoshenko* ; *Eurocode 3, §6.3.1*) ;
- les **hypothèses et limites de validité**.

Chaque résultat affiché dans l'UI propose un volet « Détail du calcul » avec la formule, les valeurs numériques substituées et la source.

**N'écris jamais une formule de mémoire sans la sourcer.** Si tu n'es pas certain d'une formule ou d'un coefficient, dis-le explicitement et ajoute `// TODO: à vérifier` plutôt que de deviner.

## Tests (obligatoires)

- Chaque fonction du `core` a des tests Vitest **avant** d'être branchée à l'UI.
- Les tests utilisent des **cas de référence connus** (exemples de manuels, cas analytiques triviaux), avec la source en commentaire.
- On teste aussi les cas limites : valeurs nulles, négatives, géométries impossibles (elles doivent lever une erreur claire).
- Tolérances relatives explicites (ex. `toBeCloseTo` avec une précision justifiée).
- `npm test` doit passer avant tout commit.

## Base de données matériaux

### Format
Un fichier JSON par famille dans `src/materials/data/` (`aciers.json`, `aluminiums.json`, `inox.json`, `fontes.json`, `titanes.json`, `polymeres.json`, `bois.json`…). Chaque entrée est validée par Zod au chargement :

```ts
{
  id: string,              // slug unique, ex. "s235jr"
  name: string,            // "S235JR"
  family: string,          // "acier de construction"
  standard?: string,       // "EN 10025-2"
  condition?: string,      // état / traitement, ex. "T6", "recuit"
  E_Pa: number,            // module d'Young
  nu: number,              // coefficient de Poisson
  rho_kg_m3: number,       // masse volumique
  Re_Pa?: number,          // limite élastique (Rp0.2 si pas de palier)
  Rm_Pa?: number,          // résistance à la rupture
  A_percent?: number,      // allongement à rupture
  alpha_1_K?: number,      // dilatation thermique
  thicknessRange_m?: [number, number],  // si Re dépend de l'épaisseur
  source: string,          // OBLIGATOIRE : norme ou référence
  verified: boolean,       // true seulement après relecture humaine
  notes?: string
}
```

### Règles
- **Aucune valeur sans source.** Si tu ajoutes un matériau, cite la norme ou la référence et mets `verified: false`. Seul moi passe une entrée à `true`.
- Ne pas inventer de valeurs. En cas de doute, laisse le champ vide plutôt que d'approximer.
- Quand une propriété dépend de l'épaisseur (aciers de construction), le préciser via `thicknessRange_m` ou plusieurs entrées.
- L'UI affiche un badge « non vérifié » sur les matériaux `verified: false`.

### Matériaux personnalisés
- L'utilisateur peut créer ses propres matériaux dans l'UI. Ils sont stockés dans `localStorage` (lecture et écriture protégées par try/catch).
- Ils peuvent être **exportés et importés en JSON** (même schéma Zod) pour être partagés entre collègues.
- Un matériau personnalisé ne modifie jamais la base de référence.

## Partage

- Chaque calcul est **encodé dans l'URL** (paramètres compressés, ex. avec `lz-string`), si bien que copier le lien suffit à partager un calcul complet.
- Si le calcul utilise un matériau personnalisé, ses propriétés sont incluses dans le lien.
- Bouton « Copier le lien » et bouton « Exporter » (PDF via l'impression du navigateur, avec une feuille de style `@media print` propre : entrées, hypothèses, formules, résultats, sources, date).

## UI / UX

- Interface en **français**.
- Un module = une page, avec, de haut en bas : schéma du cas → entrées → résultats → détail du calcul.
- Les unités sont sélectionnables à côté de chaque champ (mm / m, N / kN, MPa / GPa…).
- Les résultats se recalculent en direct, et les entrées invalides sont signalées clairement.
- Comparaison au critère : afficher le coefficient de sécurité et un code couleur (OK / limite / KO) avec un seuil réglable.
- Responsive : l'outil doit rester utilisable sur une tablette.
- Avertissement permanent et discret : « Outil de pré-dimensionnement — ne remplace pas une note de calcul vérifiée. »

## Dépôt public — sécurité

Le dépôt GitHub est **public** : tout ce qui est poussé (code, historique complet, messages de commit, adresse e-mail des commits) est visible par tous, peut être copié et indexé, et le reste même après suppression.

### Ne jamais committer
- **Aucun secret** : token, clé API, mot de passe, clé SSH, certificat, fichier `.env*`. L'application est 100 % statique et n'a besoin d'aucun secret. Si un secret semble nécessaire, s'arrêter et me demander.
- **Aucune donnée confidentielle** : notes de calcul ou plans de clients, données d'employeur, noms de projets réels, chemins locaux contenant des informations personnelles. Les exemples et les tests utilisent des cas de manuels ou des valeurs fictives.
- **Pas de texte protégé par le droit d'auteur** : ne pas recopier de paragraphes ni de tableaux de normes (EN, ISO…) ou d'ouvrages (Roark…). Citer la référence et ne reprendre que les valeurs numériques utiles.
- Relire `git diff --staged` avant chaque commit. Si un secret a été poussé, me prévenir immédiatement : il doit être **révoqué**, car réécrire l'historique ne suffit pas.

### Historique git
- Ne jamais faire `git push --force` sur `main`, ni réécrire un historique déjà poussé.
- Ne pas modifier l'identité git (nom ou e-mail) sans me demander.

### GitHub Actions
- Permissions minimales : `contents: read` par défaut, et les droits d'écriture seulement dans le job qui en a besoin (déploiement).
- Ne jamais utiliser le déclencheur `pull_request_target`.
- Ne jamais insérer `${{ github.event.* }}` (titre de PR, nom de branche…) directement dans un `run:` : c'est une injection de commandes possible. Passer par une variable `env:`.
- Actions autorisées : les actions officielles `actions/*`, épinglées sur une version. Toute autre action doit m'être soumise avant d'être ajoutée.
- Aucun secret dans les workflows.

### Dépendances
- Une nouvelle dépendance doit être maintenue et largement utilisée. Vérifier l'orthographe exacte du paquet (risque de typosquatting).
- `package-lock.json` est toujours commité, et la CI utilise `npm ci`.
- Pas de `npm audit fix --force` sans mon accord : il peut installer des versions majeures cassantes.

### Code de l'application
- Un lien partagé (URL) et un fichier JSON importé sont des **entrées non fiables** : toujours les valider avec Zod, borner leur taille (y compris après décompression) et rejeter proprement ce qui est invalide.
- Jamais de `dangerouslySetInnerHTML`, `eval` ni `new Function`, et ne jamais construire de HTML à partir de données utilisateur.
- Ne rien stocker de sensible dans `localStorage`.

## Feuille de route (dans cet ordre)

1. Socle : projet Vite + TS + tests + déploiement GitHub Pages fonctionnel, page d'accueil vide
2. `units.ts` + base matériaux (schéma, une dizaine de matériaux courants, sélecteur dans l'UI)
3. Sections : rectangle plein ou creux, rond plein ou tube, I/H, U, L, T
4. Poutres isostatiques : console et appui simple, charges ponctuelle, répartie, moment ; diagrammes V/M/flèche
5. Contraintes : traction, flexion, cisaillement, torsion, von Mises / Tresca
6. Flambement d'Euler (avec les longueurs de flambement usuelles)
7. Partage par URL + export PDF
8. Ensuite, selon le besoin : poutres hyperstatiques simples, superposition de cas, assemblages boulonnés, soudures, plaques (Roark), réservoirs sous pression, ressorts, concentrations de contraintes, fatigue simplifiée

## Façon de travailler

- **Un module à la fois.** Proposer un plan avant de coder, puis : core → tests → UI.
- Petits commits atomiques avec un message clair en français.
- Après chaque module, me résumer : formules implémentées, sources, cas testés, limites connues.
- Si une demande est ambiguë (convention, hypothèse, norme), **pose la question** plutôt que de supposer.
- Ne jamais supprimer ou affaiblir un test pour le faire passer.
