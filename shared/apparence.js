// Thème, clair/sombre, taille du texte, rayons et accent, posés sur <html>.
// Gardés sur l'appareil : la page s'affiche tout de suite aux bonnes couleurs.
//   export const appliquerApparence = preparerApparence({ cle: 'ekus.apparence', defaut: { theme: 'terracotta' } });
//   appliquerApparence({ theme, luminosite, taille_texte, rayon, accent })
//
// luminosite : 'sombre' | 'clair' | 'auto' ; taille_texte : 'petite' | 'normale' | 'grande'
// rayon : 'angulaire' | 'normal' | 'arrondi' ; accent : couleur libre (#RRGGBB) ou rien
// effets : 'tous' | 'doux' | 'aucun' ; vide : « doux » si le système demande moins d'animations, sinon « tous »

const BASE = { theme: '', luminosite: 'sombre', taille_texte: 'normale', rayon: 'normal', accent: '', effets: '' };
const systemeSombre = matchMedia('(prefers-color-scheme: dark)');
const systemeCalme = matchMedia('(prefers-reduced-motion: reduce)');

export function preparerApparence({ cle, defaut = {} }) {
  const DEFAUT = { ...BASE, ...defaut };
  let actuelle = DEFAUT;
  try {
    actuelle = { ...DEFAUT, ...JSON.parse(localStorage.getItem(cle)) };
  } catch { /* rien de gardé : apparence par défaut */ }

  function poser() {
    const racine = document.documentElement;
    const sombre = actuelle.luminosite === 'auto' ? systemeSombre.matches : actuelle.luminosite !== 'clair';
    if (actuelle.theme) racine.dataset.theme = actuelle.theme;
    racine.dataset.mode = sombre ? 'sombre' : 'clair';
    racine.dataset.taille = actuelle.taille_texte;
    racine.dataset.rayon = actuelle.rayon;
    racine.dataset.effets = ['tous', 'doux', 'aucun'].includes(actuelle.effets) ? actuelle.effets : systemeCalme.matches ? 'doux' : 'tous';
    if (/^#[0-9a-f]{3,8}$/i.test(actuelle.accent || '')) {
      racine.style.setProperty('--accent', actuelle.accent);
      racine.style.setProperty('--accent-text', actuelle.accent);
    } else {
      racine.style.removeProperty('--accent');
      racine.style.removeProperty('--accent-text');
    }
    // barre d'adresse du téléphone aux couleurs du fond
    const fond = getComputedStyle(racine).getPropertyValue('--bg').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', fond);
  }

  // seules les valeurs données changent ; null ou '' remet la valeur par défaut
  function appliquer(valeurs = {}) {
    const choisies = Object.fromEntries(Object.entries(valeurs).filter(([k]) => k in BASE));
    for (const [k, v] of Object.entries(choisies)) if (v == null || v === '') choisies[k] = DEFAUT[k];
    actuelle = { ...actuelle, ...choisies };
    try { localStorage.setItem(cle, JSON.stringify(actuelle)); } catch { /* tant pis, ce n'est qu'un confort */ }
    poser();
  }

  systemeSombre.addEventListener('change', () => {
    if (actuelle.luminosite === 'auto') poser();
  });
  systemeCalme.addEventListener('change', () => {
    if (!actuelle.effets) poser();
  });

  poser();
  return appliquer;
}
