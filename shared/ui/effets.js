// Effets de mouvement, tous réglés par data-effets sur <html> : « tous », « doux » (fondus, pas de boucles) ou « aucun ».
// Le réglage vient d'apparence.js. Repris du carnet d'effets, sans librairie.
//   suivreGroupes()            pastille glissante sous chaque .segmente et .chips de la page
//   apparition(racine, sel)    éléments qui montent en fondu, par petits lots (sel : sélecteur ou liste d'éléments)
//   boutonRemonter()           anneau de progression en bas à droite, retour en haut
//   gerbe(zone, x, y)          paillettes dorées

const racine = document.documentElement;
const SORTIE = 'cubic-bezier(.16, 1, .3, 1)';
const niveau = () => racine.dataset.effets || 'tous';


// ── Pastille glissante ───────────────────────────────────────────────────
// Le groupe est souvent redessiné à chaque clic : la dernière position est gardée
// sur son conteneur, et la pastille part de là.

const dernieres = new WeakMap();

function choisiDans(groupe) {
  const choisis = groupe.querySelectorAll(':scope > [aria-pressed="true"], :scope > [aria-selected="true"]');
  return choisis.length === 1 ? choisis[0] : null;
}

function placer(groupe, glisse, animer) {
  const cible = choisiDans(groupe);
  groupe.classList.toggle('a-glisse', !!cible);
  if (!cible) return;
  const pos = { x: cible.offsetLeft, y: cible.offsetTop, l: cible.offsetWidth, h: cible.offsetHeight };
  const avant = dernieres.get(groupe.parentElement);
  dernieres.set(groupe.parentElement, pos);
  const poser = p => {
    glisse.style.translate = `${p.x}px ${p.y}px`;
    glisse.style.width = `${p.l}px`;
    glisse.style.height = `${p.h}px`;
  };
  if (animer && avant && niveau() !== 'aucun' && (avant.x !== pos.x || avant.y !== pos.y || avant.l !== pos.l)) {
    glisse.style.transition = 'none';
    poser(avant);
    glisse.getBoundingClientRect();
    glisse.style.transition = '';
  }
  poser(pos);
}

