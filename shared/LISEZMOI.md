# Kit commun `shared/`

Servi par Caddy sur `/_shared/` pour chaque site déclaré avec `import app <appli>`.
Un `git pull` du dépôt dromnas suffit à le mettre à jour pour toutes les applis.

## Dans une appli

```html
<link rel="stylesheet" href="/_shared/tokens.css">
<link rel="stylesheet" href="/_shared/drom.css">
<link rel="stylesheet" href="/_shared/theme-<appli>.css">
<!-- puis les feuilles propres à l'appli -->
...
<div class="app">
  <aside class="sidebar" id="sidebar"></aside>
  <main class="main" id="main" tabindex="-1"></main>
</div>
<nav class="tabbar" id="tabbar" aria-label="Navigation"></nav>
<div class="toasts" id="toasts" aria-live="polite"></div>
```

`api.js` de l'appli :

```js
import { creerApi } from '/_shared/api.js';
export const { api, session, etatReseau } = creerApi();          // schéma v2, sans profils
// Ekus : creerApi({ cleSession: 'ekus.session', lectureSeuleHorsLigne: true })
```

`apparence.js` de l'appli :

```js
import { preparerApparence } from '/_shared/apparence.js';
export const appliquerApparence = preparerApparence({ cle: '<appli>.apparence', defaut: { theme: '…' } });
```

Icônes du menu : `ajouterIcones({ nom: 'tracé SVG 24×24' })` une fois, puis `icone(nom, taille)`.

## Contenu

| Fichier | Rôle |
| --- | --- |
| `tokens.css` | Palette par défaut (sombre, clair avec `data-mode="clair"`), polices, rayons (`data-rayon`), taille du texte (`data-taille`), fonds des composants |
| `drom.css` | Menu latéral, barre du bas, en-têtes de page, boutons, panneaux, champs, filtres, pastilles, badges, listes, états vides, modales, toasts |
| `theme-<appli>.css` | Couleurs, polices et réglages propres à l'appli |
| `api.js` | `creerApi()` : `lire`, `un`, `page`, `compter`, `ajouter`, `ajouterLot`, `enregistrer`, `modifier`, `supprimer`, `appeler`, `connexion` |
| `apparence.js` | `preparerApparence()` : thème, clair/sombre/auto, taille du texte, rayons, accent libre |
| `ui/dom.js` | `html`, `brut`, `esc`, `setHtml`, `$`, `$$`, `on`, `differer`, `majuscule`, `chargerSuite`, `uid`, `rechargerPage`, `etatErreur` |
| `ui/modale.js` | `ouvrirModale`, `confirmer` |
| `ui/notifications.js` | `notifier`, `notifierErreur` |
| `ui/icones.js` | `icone`, `ajouterIcones` |
| `ui/pastilles.js` | `pastilles` (groupe de filtres) |

Événements sur `window` : `nas-statut` (`detail.ok`) quand le NAS tombe ou revient,
`session-expiree` quand un jeton est refusé.

Les noms des variables CSS restent ceux d'origine (`--bg`, `--surface`, `--accent`…) ;
les classes et le JavaScript sont en français.
