# Accès sécurisé — expérience de scroll immersive

Une page unique où **plus on défile, plus on s'enfonce dans une pièce sécurisée** :
rue → hall → couloir → sas de sécurité → **porte blindée (volant cranté qui tourne au scroll)** → cave sombre → **message de remerciement**.

Le rendu fonctionne comme une **vidéo scrubbée par le défilement** (technique type Apple) :
la position de scroll pilote l'image exacte affichée à l'écran. Sensation « vision humaine qui avance dans les pièces », pas de diaporama.

## Lancer en local

Il faut un petit serveur HTTP (le mode images/vidéo ne marche pas en `file://`) :

```bash
cd thanks
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Les 3 modes de rendu

Tout se règle dans **`js/main.js`**, objet `CONFIG.mode` :

| mode | ce que c'est | à fournir |
|------|--------------|-----------|
| `"procedural"` *(défaut)* | décor **placeholder** dessiné en direct dans le navigateur, zéro fichier | rien |
| `"frames"` | **séquence d'images** — le plus fluide, idéal pour du photoréaliste | des images dans `frames/` |
| `"video"` | une **seule vidéo** scrubbée | un `.mp4` dans `assets/` |
| `"clips"` | **plusieurs vidéos** raccordées par **fondu enchaîné** (idéal clips IA) | des `.mp4` dans `assets/` |

### Mode `"clips"` : ajouter des clips au parcours

Chaque clip occupe une portion du scroll ; un **fondu enchaîné** est appliqué automatiquement
entre deux clips (aucun montage externe requis — tout se fait dans le navigateur). Il suffit
de lister les fichiers **dans l'ordre du parcours** dans `js/main.js` → `CONFIG.clips.list` :

```js
mode: "clips",
clips: {
  crossfade: 0.06,               // largeur du fondu (0.04–0.10 en général)
  list: [
    "assets/01-rue.mp4",
    "assets/02-hall.mp4",
    "assets/journey.mp4",        // porte blindée
    "assets/06-cave.mp4",
  ],
},
```

### Brancher ta vraie vidéo ultra-réaliste

**Recommandé : mode `frames`** (scrub parfaitement fluide, même sur mobile).

1. Prends ta vidéo du parcours (rue → … → cave).
2. Découpe-la en images. Avec ffmpeg :
   ```bash
   ffmpeg -i ma_video.mp4 -vf "fps=30,scale=1920:-1" frames/frame_%04d.jpg
   ```
3. Dans `js/main.js`, mets :
   ```js
   mode: "frames",
   frames: { count: <nombre d'images générées>, path: (i) => `frames/frame_${String(i).padStart(4,"0")}.jpg` },
   ```
   ⚠️ les images commencent à `frame_0000.jpg` : soit tu renommes, soit tu changes `path` en `i + 1`.

**Alternative : mode `video`** — dépose `assets/journey.mp4` et mets `mode: "video"`.
Plus simple (1 fichier) mais le scrub peut être moins fluide selon l'encodage.
Astuce d'encodage pour un bon scrub (beaucoup de keyframes) :
```bash
ffmpeg -i ma_video.mp4 -c:v libx264 -g 1 -pix_fmt yuv420p -movflags +faststart assets/journey.mp4
```

## Personnaliser les textes

Les blocs de texte qui apparaissent au fil du scroll sont dans `index.html`
(`<section class="caption" data-at="0.20">…`). `data-at` = position (0→1) où le texte
est au centre. Le dernier bloc (`.final`) est le **message de remerciement**.

## Mettre en ligne sur GitHub Pages

Le dépôt git local est déjà initialisé et commité. Il reste à créer le dépôt distant :

```bash
# 1) Crée un repo vide sur github.com (sans README), nomme-le par ex. "thanks"
# 2) Relie et pousse :
cd thanks
git remote add origin https://github.com/<TON_PSEUDO>/thanks.git
git branch -M main
git push -u origin main
```

Puis sur GitHub : **Settings → Pages → Build and deployment → Source : `Deploy from a branch` → Branch : `main` / `/root`**.
Le site sera servi sur `https://<TON_PSEUDO>.github.io/thanks/`.

## Structure

```
thanks/
├── index.html         # structure + textes narratifs
├── css/style.css      # ambiance, HUD, textes, longueur de scroll
├── js/scene.js        # rendu procédural (décor placeholder)
├── js/main.js         # moteur de scroll + config des 3 modes
├── frames/            # (mode frames) tes images ici
└── assets/            # (mode video) ta vidéo ici
```