function preparerGroupe(groupe) {
  if (groupe.querySelector(':scope > .glisse')) return;
  const glisse = document.createElement('span');
  glisse.className = 'glisse';
  glisse.setAttribute('aria-hidden', 'true');
  groupe.prepend(glisse);
  placer(groupe, glisse, true);
  new MutationObserver(() => placer(groupe, glisse, true))
    .observe(groupe, { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-selected'] });
  if ('ResizeObserver' in window) new ResizeObserver(() => placer(groupe, glisse, false)).observe(groupe);
}

export function suivreGroupes(zone = document.body) {
  const tout = () => zone.querySelectorAll('.segmente, .chips').forEach(preparerGroupe);
  let attente = false;
  new MutationObserver(() => {
    if (attente) return;
    attente = true;
    requestAnimationFrame(() => { attente = false; tout(); });
  }).observe(zone, { childList: true, subtree: true });
  tout();
  document.fonts?.ready.then(() => zone.querySelectorAll('.segmente, .chips').forEach(g => {
    const glisse = g.querySelector(':scope > .glisse');
    if (glisse) placer(g, glisse, false);
  }));
}


// ── Apparition ───────────────────────────────────────────────────────────
// Ce qui est déjà à l'écran apparaît tout de suite, en cascade ; le reste quand on y arrive.

export function apparition(zone, selecteur, { max = 40 } = {}) {
  if (niveau() === 'aucun' || !('IntersectionObserver' in window)) return;
  const doux = niveau() === 'doux';
  const elements = [...(typeof selecteur === 'string' ? zone.querySelectorAll(selecteur) : selecteur)].slice(0, max);
  elements.forEach(el => el.classList.add('avant-apparition'));
  let lot = [];
  let minuteur = 0;
  const io = new IntersectionObserver(entrees => {
    for (const e of entrees) if (e.isIntersecting) { lot.push(e.target); io.unobserve(e.target); }
    clearTimeout(minuteur);
    minuteur = setTimeout(() => {
      lot.forEach((el, k) => {
        el.classList.remove('avant-apparition');
        el.animate(doux
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [{ opacity: 0, translate: '0 14px' }, { opacity: 1, translate: '0 0' }],
        { duration: doux ? 300 : 520, delay: Math.min(k, 8) * 35, easing: SORTIE, fill: 'backwards' });
      });
      lot = [];
    }, 16);
  }, { rootMargin: '0px 0px -4% 0px' });
  elements.forEach(el => io.observe(el));
  return () => io.disconnect();
}


// ── Bouton « remonter » ─────────────────────────────────────────────────
// L'anneau se remplit avec le défilement ; il apparaît après un écran de descente.

export function boutonRemonter() {
  if (document.querySelector('.remonter')) return;
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'remonter';
  bouton.setAttribute('aria-label', 'Revenir en haut');
  bouton.innerHTML = '<span class="remonter-fleche" aria-hidden="true"></span>';
  document.body.append(bouton);

  let attente = false;
  const maj = () => {
    attente = false;
    const max = racine.scrollHeight - innerHeight;
    bouton.style.setProperty('--p', (max > 0 ? Math.min(1, scrollY / max) : 0).toFixed(3));
    bouton.classList.toggle('visible', scrollY > innerHeight * 0.8);
  };
  addEventListener('scroll', () => { if (!attente) { attente = true; requestAnimationFrame(maj); } }, { passive: true });
  addEventListener('resize', maj);
  addEventListener('hashchange', () => setTimeout(maj, 50));
  maj();

  let anim = 0;
  const stop = () => { cancelAnimationFrame(anim); anim = 0; };
  bouton.addEventListener('click', () => {
    stop();
    const depart = scrollY;
    if (niveau() !== 'tous' || depart < 2) { scrollTo({ top: 0, behavior: 'instant' }); return; }
    const duree = Math.min(900, 400 + depart * 0.1);
    const t0 = performance.now();
    const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const pas = now => {
      const t = Math.min(1, (now - t0) / duree);
      scrollTo({ top: Math.round(depart * (1 - ease(t))), behavior: 'instant' });
      anim = t < 1 ? requestAnimationFrame(pas) : 0;
    };
    anim = requestAnimationFrame(pas);
  });
  // la personne reprend la main : on s'arrête
  ['wheel', 'touchstart', 'keydown'].forEach(ev => addEventListener(ev, () => { if (anim) stop(); }, { passive: true }));
}


// ── Paillettes ───────────────────────────────────────────────────────────
// zone en position relative ou absolute ; x, y en px dans la zone. 48 au plus à la fois.

let vivantes = 0;

export function gerbe(zone, x, y, n = 22) {
  if (niveau() === 'aucun') return;
  const doux = niveau() === 'doux';
  for (let k = 0; k < (doux ? 8 : n); k++) {
    if (vivantes > 48) return;
    const s = document.createElement('span');
    const rond = Math.random() < 0.35;
    const taille = rond ? 4 + Math.random() * 5 : 9 + Math.random() * 12;
    s.className = `paillette${rond ? ' rond' : ''}`;
    s.setAttribute('aria-hidden', 'true');
    s.style.cssText = `left:${(x + (Math.random() - 0.5) * 30).toFixed(0)}px;top:${(y + (Math.random() - 0.5) * 30).toFixed(0)}px;width:${taille.toFixed(1)}px;height:${taille.toFixed(1)}px`;
    zone.append(s);
    vivantes++;
    const angle = Math.random() * Math.PI * 2;
    const portee = 30 + Math.random() * 90;
    const dx = Math.cos(angle) * portee;
    const dy = Math.sin(angle) * portee * 0.7 - 30;
    const tourne = (Math.random() - 0.5) * 360;
    const pos = (kx, ky, chute = 0) => `translate(calc(-50% + ${(dx * kx).toFixed(0)}px), calc(-50% + ${(dy * ky + chute).toFixed(0)}px))`;
    const fin = () => { s.remove(); vivantes--; };
    s.animate(doux
      ? [{ opacity: 0, transform: pos(0.4, 0.4) }, { opacity: 1, offset: 0.3 }, { opacity: 0, transform: pos(0.6, 0.6) }]
      : [
        { transform: 'translate(-50%, -50%) scale(.2)', opacity: 0 },
        { transform: `${pos(0.35, 0.45)} scale(1.3) rotate(${(tourne * 0.3).toFixed(0)}deg)`, opacity: 1, offset: 0.22 },
        { transform: `${pos(0.75, 0.8)} scale(.7) rotate(${(tourne * 0.7).toFixed(0)}deg)`, opacity: 0.9, offset: 0.55 },
        { transform: `${pos(1, 1, 24)} scale(.15) rotate(${tourne.toFixed(0)}deg)`, opacity: 0 },
      ], { duration: 900 + Math.random() * 700, delay: k * 22, easing: 'cubic-bezier(.2, .6, .35, 1)', fill: 'backwards' })
      .finished.then(fin, fin);
  }
}
