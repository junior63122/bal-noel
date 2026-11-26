import { EVENT, EDITEUR, HEBERGEUR, VIP_NOM } from './config.js';
const v = (x) => (x === 'à compléter' ? '<span class="todo">à compléter</span>' : x);
const date = new Date(EVENT.debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const P = {
  'mentions-legales': ['Mentions légales', `
    <h2>Éditeur du site</h2><p>${v(EDITEUR.societe)}<br>Siège : ${v(EDITEUR.adresse)}<br>SIRET : ${v(EDITEUR.siret)}<br>
    Directeur de la publication : ${v(EDITEUR.directeurPublication)}<br>Contact : ${v(EDITEUR.email)} · ${v(EDITEUR.telephone)}</p>
    <h2>Hébergement</h2><p>${HEBERGEUR}</p>
    <h2>Propriété intellectuelle</h2><p>Les visuels, logos et textes de ce site appartiennent à ${EDITEUR.societe} ou à leurs auteurs. Toute reproduction sans autorisation est interdite.</p>
    <h2>Alcool et accès</h2><p>Soirée réservée aux personnes majeures. L’abus d’alcool est dangereux pour la santé, à consommer avec modération.</p>`],
  confidentialite: ['Confidentialité', `
    <p>Ce site sert uniquement à recevoir des demandes de réservation pour le ${EVENT.theme.replace(/^Le /, '')} du ${date}.</p>
    <h2>Données collectées</h2><p>Prénom, nom, téléphone, e-mail (facultatif), zone et ligne choisies, nombre de personnes, mode de contact préféré, message éventuel.
    Rien d’autre : pas de compte, pas de paiement en ligne.</p>
    <h2>Pourquoi</h2><p>Traiter votre demande, vous recontacter par SMS ou WhatsApp et vous attribuer une table (mesures précontractuelles à votre demande).</p>
    <h2>Qui y a accès</h2><p>Uniquement l’organisation (${EDITEUR.societe}). Les données sont stockées chez l’hébergeur du site (${HEBERGEUR.split(' — ')[0]}, serveurs en Europe — Francfort), qui agit comme sous-traitant.
    Elles ne sont ni vendues, ni transmises à des fins publicitaires.</p>
    <h2>Durée de conservation</h2><p>Les demandes sont effacées automatiquement ${EVENT.conservationJours} jours après la soirée. Les copies de sauvegarde sont effacées au bout de 14 jours.</p>
    <h2>Cookies et traceurs</h2><p>Aucun cookie publicitaire ni outil de mesure d’audience. Le site garde seulement en mémoire de session, sur votre appareil, le fait que vous avez déjà vu l’animation d’ouverture.
    Les polices de caractères sont hébergées sur le site : aucune connexion à un service tiers n’est faite pendant votre visite.</p>
    <h2>Vos droits</h2><p>Vous pouvez demander l’accès, la rectification ou la suppression de vos données à tout moment : ${v(EDITEUR.email)}.
    Vous pouvez aussi saisir la CNIL (cnil.fr).</p>`],
  conditions: ['Conditions de réservation', `
    <h2>Une demande, pas un achat</h2><p>Le formulaire envoie une <strong>demande</strong> de réservation en ${VIP_NOM}. Elle n’engage ni vous ni l’organisation tant qu’elle n’est pas validée.</p>
    <h2>Prix</h2><p>Les prix sont indiqués <strong>par personne</strong> et dépendent de la ligne choisie (ligne avant ou ligne arrière). Le total dépend du nombre de personnes indiqué.</p>
    <h2>Validation et acompte</h2><p>L’organisation vous recontacte par SMS ou WhatsApp. Après validation, un acompte de ${EVENT.acomptePct} % du total est demandé pour confirmer la réservation ; le solde est réglé sur place.</p>
    <h2>Attribution des tables</h2><p>Vous choisissez une zone et une ligne ; l’organisation attribue la ou les tables à l’intérieur de cette ligne.</p>
    <h2>Annulation</h2><p>Les conditions d’annulation et de remboursement de l’acompte vous sont communiquées lors de la validation. <span class="todo">À préciser par l’organisation.</span></p>
    <h2>Accès</h2><p>${EVENT.lieuDetail}. ${EVENT.horairesFr}. Soirée réservée aux personnes majeures ; une pièce d’identité peut être demandée.</p>`],
  404: ['Page introuvable', `<p>Cette page n’existe pas ou a été déplacée.</p><a class="cta" href="/">Revenir à l’accueil</a>`],
};
const [titre, html] = P[document.body.dataset.page] || P[404];
document.title = `${titre} · Le Bal de Noël — Le Bal des Fous`;
document.querySelector('main').innerHTML = `<h1>${titre}</h1>${html}`;
