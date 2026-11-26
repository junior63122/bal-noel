# Audit du site de réservation — Le Bal de Noël (25 novembre 2026)

## Périmètre et limites, à lire d'abord

- **Audité** : le site `bal-noel` (accueil, plan 3D, réservation, administration, serveur, hébergement Render).
- **Bots Instagram : non audités, car introuvables.** Aucun des dépôts accessibles dans cette session
  (`bal-noel`, `edr-monaco`, `junior63122.github.io`) ne contient de bot ou d'automatisation Instagram.
  Le « projet Henrique » cité dans la consigne n'est pas dans cette session. Rien n'a été inventé à ce sujet.
- **Aucun test humain.** Les 1 000 parcours sont des **simulations automatisées** dans Chromium
  (Playwright), sur un serveur de test local avec des données de test, jamais sur le site en ligne.
- **Fluidité de la 3D non mesurable ici** : l'environnement de test n'a pas de carte graphique (rendu
  logiciel). Les mesures d'images par seconde de la page du plan ne sont pas représentatives d'un vrai téléphone.
- Pas de « 10 cycles » artificiels : le travail a suivi des boucles réelles mesure → correction → nouvelle mesure,
  décrites ci-dessous avec leurs preuves.

## Inventaire

| Élément | Rôle |
|---|---|
| `public/index.html`, `app.js`, `style.css` | accueil, transition, plan 3D (three.js), fiche table, formulaire |
| `public/config.js` | événement, 6 zones, 64 tables relevées sur le plan |
| `public/admin.html` | demandes, statuts, WhatsApp/SMS, tables, export CSV |
| `server.js` | serveur Node sans dépendance : fichiers, API, données JSON sur disque persistant |
| Render (Starter + disque 1 Go) | hébergement, contrôle de santé sur `/api/health` |
| `.github/workflows/` | tests à chaque push, surveillance du site toutes les 30 min |

## Méthode de vérification (anti-faux-positifs)

