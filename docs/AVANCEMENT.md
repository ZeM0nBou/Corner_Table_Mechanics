# Avancement du projet — Calculs RDM « coin de table »

_État au 16 novembre 2026. Ce document complète [CLAUDE.md](../CLAUDE.md), qui reste la référence pour les règles du projet._

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
| 4. Poutres (isostatiques et hyperstatiques)         | ✅         | Appuis et encastrements en nombre libre ; forces, couples, charges réparties linéaires, poids propre ; réactions, V, M, rotation, flèche ; diagrammes SVG   |
| 5. Contraintes et critères                          | ✅         | Moteur (Navier, flexion composée et déviée, τ moyen, torsion par forme, von Mises, Tresca, σ₁) ; vérification dans la page Poutres ; page Contraintes       |
| 6. Flambement                                       | ✅         | Euler et Johnson, longueurs de flambement usuelles ou K libre, deux plans (y/z ou u/v pour la cornière), coefficient de sécurité Ncr/N                      |
| 7. Partage + export PDF                             | ✅         | Lien compressé dans l’ancre (Sections, Poutres, Contraintes, Flambement), matériau inclus ; export PDF par l’impression, formules dépliées                  |
| 8. Modules complémentaires                          | ⏳ à faire | —                                                                                                                                                           |

**Qualité :** 596 tests Vitest, lint et vérification des types sans erreur. La CI bloque le déploiement si un test échoue.

### Pages de l'application

- **Accueil :** liste des modules et hypothèses par défaut.
- **Matériaux (`#/materiaux`) :** liste avec recherche (nom, norme, état, secteur, atouts), familles repliables, matériaux personnalisés en grisé dans leur famille. La fiche affiche les propriétés avec unités au choix, l'aide au choix, la source et les badges « non vérifié » et « personnalisé ». Formulaire de création contrôlé champ par champ ; import et export JSON.
- **Sections (`#/sections`) :** rectangle plein ou creux, rond, tube, profilés I/H, U, L, T. Schéma coté à l'échelle, cotes avec unités, choix facultatif d'un matériau pour la masse linéique. Résultats : A, G, Iy, Iz, Wel, Wpl, i, J, Av, plus les axes principaux pour la cornière. Formule et application numérique avec leur source sous chaque résultat (bouton ƒ, ou « Toutes / Aucune »).
- **Poutres (`#/poutres`) :** schéma, puis appuis, charges, section et matériau, résultats et diagrammes (les charges sont juste sous le schéma pour voir son évolution).
  - **Appuis :** liste libre d'appuis simples et d'encastrements (A, B, C… dans l'ordre de la liste), ajout, suppression, et configurations usuelles en un clic (deux appuis, consoles, encastrée-appuyée, bi-encastrée). Les appuis placés à l'extrémité droite suivent la longueur. Poutre isostatique ou hyperstatique, signalée dans les résultats.
  - **Charges :** force ponctuelle, couple, charge uniforme, charge linéaire (triangle, trapèze), totale ou partielle. Chaque charge a sa couleur (palette catégorielle à 8 teintes, vérifiée pour les daltonismes) et son numéro, sur le schéma et dans la liste ; la couleur suit la charge quand une autre est supprimée.
  - **Poids propre :** activé par défaut et toujours en tête de la liste des charges, q = ρ·A·g₀ (ou m′·g₀ en saisie directe), dessiné en gris (« pp ») ; ignoré avec un message si le matériau ou la section manquent.
  - **Rigidité :** E du matériau ou saisi, I d'une section paramétrique (avec le schéma coté de l'onglet Sections et un bouton ⓘ qui montre les vignettes des formes au survol) ou saisi ; sans EI, seuls les réactions, V et M sont donnés.
  - **Vérification (étape 5b) :** contraintes de traction et de compression maximales (fibre et abscisse), cisaillement moyen τ = V/Av, contrainte équivalente (von Mises pour un matériau ductile, contrainte principale de traction pour un matériau fragile), résistance du matériau, coefficient de sécurité avec pastille OK / Limite / KO (icône et mot, seuil réglable, 1,5 par défaut), flèche comparée à L/limite (300 par défaut). Formule, application numérique et source sous chaque ligne (bouton ƒ). Indisponible en saisie directe de I ou sans matériau, avec un message.
  - **Résultats :** réactions et couples d'encastrement, |V|max, |M|max, flèche maximale, L/δ, rotation maximale, avec leur abscisse. Diagrammes V, M et flèche (toutes charges cumulées) : au-dessus de chacun, la valeur au point survolé et le min et le max avec leur abscisse ; extremums marqués sur la courbe. Formule fermée (bouton ƒ) quand un cas de table est reconnu ; volet « Détail du calcul ».
