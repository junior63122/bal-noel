# Journal d'audit — Bal de Noël (reprise possible à partir de ce fichier)

## 0. Contexte (section 0 non remplie par le demandeur : complétée à partir du projet)
- Projet : réservation VIP Croisette du Bal de Noël (Le Bal des Fous), Cannes, 27/12/2026.
- Type : réservation (demande + rappel, acompte hors ligne). Prod : https://bal-noel-mgh6.onrender.com (aucune action modifiante).
- Test : serveur local (`node server.js`, données temporaires). Code : dépôt `junior63122/bal-noel`.
- Stack : Node.js sans dépendance, three.js, JSON sur disque, Render Starter + disque.
- Automatisations / bots : **aucun dans ce dépôt** (pas de bot Instagram, ni e-mail, ni WhatsApp automatique :
  les boutons WhatsApp/SMS de l'admin ouvrent un message pré-rempli que l'organisateur envoie lui-même).
  Automatisations existantes : contrôle de santé Render, workflows GitHub (tests, surveillance 30 min), sauvegarde quotidienne.
- Parcours critique : accueil → plan → zone → ligne → nombre de personnes → demande → réception côté admin.
- Interdits appliqués : aucune écriture sur la prod, aucun vrai message envoyé, données fictives uniquement.
- Panel humain : aucun. Profils : simulations Playwright.

## 1. Accès réels (section 2)
- Testable réellement : code, serveur local, Chromium (Playwright), Lighthouse 12, axe-core 4.10, API Render (déploiement, journaux).
- Analysable seulement : site en ligne (l'URL publique est bloquée par le proxy de cet environnement → vérifié via journaux Render).
- Impossible ici : vrais iPhone/Android, Safari/Firefox réels (WebKit non installé), GPU (3D en rendu logiciel), testeurs humains.

## 2. Base de référence (avant corrections, commit 26af434)
| Mesure | Mobile 4G simulé (Pixel 7, CPU ×4) | Ordinateur |
|---|---|---|
| TTFB | 155 ms | 3 ms |
| LCP | **5 036 ms** (image de la boule) ✗ | non mesurable (écran d'ouverture) |
| CLS | **0,745** ✗ | 0,016 |
| INP (approx., clic « Choisir ma table ») | 20 ms | 26 ms |
| Lighthouse SEO / Accessibilité / Bonnes pratiques | 100 / 100 / 100 (perf : NO_LCP) | 100 / 100 / — |
- axe-core (WCAG 2.2 AA + bonnes pratiques) : 0 critique, 0 grave ; « region » (moyen) sur toutes les pages,
  « aria-allowed-role » (mineur) sur le formulaire, « landmark-one-main » (moyen) sur la connexion admin.
- Tests : 15 tests serveur (passent), simulateur de parcours (149/150 au dernier passage).
- Dépendances serveur : aucune (pas de npm audit nécessaire) ; three.js 0.160 et Lenis 1.1.13 embarqués.
- Polices chargées depuis Google (transfert d'adresse IP à Google sans consentement).
- Pas de mentions légales, de politique de confidentialité ni de conditions de réservation.
- Pas d'image de partage social, pas de robots.txt / sitemap / données structurées.

## 3. Problèmes (ID · gravité · statut)
| ID | Gravité | Problème | Preuve | Statut |
|---|---|---|---|---|
| P1 | CRITIQUE | Faux succès : si `/api/state` échoue une fois, « mode démo » → demande stockée dans le navigateur, interface « envoyée », serveur rien | `fauxsucces.cjs` : interface succès = oui, serveur = non | ouvert |
| P2 | ÉLEVÉE | Bouton d'accueil en calque plein écran pendant le chargement (classe `.loading` partagée) → CLS 0,745 mobile | mesure CLS, sources « cta / trio / h-info » | ouvert |
| P3 | ÉLEVÉE | LCP mobile 5,0 s (ouverture 2,75 s + image 240 Ko en concurrence avec three.js) | mesure | ouvert |
| P4 | ÉLEVÉE | Aucune mention légale / confidentialité / conditions (obligatoire : LCEN, RGPD) | analyse | ouvert |
| P5 | MOYENNE | Polices Google : IP transmise à Google sans consentement | analyse | ouvert |
| P6 | MOYENNE | Pas d'image de partage, de balises Open Graph, de données structurées Event | analyse | ouvert |
| P7 | MOYENNE | Repères de structure manquants (axe « region », « landmark-one-main ») | axe | ouvert |
| P8 | MOYENNE | Pas de durée de conservation des données personnelles | analyse | ouvert |
| P9 | FAIBLE | Pas de page 404 dédiée | analyse | ouvert |
