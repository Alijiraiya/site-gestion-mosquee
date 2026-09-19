# Rapport de synchronisation — score SVF et données liées

- Date : 2026-08-08T12:55:41.222Z
- Application : http://localhost:3000
- Mosquée : testfull (cmskapr0g0001u4eyb4b5e1mx)
- Durée : 17.8 s — 208 requêtes HTTP

**97 réussites · 0 échecs · 0 ignorés** (99 vérifications)

| Test | Intitulé | Réussites | Échecs |
| --- | --- | --- | --- |
| T1 | Création d'une famille : score et priorité calculés immédiatement | 5 | 0 |
| T2 | Ajout d'un membre : effectif, statut marital et score suivent | 9 | 0 |
| T3 | Modification du chef de famille : miroir vers la famille et recalcul SVF | 10 | 0 |
| T4 | Modification de la fiche famille : le chef est mis à jour en retour | 6 | 0 |
| T5 | Suppression d'un membre : effectif et score recalculés | 5 | 0 |
| T6 | Enfants scolarisés : ajout et suppression recalculent le score | 4 | 0 |
| T7 | Aide manuelle : le score baisse, la ligne est payée, le solde est débité | 9 | 0 |
| T8 | Aides successives : le malus se cumule puis se plafonne | 4 | 0 |
| T9 | Confirmation d'une distribution : le score baisse pour CHAQUE bénéficiaire | 7 | 0 |
| T10 | Validation d'un paiement : solde débité, score stable (pas de double malus) | 6 | 0 |
| T11 | Annulation d'une ligne : le malus est retiré et le score remonte | 4 | 0 |
| T12 | Annulation de la distribution entière : toutes les lignes et tous les scores suivent | 4 | 0 |
| T13 | Suppression d'une distribution : solde et scores restaurés | 5 | 0 |
| T14 | Changement de paramètres : toutes les familles sont recalculées | 7 | 0 |
| T15 | Famille archivée : exclue des distributions mais conservée | 8 | 0 |
| T16 | Scénario complet : création → membres → modification → aide → annulation | 4 | 0 |

## Aucun échec

Toutes les dépendances testées sont synchronisées : chaque écriture rejoue le score SVF, la priorité, les champs miroir et le solde.