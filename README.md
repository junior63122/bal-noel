# Le Bal des Fous — Le Bal de Noël · Cannes · Réservation de tables

Site de réservation de tables VIP pour le Bal de Noël — dimanche 27 décembre 2026, ouverture des portes à 16 h, fermeture à minuit, La Terrasse du Palais des Festivals, Cannes. Construit sur le plan Deco Flamme « Le Bal des Fous - Noël, Palais des Festivals, version 1 » (piste tournante Ø 7,50 m, 2 bars, régie DJ, zones 1 à 4 et scène), relevé en mètres dans `public/plan.js`.

## Lancer

```
node server.js            # Node 18 ou plus, aucune dépendance
```
Ouvrir http://localhost:3000 — administration : http://localhost:3000/admin

Variables : `ADMIN_PASSWORD` (mot de passe admin, **10 caractères minimum**, obligatoire en ligne), `PORT`, `DATA_DIR` (dossier de db.json).

## Modifier l'événement, les zones, les prix, les tables

Tout est dans `public/config.js` : date, lieu, horaires, acompte, zones (nom, prix, capacité, couleur)
et les 33 tables (numéro, zone, position sur le plan).

## Fonctionnement

1. Accueil Noël → « Choisir ma table ».
2. Salle en 3D : glisser pour tourner, molette = zoom vers le curseur, boutons + / −, « Vue d’ensemble ».
3. Panneau « Zones & tarifs » : cliquer une zone zoome dessus et met ses tables en avant ; disponibilités en direct.
4. Clic sur une table → fiche (prix, capacité, acompte 20 %) + formulaire de demande (WhatsApp ou SMS).
5. Pas de paiement en ligne : l’organisation recontacte, acompte de 20 % après validation.
6. /admin : liste des demandes, boutons WhatsApp / SMS avec message prérempli, statuts (contactée / validée / refusée),
   validation = table réservée automatiquement, bascule manuelle des tables, export CSV.

## Hébergement (Render, etc.)

Service web Node, commande de démarrage `node server.js`. Ajouter un **disque persistant** monté sur `DATA_DIR`,
sinon les demandes sont perdues à chaque redémarrage. Sur un hébergement 100 % statique, le site fonctionne en mode démo (sans admin).

## Tests

```
node --test tests/*.test.mjs                                   # 13 tests serveur (sécurité, données, charge)
NODE_PATH=$(npm root -g) node tests/parcours.cjs 1000 8        # 1 000 parcours simulés dans Chromium (Playwright requis)
```

Les tests serveur démarrent un vrai serveur temporaire et vérifient chaque résultat en relisant le fichier
de données et l'administration, jamais sur la seule réponse HTTP. Les parcours sont des **simulations
automatisées** (10 appareils × 15 comportements × 3 réseaux), vérifiées ensuite via l'administration.
Rapport : `tests/rapport-parcours.md`.

## Surveillance

- `GET /api/health` : relit les données sur disque et les compare à la mémoire (HTTP 503 si incohérence),
  compteurs de demandes, refus, erreurs d'écriture, échecs de connexion admin.
- `.github/workflows/surveillance.yml` : contrôle le site en ligne toutes les 30 min ; un échec déclenche
  l'e-mail de notification GitHub.
- Une copie quotidienne des données est gardée 14 jours dans `DATA_DIR/sauvegardes/`.
