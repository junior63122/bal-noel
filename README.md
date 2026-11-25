# Le Bal des Fous — Nuit de Noël · Réservation de tables

Site de réservation de tables VIP, sur le même principe que lebaldesfous-reservation.com, construit sur le plan de la salle (piste tournante, 2 bars, DJ, sapins S1–S6).

## Lancer

```
node server.js            # Node 18 ou plus, aucune dépendance
```
Ouvrir http://localhost:3000 — administration : http://localhost:3000/admin

Variables : `ADMIN_PASSWORD` (mot de passe admin, **à définir**), `PORT`, `DATA_DIR` (dossier de db.json).

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
