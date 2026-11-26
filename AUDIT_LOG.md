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
| P1 | CRITIQUE | Faux succès : si `/api/state` échoue une fois, « mode démo » → demande stockée dans le navigateur, interface « envoyée », serveur rien | avant : interface succès / serveur rien ; après : `tests/faux-succes.cjs` S1 SUCCESS_VERIFIED | **vérifié** (2f78445) |
| P2 | ÉLEVÉE | Bouton d'accueil en calque plein écran pendant le chargement (classe `.loading` partagée) → CLS 0,745 mobile | CLS mobile 0,745 → 0,01 | **vérifié** (2f78445) |
| P3 | ÉLEVÉE | LCP mobile 5,0 s (ouverture 2,75 s + image 240 Ko en concurrence avec three.js) | LCP 5,0 → 3,2 s ; reste > 2,5 s à cause de l’animation d’ouverture demandée | **partiel** |
| P4 | ÉLEVÉE | Aucune mention légale / confidentialité / conditions (obligatoire : LCEN, RGPD) | pages créées ; adresse, SIRET, directeur de publication, e-mail **à fournir** | **partiel** |
| P5 | MOYENNE | Polices Google : IP transmise à Google sans consentement | test « pages légales… » : aucune ressource Google | **vérifié** |
| P6 | MOYENNE | Pas d'image de partage, de balises Open Graph, de données structurées Event | Lighthouse SEO 100 | **vérifié** |
| P7 | MOYENNE | Repères de structure manquants (axe « region », « landmark-one-main ») | axe : 0 violation (8 écrans client + admin) | **vérifié** |
| P8 | MOYENNE | Pas de durée de conservation des données personnelles | purge automatique 90 j après la soirée [ANALYSE : non déclenchable avant 2027] | **corrigé** |
| P9 | FAIBLE | Pas de page 404 dédiée | test : statut 404 + page | **vérifié** |
| P10 | MOYENNE | Test biaisé : S10 « ligne complète » réussissait à cause de l'anti-spam (même adresse pour tous les scénarios) | message obtenu « Trop de demandes » | **corrigé** : une adresse par scénario + message exact exigé |

## 4. Mesures après corrections (commit 2f78445)
| Mesure | Avant | Après |
|---|---|---|
| CLS mobile 4G | 0,745 | **0,01** |
| LCP mobile 4G simulé | 5 036 ms | **3 212 ms** (objectif 2 500 non atteint : ouverture animée) |
| INP approx. | 20–26 ms | 22–27 ms |
| axe-core (parcours client) | 6 types « region » / « aria-allowed-role » | **0** |
| Lighthouse accueil (a11y / bonnes pratiques / SEO) | 100 / 100 / 100 | 100 / 100 / 100 (+ OG, JSON-LD, sitemap) |
| Lighthouse pages légales (mobile) | — | perf 91 → corrigé CLS, SEO 92 → descriptions ajoutées |
| Tests serveur | 15 | **17** (restauration de sauvegarde réelle, pages légales) |
| Tests anti-faux-succès client | 0 | **10/10**, mutation détectée (2 scénarios en échec) |

## 5. Contre-audit indépendant (agent distinct, sans accès à mes conclusions)
| ID | Gravité | Constat (reproduit par l'auditeur) | Correction | Preuve |
|---|---|---|---|---|
| C1 | ÉLEVÉE | Validation admin sans contrôle des places : 60 pers. validées pour 36 | refus 409 avec places restantes | test C1 + mutation détectée |
| C2 | ÉLEVÉE | Table attribuée à 2 clients (demande refusée puis revalidée) ; blocage d'une table attribuée | tables reprises retirées ; blocage refusé | test C2 + mutation |
| C3 | ÉLEVÉE | db.json abîmé → base vide + sauvegarde du jour écrasée = perte totale | fichier mis de côté, restauration auto depuis la dernière sauvegarde, sauvegarde du jour jamais écrasée, écriture d'arrêt atomique | tests C3, C3 bis + mutation |
| C4 | MOYENNE | Renvoi modifié (2 → 8 pers.) traité comme doublon → client lit « 8 », base garde 2 (faux succès) | doublon seulement si identique et non refusé ; client informé « déjà reçue » | test C4 + mutation |
| C5 | MOYENNE | Migration : anciennes tables « ailes » 150 € passées à 200 €, table en double | prix figé par demande, table migrée une seule fois, `reserved` nettoyé | test C3+C5 + mutation |
| C6 | FAIBLE | X-Forwarded-For accepté hors proxy → anti-spam contournable | utilisé seulement si RENDER/TRUST_PROXY | test C6 + mutation |
| C7 | MOYENNE (suspecté par l'auditeur, confirmé par analyse) | 201 renvoyé avant l'écriture disque : un disque plein donnait un faux succès | 201 seulement après écriture réelle, sinon 503 et demande retirée | [ANALYSE] + tests de charge |
| R1 | — | Régression introduite par ma propre correction (écriture bloquée après la 1re) | corrigée | attrapée par 6 tests serveur avant tout déploiement |

Non corrigé (risque jugé faible) : fenêtre très étroite entre la purge RGPD et une requête admin en cours ; mémoire des compteurs anti-spam bornée par nettoyage toutes les 5 min.
