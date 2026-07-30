# Pack de prompts IA — parcours vers la pièce sécurisée

But : 8 clips (5–10 s chacun), chacun un **travelling avant** en vue subjective, même
style visuel, pour être raccordés en une "vidéo qui avance selon le scroll".

## Règles d'or (à respecter pour tous les clips)
1. **Vue première personne**, caméra à hauteur des yeux, **elle n'avance que vers l'avant**, vitesse lente et constante, stabilisée (aucun tremblement), **aucune coupe** dans le clip.
2. **Format 16:9**, résolution maximale disponible (1080p mini, 1440p/4K idéal), 24–30 fps.
3. **Cohérence** : garder EXACTEMENT le même suffixe de style sur les 8 prompts.
4. **Continuité (astuce pro)** : si ton outil accepte une image de départ (image-to-video),
   exporte **la dernière image du clip N** et utilise-la comme **image de départ du clip N+1**.
   → le décor s'enchaîne sans saut. Sinon, on masque les raccords par des fondus (je gère).
5. **Lumière** : de plus en plus sombre à mesure qu'on descend (clips 1→8).

## Suffixe de style (à coller à la fin de CHAQUE prompt)
```
First-person POV, camera at human eye level, slow steady forward dolly at constant speed,
smooth gimbal stabilization, no camera shake, no cuts, the camera only moves forward.
Photorealistic, cinematic, shot on a 24mm lens, 16:9, moody volumetric lighting,
subtle film grain, desaturated cool color grade, high detail.
```

## Les 8 prompts

**1 — La rue (NIVEAU 0)**
```
A deserted city street at dusk, wet asphalt reflecting cold light. Ahead stands an
imposing windowless concrete building with a single heavy steel entrance door lit by a
dim lamp. The camera moves slowly forward toward the door.
```

**2 — Le hall (-1)**
```
Passing through a heavy steel door into a dim, empty concrete lobby with a polished
floor and a security camera in the corner. Cold overhead light. The camera glides
forward across the lobby toward the dark opening of a corridor.
```

**3 — Le couloir (-2)**
```
Moving forward down a long narrow institutional corridor, flickering fluorescent tubes
on the ceiling, closed grey metal doors along both walls, strong one-point perspective
toward a distant vanishing point.
```

**4 — Le sas de sécurité (-3)**
```
Approaching a security airlock: a card reader glowing red on the wall, a metal mantrap
gate ahead, yellow warning signs, harsh directional light and deep shadows. The camera
advances slowly toward the gate.
```

**5 — Approche de la porte blindée (-4)**
```
A dim underground antechamber. Ahead, a massive circular steel bank-vault door with a
large spoked hand-wheel and rows of heavy bolts, cold industrial rim light. The camera
moves slowly toward the vault door.
```

**6 — Le volant qui tourne + ouverture (-4)**
```
Low push-in toward a giant steel vault wheel; the spoked hand-wheel slowly rotates,
heavy locking bolts retract with mechanical motion, and the massive circular door begins
to swing open, revealing a pitch-black space beyond.
```
*(Ici la rotation du volant est voulue — le reste du suffixe reste identique.)*

**7 — La descente (-5)**
```
Descending a narrow dark stone staircase into an underground cellar, a single bare bulb
casting long shadows, the light level dropping as we go down. The camera moves forward
and slightly downward.
```

**8 — La cave (-5, final)**
```
Slowly entering a dark vaulted stone cellar, almost black, with a single warm pool of
light at the far end illuminating an old empty wooden table. The camera drifts slowly
forward toward the light.
```

## Livraison
Nomme les fichiers `01.mp4 … 08.mp4` et envoie-les (lien direct Drive/Dropbox/WeTransfer,
ou pousse-les dans le repo). Je raccorde (fondus aux passages de porte), je convertis en
séquence d'images, je branche le mode `frames` et je pousse en ligne.
