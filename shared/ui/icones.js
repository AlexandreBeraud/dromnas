import { brut } from './dom.js';

// Tracés communs ; chaque appli ajoute ceux de son menu avec ajouterIcones()
const TRACES = {
  accueil: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z',
  reglages: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  plus: 'M12 5v14M5 12h14',
  menu: 'M4 6h16M4 12h16M4 18h16',
  recherche: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  fermer: 'M6 6l12 12M18 6 6 18',
  ok: 'M20 6 9 17l-5-5',
  alerte: 'M12 8v5M12 16.5v.01M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  precedent: 'M15 6l-6 6 6 6',
  suivant: 'M9 6l6 6-6 6',
  bas: 'M6 9l6 6 6-6',
  sortie: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  modifier: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  importer: 'M12 4v11M7 10l5 5 5-5M4 20h16',
  envoyer: 'M12 16V4M7 9l5-5 5 5M4 20h16',
};

export function ajouterIcones(traces) {
  Object.assign(TRACES, traces);
}

export function icone(nom, taille = 18) {
  return brut(`<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${TRACES[nom] || ''}"/></svg>`);
}
