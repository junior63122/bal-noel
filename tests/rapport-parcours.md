# Rapport des 1000 parcours simulés

Exécuté le 2026-11-25T18:12:16.118Z sur un serveur de test local (données de test). **Simulations automatisées, pas des personnes réelles.**

**Réussite : 946/1000 (94.6 %)** · vérification indépendante via l’administration · durée totale 5253 s

| Comportement | Parcours | Réussis | Durée moyenne |
|---|---|---|---|
| direct | 70 | 69 | 36.2 s |
| zones | 70 | 69 | 46.4 s |
| liste | 70 | 66 | 47.4 s |
| erreurs | 70 | 66 | 46.9 s |
| double-clic | 70 | 66 | 40.7 s |
| retour | 70 | 69 | 50.7 s |
| actualise | 70 | 70 | 62.5 s |
| reservee | 70 | 70 | 23.5 s |
| clavier | 70 | 70 | 25.8 s |
| vue-table | 70 | 54 | 44.8 s |
| filtre | 60 | 56 | 42.5 s |
| hesitant | 60 | 45 | 53.1 s |
| abandon | 60 | 59 | 32.3 s |
| lien-direct | 60 | 59 | 34.1 s |
| mouvement-reduit | 60 | 58 | 38.2 s |

| Appareil | Parcours | Réussis | Durée moyenne |
|---|---|---|---|
| iPhone SE | 100 | 94 | 40.8 s |
| iPhone 13 | 100 | 93 | 41.6 s |
| iPhone 15 Pro Max | 100 | 97 | 40.7 s |
| Pixel 7 | 100 | 97 | 41.4 s |
| Galaxy S9+ | 100 | 100 | 41.9 s |
| iPad | 100 | 96 | 43.1 s |
| iPhone paysage | 100 | 94 | 42.2 s |
| Ordinateur 1440 | 100 | 94 | 42.2 s |
| Ordinateur 1920 | 100 | 89 | 41.8 s |
| Petit portable 1280 | 100 | 92 | 42.1 s |

| Réseau | Parcours | Réussis | Durée moyenne |
|---|---|---|---|
| 3G lente | 237 | 218 | 52.4 s |
| 4G | 261 | 249 | 39.0 s |
| rapide | 502 | 479 | 38.1 s |

## Échecs