- **Contraintes (`#/contraintes`) :** schéma de la section cotée et conventions, section paramétrique et matériau, efforts N, My, Vz, T avec unités, seuil du coefficient de sécurité. Résultats : σN, traction et compression maximales (avec le point), τV, τT, τ retenu, von Mises, Tresca, σ₁, résistance et coefficient de sécurité avec pastille ; bouton ƒ sous chaque ligne ; remarques selon la forme (cornière, profil ouvert, matériau fragile) ; hypothèses et limites.
- **Flambement (`#/flambement`) :** schéma des quatre cas usuels, section et matériau, longueur, appuis de chaque plan (K usuel ou libre), effort de compression. Résultats : élancement et charge critique par plan (Euler ou Johnson), élancement de transition, N/A, coefficient de sécurité avec pastille, bouton ƒ, remarques et hypothèses.

---

## 2. Décisions d'architecture

### 2.1 Organisation du code

```
src/
  core/           TypeScript pur, aucune dépendance à React (règle vérifiée par ESLint)
    units.ts      conversions d'unités
    sections/     composite.ts (moteur à rectangles), shapes.ts (formes usuelles)
    beams/        model.ts (types, validation), solver.ts (Macaulay), analysis.ts (extremums, échantillons), sources.ts, selfWeight.ts
    buckling/     buckling.ts (Euler, Johnson, longueurs de flambement, vérification dans deux plans)
    stress/       stress.ts (Navier, τ, von Mises, Tresca, σ₁, n, verdict), beamCheck.ts (vérification d'une poutre), combined.ts (efforts combinés N, My, Vz, T)
  materials/      schéma Zod, données JSON, chargement, recherche, matériaux personnalisés
  ui/             composants React, un dossier par module (materials/, sections/)
  share/          codec.ts (compression bornée, base64url), schemas.ts (format des liens, Zod), share.ts (enveloppe, ancre), materialLink.ts (matériau partagé)
tests/            miroir de core/, materials/ et des fonctions pures de ui/
```

