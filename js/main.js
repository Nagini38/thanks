/* ============================================================
   main.js — Moteur de scroll + orchestration
   ------------------------------------------------------------
   La progression `p` (0 → 1) est calculée depuis la position de
   scroll, lissée, puis passée au moteur de rendu choisi.
   ============================================================ */

(function () {
  "use strict";

  /* ======================= CONFIGURATION ======================= *
   * Pour brancher ta VRAIE vidéo ultra-réaliste plus tard,
   * change simplement `mode` ci-dessous (voir README.md).
   * ------------------------------------------------------------ */
  const CONFIG = {
    // "procedural" : décor dessiné (placeholder, par défaut)
    // "frames"     : séquence d'images (le plus fluide) -> voir frames/
    // "video"      : une vidéo scrubbée -> voir assets/
    mode: "procedural",

    scrollLengthVh: 720,   // longueur de l'expérience (doit = #scrolltrack dans le CSS)
    smoothing: 0.12,       // 0 = brut, 1 = instantané. Plus bas = plus "glissant".

    // --- mode "frames" ---
    frames: {
      count: 180,                         // nombre d'images
      path: (i) => `frames/frame_${String(i).padStart(4, "0")}.jpg`,
    },

    // --- mode "video" ---
    video: {
      src: "assets/journey.mp4",
    },
  };

  // Zones affichées dans la jauge de profondeur (bornes en progression)
  const ZONES = [
    [0.00, "RUE — NIVEAU 0"],
    [0.14, "HALL — NIVEAU -1"],
    [0.32, "COULOIR — NIVEAU -2"],
    [0.50, "ZONE CONTRÔLÉE — NIVEAU -3"],
    [0.66, "SAS BLINDÉ — NIVEAU -4"],
    [0.80, "CAVE — NIVEAU -5"],
  ];

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  // --- Éléments DOM ---
  const canvas = document.getElementById("scene");
  const video = document.getElementById("scrubVideo");
  const track = document.getElementById("scrolltrack");
  const captions = Array.from(document.querySelectorAll(".caption"));
  const vaultWheel = document.getElementById("vaultWheel");
  const vaultHud = document.getElementById("vaultHud");
  const depthFill = document.getElementById("depthFill");
  const depthLabel = document.getElementById("depthLabel");
  const scrollHint = document.getElementById("scrollHint");

  // Longueur de scroll cohérente avec la config
  track.style.height = CONFIG.scrollLengthVh + "vh";

  // ============================================================
  //  Renderers (interface commune : render(p), resize())
  // ============================================================

  // 1) Procédural
  let scene = null;
  if (CONFIG.mode === "procedural") {
    scene = new window.ProceduralScene(canvas);
  }

  // 2) Séquence d'images
  const frameStore = { images: [], loaded: 0, ctx: null };
  if (CONFIG.mode === "frames") {
    frameStore.ctx = canvas.getContext("2d");
    fitCanvas();
    for (let i = 0; i < CONFIG.frames.count; i++) {
      const img = new Image();
      img.src = CONFIG.frames.path(i);
      img.onload = () => { frameStore.loaded++; };
      frameStore.images.push(img);
    }
  }

  // 3) Vidéo
  if (CONFIG.mode === "video") {
    video.style.display = "block";
    canvas.style.display = "none";
    video.src = CONFIG.video.src;
  }

  function fitCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    if (frameStore.ctx) frameStore.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawFrame(p) {
    const store = frameStore;
    const n = CONFIG.frames.count;
    const idx = clamp(Math.round(p * (n - 1)), 0, n - 1);
    const img = store.images[idx];
    if (!img || !img.complete || !img.naturalWidth) return;
    const ctx = store.ctx;
    const cw = window.innerWidth, ch = window.innerHeight;
    // "cover" : remplit l'écran sans déformer
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }

  function renderVideo(p) {
    if (video.readyState >= 1 && !isNaN(video.duration)) {
      const target = p * video.duration;
      // on ne "seek" que si l'écart est notable (évite le jank)
      if (Math.abs(video.currentTime - target) > 0.02) {
        video.currentTime = target;
      }
    }
  }

  // ============================================================
  //  Boucle : scroll -> progression lissée -> rendu
  // ============================================================
  let targetP = 0;
  let currentP = 0;

  function computeTargetP() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    targetP = max > 0 ? clamp(window.scrollY / max) : 0;
  }

  function updateOverlays(p) {
    // Textes : opacité selon la distance à leur point d'ancrage
    for (const el of captions) {
      const at = parseFloat(el.dataset.at);
      const d = Math.abs(p - at);
      const win = el.classList.contains("final") ? 0.14 : 0.075;
      const o = clamp(1 - d / win);
      el.style.opacity = o.toFixed(3);
      const ty = (1 - o) * 24;
      const side = el.dataset.side;
      if (side === "center") el.style.transform = `translate(-50%, calc(-50% + ${ty}px))`;
      else el.style.transform = `translateY(calc(-50% + ${ty}px))`;
    }

    // Volant HUD : tourne proportionnellement au scroll, révélé en zone sécurisée
    vaultWheel.style.transform = `rotate(${p * 1080}deg)`;
    const hudVis = clamp((p - 0.46) / 0.1) * clamp((0.95 - p) / 0.1);
    vaultHud.style.opacity = (hudVis * 0.9).toFixed(3);

    // Jauge de profondeur
    depthFill.style.width = (p * 100).toFixed(1) + "%";
    let label = ZONES[0][1];
    for (const [b, name] of ZONES) if (p >= b) label = name;
    if (depthLabel.textContent !== label) depthLabel.textContent = label;

    // Indice de scroll : disparaît dès qu'on avance
    scrollHint.style.opacity = clamp(1 - p / 0.04).toFixed(3);
  }

  function loop() {
    // lissage exponentiel vers la cible
    currentP += (targetP - currentP) * CONFIG.smoothing;
    if (Math.abs(targetP - currentP) < 0.0002) currentP = targetP;

    const p = clamp(currentP);

    if (CONFIG.mode === "procedural") scene.render(p);
    else if (CONFIG.mode === "frames") drawFrame(p);
    else if (CONFIG.mode === "video") renderVideo(p);

    updateOverlays(p);
    requestAnimationFrame(loop);
  }

  // ============================================================
  //  Événements
  // ============================================================
  window.addEventListener("scroll", computeTargetP, { passive: true });
  window.addEventListener("resize", () => {
    if (scene) scene.resize();
    else fitCanvas();
    computeTargetP();
  });

  computeTargetP();
  currentP = targetP;
  requestAnimationFrame(loop);
})();
