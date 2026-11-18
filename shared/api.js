// Client PostgREST commun. Tout passe par Caddy, sur la même origine que le site.
// Chaque appli le prépare une fois dans son propre api.js :
//   export const { api, session, etatReseau } = creerApi({ cleSession: 'ekus.session' });
// L'événement window 'nas-statut' ({ detail: { ok } }) prévient quand le NAS tombe ou revient.

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Codes Postgres les plus courants, dits simplement
const MESSAGES = {
  23505: 'Cette valeur existe déjà.',
  23503: 'Impossible : d’autres données y sont liées.',
  23514: 'Une des valeurs saisies n’est pas acceptée.',
  42501: 'Ce profil n’a pas le droit de faire ça.',
};

function params(filtres = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filtres)) {
    if (v !== undefined && v !== null && v !== '') q.append(k, v);
  }
  const s = q.toString();
  return s ? '?' + s : '';
}

// filtres PostgREST, ou un id seul pour viser une ligne
const cible = idOuFiltres => typeof idOuFiltres === 'object' ? idOuFiltres : { id: `eq.${idOuFiltres}` };


// ── Session (applis avec profils et code) ────────────────────────────────
// « Rester connecté » : localStorage jusqu'à l'expiration du jeton. Sinon le temps de l'onglet.

function creerSession(cle) {
  const lire = () => {
    if (!cle) return null;
    for (const stock of [sessionStorage, localStorage]) {
      try {
        const s = JSON.parse(stock.getItem(cle));
        if (s?.jeton && s.expire > Date.now()) return s;
        if (s) stock.removeItem(cle);
      } catch { /* stockage bloqué ou valeur abîmée : pas de session */ }
    }
    return null;
  };
  const ecrire = s => {
    try {
      sessionStorage.removeItem(cle);
      localStorage.removeItem(cle);
      if (s) (s.rester ? localStorage : sessionStorage).setItem(cle, JSON.stringify(s));
    } catch { /* navigation privée : la session ne vit qu'en mémoire */ }
  };

  let courante = lire();
  const session = {
    get active() {
      if (courante && courante.expire <= Date.now()) session.fermer();
      return courante !== null;
    },
    get profil() { return session.active ? courante.profil : null; },
    get jeton() { return session.active ? courante.jeton : null; },
    ouvrir({ jeton, expire_le, profil }, rester) {
      courante = { jeton, expire: Date.parse(expire_le), profil, rester: !!rester };
      ecrire(courante);
    },
    fermer() {
      courante = null;
      if (cle) ecrire(null);
    },
  };
  return session;
}


// ── Client ───────────────────────────────────────────────────────────────
// schema : le schéma v2 d'une refonte (l'ancienne appli reste sur public)
// lectureSeuleHorsLigne : avec un service worker, refuser d'écrire tant que le NAS ne répond pas

