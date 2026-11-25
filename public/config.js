// =====================================================================
//  CONFIGURATION DE L'ÉVÉNEMENT — tout ce qui se modifie est ici.
//  (le serveur lit aussi ce fichier pour connaître les tables)
// =====================================================================

export const EVENT = {
  marque: 'Le Bal des Fous',
  theme: 'Nuit de Noël',
  sousTheme: 'Flocons & Merveilles',
  dateLongue: 'Samedi 19 Décembre',
  dateCourte: '19 DÉCEMBRE 2026',
  horaires: '23H00 — 06H00',
  debut: '2026-12-19T23:00:00+01:00',   // pour le compte à rebours
  lieu: 'Le Palais',
  tagline: 'LE BAL DE NOËL',
  acomptePct: 20,
  personnes: '10 ou 15 personnes',
};

// Zones : nom, prix (nombre ou [min, max]), capacité, couleur de la pastille
export const ZONES = [
  { id: 'front',   nom: 'Scène · Front DJ',       prix: 3500,         capacite: 15, couleurs: ['#e0393e'] },
  { id: 'diag',    nom: 'Scène · Diagonales',     prix: [2000, 2500], capacite: 10, couleurs: ['#f2c94c', '#27ae60'] },
  { id: 'balcon',  nom: 'Scène · Balcons +0,60',  prix: 1800,         capacite: 10, couleurs: ['#6c5ce7'] },
  { id: 'fond1',   nom: 'VIP Fond · rang 1',      prix: 2000,         capacite: 15, couleurs: ['#f39c12'] },
  { id: 'fond2',   nom: 'VIP Fond · rang 2',      prix: 1500,         capacite: 10, couleurs: ['#e84393'] },
  { id: 'ailes',   nom: 'VIP Fond · ailes',       prix: 1200,         capacite: 10, couleurs: ['#00b8d4'] },
];

// Tables : coordonnées relevées sur le plan (pixels du plan 1280 × 834),
// a = orientation (degrés) des canapés, n = nombre de canapés.
// La piste tournante est au centre (627, 389). 17 px ≈ 1 m.
const T = (num, zone, x, y, a = 0, n = 2, prix) => ({ id: String(num).padStart(2, '0'), zone, x, y, a, n, prix });

export const TABLES = [
  // VIP Fond centre — rang 2 (rangée du fond)
  T(1, 'fond2', 540, 185, 0, 2), T(2, 'fond2', 592, 185, 0, 2),
  T(3, 'fond2', 662, 185, 0, 2), T(4, 'fond2', 714, 185, 0, 2),
  // VIP Fond centre — rang 1 (côté piste)
  T(5, 'fond1', 478, 228, 0, 2), T(6, 'fond1', 522, 228, 0, 2), T(7, 'fond1', 566, 228, 0, 2),
  T(8, 'fond1', 688, 228, 0, 2), T(9, 'fond1', 732, 228, 0, 2), T(10, 'fond1', 776, 228, 0, 2),
  // Aile gauche (2 rangées en diagonale)
  T(11, 'ailes', 325, 312, -35, 2), T(12, 'ailes', 360, 287, -35, 2), T(13, 'ailes', 396, 262, -35, 2),
  T(14, 'ailes', 360, 345, -35, 2), T(15, 'ailes', 396, 320, -35, 2), T(16, 'ailes', 432, 295, -35, 2),
  // Aile droite
  T(17, 'ailes', 858, 262, 35, 2), T(18, 'ailes', 894, 287, 35, 2), T(19, 'ailes', 929, 312, 35, 2),
  T(20, 'ailes', 822, 295, 35, 2), T(21, 'ailes', 858, 320, 35, 2), T(22, 'ailes', 894, 345, 35, 2),
  // Scène — balcons +0,60 de part et d'autre du DJ
  T(23, 'balcon', 505, 578, 0, 2), T(24, 'balcon', 749, 578, 0, 2),
  // Scène — front DJ (arc central)
  T(25, 'front', 585, 612, 0, 2), T(26, 'front', 627, 612, 0, 2), T(27, 'front', 669, 612, 0, 2),
  // Scène — diagonales (2 500 € pour les plus proches du DJ)
  T(28, 'diag', 532, 640, 38, 2, 2000), T(29, 'diag', 560, 662, 38, 2, 2500), T(30, 'diag', 590, 684, 38, 2, 2500),
  T(31, 'diag', 664, 684, -38, 2, 2500), T(32, 'diag', 694, 662, -38, 2, 2500), T(33, 'diag', 722, 640, -38, 2, 2000),
];

export const zoneOf = (t) => ZONES.find((z) => z.id === t.zone);
export const prixTable = (t) => t.prix ?? (Array.isArray(zoneOf(t).prix) ? zoneOf(t).prix[0] : zoneOf(t).prix);
export const euros = (n) => n.toLocaleString('fr-FR').replace(/ | /g, ' ') + ' €';
