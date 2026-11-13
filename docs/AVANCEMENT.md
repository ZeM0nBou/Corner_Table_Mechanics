# Avancement du projet — Calculs RDM « coin de table »

_État au 13 novembre 2026. Ce document complète [CLAUDE.md](../CLAUDE.md), qui reste la référence pour les règles du projet._

Application en ligne : https://zem0nbou.github.io/Corner_Table_Mechanics/

---

## 1. Ce qui est fait

| Étape de la feuille de route                        | État       | Contenu                                                                                                                                                     |
| --------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Socle                                            | ✅         | Vite + React + TypeScript strict, Tailwind, Vitest, ESLint + Prettier, déploiement GitHub Pages par GitHub Actions, page d'accueil, avertissement permanent |
| 2. Unités + base matériaux                          | ✅         | `core/units.ts`, schéma Zod, 13 matériaux de référence, page Matériaux avec recherche et familles repliables                                                |
| 2bis. Matériaux personnalisés                       | ✅         | Création, modification, duplication, stockage dans le navigateur, export et import JSON avec résolution des conflits                                        |
| 2ter. Aide au choix des matériaux                   | ✅         | Indice de prix (€ à €€€€€), aptitude à 17 procédés, secteurs, emplois, atouts et limites                                                                    |
| 3. Sections                                         | ✅         | 8 formes paramétriques, schéma coté, résultats avec formules LaTeX et application numérique                                                                 |
| 3bis. Catalogue de profilés (IPE, HEA, HEB, UPN, L) | ⏳ à faire | —                                                                                                                                                           |
| 4. Poutres isostatiques                             | ✅         | Console, deux appuis avec porte-à-faux ; forces, couples, charges réparties linéaires ; réactions, V, M, rotation, flèche ; diagrammes SVG                  |
| 5 à 8                                               | ⏳ à faire | Contraintes, flambement, partage par URL et export PDF, modules complémentaires                                                                             |

**Qualité :** 383 tests Vitest, lint et vérification des types sans erreur. La CI bloque le déploiement si un test échoue.

### Pages de l'application

- **Accueil :** liste des modules et hypothèses par défaut.
- **Matériaux (`#/materiaux`) :** liste avec recherche (nom, norme, état, secteur, atouts), familles repliables, matériaux personnalisés en grisé dans leur famille. La fiche affiche les propriétés avec unités au choix, l'aide au choix, la source et les badges « non vérifié » et « personnalisé ». Formulaire de création contrôlé champ par champ ; import et export JSON.
- **Sections (`#/sections`) :** rectangle plein ou creux, rond, tube, profilés I/H, U, L, T. Schéma coté à l'échelle, cotes avec unités, choix facultatif d'un matériau pour la masse linéique. Résultats : A, G, Iy, Iz, Wel, Wpl, i, J, Av, plus les axes principaux pour la cornière. Formule et application numérique avec leur source sous chaque résultat (bouton ƒ, ou « Toutes / Aucune »).
- **Poutres (`#/poutres`) :** poutre sur deux appuis (porte-à-faux réglables) ou console encastrée à gauche ou à droite. Charges en liste : force ponctuelle, couple, charge uniforme, charge linéaire (triangle, trapèze), sur toute la longueur ou partielle. Rigidité : E du matériau ou saisi, I d'une section paramétrique ou saisi ; sans EI, seuls les réactions, V et M sont donnés. Résultats : réactions, |V|max, |M|max, flèche maximale, L/δ, rotation maximale, avec leur abscisse. Diagrammes V, M et flèche avec lecture exacte au survol. Formule fermée (bouton ƒ) quand un cas de table est reconnu ; volet « Détail du calcul » pour la méthode et les hypothèses.

---

## 2. Décisions d'architecture

### 2.1 Organisation du code

