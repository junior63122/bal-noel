# Rapport des 150 parcours simulés

Exécuté le 2026-11-25T16:39:40.649Z sur un serveur de test local (données de test). **Simulations automatisées, pas des personnes réelles.**

**Réussite : 147/150 (98.0 %)** · vérification indépendante via l’administration · durée totale 674 s

| Comportement | Parcours | Réussis | Durée moyenne |
|---|---|---|---|
| direct | 10 | 10 | 32.1 s |
| zones | 10 | 10 | 39.6 s |
| liste | 10 | 10 | 38.5 s |
| erreurs | 10 | 10 | 38.5 s |
| double-clic | 10 | 10 | 31.7 s |
| retour | 10 | 10 | 44.9 s |
| actualise | 10 | 10 | 49.9 s |
| reservee | 10 | 10 | 18.3 s |
| clavier | 10 | 10 | 25.7 s |
| vue-table | 10 | 9 | 37.5 s |
| filtre | 10 | 10 | 34.3 s |
| hesitant | 10 | 8 | 45.4 s |
| abandon | 10 | 10 | 29.1 s |
| lien-direct | 10 | 10 | 27.0 s |
| mouvement-reduit | 10 | 10 | 33.6 s |

| Appareil | Parcours | Réussis | Durée moyenne |
|---|---|---|---|
| iPhone SE | 15 | 15 | 36.7 s |
| iPhone 13 | 15 | 15 | 35.4 s |
| iPhone 15 Pro Max | 15 | 15 | 32.6 s |
| Pixel 7 | 15 | 15 | 34.4 s |
| Galaxy S9+ | 15 | 15 | 33.4 s |
| iPad | 15 | 15 | 37.8 s |
| iPhone paysage | 15 | 13 | 34.1 s |
| Ordinateur 1440 | 15 | 14 | 32.6 s |
| Ordinateur 1920 | 15 | 15 | 38.5 s |
| Petit portable 1280 | 15 | 15 | 35.2 s |

| Réseau | Parcours | Réussis | Durée moyenne |
|---|---|---|---|
| 3G lente | 33 | 32 | 44.9 s |
| 4G | 34 | 33 | 31.0 s |
| rapide | 83 | 82 | 32.8 s |

## Échecs

- #97 iPhone paysage · 3G lente · vue-table : page.click: Timeout 15000ms exceeded. (tests/echecs/p97.png)
- #117 iPhone paysage · rapide · hesitant : page.click: Timeout 15000ms exceeded. (tests/echecs/p117.png)
- #118 Ordinateur 1440 · 4G · hesitant : page.click: Timeout 15000ms exceeded. (tests/echecs/p118.png)
