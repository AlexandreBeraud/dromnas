import { html, setHtml } from './dom.js';
import { icone } from './icones.js';

let compteur = 0;

// ouvrirModale({ titre, corps, actions: [{ libelle, principal, danger, run }], taille: 'etroite' | 'large' })
// largeur (en px) remplace taille quand une modale a besoin d'une largeur précise.
// run(el) peut être async. S'il lève une erreur, elle s'affiche dans la modale,
// qui reste ouverte : la saisie n'est pas perdue. S'il renvoie false, la modale reste ouverte aussi.
export function ouvrirModale({ titre, corps = '', actions = [], taille = '', largeur, aOuverture, aFermeture }) {
  const fond = document.createElement('div');
  fond.className = 'modale-fond';
  const idTitre = `modale-titre-${++compteur}`;

  setHtml(fond, html`
    <div class="modale ${taille ? `modale-${taille}` : ''}" role="dialog" aria-modal="true" aria-labelledby="${idTitre}">
      <div class="modale-tete">
        <h2 id="${idTitre}">${titre}</h2>
        <button type="button" class="btn btn-fantome btn-icone" data-fermer aria-label="Fermer">${icone('fermer', 20)}</button>
      </div>
      <div class="modale-corps">${corps}</div>
      <p class="modale-erreur" role="alert" hidden></p>
      ${actions.length ? html`
        <div class="modale-pied">
          ${actions.map((a, i) => html`<button type="button" class="btn ${a.principal ? 'btn-principal' : a.danger ? 'btn-danger' : ''}" data-action="${i}">${a.libelle}</button>`)}
        </div>` : ''}
    </div>
  `);

  const precedent = document.activeElement;
  const modale = fond.querySelector('.modale');
  const erreur = fond.querySelector('.modale-erreur');
  if (largeur) modale.style.setProperty('--modale-l', `${largeur / 16}rem`);

  function fermer() {
    if (!fond.isConnected) return;
    fond.remove();
    document.removeEventListener('keydown', clavier);
    if (!document.querySelector('.modale-fond')) document.body.classList.remove('modale-ouverte');
    precedent?.focus?.();
    aFermeture?.();
  }

  function clavier(e) {
    if (e.key === 'Escape' && fond === [...document.querySelectorAll('.modale-fond')].pop()) fermer();
  }

  fond.addEventListener('click', async e => {
    if (e.target === fond || e.target.closest('[data-fermer]')) return fermer();
    const bouton = e.target.closest('[data-action]');
    if (!bouton) return;
    const action = actions[Number(bouton.dataset.action)];
    if (!action.run) return fermer();
    bouton.disabled = true;
    erreur.hidden = true;
    try {
      if ((await action.run(modale)) !== false) fermer();
    } catch (err) {
      erreur.textContent = err?.message || String(err);
      erreur.hidden = false;
    } finally {
      bouton.disabled = false;
    }
  });
  document.addEventListener('keydown', clavier);

  document.body.append(fond);
  document.body.classList.add('modale-ouverte');
  (modale.querySelector('input, select, textarea') || modale.querySelector('[data-fermer]')).focus();
  aOuverture?.(modale);
  return { el: modale, fermer };
}

// Confirmation simple : true si l'action est validée
export function confirmer({ titre, message, libelle = 'Confirmer', danger = false }) {
  return new Promise(resoudre => {
    let reponse = false;
    ouvrirModale({
      titre,
      taille: 'etroite',
      corps: html`<p class="muted">${message}</p>`,
      actions: [
        { libelle: 'Annuler' },
        { libelle, principal: !danger, danger, run: () => { reponse = true; } },
      ],
      // croix, Échap ou clic à côté : c'est non
      aFermeture: () => resoudre(reponse),
    });
  });
}