- **Alias d'import :** `@core/*`, `@materials/*`, `@ui/*`, `@share/*`.
- **Isolation du moteur :** une règle ESLint `no-restricted-imports` interdit à `src/core/**` d'importer React ou l'UI.
- **Navigation :** par ancre (`#/materiaux`), sans bibliothèque de routage. C'est compatible GitHub Pages, qui ne réécrit pas les URL.
- **Chargement à la demande :** les pages Matériaux, Sections et Poutres sont chargées par `React.lazy` (paquet initial 226 kB au lieu de 504 kB) ; KaTeX l'est à la première formule.
- **Composants partagés :** `FormulaTable` (tableau avec bouton ƒ : formule, application numérique, source), `InfoTip` (bouton ⓘ à panneau), `ShapeThumbnail` (vignette de forme de section), `SectionShapeFields` (choix de forme et cotes, pages Poutres et Contraintes), `VerdictBadge` (pastille OK / Limite / KO).
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
BEAM_SOURCES · BEAM_ASSUMPTIONS · selfWeight_N_m(m′) · STANDARD_GRAVITY_m_s2
```

- **Modèle :** `{ length_m, EI_Nm2?, supports, loads }`.
  - Appuis à position libre : `appui` (w = 0) ou `encastrement` (w = 0 et θ = 0).
  - Charges : `ponctuelle` (x, Fz), `couple` (x, C), `repartie` (x1, x2, q1, q2, variation linéaire).
- **Méthode :** fonctions de singularité (Macaulay). Chaque charge ou réaction est un terme c·⟨x − a⟩ⁿ, intégré exactement. Les inconnues (réactions, EI·θ₀, EI·w₀) viennent d'un système linéaire (équilibre + conditions aux appuis) résolu par pivot de Gauss, adimensionné par L. EI constant n'intervient pas dans le système.
- **Hyperstatique :** le solveur le traite déjà (testé : encastrée-appuyée, bi-encastrée, deux travées). Il est refusé par défaut ; `allowHyperstatic: true` le débloque, ce que fait l'UI.
- **Superposition :** la solution est une liste de termes, donc additionnable et pondérable par `combineSolutions` sans recalcul (même longueur, même EI, mêmes appuis).
- **Extremums :** valeurs aux bornes de chaque tronçon et aux zéros de la dérivée (q pour V, V pour M, M pour θ, θ pour w), trouvés par dichotomie.
- **Sans effort normal :** articulation et appui à rouleau sont confondus.

### 2.3ter API des contraintes (`@core/stress`)

```ts
bendingStress_Pa(M, Iy, z) · extremeFibres(h, zG) · averageShearStress_Pa(V, Av)
vonMises_Pa(σ, τ) · tresca_Pa(σ, τ) · maxPrincipalStress_Pa(σ, τ)
safetyFactor(R, σ) · verdict(n, seuil): 'ok' | 'limite' | 'ko'
beamStresses(input): BeamStresses          // traction et compression max (fibre, x, M), τ moyen max
strengthBasis(matériau): ductile (Re) | fragile (Rm) | undefined
checkBeamStrength(contraintes, base, seuil): StrengthCheck
checkDeflection(δmax, L, limite): DeflectionCheck
STRESS_SOURCES · StressInputError
```

- **Signe :** σ > 0 en traction ; σ(z) = −M·z/Iy, z depuis G vers le haut (M > 0 tend la fibre inférieure).
- **Côté UI :** `beamCheckModel.ts` (`evaluateCheck`, fonction pure testée) prépare les données et les messages ; `BeamCheck.tsx` les affiche ; `beamCheckFormulas.ts` produit le LaTeX.

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
- **Poids propre :** g₀ conventionnel (9,806 65 m/s²) ; congés des profilés négligés, donc A et le poids légèrement sous-estimés. Avec le poids propre, une poutre a deux charges : aucun cas de table n'est alors reconnu pour la formule fermée.
- **Schéma :** il n'est pas dessiné quand les données sont invalides ou que la poutre est un mécanisme (appuis insuffisants) ; seul le message d'erreur s'affiche. Au-delà de 8 charges, les couleurs se répètent (le numéro reste distinct).
- **Formules fermées affichées pour 7 cas de table seulement** (une seule charge) ; les autres chargements n'affichent que la méthode générale, sans expression de M(x) par tronçon.
- **Extremums :** deux zéros distants de moins de 1/32 de tronçon peuvent être manqués.
- **Rapport L/δ :** calculé avec la longueur totale, y compris pour une console ou un porte-à-faux.

### Contraintes (étape 5b)

- **Majorant :** σ_max et τ_max sont combinées même si elles ne sont pas atteintes au même point ni sur la même fibre.
- **τ moyen sur Av :** la répartition de Jourawski n'est pas calculée (maximum réel × 1,5 dans un rectangle plein). τ n'est pas calculée pour la cornière (Av non définie).
- **Fragile :** compression non vérifiée (pas de résistance en compression dans la base). Le critère retenu (fragile si Re absente) classe la seule EN-GJL-250 comme fragile.
- **Non vérifiés :** déversement, voilement local, fatigue, concentrations de contraintes ; pas de coefficient partiel γ_M0.
- **Saisie directe de I :** pas de vérification de contrainte (G, h et Av inconnus).
- **Flèche admissible :** une seule valeur L/limite, appliquée à la longueur totale (console comprise).

### Contraintes (page Contraintes, étape 5c)

- **Efforts :** N, My, Vz et T seulement (pas de Mz ni de Vy).
- **Majorant :** |σ|max combinée avec τ = τV + τT, même si ces maxima ne coïncident pas.
- **Torsion :** formule de Roark approchée pour le rectangle plein (quelques %) ; Bredt en paroi mince pour le rectangle creux, sans concentration aux angles ; T·tmax/J pour les profils ouverts (I, U, L, T), sans gauchissement gêné ni concentration aux angles rentrants.
- **Cornière :** σ en flexion déviée (avec Iyz) ; τV non calculée (Av non définie). Le centre de cisaillement du U et de la cornière n'est pas calculé : la torsion induite par Vz n'est pas comptée (signalée).
- **Sections paramétriques seulement** (pas de saisie directe de A et I).

### Application

- **Interface non testée automatiquement :** les composants React n'ont pas de tests (ni jsdom ni Testing Library), seules les fonctions pures de l'UI le sont. Le rendu (schéma, panneaux) se vérifie à la main.
- **Matériaux personnalisés :** non synchronisés entre deux onglets ouverts. Il faut les exporter pour les retrouver sur un autre poste.
- **Partage et export (étape 7) :** voir les limites de la section 7.
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

**Contraintes (`src/core/stress/`)**

- [ ] Paragraphes de Timoshenko & Gere pour la formule de Navier, le critère de Tresca et les contraintes principales.
- [ ] Torsion (`combined.ts`) : n° de tableau de Roark pour le rectangle plein (coefficients 0,6095 ; 0,8865 ; −1,8023 ; 0,9100) et les profils minces ouverts ; paragraphes de Bredt, de la torsion des arbres et de la flexion déviée.
- [ ] Paragraphe de l'EN 1990 (annexe A1.4) pour les limites de flèche.

**Flambement (`src/core/buckling/`)**

- [ ] Paragraphes de Timoshenko & Gere (Theory of Elastic Stability) pour Euler et les longueurs de flambement ; édition et n° d’équation de Shigley pour la parabole de Johnson ; paragraphe de l’EN 1993-1-1 §6.3.1.2.

**Poutres (`src/core/beams/`)**

- [ ] Numéros de cas du tableau 8.1 de Roark (8ᵉ éd.) et de l'annexe de Gere & Goodno pour les formules fermées. Les valeurs ont été recoupées par le solveur (accord à 1e-9), pas avec les ouvrages.
- [ ] Paragraphes de Hibbeler et de Gere & Goodno pour les fonctions de singularité et la superposition ; référence exacte de l'article de Macaulay (1919).

### Développement

- [ ] **Étape 3bis :** catalogue IPE, HEA, HEB, UPN et cornières, valeurs sourcées (ArcelorMittal, EN 10365) en `verified: false`.
- [ ] **Poutres, suites possibles :** cas de charge pondérés (`combineSolutions`, ex. 1,35 G + 1,5 Q), expression de M(x) par tronçon, schéma affiché même en cas d'erreur.
- [ ] **Poutres :** la flexion d’une cornière ignore Iyz (σ et flèche) ; la page Contraintes, elle, en tient compte. À aligner.
- [ ] **Étape 7, à valider par le responsable :** partage par lien et export PDF (section 7). Suites possibles : unités d'affichage de chaque champ dans le lien, partage de la page Matériaux (fiche d'un matériau), icône du site (`/favicon.ico` en 404, sans conséquence).
- [ ] **Étape 8 :** modules complémentaires.
- [ ] **Flambement, suites possibles :** courbes de flambement de l’EN 1993-1-1 §6.3.1 (χ), flambement par torsion et flexion-torsion des profils ouverts, K recommandés pour encastrements imparfaits.
- [ ] Éventuellement : tests de composants React (nécessite jsdom et Testing Library, à valider), centre de cisaillement, profilé I à semelles différentes.

---

## 5. Étape 5 terminée : contraintes et critères

### Plan (5a, 5b et 5c faits)

1. **5a. Moteur `core/stress/`** (TypeScript pur, testé avant l'UI) :
   - contrainte normale de flexion (Navier) σ(z) = −M·z/Iy, z mesuré depuis G vers le haut, **σ > 0 en traction** ; fibres extrêmes z_sup = h − zG et z_inf = −zG (sections non symétriques : T, L) ;
   - contrainte de cisaillement moyenne τ = V/Av,z ;
   - contraintes équivalentes de von Mises √(σ² + 3τ²) et de Tresca √(σ² + 4τ²), contrainte principale maximale σ₁ (critère de Rankine pour les matériaux fragiles) ;
   - coefficient de sécurité n = R/σ et verdict OK / limite / KO.
2. **5b. Page Poutres**, bloc « Vérification » sous les résultats : σ traction et σ compression maximales (fibre, abscisse), τ maximal, contrainte équivalente, résistance du matériau, coefficient de sécurité avec code couleur et icône ; flèche comparée à L/limite. Formules (bouton ƒ) avec application numérique et source.
3. **5c. Page Contraintes autonome** (`#/contraintes`) : section et efforts combinés N, My, Vz, T. Moteur `combined.ts` : σ = N/A + My·(Iyz·y − Iz·z)/(Iy·Iz − Iyz²) évaluée aux sommets de la section (se réduit à N/A − My·z/Iy si Iyz = 0) ; τV = |Vz|/Av ; τT = |T|/Wt avec Wt selon la forme ; von Mises, Tresca, σ₁. `checkStrength` est commune aux pages Poutres et Contraintes.

