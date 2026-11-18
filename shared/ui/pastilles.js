import { html, on, setHtml } from './dom.js';

// Groupe de pastilles de filtre.
// pastilles(el, { options: [{ valeur, libelle, nombre }], valeur, multiple, libelle, aChangement })
export function pastilles(el, { options, valeur, multiple = false, libelle = 'Filtre', aChangement }) {
  let choisi = multiple ? new Set(valeur || []) : valeur;

  const estChoisi = v => multiple ? choisi.has(v) : choisi === v;

  function rendre() {
    setHtml(el, html`
      <div class="chips" role="group" aria-label="${libelle}">
        ${options.map(o => html`
          <button type="button" class="chip" data-valeur="${o.valeur}" aria-pressed="${estChoisi(o.valeur)}">
            ${o.libelle}${o.nombre != null ? html`<span class="chip-n">${o.nombre}</span>` : ''}
          </button>`)}
      </div>
    `);
  }

  on(el, 'click', '.chip', (_, bouton) => {
    const v = bouton.dataset.valeur;
    if (multiple) {
      choisi.has(v) ? choisi.delete(v) : choisi.add(v);
      aChangement?.([...choisi]);
    } else {
      choisi = v;
      aChangement?.(v);
    }
    rendre();
  });

  rendre();
  return {
    poser(v) { choisi = multiple ? new Set(v) : v; rendre(); },
    poserOptions(o) { options = o; rendre(); },
  };
}