```
src/
  core/           TypeScript pur, aucune dépendance à React (règle vérifiée par ESLint)
    units.ts      conversions d'unités
    sections/     composite.ts (moteur à rectangles), shapes.ts (formes usuelles)
    beams/        model.ts (types, validation), solver.ts (Macaulay), analysis.ts (extremums, échantillons), sources.ts
  materials/      schéma Zod, données JSON, chargement, recherche, matériaux personnalisés
  ui/             composants React, un dossier par module (materials/, sections/)
  share/          vide (prévu pour l'étape 7)
tests/            miroir de core/, materials/ et des fonctions pures de ui/
```

- **Alias d'import :** `@core/*`, `@materials/*`, `@ui/*`, `@share/*`.
- **Isolation du moteur :** une règle ESLint `no-restricted-imports` interdit à `src/core/**` d'importer React ou l'UI.
- **Navigation :** par ancre (`#/materiaux`), sans bibliothèque de routage. C'est compatible GitHub Pages, qui ne réécrit pas les URL.
- **Fonctions pures de l'UI :** la logique testable de l'interface est sortie des composants, ce qui permet de la tester sans navigateur. Exemples : `materialDraft.ts`, `sectionForm.ts`, `annotations.ts`, `sectionFormulas.ts`, `format.ts`.

### 2.2 Types et unités

- **Unités :** tout est en SI dans le moteur. L'unité est portée par le nom de la variable (`E_Pa`, `A_m2`, `Iy_m4`, `rho_kg_m3`). Il n'y a pas de types « marqués » : TypeScript n'empêche pas d'additionner des m² et des m⁴.
- **`core/units.ts` :**
  - table `UNITS` de facteurs exacts vers le SI pour 10 grandeurs (longueur, force, contrainte, moment, aire, module de flexion, moment quadratique, masse volumique, masse linéique, dilatation) ;
  - `toSI(valeur, grandeur, unité)` et `fromSI(…)` : l'unité est vérifiée contre la grandeur à la compilation, et une valeur non finie lève une erreur ;
  - les conversions se font uniquement dans l'UI, dans `UnitInput` et `QuantityValue`.
- **Saisie :** à la française (`0,3`, `7 850`, `2,1e5`) par `parseDecimal`. Un champ vide donne `undefined`, une saisie invalide donne `NaN`.

### 2.3 API des sections (`@core/sections`)

```ts
computeSection(input: SectionInput): SectionResult      // lève SectionGeometryError si géométrie impossible
compositeProperties(rects: Rect[]): CompositeProperties  // moteur générique (rectangles alignés sur les axes)
principalAxes(Iy, Iz, Iyz): PrincipalAxes
torsionConstantRectangle(b_m, h_m): number
linearMass_kg_m(A_m2, rho_kg_m3): number
SECTION_SOURCES                                           // sources affichées avec chaque formule
```

- **Entrée `SectionInput` :** union discriminée par `shape` :
  - `'rectangle'` (b, h) et `'rectangleCreux'` (b, h, t) ;
  - `'rond'` (d) et `'tube'` (d, t) ;
  - `'I'`, `'U'` et `'T'` (h, b, tw, tf) ;
  - `'L'` (h, b, t).
- **Sortie `SectionResult` :**
  - A, yG, zG, Iy, Iz, Iyz, Wel,y, Wel,z (minimaux), Wpl,y, Wpl,z, axe neutre plastique (yPl, zPl), iy, iz ;
  - axes principaux (Iu, Iv, α, iu, iv), J, Av,z et Av,y (`undefined` si non définies) ;
  - géométrie pour le dessin, formules, sources et hypothèses.
- **Méthode des profils I, U, L, T et du rectangle creux :** décomposition en rectangles. Le centre de gravité et les moments quadratiques viennent du théorème de Huygens. Wpl s'obtient en cherchant l'axe neutre plastique par dichotomie. Le rond et le tube utilisent des formules fermées.

### 2.3bis API des poutres (`@core/beams`)