### Décisions de l'étape 5c (confirmées par le responsable du projet le 16 novembre 2026)

- **Efforts :** N, My, Vz, T (flexion plane autour de y, comme la page Poutres).
- **Combinaison :** majorant, comme en 5b (pas d'évaluation point par point).
- **Torsion :** calculée pour toutes les formes, avec la source et les limites de chaque formule (rectangle plein marqué `TODO: à vérifier`).

### Décisions (confirmées par le responsable du projet le 16 novembre 2026)

- **Matériau ductile** (Re renseignée : aciers, aluminiums, inox, titane, fonte GS) : contrainte équivalente de von Mises comparée à Re, signe indifférent. Coefficient de sécurité **brut** n = Re/σ_eq, sans coefficient partiel γ_M0.
- **Matériau fragile** (Re absente, Rm seule : fonte grise EN-GJL) : contrainte principale de **traction** σ₁ comparée à Rm. La **compression n'est pas vérifiée**, faute de résistance en compression dans la base. Aucun champ `Rc_Pa` n'a été ajouté au schéma.
- **Seuils réglables** : coefficient de sécurité « OK » à partir de **1,5** (« limite » entre 1 et 1,5, « KO » sous 1) ; flèche admissible **L/300** (pour une console, l'usage est plutôt L/150 : à régler à la main).
- **Majorant** : σ_max et τ_max sont combinés même s'ils ne sont pas atteints à la même abscisse ni sur la même fibre. C'est conservatif.
- **Section** : la vérification de contrainte demande une section paramétrique (zG, h, Av). En saisie directe de I, elle n'est pas proposée.
- **Hors périmètre, signalé dans l'UI** : déversement, voilement local, fatigue, concentrations de contraintes, cisaillement de Jourawski (répartition réelle de τ).

---

## 6. Étape 6 terminée : flambement

### Moteur (`core/buckling/`)

- Lk = K·L ; i = √(I/A) ; λ = Lk/i ; Ncr d'Euler = π²EI/Lk².
- Élancement de transition λc = π√(2E/Re) (tangence, σcr = Re/2). Sous λc : parabole de Johnson σcr = Re − (Re·λ/2π)²/E ; au-delà : Euler σcr = π²E/λ². Sans Re (fonte grise) : Euler seul, signalé.
- Deux plans de flambement, chacun avec son K ; le plan de plus petit Ncr gouverne. n = Ncr,min / N (N > 0 en compression).

### Décisions (confirmées par le responsable du projet le 16 novembre 2026)

- **Modèle :** Euler + Johnson (pas de courbes EC3 pour l'instant).
- **K :** valeurs théoriques 2 ; 1 ; 0,7 ; 0,5, plus un K saisi librement ; l'UI rappelle qu'un encastrement réel n'est jamais parfait.
- **Plans :** deux plans avec K distincts. Pour une section sans axe de symétrie (cornière), les plans sont les axes principaux u et v (choix fait lors du développement, cohérent avec la mécanique).
- **Seuil :** même seuil réglable que les contraintes (OK à partir de 1,5). Ncr est une charge de barre parfaite : l'UI signale l'effet des imperfections aux élancements intermédiaires. La question d'un seuil par défaut plus élevé (2 à 3, usage courant en mécanique sans courbe d'imperfection) a été posée ; le responsable a validé l'étape telle quelle, donc 1,5 reste la valeur par défaut. À revoir si besoin.
- **Étape 6 validée** par le responsable du projet le 16 novembre 2026 (poussée sur `main`, en ligne).

### Page (`#/flambement`)

Schéma des quatre cas (déformées schématiques, cas retenus surlignés), section paramétrique et matériau (ou E saisi), longueur, appuis de chaque plan, effort N, seuil. Résultats : λ et Ncr par plan (modèle Euler ou Johnson), λc, N/A, n avec pastille ; bouton ƒ ; remarques (axes principaux, profil ouvert, matériau sans Re, élancement intermédiaire).

### Limites

- Barre parfaite : pas d'imperfection, d'excentricité ni de contrainte résiduelle (n surestimé aux élancements moyens par rapport à l'EN 1993-1-1).
- Flambement par flexion seul : le flambement par torsion ou flexion-torsion (L, T, U) n'est pas calculé.
- Section constante, effort normal constant, matériau homogène.

---

## 7. Étape 7 terminée : partage par lien et export PDF (à valider)

### Décisions (confirmées par le responsable du projet le 16 novembre 2026)

- **Compression :** `CompressionStream('deflate-raw')` natif, sans dépendance (pas de `lz-string`).
- **Lien :** dans l'ancre, `#/poutres?c=…` (compatible GitHub Pages ; l'ancre n'est jamais envoyée au serveur).
- **Barre d'adresse :** non modifiée pendant la saisie ; le lien n'est fabriqué qu'au clic sur « Copier le lien ». Recharger une page ouverte par un lien revient aux valeurs du lien.
- **Matériau de référence :** identifiant + instantané (E, ν, ρ, Re, Rm). Si la base a changé depuis, l'écart est affiché et le calcul reprend les valeurs du lien (matériau temporaire « valeurs du lien », non vérifié). Absent de la base : reconstitué depuis le lien.
- **Matériau personnalisé :** inclus en entier ; chez le destinataire, temporaire pour ce calcul, avec un bouton « Ajouter à mes matériaux » (conflit d'identifiant : remplacer ou garder les deux, comme l'import JSON).

### Format et sécurité (`src/share/`)

- Enveloppe `{ v: 1, page, state }`, JSON → deflate brut → base64url. Un schéma Zod strict par page (`STATE_SCHEMAS`) ; nombres finis ; listes bornées (20 appuis, 100 charges) ; matériau personnalisé validé par `MaterialSchema`.
- Bornes : paramètre ≤ 16 000 caractères avant décodage ; JSON ≤ 256 ko, contrôlé **pendant** la décompression (arrêt d'une « bombe »). UTF-8 strict.
- Un champ vide ou invalide (`undefined`, `NaN`) est écrit `null` et relu vide.
- **Compatibilité :** un lien publié doit rester lisible. Toute modification incompatible des schémas impose `SHARE_VERSION = 2` et un décodeur pour la version 1.
- Ordre de grandeur : poutre par défaut ≈ 430 caractères de paramètre, lien complet ≈ 500.

### Interface

- `SharedPageLoader` décode le lien (asynchrone) avant de monter la page ; la page est remontée quand le lien change (`key`).
- `usePageMaterial` : matériau choisi, matériaux personnalisés et matériau reçu ; `LinkNotice` : bandeau (lien lu, lien inutilisable avec message, état du matériau) ; `ShareBar` : « Copier le lien » (repli : lien affiché à copier à la main) et « Exporter (PDF) ».
- Adaptateurs purs et testés : `sectionShare.ts`, `beamShare.ts` (identifiants d'appuis et de charges renumérotés à l'ouverture). Pages Contraintes et Flambement : correspondance directe.
- Poutres : les seuils de la vérification (n et L/limite) sont remontés de `BeamCheck` dans la page pour être partagés.
- **Export PDF :** le bouton déplie toutes les formules et le volet « Détail du calcul » (`PrintProvider`, contexte `expandAll`), attend le rendu KaTeX, puis appelle `window.print()` ; tout se replie à `afterprint`. En-tête imprimé : page, date et heure, avertissement, lien du calcul. Feuille `@media print` dans `index.css` (boutons d'action masqués, option choisie et sélecteur de matériau gardés, couleurs conservées, A4).

### Vérification

- 91 tests (codec avec vecteurs RFC 4648, liens tronqués ou forgés, bombe de décompression ; schémas ; matériau ; adaptateurs de section et de poutre).
- Contrôlé dans Chrome (piloté par script) : copie du lien, réouverture dans un navigateur au stockage vide (longueur et seuil restaurés), liens invalides (charabia, tronqué, autre page), matériau personnalisé ajouté à mes matériaux, écart de matériau de référence affiché, PDF des pages Poutres et Sections relu.

### Limites

- **Unités d'affichage** de chaque champ non partagées (le destinataire voit les unités par défaut, les valeurs sont identiques) ; seule l'unité des abscisses de la page Poutres l'est.
- Un champ contenant une saisie invalide revient vide.
- Impression par Ctrl+P : seules les formules déjà dépliées sont imprimées (le bouton « Exporter » déplie tout) ; l'en-tête a la date mais pas le lien.
- Page Matériaux non partageable par lien.
- Un lien de matériau temporaire repartagé l'est comme matériau personnalisé.
