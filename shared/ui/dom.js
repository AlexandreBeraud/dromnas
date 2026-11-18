const ECHAPPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(valeur) {
  return String(valeur ?? '').replace(/[&<>"']/g, c => ECHAPPE[c]);
}

// Morceau de HTML déjà sûr, que html`` ne doit pas échapper
class Brut {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const brut = s => new Brut(s);

function morceau(v) {
  if (v instanceof Brut) return v.s;
  if (Array.isArray(v)) return v.map(morceau).join('');
  if (v === false || v == null) return '';
  return esc(v);
}

// Gabarit HTML : chaque valeur est échappée, sauf brut() et les html`` imbriqués
export function html(textes, ...valeurs) {
  let out = textes[0];
  valeurs.forEach((v, i) => { out += morceau(v) + textes[i + 1]; });
  return brut(out);
}

export function setHtml(el, contenu) {
  el.innerHTML = String(contenu);
}

export const $ = (sel, racine = document) => racine.querySelector(sel);
export const $$ = (sel, racine = document) => [...racine.querySelectorAll(sel)];

// Délégation : un seul écouteur par conteneur, qui survit aux re-rendus
export function on(racine, type, selecteur, gestion) {
  racine.addEventListener(type, e => {
    const cible = e.target.closest(selecteur);
    if (cible && racine.contains(cible)) gestion(e, cible);
  });
}

export function differer(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const majuscule = s => s ? s[0].toUpperCase() + s.slice(1) : s;

// Liste qui se complète toute seule : charger() est appelé quand l'élément [data-suite]
// arrive à l'écran (un à la fois). À appeler une fois par page.
export function chargerSuite(racine, charger) {
  let occupe = false;
  const io = new IntersectionObserver(entrees => {
    if (occupe || !entrees.some(e => e.isIntersecting)) return;
    occupe = true;
    Promise.resolve(charger()).finally(() => { occupe = false; });
  }, { rootMargin: '600px 0px' });
  const surveiller = () => {
    if (!racine.isConnected) { io.disconnect(); mo.disconnect(); return; }
    racine.querySelectorAll('[data-suite]:not([data-surveille])').forEach(el => { el.dataset.surveille = '1'; io.observe(el); });
  };
  const mo = new MutationObserver(surveiller);
  mo.observe(racine, { childList: true, subtree: true });
  surveiller();
}

// pas de crypto.randomUUID : il n'existe pas hors HTTPS
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Réaffiche la page courante (le routeur de l'appli écoute hashchange)
export const rechargerPage = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

// Écran d'erreur avec un bouton ; l'attribut dit qui doit réagir au clic
export function etatErreur(titre, err, attribut = 'data-reessayer') {
  const horsLigne = err?.status === 0;
  return html`<div class="vide-etat" role="alert">
    <h2>${horsLigne ? 'Le NAS ne répond pas' : titre}</h2>
    <p>${horsLigne ? 'Vérifie que Tailscale est actif sur cet appareil. Rien de ce que tu as saisi n’est perdu.' : err?.message || ''}</p>
    <button type="button" class="btn" ${brut(attribut)}>Réessayer</button>
  </div>`;
}