```ts
solveBeam(model: BeamModel, options?: { allowHyperstatic?: boolean }): BeamSolution  // lève BeamModelError
shear_N(sol, x, côté?) · moment_Nm(sol, x, côté?) · slope_rad(sol, x) · deflection_m(sol, x)
beamExtrema(sol): BeamExtrema          // min et max de V, M, θ, w avec leur abscisse
sampleBeam(sol, nbPoints?): BeamSample[]  // points doublés aux discontinuités
combineSolutions([{ solution, factor }]): BeamSolution  // superposition de cas
classifyBeam(model) · validateBeamModel(model) · loadTerms(model) · breakpoints(sol)
BEAM_SOURCES · BEAM_ASSUMPTIONS
```

- **Modèle :** `{ length_m, EI_Nm2?, supports, loads }`.
  - Appuis à position libre : `appui` (w = 0) ou `encastrement` (w = 0 et θ = 0).
  - Charges : `ponctuelle` (x, Fz), `couple` (x, C), `repartie` (x1, x2, q1, q2, variation linéaire).
- **Méthode :** fonctions de singularité (Macaulay). Chaque charge ou réaction est un terme c·⟨x − a⟩ⁿ, intégré exactement. Les inconnues (réactions, EI·θ₀, EI·w₀) viennent d'un système linéaire (équilibre + conditions aux appuis) résolu par pivot de Gauss, adimensionné par L. EI constant n'intervient pas dans le système.
- **Hyperstatique :** le solveur le traite déjà (testé : encastrée-appuyée, bi-encastrée, deux travées). Il est refusé par défaut ; `allowHyperstatic: true` le débloque. L'UI ne l'expose pas encore.
- **Superposition :** la solution est une liste de termes, donc additionnable et pondérable par `combineSolutions` sans recalcul (même longueur, même EI, mêmes appuis).
- **Extremums :** valeurs aux bornes de chaque tronçon et aux zéros de la dérivée (q pour V, V pour M, M pour θ, θ pour w), trouvés par dichotomie.
- **Sans effort normal :** articulation et appui à rouleau sont confondus.

### 2.4 Conventions

- **Poutres, dans le moteur :** forces, charges réparties, réactions et flèche positives vers le haut (+z) ; couples et rotation positifs dans le sens trigonométrique ; V = somme des forces vers le haut à gauche de la coupe ; M positif quand la fibre inférieure est tendue. D'où dV/dx = q, dM/dx = V, EI·w″ = M. Un couple trigonométrique C fait sauter M de −C.
- **Poutres, dans l'UI :** forces et charges réparties saisies positives **vers le bas** ; le signe est inversé dans `beamForm.ts`, et nulle part ailleurs. Les couples gardent le sens trigonométrique.
- **Diagrammes :** SVG maison (`BeamDiagram`, fonctions pures dans `diagram.ts`), pas de Recharts.