- #10 Petit portable 1280 · 4G · direct : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p10.png)
- #19 Ordinateur 1920 · rapide · zones : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p19.png)
- #41 iPhone SE · 4G · double-clic : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p41.png)
- #94 Pixel 7 · rapide · vue-table : page.click: Timeout 15000ms exceeded. (tests/echecs/p94.png)
- #97 iPhone paysage · 3G lente · vue-table : page.click: Timeout 15000ms exceeded. (tests/echecs/p97.png)
- #100 Petit portable 1280 · 3G lente · vue-table : page.click: Timeout 15000ms exceeded. (tests/echecs/p100.png)
- #103 iPhone 15 Pro Max · rapide · filtre : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p103.png)
- #112 iPhone 13 · rapide · hesitant : page.click: Timeout 15000ms exceeded. (tests/echecs/p112.png)
- #119 Ordinateur 1920 · 4G · hesitant : page.click: Timeout 15000ms exceeded. (tests/echecs/p119.png)
- #139 Ordinateur 1920 · rapide · lien-direct : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p139.png)
- #248 Ordinateur 1440 · 3G lente · vue-table : page.click: Timeout 15000ms exceeded. (tests/echecs/p248.png)
- #251 iPhone SE · 3G lente · filtre : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p251.png)
- #258 Ordinateur 1440 · rapide · filtre : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p258.png)
- #268 Ordinateur 1440 · rapide · hesitant : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p268.png)
- #300 Petit portable 1280 · 3G lente · mouvement-reduit : page.click: Timeout 15000ms exceeded. (tests/echecs/p300.png)
- #323 iPhone 15 Pro Max · 3G lente · liste : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p323.png)
- #337 iPhone paysage · 4G · erreurs : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p337.png)
- #391 iPhone SE · 3G lente · vue-table : page.click: Timeout 15000ms exceeded. (tests/echecs/p391.png)
- #398 Ordinateur 1440 · 3G lente · vue-table : page.click: Timeout 15000ms exceeded. (tests/echecs/p398.png)
- #400 Petit portable 1280 · 3G lente · vue-table : page.click: Timeout 15000ms exceeded. (tests/echecs/p400.png)
- #411 iPhone SE · rapide · hesitant : page.click: Timeout 15000ms exceeded. (tests/echecs/p411.png)
- #412 iPhone 13 · 4G · hesitant : page.click: Timeout 15000ms exceeded. (tests/echecs/p412.png)
- #417 iPhone paysage · 4G · hesitant : page.click: Timeout 15000ms exceeded. (tests/echecs/p417.png)
- #419 Ordinateur 1920 · 3G lente · hesitant : page.click: Timeout 15000ms exceeded. (tests/echecs/p419.png)
- #420 Petit portable 1280 · 4G · hesitant : page.click: Timeout 15000ms exceeded. (tests/echecs/p420.png)
- #542 iPhone 13 · 3G lente · vue-table : page.click: Timeout 15000ms exceeded. (tests/echecs/p542.png)
- #546 iPad · rapide · vue-table : page.click: Timeout 15000ms exceeded. (tests/echecs/p546.png)
- #564 Pixel 7 · 3G lente · hesitant : page.click: Timeout 15000ms exceeded. (tests/echecs/p564.png)
- #568 Ordinateur 1440 · 4G · hesitant : page.click: Timeout 15000ms exceeded. (tests/echecs/p568.png)
- #592 iPhone 13 · 3G lente · mouvement-reduit : page.click: Timeout 15000ms exceeded. (tests/echecs/p592.png)
- #630 Petit portable 1280 · rapide · liste : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p630.png)
- #641 iPhone SE · 4G · double-clic : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p641.png)
- #649 Ordinateur 1920 · 4G · double-clic : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p649.png)
- #660 Petit portable 1280 · rapide · retour : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p660.png)
- #696 iPad · 4G · vue-table : page.click: Timeout 15000ms exceeded. (tests/echecs/p696.png)
- #699 Ordinateur 1920 · 3G lente · vue-table : page.click: Timeout 15000ms exceeded. (tests/echecs/p699.png)
- #716 iPad · rapide · hesitant : page.click: Timeout 15000ms exceeded. (tests/echecs/p716.png)
- #729 Ordinateur 1920 · rapide · abandon : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p729.png)
- #779 Ordinateur 1920 · rapide · liste : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p779.png)
- #782 iPhone 13 · 3G lente · erreurs : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p782.png)
- #793 iPhone 15 Pro Max · rapide · double-clic : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p793.png)
- #844 Pixel 7 · 3G lente · vue-table : page.click: Timeout 15000ms exceeded. (tests/echecs/p844.png)
- #847 iPhone paysage · rapide · vue-table : page.click: Timeout 15000ms exceeded. (tests/echecs/p847.png)
- #852 iPhone 13 · rapide · filtre : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p852.png)
- #861 iPhone SE · rapide · hesitant : page.click: Timeout 15000ms exceeded. (tests/echecs/p861.png)
- #862 iPhone 13 · rapide · hesitant : page.click: Timeout 15000ms exceeded. (tests/echecs/p862.png)
- #866 iPad · 3G lente · hesitant : page.click: Timeout 15000ms exceeded. (tests/echecs/p866.png)
- #869 Ordinateur 1920 · 3G lente · hesitant : page.click: Timeout 15000ms exceeded. (tests/echecs/p869.png)
- #927 iPhone paysage · 3G lente · liste : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p927.png)
- #938 Ordinateur 1440 · rapide · erreurs : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p938.png)
- #939 Ordinateur 1920 · rapide · erreurs : page.waitForSelector: Timeout 20000ms exceeded. (tests/echecs/p939.png)
- #997 iPhone paysage · rapide · vue-table : page.click: Timeout 15000ms exceeded. (tests/echecs/p997.png)
- #999 Ordinateur 1920 · 4G · vue-table : page.click: Timeout 15000ms exceeded. (tests/echecs/p999.png)
- #1000 Petit portable 1280 · rapide · vue-table : page.click: Timeout 15000ms exceeded. (tests/echecs/p1000.png)