1. **Les résultats ne sont jamais validés par la seule réponse HTTP.** Chaque demande est relue
   dans le fichier sur disque **et** via l'API d'administration (ce que voit l'organisateur).
2. **Les parcours navigateur sont contre-vérifiés par un mécanisme distinct** : après les 1 000 parcours,
   le script interroge l'administration et exige exactement 1 demande pour chaque parcours
   « réservation », 0 pour les parcours « abandon » / « table réservée ». Toute erreur JavaScript fait échouer le parcours.
3. **Les tests savent échouer** (test par mutation) : 6 défauts introduits volontairement dans le serveur
   (anti-doublon, pot de miel, statuts, blocage admin, table réservée, capacité) → **6/6 détectés**.
4. `/api/health` relit réellement le fichier de données ; un fichier corrompu fait passer la santé en erreur
   (testé : HTTP 503).

## Résultats mesurés

| Test | Résultat |
|---|---|
| Tests serveur (`node --test tests/*.test.mjs`) | **13/13**, aussi verts sur GitHub Actions (exécution indépendante) |
| Test par mutation | 6/6 défauts détectés |
| 1 000 parcours simulés, 8 navigateurs en parallèle | **946/1 000** — voir `tests/rapport-parcours.md` |
| Rejeu des 54 échecs, 2 navigateurs en parallèle | **54/54** — voir `tests/rapport-rejeu-54.md` |
| Audit mobile (7 appareils) | aucun défilement horizontal, aucune erreur JS |
| Charge serveur (local) | ~27 000 pages/s, ~60 000 lectures de disponibilité/s, 2 000 demandes simultanées sans perte |
| Accueil | 60 images/s, 0 tâche longue |

**Interprétation honnête des 54 échecs** : tous sont des délais dépassés (clic ou attente > 15–20 s), concentrés
sur les scénarios les plus lourds en 3D (vue depuis la table, changements de table rapides), et **tous réussissent
quand la machine de test n'est pas saturée**. Ils traduisent la limite de l'environnement de test (8 rendus 3D
logiciels simultanés), pas un défaut reproduit du site. Ils ne sont pas pour autant comptés comme réussis.

## Défauts réels trouvés et corrigés

| # | Gravité | Défaut (trouvé par) | Correction | Preuve |
|---|---|---|---|---|
| 1 | Bloquant | Téléphone à l'horizontale : bouton « Choisir ma table » inaccessible (audit mobile) | mise en page dédiée paysage, défilement autorisé | captures 7 appareils |
| 2 | Bloquant | Fiche de table invisible sur mobile (classe CSS partagée avec l'accueil) | renommage | capture + parcours |
| 3 | Majeur | Défilement bloqué après actualisation ou lien partagé vers le plan (parcours « actualise ») | initialisation corrigée | 70/70 « actualise » |
| 4 | Majeur | Clic rapide sur une table annulé par le survol caméra d'arrivée (parcours) | le survol ne s'exécute plus si l'utilisateur a agi | rejeu |
| 5 | Majeur | Mobile : bouton « Revenir au plan » caché sous la fiche en vue « depuis la table » | la fiche se range pendant cette vue | rejeu |
| 6 | Majeur | Fiche vide si on change vite de table (animation à opacité 0) | animation sans masquage | rejeu |
| 7 | Moyen | Paysage : bouton doré fixe recouvrant « Voir depuis cette table » | boutons groupés | rejeu |
| 8 | Moyen | Vue d'ensemble coupée sur téléphone vertical | cadrage adapté au format | captures |
| 9 | Moyen | Message trop long : connexion coupée au lieu d'une réponse (tests serveur) | réponse 413 propre | test 4 |
| 10 | Mineur | Cibles tactiles < 44 px (fermer, replier, cases) | agrandies | audit mobile |

## Sécurité

| Risque | Gravité | Avant | Après (testé) |
|---|---|---|---|
| Mot de passe admin par défaut si non configuré | Élevée | `noel2026` utilisé | refus de démarrer en ligne, admin désactivée en local, ≥ 10 caractères |
| Force brute sur l'admin | Élevée | illimité | 10 essais / 15 min par adresse (test 9) |
| Statut arbitraire injecté dans le tableau de bord | Moyenne | texte libre | liste fermée (test 10) |
| Contournement de l'anti-spam via `X-Forwarded-For` | Moyenne | 1re adresse (falsifiable) | dernière adresse, ajoutée par Render (test 8) |
| Données invalides (téléphone, e-mail, capacité) | Moyenne | partiellement contrôlées | validées côté serveur (test 4) |
| Doublons (double clic) | Faible | 2 demandes | 1 seule (test 6, parcours « double-clic ») |
| En-têtes de sécurité | Moyenne | aucun | CSP, HSTS, nosniff, anti-iframe, Referrer, Permissions |
| Données personnelles dans les journaux | Moyenne | nom + téléphone | identifiant seulement |
| Traversée de dossiers | — | protégée | confirmé (test 2) |
| Sauvegarde | Moyenne | aucune | copie quotidienne gardée 14 jours |

Non couvert : pas de test d'intrusion externe ; les polices Google restent chargées depuis Google
(à auto-héberger pour supprimer cette dépendance) ; le mot de passe admin circule dans un en-tête (HTTPS en ligne).

## Surveillance

- Render redémarre le service si `/api/health` échoue (contrôle de santé configuré).
- `surveillance.yml` vérifie toutes les 30 min : santé, données, admin active, 7 fichiers essentiels, lenteur > 5 s ;
  un échec envoie l'e-mail de notification GitHub au propriétaire.
- Pour une alerte SMS / WhatsApp immédiate, il faudrait un service externe (ex. UptimeRobot, gratuit) pointé sur `/api/health`.

## Notes (sur 100), justifiées

| Domaine | Note | Justification et limite |
|---|---|---|
| Stabilité serveur | 95 | 13/13 tests, mutation 6/6, 2 000 demandes simultanées sans perte ; pas de test longue durée |
| Sécurité | 88 | 10 risques corrigés et testés ; pas de test d'intrusion externe, dépendance Google Fonts |
| Fonctionnalités | 92 | parcours complets OK ; pas de paiement d'acompte en ligne ni de confirmation automatique par message |
| Navigation / ergonomie | 90 | parcours critiques 100 % au rejeu ; prix et capacités encore provisoires |
| Accessibilité | 80 | libellés, focus, erreurs signalées ; plan 3D difficile à utiliser sans la vue |
| Rapidité | 85 | accueil 60 i/s, ~900 Ko ; 3D non mesurable sans GPU |
| Couverture des tests | 85 | serveur + 1 000 parcours ; aucun test humain, aucun vrai téléphone |
| Bots Instagram | — | **non évaluables** : aucun bot dans les dépôts accessibles |

## Reste à faire

1. Vrais prix et capacités par zone (valeurs provisoires).
2. Un essai sur un vrai iPhone et un vrai Android (la 3D réelle dépend du téléphone).
3. Quelques personnes réelles qui réservent une table de test, puis suppression dans l'admin.
4. Donner accès au dépôt des bots Instagram pour en faire l'audit.

## Mise à jour du 26 novembre : réservation par ligne (VIP Croisette)

Le client ne choisit plus une table : il choisit une zone (1 à 4), puis la ligne avant (200 €/pers.) ou arrière
(150 €/pers.), et indique le nombre de personnes. L'organisation attribue les tables dans l'administration.
Places par ligne = nombre de tables × 6 (valeur provisoire, `PERS_PAR_TABLE` dans `public/config.js`).

- Tests serveur : **15/15** ; test par mutation sur les nouvelles règles : **6/6 défauts détectés**
  (places décomptées, ligne complète, table attribuée deux fois, table hors ligne, scène hors vente, libération au refus).
- Parcours simulés (nouveau parcours zone → ligne → personnes) : **149/150**, le seul échec
  (« mouvement réduit », délai de clic) réussit au rejeu (5/5). Rapport : `tests/rapport-lignes-150.md`.
- Les anciennes demandes « par table » sont converties automatiquement (ligne de la table + table attribuée).
