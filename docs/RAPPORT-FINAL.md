# Rapport final d'audit — Bal de Noël · VIP Croisette (26 novembre 2026)

Étiquettes : **[RÉEL]** testé sur le vrai code / serveur local · **[SIMULÉ]** simulation automatisée ·
**[ANALYSE]** lecture du code · **[NON VÉRIFIABLE]** impossible ici. Aucun test humain n'a été réalisé.

## 1. Résumé exécutif

**État initial** : site fonctionnel et rapide sur ordinateur, mais un **faux succès critique**
(le client pouvait voir « Demande envoyée » sans que rien n'arrive), une **mise en page qui sautait** sur mobile
(CLS 0,745), aucune page légale, des polices chargées chez Google, et — trouvés par le contre-audit —
une possible **surréservation**, une **double attribution de table** et un risque de **perte totale des données**.

**État final** : les 9 problèmes de l'audit et les 7 du contre-audit sont corrigés, chacun couvert par un test
qui échoue si le défaut revient (vérifié par mutation). 23 tests serveur, 10 scénarios anti-faux-succès,
parcours simulés dans le navigateur, 0 violation d'accessibilité sur le parcours client.

**5 actions restantes les plus importantes**
1. Fournir les **informations légales** (adresse du siège, SIRET, directeur de publication, e-mail, téléphone)
   et les **conditions d'annulation de l'acompte** → `public/config.js`, objet `EDITEUR`.
2. Confirmer le **nombre de personnes par table** (6 provisoire) et un éventuel **minimum par réservation**.
3. Tester soi-même sur un **vrai iPhone et un vrai Android** (la 3D dépend du téléphone ; non mesurable ici).
4. Créer une **alerte de disponibilité** externe (UptimeRobot, gratuit) sur `/api/health` pour une alerte SMS/e-mail immédiate.
5. Choisir un **nom de domaine** (ex. noel.lebaldesfous-reservation.com) : les liens de partage, le sitemap et
   les balises sociales utilisent l'adresse Render actuelle.

## 2. Inventaire
- Site : accueil (ouverture animée, boule à neige), plan 3D (zones 1–4, lignes avant/arrière, scène « bientôt »),
  formulaire de demande, administration (demandes, attribution des tables, places par ligne, WhatsApp/SMS pré-remplis, CSV),
  pages Conditions / Confidentialité / Mentions légales / 404.
- Serveur : Node.js sans dépendance, données JSON sur disque persistant Render (Francfort), sauvegarde quotidienne 14 jours.
- **Bots / automatisations : aucun bot dans le dépôt** (ni Instagram, ni e-mail, ni WhatsApp automatique). Les automatisations
  réelles sont : contrôle de santé Render, workflow GitHub de tests, workflow de surveillance toutes les 30 min,
  sauvegarde quotidienne, purge RGPD. La partie « audit des bots Instagram » est donc **[NON VÉRIFIABLE]** faute de code.

## 3. Base de référence et mesures finales
| Mesure | Avant | Après | Type |
|---|---|---|---|
| LCP mobile (Pixel 7, 4G simulée, CPU ×4) | 5 036 ms | 3 212 ms | [RÉEL] mesure navigateur |
| CLS mobile | **0,745** | **0,01** | [RÉEL] |
| INP approx. (clic principal) | 20–26 ms | 22–27 ms | [RÉEL] |
| Lighthouse accueil — accessibilité / bonnes pratiques / SEO | 100 / 100 / 100 | 100 / 100 / 100 | [RÉEL] |
| Lighthouse performance accueil | non mesurable (ouverture animée) | non mesurable (idem) | [RÉEL] limite de l'outil |
| axe-core WCAG 2.2 AA (8 écrans client) | 2 types de violations moyennes/mineures | **0** | [RÉEL] |
| Requêtes vers des tiers (Google Fonts) | oui | **aucune** | [RÉEL] test automatique |
| Tests serveur | 15 | **23** | [RÉEL] |
| Tests anti-faux-succès client | 0 | **10/10** | [RÉEL] (pannes simulées) |

LCP > 2,5 s : la cause restante est l'**animation d'ouverture demandée** (~1,5 s avant l'apparition du contenu).
La supprimer ramènerait le LCP sous 2 s ; c'est un choix de design à trancher.

## 4. Parcours simulés
- Matrice : 10 appareils (iPhone SE/13/15 Pro Max, Pixel 7, Galaxy, iPad, paysage, 3 ordinateurs) × 15 comportements
  (direct, liste des zones, étiquette de ligne, erreurs de saisie, double clic, retour, actualisation, ligne complète,
  clavier seul, vue depuis la ligne, changement de ligne, hésitation, abandon, lien direct, mouvements réduits)
  × 3 réseaux (fibre, 4G, 3G lente). **[SIMULÉ]** dans Chromium — pas de Safari/Firefox réels ici.
- Chaque parcours est vérifié indépendamment : l'API d'administration doit contenir exactement la demande attendue
  (bonne ligne, bon nombre de personnes), ou aucune si le parcours ne devait rien créer.
- Résultats : 1 000 parcours sur l'ancien modèle par table (946 réussis, 54 délais de la machine de test, tous réussis au rejeu) ;
  150 parcours sur le modèle par ligne (149/150, l'échec réussit au rejeu) ; 60 parcours de non-régression finaux
  : **60/60** (voir `tests/rapport-parcours.md`).

## 5. Problèmes et corrections
Voir `AUDIT_LOG.md` (tableaux P1–P10 et C1–C7, avec preuve et statut). Les plus graves :
- **P1 critique — faux succès** : mode « démo » silencieux. Corrigé : succès seulement avec un numéro de demande
  confirmé par le serveur, lui-même renvoyé seulement après écriture réelle sur disque (C7).
- **C3 — perte de données** : fichier abîmé → base vide et sauvegarde écrasée. Corrigé : mise de côté + restauration
  automatique depuis la dernière sauvegarde (testé avec un vrai fichier tronqué).
- **C1/C2 — surréservation et double attribution** : corrigés côté serveur (l'interface ne peut pas contourner).

## 6. Audit indépendant de fiabilité des automatisations et des validations
- **Méthode** : séparation exécutant / vérificateur (le navigateur agit, l'API d'administration et le fichier sur disque
  vérifient) ; scénarios conçus pour tromper la validation (réponse 200 sans numéro, page HTML d'un proxy, coupure en
  plein envoi, absence de réponse, réponse perdue puis renvoi, double clic, champs piégés, ligne qui se remplit pendant
  la saisie) ; **tests par mutation** (12 défauts réinjectés volontairement : 12 détectés).
- **Faux positifs mesurés** : avant correction, 1 scénario sur 1 testé donnait un faux succès (P1) et un renvoi modifié
  en donnait un autre (C4) ; après correction, **0 faux succès sur 10 scénarios**.
- **Biais trouvé dans mes propres tests** : le scénario « ligne complète » réussissait à cause de l'anti-spam (même adresse
  pour tous les visiteurs simulés). Corrigé : une adresse par visiteur et vérification du message exact attendu.
- **Contre-audit** : un agent distinct, sans accès à mes conclusions, a trouvé 6 défauts confirmés que mes tests
  n'avaient pas vus. Tous sont corrigés et couverts. Leçon : mes notes précédentes étaient trop optimistes.
- **Limites** : pas de test sur de vrais téléphones ni avec de vraies personnes ; comportement exact du proxy Render
  (adresse IP en dernier dans X-Forwarded-For) [NON VÉRIFIABLE] ; site public non joignable depuis cet environnement
  (déploiement vérifié via l'API et les journaux Render).

## 7. Sécurité et conformité
- En-têtes CSP (sans tiers), HSTS, nosniff, anti-iframe ; validation serveur de tous les champs ; anti-spam ;
  blocage après 10 mots de passe admin faux ; aucune donnée personnelle dans les journaux ; XSS testée (nom piégé
  affiché sans exécution dans l'admin) ; traversée de dossiers refusée.
- RGPD : pas de cookies ni traceurs, polices locales, politique de confidentialité, effacement automatique 90 jours
  après la soirée (sauvegardes : 14 jours). [ANALYSE] la purge n'est déclenchable qu'en mars 2027.
- Hébergement Render en Europe (Francfort) ; société de droit américain → mentionné dans la politique.

## 8. Notes sur 100 (critères fixés : part des contrôles mesurés réussis ; non mesurable = indiqué)
| Domaine | Avant | Après | Mesure et limite |
|---|---|---|---|
| Fiabilité des validations | 40 | 95 | 0 faux succès / 10 scénarios, 12/12 mutations ; pas de vrai réseau mobile |
| Stabilité / intégrité des données | 70 | 95 | 23 tests dont restauration réelle ; pas de test longue durée |
| Sécurité | 85 | 92 | 6 défauts corrigés ; pas de test d'intrusion externe |
| Accessibilité | 90 | 95 | axe 0 violation ; plan 3D difficile sans la vue (alternative : liste des zones) |
| SEO / partage | 70 | 95 | Lighthouse 100, OG, JSON-LD ; domaine définitif à choisir |
| Conformité | 30 | 80 | pages créées ; informations légales et annulation **manquantes** |
| Rapidité mobile | 55 | 75 | LCP 3,2 s (> 2,5 s) à cause de l'ouverture ; CLS bon |
| UX / navigation | — | non noté | aucun test humain ; parcours simulés réussis |
| Performance / précision des bots | — | **non évaluable** | aucun bot dans le dépôt |

## 9. Ce que vous devez faire
1. Compléter `EDITEUR` dans `public/config.js` et les conditions d'annulation (je peux le faire si vous m'envoyez les infos).
2. Confirmer personnes par table / minimum.
3. Tester sur votre iPhone et un Android, et faire réserver 2–3 personnes réelles (puis supprimer dans l'admin).
4. Créer un compte UptimeRobot (gratuit) sur `https://…/api/health`.
5. Si vous voulez l'audit des bots Instagram : ajouter leur dépôt à la session.

## 10. Maintenance
- Avant chaque modification : `node --test tests/*.test.mjs` (aussi lancé automatiquement par GitHub) puis
  `node tests/faux-succes.cjs` ; parcours `node tests/parcours.cjs 150 4` avant un changement d'interface.
- Surveillance : e-mails GitHub en cas d'échec du contrôle toutes les 30 min.
- Après la soirée : exporter le CSV si besoin ; l'effacement automatique a lieu 90 jours après.