- **Axes (EN 1993-1-1 §1.7) :** y horizontal vers la droite, z vertical vers le haut, x le long de la poutre. Iy correspond à la flexion autour de y (axe fort d'un I).
- **Origine O :** coin inférieur gauche de la boîte englobante. yG et zG sont donnés depuis O.
- **Angle α :** angle de l'axe principal u (moment maximal) depuis y, sens trigonométrique, dans ]−π/2, π/2].
- **Wel :** valeur minimale, sur la fibre la plus éloignée du centre de gravité.
- **Formules dans l'UI :** LaTeX rendu par KaTeX, chargé à la demande et sans `dangerouslySetInnerHTML`. L'application numérique est en mm et se termine par la valeur calculée par le moteur, jamais par un recalcul. Le volet « Détail du calcul » de CLAUDE.md prend la forme du bouton ƒ sous chaque résultat (formule, application numérique, source), plus la ligne d'hypothèses.

### 2.5 Matériaux

- **Schéma Zod strict :** les champs inconnus sont refusés. Contrôles physiques : E et ρ > 0, 0 ≤ ν < 0,5, Re ≤ Rm. La source est obligatoire, et `selectionSource` l'est aussi dès qu'une indication d'aide au choix est renseignée.
- **Une entrée par nuance et par état :** quand une propriété dépend de l'épaisseur, on stocke la **moyenne** des tranches courantes. Les valeurs de chaque tranche vont dans `notes`, et un écart de plus de 10 % est signalé. `Rm_Pa` est le minimum garanti.
- **Aide au choix :** vocabulaire fixe dans `selection.ts` (17 procédés, 4 niveaux d'aptitude, 12 secteurs). Échelle de prix en €/kg pour un demi-produit en petite quantité chez un distributeur : `<2`, `2–5`, `5–15`, `15–40`, `>40`.
- **Matériaux personnalisés :**
  - identifiants préfixés `perso-` ;
  - stockage `localStorage` (clé `rdm.materiaux-perso`) dont chaque accès est protégé par try/catch ;
  - export versionné `{ format: "rdm-materiaux", version: 1, materials }` ;
  - import limité à 1 Mo et 500 matériaux, une entrée invalide étant refusée seule ;
  - en cas de conflit d'identifiant, l'utilisateur choisit (remplacer, garder les deux, ignorer).

### 2.6 Outillage et environnement

- **Versions :** TypeScript est fixé à `~6.0.3`, parce que `typescript-eslint` ne gère pas encore TypeScript 7. Vite 8, React 19, Zod 4, Tailwind 4, KaTeX 0.19.
- **Dépendances ajoutées avec accord :** `zod` (prévue par la stack) et `katex`.
- **Spécificités du poste Windows :**
  - lancer les tests depuis un chemin `C:\…` en majuscule, sinon Vitest charge deux instances et échoue ;
  - `git push` passe par `git -c http.sslBackend=schannel push`.
- **Identité git :** adresse anonyme GitHub (`…@users.noreply.github.com`) pour ce dépôt. Les 7 premiers commits portent encore l'ancienne adresse.

---

## 3. Limites connues

### Données matériaux

- **Aucune valeur relue par un humain :** les 13 matériaux sont en `verified: false`. Les valeurs ont été recoupées avec des sources web secondaires (aciéries, fournisseurs), pas avec le texte des normes.
- **Valeurs moyennées :** ce sont des moyennes entre tranches d'épaisseur. Pour une pièce massive en 42CrMo4, Re réel = 750 MPa, contre 825 MPa en moyenne (−9 %).
- **Prix :** ce sont des ordres de grandeur. Pour les aluminiums, ce sont des estimations faute de cotation publique ; pour les fontes, il s'agit du prix d'une pièce brute.
- **Aptitudes aux procédés :** indications qualitatives, issues principalement de la connaissance métier.

### Sections

- **Pas de congés ni d'arrondis d'angle :** environ −5 % sur Iy par rapport aux catalogues, par exemple 1846 cm⁴ pour un « IPE 200 » paramétrique contre environ 1940 cm⁴ au catalogue.
- **Torsion :** seule la torsion de Saint-Venant est prise en compte (pas de gauchissement). J des profils ouverts est approché par Σ b·t³/3, et celui du rectangle creux par la formule de Bredt (paroi mince).
- **Centre de cisaillement :** il n'est pas calculé, ce qui compte pour le U et la cornière.
- **Profilé I :** seulement symétrique (semelles identiques).
- **Aire de cisaillement :** non définie pour la cornière ni pour Vy sur le T. Pour les I/H, η = 1 et r = 0.

### Poutres

- **Euler-Bernoulli :** la flèche due à l'effort tranchant est négligée (poutres courtes sous-estimées).
- **EI constant** sur toute la longueur ; flexion plane autour de y, sans effort normal ni torsion.
- **Pas d'appui élastique, de rotule interne ni de tassement imposé.**
- **UI limitée à l'isostatique :** deux appuis ou un encastrement en bout. Le solveur accepte d'autres configurations, non exposées.
- **Formules fermées affichées pour 7 cas de table seulement** (une seule charge) ; les autres chargements n'affichent que la méthode générale, sans expression de M(x) par tronçon.
- **Extremums :** deux zéros distants de moins de 1/32 de tronçon peuvent être manqués.
- **Rapport L/δ :** calculé avec la longueur totale, y compris pour une console ou un porte-à-faux.
- **Pas de vérification de contrainte** (étape 5) ni de poids propre automatique.

### Application

- **Interface non testée automatiquement :** les composants React n'ont pas de tests (ni jsdom ni Testing Library), seules les fonctions pures de l'UI le sont. Le rendu (schéma, panneaux) se vérifie à la main.
- **Matériaux personnalisés :** non synchronisés entre deux onglets ouverts. Il faut les exporter pour les retrouver sur un autre poste.
- **Pas encore de partage d'un calcul par URL ni d'export PDF** (étape 7).
- **`groupByFamily`** (`materials/index.ts`) n'est plus utilisée par l'UI, remplacée par `buildFamilyGroups`. Elle est conservée et testée.
- **Audit npm :** 10 alertes « modérées » sur `minimatch`, uniquement dans l'outillage de lint. Les dépendances livrées au navigateur n'en ont aucune. On attend la correction en amont.

---

## 4. TODO

### À vérifier dans les sources (marqués `TODO: à vérifier` dans le code)

**Matériaux (`src/materials/data/`)**

- [ ] **1.4404 (priorité) :** ligne « bande laminée à froid » de EN 10088-2 (Rp0,2 = 240 MPa non confirmé).
- [ ] **1.4301 et 1.4404 :** annexe de EN 10088-1 (E, ρ, α), paragraphe de EN 1993-1-4 pour ν, et valeurs de l'édition 2024 de EN 10088-2.
- [ ] **S235JR :** source de ρ = 7850 kg/m³ (EN 1991-1-1 tab. A.4).
- [ ] **S275JR :** Re pour 16–40 mm et A.
- [ ] **S355JR :** A.
- [ ] **C45 +QT :** classe d ≤ 16 mm, et pertinence de E et ν génériques pour un acier trempé-revenu.
- [ ] **EN AW-6082 :** domaine de la seconde tranche d'épaisseur (25 mm retenus, une source donne 125 mm).
- [ ] **EN AW-7075 :** propriétés physiques (valeurs typiques).
- [ ] **EN-GJL-250 et EN-GJS-400-15 :** annexes de EN 1561 et EN 1563, et α.
- [ ] **Ti-6Al-4V :** E (110 à 120 GPa selon les sources) et α.
- [ ] Passer `verified` à `true` après relecture (à faire par le responsable du projet uniquement).

**Sections (`src/core/sections/`)**

- [ ] Numéros de tableau de Roark (8ᵉ éd.) pour les propriétés des sections planes et la torsion du rectangle plein.
- [ ] Paragraphe de référence de la formule de Bredt.
- [ ] Paragraphes de Timoshenko & Gere pour les axes principaux.
- [ ] EN 1993-1-1 §6.2.6(3) : vérifier Av pour les barres pleines (rectangle, rond), le rectangle creux, le tube et le T.

**Poutres (`src/core/beams/`)**

- [ ] Numéros de cas du tableau 8.1 de Roark (8ᵉ éd.) et de l'annexe de Gere & Goodno pour les formules fermées. Les valeurs ont été recoupées par le solveur (accord à 1e-9), pas avec les ouvrages.
- [ ] Paragraphes de Hibbeler et de Gere & Goodno pour les fonctions de singularité et la superposition ; référence exacte de l'article de Macaulay (1919).

### Développement

- [ ] **Étape 3bis :** catalogue IPE, HEA, HEB, UPN et cornières, valeurs sourcées (ArcelorMittal, EN 10365) en `verified: false`.
- [ ] **Poutres, suites possibles :** exposer l'hyperstatique dans l'UI, cas de charge pondérés (`combineSolutions`), poids propre depuis le matériau et la section, expression de M(x) par tronçon.
- [ ] **Étapes 5 à 8 :** contraintes et critères, flambement d'Euler, partage par URL et export PDF, modules complémentaires.
- [ ] Éventuellement : tests de composants React (nécessite jsdom et Testing Library, à valider), centre de cisaillement, profilé I à semelles différentes.
