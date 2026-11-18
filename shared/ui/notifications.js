import { html, setHtml } from './dom.js';
import { icone } from './icones.js';

// notifier('Transaction enregistrée')
// notifier(err.message, { type: 'erreur', action: { libelle: 'Réessayer', run } })
// La page doit avoir un <div class="toasts" id="toasts" aria-live="polite">.
export function notifier(message, { type = 'ok', action = null, duree } = {}) {
  const pile = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'erreur' ? 'alert' : 'status');
  setHtml(el, html`
    ${icone(type === 'erreur' ? 'alerte' : 'ok')}
    <span class="toast-texte">${message}</span>
    ${action ? html`<button type="button">${action.libelle}</button>` : ''}
    <button type="button" class="toast-fermer" aria-label="Fermer">${icone('fermer', 16)}</button>
  `);

  const fermer = () => el.remove();
  el.addEventListener('click', e => {
    const bouton = e.target.closest('button');
    if (!bouton) return;
    fermer();
    if (!bouton.classList.contains('toast-fermer')) action?.run();
  });
  pile.append(el);
  // une erreur reste plus longtemps : il faut le temps de la lire
  setTimeout(fermer, duree ?? (type === 'erreur' ? 9000 : 3500));
  return fermer;
}

export const notifierErreur = (err, action) => notifier(err?.message || String(err), { type: 'erreur', action });
