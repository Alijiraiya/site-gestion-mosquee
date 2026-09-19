# Suite de tests complete -- Application de gestion des dons

`test-full-suite.mjs` -- 3 979 lignes, **829 assertions**, 16 sections, 101 blocs proteges.

> **AVERTISSEMENT** : a executer **uniquement sur une base de developpement**.
> Le script cree, modifie et supprime des donnees reelles (familles, dons, distributions,
> parametres, mot de passe). Il restaure tout a la fin, mais un plantage en cours de route
> peut laisser des residus. Ne jamais lancer sur la base de production.

---

## 1. Prerequis

1. L'application tourne : `npm run dev` (par defaut `http://localhost:3000`).
2. Vous connaissez le mot de passe d'un compte imam et l'identifiant de sa mosquee.
3. Node 18 ou superieur (le script n'utilise que `fetch` natif -- **aucune dependance a installer**).

---

## 2. Lancement

Placez le fichier a la racine du projet, puis :

```powershell
node test-full-suite.mjs --mosque cmsexl13m0001cgeytn0mer03 --password "imam1111"
```

Si vous omettez `--mosque`, le script tente de resoudre la mosquee tout seul ; s'il y en a
plusieurs il affiche la liste et s'arrete pour que vous choisissiez.

### Options

| Option | Effet |
|---|---|
| `--base <url>` | URL de l'application (defaut `http://localhost:3000`) |
| `--mosque <id>` | Identifiant de la mosquee de test |
| `--password <mdp>` | Mot de passe du compte imam |
| `--only S5,S7` | N'executer que ces sections |
| `--skip S2,S15` | Executer tout sauf ces sections |
| `--repeat 3` | Rejouer toute la suite N fois (conditions repetitives) |
| `--keep` | Ne pas nettoyer les donnees de test a la fin |
| `--bail` | S'arreter au premier echec |
| `--verbose` | Afficher chaque requete HTTP |
| `--list` | Lister les sections et sortir (ne touche pas au reseau) |
| `--timeout 30000` | Delai maximum par requete, en ms |
| `--out <nom>` | Nom de base des rapports (defaut `test-report-full`) |

Les variables d'environnement `BASE`, `MOSQUE` et `PASSWORD` sont acceptees en remplacement.

### Exemples utiles

```powershell
# Voir la liste des sections sans rien executer
node test-full-suite.mjs --list

# Uniquement le moteur SVF et le water-filling
node test-full-suite.mjs --only S7,S8 --mosque <id> --password "..."

# Trois passes completes pour detecter les derives d'etat
node test-full-suite.mjs --repeat 3 --mosque <id> --password "..."

# Sauter la creation de compte (evite de polluer la table User)
node test-full-suite.mjs --skip S2 --mosque <id> --password "..."

# Inspecter les donnees generees apres coup
node test-full-suite.mjs --keep --mosque <id> --password "..."
```

---

## 3. Sections

| # | Section | Assertions | Contenu |
|---|---|---:|---|
| S0 | Amorcage | -- | Joignabilite, resolution de la mosquee, connexion, instantanes des parametres |
| S1 | Authentification | 77 | Cascade wilaya/commune/mosquee, matrice d'erreurs de connexion, JWT, cookie HttpOnly, profil, changement de mot de passe, deconnexion des autres appareils |
| S2 | Creation de compte | 29 | Champs obligatoires, format d'e-mail, longueur du mot de passe, doublons, compte B pour les tests de cloisonnement |
| S3 | Fiche mosquee | 21 | Lecture, types, matrice de modification, restauration |
| S4 | Parametres | 92 | 2 booleens, 17 entiers, 5 decimaux, poids SVF, reset par portee, propagation aux scores, ecritures concurrentes |
| S5 | Familles | 128 | 8 champs obligatoires, etat civil, 4x4 logement, unicite CCP, types, filtres, edition, suppression douce/definitive |
| S6 | Membres et enfants | 102 | Roles, garde-fous du chef, **promotion SPOUSE -> MARIE**, **membersCount et ajouts successifs**, routes enfants, 10 ajouts concurrents |
| S7 | Score SVF | 22 | **Calibration empirique des 12 facteurs**, bornes exactes, priorites, profils composites, 15 mutations sequentielles |
| S8 | Water-filling | 69 | Validation du budget, 20 invariants, reserve, bornes min/max, selection, monotonie, proportionnalite |
| S9 | Distributions | 84 | Confirmation, paiement, solde de la mosquee, annulation, distribution manuelle, 3 cycles enchaines |
| S10 | Donateurs et dons | 68 | Doublons, **KAFFARA refusee**, 4 categories x 3 moyens, deltas de solde, dons anonymes |
| S11 | Tableau de bord | 36 | Statistiques, resume financier, **axe Y du graphique Entrees/Sorties**, repartition sociale |
| S12 | Documents | 19 | Televersement, telechargement, en-tetes, suppression |
| S13 | Securite | 19 | 401 sur 48 routes, jetons falsifies, **cloisonnement entre mosquees**, aucune fuite de donnees |
| S14 | Contrats d'API | 16 | Enveloppe `{success, data}`, types, methodes HTTP, champs inconnus ignores |
| S15 | Fuzzing | 14 | Corps JSON invalides, 20 chaines hostiles, valeurs numeriques limites, concurrence, boucles repetitives |
| S16 | Non-regression | 26 | Les 7 correctifs livres precedemment |

---

## 4. Points remarquables

**La section S7 ne code en dur aucun poids SVF.** Elle mesure empiriquement la contribution de
chaque facteur en creant une famille de reference puis en faisant varier un seul attribut a la
fois. Les valeurs mesurees sont ensuite comparees a `GET /api/settings`. Si vous modifiez un
poids dans les parametres, les tests suivent automatiquement -- ils detectent en revanche un
ecart entre le poids **configure** et le poids **reellement applique**.

**La section S8 privilegie les invariants** plutot que de reimplementer l'algorithme :
somme allouee <= budget net, `unallocated >= 0`, respect des bornes min/max, arrondi a
2 decimales, monotonie score -> montant, et rapport `montant / score^exposant` constant a
moins de 2 % pres entre toutes les familles servies.

**Aucun fichier du projet n'est modifie.** Le script agit exclusivement par appels HTTP sur
l'API. Le schema Prisma, `svf.js`, `waterFilling.js` et les routes ne sont jamais touches.

---

## 5. Sorties

A la fin, deux fichiers sont ecrits dans le repertoire courant :

- **`test-report-full.json`** -- resultat detaille : chaque assertion, son intitule, son type
  (`PASS`/`FAIL`/`SKIP`/`INFO`/`WARN`), le detail en cas d'echec, les poids SVF mesures, la
  couverture des routes, le bilan du nettoyage.
- **`test-report-full.md`** -- rapport lisible : synthese par section, liste des echecs,
  tableau comparant poids configures et poids mesures, requetes SQL de purge.

Code de sortie : `0` si aucun echec, `1` sinon, `2` en cas d'erreur non rattrapee.

**Envoyez-moi `test-report-full.json` pour que je l'analyse.**

---

## 6. Nettoyage

Toutes les donnees creees portent le prefixe `ZZTEST` et un suffixe numerique unique par
execution. A la fin, le script supprime dans l'ordre : distributions, documents, dons,
donateurs, familles ; puis reinitialise les parametres et restaure la fiche mosquee ainsi que
le mot de passe.

Deux exceptions, signalees dans le rapport :

1. **Les familles ayant recu une aide** ne peuvent pas etre supprimees definitivement (regle
   metier volontaire) -- elles sont archivees a la place.
2. **Les comptes crees par la section S2** ne sont pas supprimables via l'API. Utilisez
   `--skip S2` pour les eviter, ou la requete SQL fournie en fin de rapport.

---

## 7. En cas de probleme

| Symptome | Cause probable |
|---|---|
| `Impossible de joindre l'application` | `npm run dev` n'est pas lance, ou mauvaise valeur de `--base` |
| `Impossible de choisir automatiquement` | Plusieurs mosquees existent : relancez avec `--mosque <id>` (la liste est affichee) |
| `Invalid credentials.` a l'amorcage | Mauvais `--password` ou mauvais `--mosque` |
| Beaucoup d'echecs en S4 | Des parametres ont ete laisses dans un etat inhabituel par une execution precedente interrompue : lancez `--only S4` une fois, le reset final remettra tout en ordre |
| Le script s'arrete au milieu | Relancez avec `--verbose` pour voir la derniere requete HTTP emise |
