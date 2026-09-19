# Rapport de test complet -- 2026-08-08T14:57:53.789Z

- **Base** : http://localhost:3000
- **Mosquee** : testfull (testfull/testfull)
- **Duree** : 105 s -- **1993 requetes HTTP**
- **Resultat** : 1903 reussis / 2 echecs / 0 ignores / 0 avertissements / 35 informations

## Synthese par section

| Section | Intitule | Reussis | Echecs | Ignores | Avert. | Infos |
|---|---|---:|---:|---:|---:|---:|
| S0 |  | 0 | 0 | 0 | 0 | 0 |
| S1 | Authentification (login, profil, mot de passe, sessions) | 0 | 0 | 0 | 0 | 0 |
| S10 | Donateurs et dons : validation, categories, solde, KAFFARA supprimee | 0 | 0 | 0 | 0 | 0 |
| S11 | Tableau de bord : statistiques, resume financier, graphiques | 0 | 0 | 0 | 0 | 0 |
| S12 | Documents joints aux familles | 0 | 0 | 0 | 0 | 0 |
| S13 | Securite : 401 systematique, jetons falsifies, cloisonnement multi-mosquees | 0 | 0 | 0 | 0 | 0 |
| S14 | Contrats d'API : enveloppe success/data, types, methodes, en-tetes | 0 | 0 | 0 | 0 | 0 |
| S15 | Fuzzing : corps invalides, chaines extremes, concurrence | 0 | 0 | 0 | 0 | 0 |
| S16 | Non-regression : les correctifs des livraisons precedentes | 0 | 0 | 0 | 0 | 0 |
| S17 | Synchronisation : chaque ecriture se propage partout | 0 | 0 | 0 | 0 | 0 |
| S2 | Creation de compte + mosquee (register) | 0 | 0 | 0 | 0 | 0 |
| S3 | Profil mosquee (GET / PUT / unicite) | 0 | 0 | 0 | 0 | 0 |
| S4 | Parametres : matrices de validation, poids SVF, reset, propagation | 0 | 0 | 0 | 0 | 0 |
| S5 | Familles : creation, validations, logement, filtres, edition, suppression | 0 | 0 | 0 | 0 | 0 |
| S6 | Membres et enfants : roles, garde-fous HEAD, promotion SPOUSE, compteurs | 0 | 0 | 0 | 0 | 0 |
| S7 | SVF : calibration de chaque facteur, profils composites, mutations | 0 | 0 | 0 | 0 | 0 |
| S8 | Water-filling : budget, reserve, bornes, proportionnalite, monotonie | 0 | 0 | 0 | 0 | 0 |
| S9 | Distributions : calcul, confirmation, paiement, solde, annulation | 0 | 0 | 0 | 0 | 0 |

## Echecs (2)

### S1.6.4 nouveau mot de passe vide

```json
{
  "expectedStatus": 400,
  "gotStatus": 200,
  "expectedMessage": null,
  "gotMessage": null,
  "envelopeSuccess": true,
  "body": "{\"success\":true,\"data\":{\"user\":{\"id\":\"cmskapqzl0000u4eycnyyo1i3\",\"firstName\":\"testfull\",\"lastName\":\"testfull\",\"email\":\"testfull@mosque.dz\",\"phone\":\"0555555555\",\"role\":\"IMAM\",\"isActive\":true,\"lastLogin\":\"2026-08-08T14:56:11.122Z\",\"tokenVersion\":10,\"cr..."
}
```

### S2.1.3 objet mosque absent accepte : la mosquee est optionnelle

```json
{
  "status": 400,
  "message": "Missing required registration fields."
}
```

## Poids SVF

| Facteur | Configure (API) | Mesure (empirique) | Ecart |
|---|---:|---:|---:|
| points_income_below_smig | 40 | 40 | 0 |
| points_income_below_2x_smig | 25 | 25 | 0 |
| points_income_below_3x_smig | 10 | 10 | 0 |
| points_widow_divorced | 15 | 15 | 0 |
| points_widow_divorced_div | - | 15 | - |
| points_no_support | 20 | 20 | 0 |
| points_disability | 15 | 15 | 0 |
| points_chronic_illness | 10 | 10 | 0 |
| points_renting | 10 | 10 | 0 |
| points_senior_head | 10 | 10 | 0 |
| points_young_head | 5 | 5 | 0 |
| points_per_child | 5 | 5 | 0 |

## Couverture des routes

| Route | Appels |
|---|---:|

## Nettoyage

```json
{
  "distributions": 15,
  "donations": 25,
  "donors": 16,
  "documents": 2,
  "families": 202,
  "echecs": [],
  "parametresReinitialises": true,
  "parametresRestaures": true,
  "mosqueeRestauree": true
}
```

### Purge SQL manuelle (comptes crees par la section S2)

L'API n'expose pas de suppression de compte. Sur une base de developpement uniquement :

```sql
-- Verifier d'abord ce qui sera supprime
SELECT id, email FROM "User" WHERE email LIKE 'zztest.%';
SELECT id, name FROM "Mosque" WHERE name LIKE 'ZZTEST%';

DELETE FROM "MosqueSettings" WHERE "mosqueId" IN (SELECT id FROM "Mosque" WHERE name LIKE 'ZZTEST%');
DELETE FROM "User" WHERE email LIKE 'zztest.%';
DELETE FROM "Mosque" WHERE name LIKE 'ZZTEST%';
```

### Purge SQL des familles restantes

```sql
SELECT id, "firstName", "lastName", ccp FROM "Family" WHERE "lastName" LIKE 'ZZTEST%' OR ccp LIKE '99200968333%';
DELETE FROM "Family" WHERE "lastName" LIKE 'ZZTEST%' OR ccp LIKE '99200968333%';
```
