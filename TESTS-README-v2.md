# Suites de test — version corrigée (v2)

Deux scripts, à lancer **l'un après l'autre**, jamais en parallèle
(ils partagent le même solde de mosquée et les mêmes paramètres SVF).

| Script | Rôle | Durée | Assertions |
|---|---|---|---|
| `test-sync-suite.mjs` | 16 tests ciblés sur la **synchronisation** (score SVF ↔ membres ↔ distributions ↔ paramètres) | ~10 s | ~95 |
| `test-full-suite.mjs` | 16 sections **S1 → S16**, toutes les fonctionnalités du site | ~90 s | ~1 800 |

---

## 1. Lancer

Fenêtre 1 :

```powershell
cd "C:\Users\USER\Desktop\Donation-management-system-WEB-App-main"
npm run dev
```

Fenêtre 2 (attendre que le serveur affiche `Ready`) :

```powershell
cd "C:\Users\USER\Desktop\Donation-management-system-WEB-App-main"

node test-sync-suite.mjs --password "imam1111" --mosque cmsexl13m0001cgeytn0mer03 2>&1 | Tee-Object -FilePath sync-terminal.txt

node test-full-suite.mjs --password "imam1111" --mosque cmsexl13m0001cgeytn0mer03 2>&1 | Tee-Object -FilePath full-terminal.txt
```

### Fichiers produits

- `sync-report.json` + `sync-report.md`
- `test-report-full.json` + `test-report-full.md`
- `sync-terminal.txt` + `full-terminal.txt`

À me renvoyer : les **6** fichiers ci-dessus.

### Options utiles

```powershell
node test-full-suite.mjs --list                      # lister les sections
node test-full-suite.mjs --only S4,S7 --password ... # ne jouer que S4 et S7
node test-full-suite.mjs --skip S15 --password ...   # sauter le fuzzing
node test-full-suite.mjs --repeat 3 --password ...   # 3 passes (tests répétitifs)
node test-full-suite.mjs --keep --password ...       # ne pas nettoyer les données de test
node test-full-suite.mjs --verbose --password ...    # afficher le détail des PASS
node test-full-suite.mjs --bail --password ...       # arrêter au premier échec
```

---

## 2. Ce qui a été corrigé dans `test-sync-suite.mjs`

Les 3 rouges du dernier run étaient des **défauts du script**, pas de l'application.

| Test | Avant | Après |
|---|---|---|
| T3 | attendait `headMirrored === true` | l'API renvoie un **objet** (`{dateOfBirth: …}`) → on vérifie que c'est un objet contenant les champs reportés |
| T4 | attendait `headMirrored` booléen | idem : vérification de l'objet |
| T5 | `role: "BROTHER"` → `Invalid role` → **tout T5 ne tournait pas** | `role: "OTHER"` (valeur réelle de l'enum `FamilyMemberRole`) → T5 teste enfin la **suppression de membre** et le recalcul du score |

Rappel de l'enum Prisma : `HEAD | SPOUSE | CHILD | PARENT | OTHER`.

---

## 3. Ce qui a été corrigé dans `test-full-suite.mjs`

### 3.1 Plantage bloquant

- **S13.3.11** : `readSettings()` renvoie `{ r, s, w, wf }`, le script lisait `mine.settings.pointsPerChild` → `TypeError: Cannot read properties of undefined`. Corrigé en `mine.s`.

### 3.2 Rapport faussé

- Le tableau `echecs` du JSON et le compteur « X réussis, Y échecs » par section filtraient sur `r.type`, alors que le champ s'appelle `r.status` → **toujours 0**. Corrigé.
- Le filtre par itération utilisait `r.iteration` au lieu de `r.iter` (cassait `--repeat`). Corrigé.

### 3.3 Le plus important : les poids SVF n'étaient jamais lus

L'API expose les poids sous des clés **`svf_*`** (`svf_pts_per_child`, `svf_pts_social_widow_divorced`, …), le script utilisait des noms internes (`points_per_child`, …). Résultat : `STATE.weights` ne correspondait jamais, **tous les calculs de référence retombaient silencieusement sur les valeurs par défaut codées en dur**, et tous les `PUT { svfWeights: { points_per_child: 6 } }` étaient ignorés par l'API.

Ajout d'une table de traduction dans les deux sens :

- `WKEY` : nom interne → clé API
- `WK(key)` : clé API pour l'écriture
- `wput(key, value)` : objet `svfWeights` prêt à envoyer
- `RW(obj, key)` : lecture d'un poids renvoyé par l'API
- `normalizeWeights(raw)` : conversion de la réponse API vers les noms internes

Appliqué à **S4.1, S4.8, S4.9, S4.10** (20 emplacements). Les sections « modifier un poids → le score bouge du bon delta » deviennent de vrais tests.

### 3.4 Faux positifs supprimés

| Test | Problème | Correction |
|---|---|---|
| S1.6 (×7) | envoyait `newPassword`, l'API lit **`password`** → tout le changement de mot de passe testait un champ ignoré | champ renommé `password` |
| S12.1.12 | `dl.headers["content-type"]` sur un objet `Headers` → toujours `undefined` | `dl.headers.get("content-type")` |
| S14.1.4 | idem sur toutes les routes GET | `r.headers.get("content-type")` |
| S5.9 | envoyait `commune` dans une famille — le modèle `Family` **n'a pas** cette colonne (elle est sur `Mosque`) | retirée du payload famille |
| S4.10.2 | attendait un message exact pour un `scope` manquant | vérifie le code 400, pas le libellé |
| Oracle SVF (social) | additionnait *veuf/divorcé* **et** *sans soutien* | un seul statut social, comme le code |
| Oracle SVF (âge) | utilisait `âge <= seuil` | `âge < seuil`, comme le code |

> ⚠️ Les deux derniers points alignent **le test sur le code actuel** — je n'ai touché à aucune règle de calcul. Les deux questions de conception (veuve 15 vs sans-soutien 20, et la borne 25 ans stricte) restent ouvertes, comme convenu.

---

## 4. Ce qui n'a **pas** été touché

- `prisma/schema.prisma`
- `src/lib/svf.js` (`computeSVF`)
- `src/lib/waterFilling.js`
- Aucune route API, aucun composant

Seuls les **deux fichiers de test** changent.

---

## 5. Couverture de `test-full-suite.mjs`

| Section | Domaine |
|---|---|
| S1 | Authentification (login, cascade wilaya/commune/mosquée, cookie, logout, changement de mot de passe) |
| S2 | Création de compte + mosquée |
| S3 | Profil mosquée |
| S4 | Paramètres (booléens, entiers, nombres, `svfWeights`, propagation, reset) |
| S5 | Familles (CRUD, filtres, recherche, statuts, archivage, suppression soft/hard) |
| S6 | Membres et enfants (rôles, chef, miroir, suppressions) |
| S7 | SVF (les 7 facteurs, bornes, plafonds, malus, priorités) |
| S8 | Water-filling (réserve, min/max, budget, monotonie) |
| S9 | Distributions (calcul, confirmation, paiement, annulation, suppression) |
| S10 | Donateurs et dons |
| S11 | Tableau de bord |
| S12 | Documents |
| S13 | Sécurité (isolation entre mosquées, tokens, injections) |
| S14 | Contrats d'API (enveloppe, content-type, temps de réponse) |
| S15 | Fuzzing |
| S16 | Non-régression |