export function creerApi({ base = '/api', schema = 'v2', delai: delaiDefaut = 15000, cleSession = null, lectureSeuleHorsLigne = false } = {}) {
  const session = creerSession(cleSession);

  let joignable = true;
  const etatReseau = { get horsLigne() { return !joignable; } };
  function signaler(ok) {
    if (ok === joignable) return;
    joignable = ok;
    window.dispatchEvent(new CustomEvent('nas-statut', { detail: { ok } }));
  }

  async function requete(chemin, { methode = 'GET', corps, entetes = {}, delai = delaiDefaut } = {}) {
    const ctrl = new AbortController();
    const minuteur = setTimeout(() => ctrl.abort(), delai);
    const h = { ...entetes };
    if (schema) {
      h['Accept-Profile'] = schema;
      // une écriture sans Content-Profile irait chercher la table dans public
      if (methode !== 'GET' && methode !== 'HEAD') h['Content-Profile'] = schema;
    }
    if (corps !== undefined) h['Content-Type'] = 'application/json';
    const jeton = session.jeton;
    if (jeton) {
      h.Authorization = `Bearer ${jeton}`;
      // le cache hors ligne range les réponses par profil
      h['X-Drom-Profil'] = session.profil?.id || '';
    }

    let rep;
    try {
      rep = await fetch(base + chemin, {
        method: methode,
        headers: h,
        body: corps === undefined ? undefined : JSON.stringify(corps),
        signal: ctrl.signal,
        cache: 'no-store',
      });
    } catch (e) {
      signaler(false);
      if (methode !== 'GET' && methode !== 'HEAD' && !chemin.startsWith('/rpc/')) throw new ApiError('Hors ligne : rien n’est enregistré tant que le NAS ne répond pas.', 0);
      throw new ApiError(e.name === 'AbortError' ? 'Le NAS met trop de temps à répondre.' : 'Le NAS est injoignable.', 0);
    } finally {
      clearTimeout(minuteur);
    }
    // réponse gardée par le service worker : les données ne sont pas fraîches
    signaler(!rep.headers.get('X-Drom-Hors-Ligne'));

    if (!rep.ok) {
      let err = {};
      try { err = await rep.json(); } catch { /* corps vide ou pas du JSON */ }
      // jeton expiré ou refusé : l'appli renvoie au choix du profil
      if (rep.status === 401 && jeton) {
        session.fermer();
        window.dispatchEvent(new CustomEvent('session-expiree'));
        throw new ApiError('Ta session a expiré, reconnecte-toi.', 401, err.code);
      }
      throw new ApiError(MESSAGES[err.code] || err.message || `Erreur ${rep.status}`, rep.status, err.code);
    }

    const texte = rep.status === 204 || methode === 'HEAD' ? '' : await rep.text();
    return { donnees: texte ? JSON.parse(texte) : null, rep };
  }

  // Hors ligne, l'appli ne montre que des données gardées : on n'écrit pas par-dessus
  function verifierEnLigne() {
    if (lectureSeuleHorsLigne && !joignable) throw new ApiError('Hors ligne : la saisie reprendra quand le NAS répondra.', 0);
  }

  const api = {
    // api.lire('comptes', { select: 'id,nom', archive: 'is.false', order: 'ordre' })
    async lire(table, filtres) {
      return (await requete(`/${table}${params(filtres)}`)).donnees;
    },

    async un(table, filtres) {
      const lignes = await api.lire(table, { ...filtres, limit: 1 });
      return lignes[0] ?? null;
    },

    // Une page de lignes et le total, pour ne jamais tout charger d'un coup
    async page(table, filtres, { debut = 0, taille = 100 } = {}) {
      const { donnees, rep } = await requete(`/${table}${params(filtres)}`, {
        entetes: { 'Range-Unit': 'items', Range: `${debut}-${debut + taille - 1}`, Prefer: 'count=exact' },
      });
      const total = Number((rep.headers.get('Content-Range') || '').split('/')[1]);
      const lignes = donnees || [];
      return { lignes, total: Number.isFinite(total) ? total : debut + lignes.length };
    },

    async compter(table, filtres) {
      const { rep } = await requete(`/${table}${params(filtres)}`, { methode: 'HEAD', entetes: { Prefer: 'count=exact' } });
      return Number((rep.headers.get('Content-Range') || '').split('/')[1]) || 0;
    },

    // Une ligne ; renvoie la ligne créée
    async ajouter(table, ligne) {
      if (Array.isArray(ligne)) throw new Error('api.ajouter : une ligne à la fois (api.ajouterLot pour plusieurs)');
      verifierEnLigne();
      const { donnees } = await requete(`/${table}`, {
        methode: 'POST', corps: ligne, entetes: { Prefer: 'return=representation' },
      });
      return donnees?.[0] ?? null;
    },

    // Plusieurs lignes en une requête ; renvoie les lignes créées
    async ajouterLot(table, lignes) {
      verifierEnLigne();
      const { donnees } = await requete(`/${table}`, {
        methode: 'POST', corps: lignes, entetes: { Prefer: 'return=representation' },
      });
      return donnees || [];
    },

    // Crée ou remplace selon la clé : api.enregistrer('set_prefs', ligne, 'kind,target_id')
    async enregistrer(table, ligne, conflit) {
      verifierEnLigne();
      const { donnees } = await requete(`/${table}${params({ on_conflict: conflit })}`, {
        methode: 'POST', corps: ligne, entetes: { Prefer: 'resolution=merge-duplicates,return=representation' },
      });
      return Array.isArray(ligne) ? donnees || [] : donnees?.[0] ?? null;
    },

    // api.modifier('comptes', id, champs) → la ligne modifiée
    // api.modifier('settings', { id: 'eq.1' }, champs) → les lignes modifiées
    async modifier(table, idOuFiltres, champs) {
      verifierEnLigne();
      const { donnees } = await requete(`/${table}${params(cible(idOuFiltres))}`, {
        methode: 'PATCH', corps: champs, entetes: { Prefer: 'return=representation' },
      });
      if (typeof idOuFiltres === 'object') return donnees || [];
      // RLS : une ligne d'un autre profil ne se modifie pas, sans erreur de la base
      if (!donnees?.length) throw new ApiError('Cette ligne n’existe plus ou n’est pas visible pour ce profil.', 404);
      return donnees[0];
    },

    async supprimer(table, idOuFiltres) {
      const filtres = cible(idOuFiltres);
      if (!Object.keys(filtres).length) throw new Error('Suppression sans filtre refusée');
      verifierEnLigne();
      await requete(`/${table}${params(filtres)}`, { methode: 'DELETE' });
    },

    // api.appeler('periode', { decalage: -1 }) ; délai plus long pour un calcul lourd
    async appeler(fonction, args = {}, { delai } = {}) {
      return (await requete(`/rpc/${fonction}`, { methode: 'POST', corps: args, delai })).donnees;
    },

    // Appli avec profils : appelle v2.login ; la session n'est ouverte que si ok
    async connexion(profil, code, rester) {
      session.fermer();
      const r = await api.appeler('login', { profil, code, rester });
      if (r?.ok) session.ouvrir(r, rester);
      return r;
    },

    deconnexion() {
      session.fermer();
    },
  };

  return { api, session, etatReseau };
}
