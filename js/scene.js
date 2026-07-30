/* ============================================================
   scene.js — Rendu procédural cinématographique v2
   Couloir souterrain photoréaliste avec porte blindée
   ============================================================ */
(function () {
  "use strict";

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const rand = (a = 0, b = 1) => a + Math.random() * (b - a);

  // --- Constantes du monde -------------------------------------------------
  const HW = 2.7;            // demi-largeur couloir
  const CEIL = 2.3;          // hauteur plafond au-dessus œil
  const FLOOR = 1.7;         // profondeur sol sous œil
  const DEPTH = 96;          // distance totale parcourue
  const Z_BLAST = 66;        // profondeur porte blindée
  const Z_CAVE = 80;         // début cave

  // Portes latérales
  const DOORFRAMES = [14, 24, 34, 44, 54];

  // Nuages de points bruit (béton) — générés une fois
  let noiseCache = null;
  function getNoise() {
    if (noiseCache) return noiseCache;
    const size = 64;
    const data = [];
    for (let i = 0; i < size * size; i++) {
      data.push(Math.random());
    }
    noiseCache = { data, size };
    return noiseCache;
  }

  function sampleNoise(x, y) {
    const n = getNoise();
    const s = n.size;
    const ix = Math.floor(x * s) % s;
    const iy = Math.floor(y * s) % s;
    const idx = (ix + iy * s + s * s) % (s * s);
    return n.data[idx] || 0.5;
  }

  class ProceduralScene {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.time = 0;
      this.dustParticles = [];
      for (let i = 0; i < 120; i++) {
        this.dustParticles.push({
          x: rand(-3, 3),
          y: rand(-1, 2.5),
          z: rand(2, 80),
          speed: rand(0.002, 0.015),
          size: rand(0.4, 1.6),
          drift: rand(-0.002, 0.002),
        });
      }
      this.fluoFlicker = 0;
      this.resize();
    }

    resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.w = w;
      this.h = h;
      this.canvas.width = Math.round(w * this.dpr);
      this.canvas.height = Math.round(h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    // --- Projection 3D → 2D --------------------------------------------
    proj(x, y, z, cx, horizon, focal) {
      return {
        x: cx + (x * focal) / z,
        y: horizon + (y * focal) / z,
      };
    }

    // --- Palette teal/steel désaturée ------------------------------------
    tealSteel(r, g, b, l) {
      // Applique le color grading froid
      const tr = (r * 0.85 + g * 0.04 + b * 0.02) * l;
      const tg = (r * 0.06 + g * 0.82 + b * 0.06) * l;
      const tb = (r * 0.04 + g * 0.08 + b * 0.88) * l;
      return `rgb(${Math.round(tr)},${Math.round(tg)},${Math.round(tb)})`;
    }

    // --- Render principal -------------------------------------------------
    render(p) {
      const ctx = this.ctx, w = this.w, h = this.h;
      this.time += 0.016;
      this.fluoFlicker = 0.92 + Math.sin(this.time * 3.7 + Math.sin(this.time * 1.2)) * 0.06 + Math.random() * 0.04;
      ctx.clearRect(0, 0, w, h);

      const EXT_END = 0.14;
      const XFADE = 0.035;

      if (p < EXT_END + XFADE) {
        this.renderExterior(clamp(p / EXT_END), p);
      }
      if (p > EXT_END - XFADE) {
        const t = clamp((p - EXT_END) / (1 - EXT_END));
        const a = clamp((p - (EXT_END - XFADE)) / (XFADE * 2));
        ctx.save();
        ctx.globalAlpha = a;
        this.renderInterior(t, p);
        ctx.restore();
      }

      // Film grain overlay
      this.renderFilmGrain(p);
    }

    // --- Grain cinéma ----------------------------------------------------
    renderFilmGrain(p) {
      const ctx = this.ctx, w = this.w, h = this.h;
      const gs = 3;
      ctx.save();
      ctx.globalAlpha = 0.035;
      for (let x = 0; x < w; x += gs) {
        for (let y = 0; y < h; y += gs) {
          const v = Math.random();
          ctx.fillStyle = `rgba(${v*255},${v*255},${v*255},${0.3})`;
          ctx.fillRect(x, y, gs, gs);
        }
      }
      ctx.restore();
    }

    // --- Extérieur : rue nocturne ----------------------------------------
    renderExterior(t, p) {
      const ctx = this.ctx, w = this.w, h = this.h;
      const approach = smooth(t);

      // Ciel nocturne profond
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#0a0d1a");
      sky.addColorStop(0.4, "#101625");
      sky.addColorStop(0.7, "#1a1c2e");
      sky.addColorStop(1, "#1f1a24");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Étoiles faibles
      if (!this._stars) {
        this._stars = [];
        for (let i = 0; i < 60; i++) {
          this._stars.push({ x: rand(0, w), y: rand(0, h * 0.5), a: rand(0.1, 0.5) });
        }
      }
      for (const s of this._stars) {
        ctx.fillStyle = `rgba(200,210,255,${s.a * (1 - approach)})`;
        ctx.fillRect(s.x, s.y, 1.5, 1.5);
      }

      // Sol
      const groundY = h * (0.65 + approach * 0.15);
      const g = ctx.createLinearGradient(0, groundY, 0, h);
      g.addColorStop(0, "#14151c");
      g.addColorStop(1, "#08090e");
      ctx.fillStyle = g;
      ctx.fillRect(0, groundY, w, h - groundY);

      // Façade bâtiment
      const cx = w / 2;
      const fw = w * lerp(0.4, 2.0, approach);
      const fh = h * lerp(0.45, 2.0, approach);
      const fx = cx - fw / 2;
      const fy = groundY - fh;

      const facGrad = ctx.createLinearGradient(0, fy, 0, groundY);
      facGrad.addColorStop(0, "#0d0e14");
      facGrad.addColorStop(0.5, "#12141c");
      facGrad.addColorStop(1, "#0f1018");
      ctx.fillStyle = facGrad;
      ctx.fillRect(fx, fy, fw, fh);

      // Fenêtres
      ctx.save();
      ctx.beginPath();
      ctx.rect(fx, fy, fw, fh);
      ctx.clip();
      const cols = 5, rows = 4;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const lit = (i * 7 + j * 3) % 7 < 3;
          const wx = fx + fw * (0.1 + (i / cols) * 0.8);
          const wy = fy + fh * (0.08 + (j / rows) * 0.55);
          const fw2 = fw * 0.09;
          const fh2 = fh * 0.065;
          // Lueur fenêtre
          if (lit) {
            const glow = ctx.createRadialGradient(wx + fw2/2, wy + fh2/2, 0, wx + fw2/2, wy + fh2/2, fw2 * 2);
            glow.addColorStop(0, `rgba(210,190,130,${0.15 + approach * 0.2})`);
            glow.addColorStop(1, "rgba(210,190,130,0)");
            ctx.fillStyle = glow;
            ctx.fillRect(wx - fw2, wy - fh2, fw2 * 4, fh2 * 4);
          }
          ctx.fillStyle = lit ? "rgba(220,200,150,0.6)" : "rgba(80,100,140,0.08)";
          ctx.fillRect(wx, wy, fw2, fh2);
          // Cadre fenêtre
          ctx.strokeStyle = lit ? "rgba(180,160,120,0.3)" : "rgba(100,110,130,0.15)";
          ctx.lineWidth = 1;
          ctx.strokeRect(wx, wy, fw2, fh2);
        }
      }
      ctx.restore();

      // Porte entrée
      const doorW = fw * lerp(0.14, 0.38, approach);
      const doorH = fh * lerp(0.26, 0.65, approach);
      const dx = cx - doorW / 2;
      const dy = groundY - doorH;

      // Halo lumineux autour de la porte
      const halo = ctx.createRadialGradient(cx, dy + doorH * 0.5, doorW * 0.2, cx, dy + doorH * 0.5, doorW * 1.6);
      halo.addColorStop(0, `rgba(220,190,120,${0.3 + approach * 0.5})`);
      halo.addColorStop(0.3, `rgba(200,170,100,${0.1 + approach * 0.2})`);
      halo.addColorStop(1, "rgba(200,170,100,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(dx - doorW, dy - doorH * 0.3, doorW * 3, doorH * 1.8);

      const door = ctx.createLinearGradient(0, dy, 0, dy + doorH);
      door.addColorStop(0, "#b89840");
      door.addColorStop(0.3, "#d4b050");
      door.addColorStop(0.6, "#a88838");
      door.addColorStop(1, "#6a5520");
      ctx.fillStyle = door;
      ctx.fillRect(dx, dy, doorW, doorH);
      // Cadre porte
      ctx.strokeStyle = "rgba(180,160,100,0.4)";
      ctx.lineWidth = 2;
      ctx.strokeRect(dx, dy, doorW, doorH);
      // Poignée
      ctx.fillStyle = "rgba(200,180,120,0.6)";
      const ph = doorH * 0.08;
      const pw = doorW * 0.04;
      ctx.fillRect(dx + doorW * 0.65, dy + doorH * 0.55, pw, ph);

      // Assombrissement final
      ctx.fillStyle = `rgba(0,0,0,${clamp((t - 0.6) / 0.4) * 0.95})`;
      ctx.fillRect(0, 0, w, h);
    }

    // --- Intérieur : couloir --------------------------------------------
    renderInterior(t, p) {
      const ctx = this.ctx, w = this.w, h = this.h;
      const cx = w / 2;
      const horizon = h * 0.5;
      const focal = w * 0.82;
      const cameraZ = smooth(t) * DEPTH;

      // Vignette téléobjectif (24mm)
      ctx.save();
      const vig = ctx.createRadialGradient(cx, horizon, w * 0.15, cx, horizon, w * 0.72);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // Lumière
      let light;
      if (cameraZ < Z_BLAST) light = lerp(0.85, 0.40, clamp(cameraZ / Z_BLAST));
      else if (cameraZ < Z_CAVE) light = lerp(0.40, 0.10, clamp((cameraZ - Z_BLAST) / (Z_CAVE - Z_BLAST)));
      else light = 0.08;

      // Fond noir
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      // Dessiner le couloir par bandes
      const zFar = 58, zNear = 0.6;
      const bands = 60;
      let prev = null;
      for (let i = 0; i <= bands; i++) {
        const f = i / bands;
        const zrel = zFar * Math.pow(zNear / zFar, f);
        const rect = this.openingRect(zrel, cx, horizon, focal);
        if (prev) {
          this.drawBandCinematic(prev, rect, prev.z, light, cameraZ);
        }
        prev = rect;
        prev.z = zrel;
      }

      // Lumières fluorescentes au plafond
      this.renderFluoLights(cameraZ, cx, horizon, focal, light);

      // Poussière volumétrique
      this.renderDust(cameraZ, cx, horizon, focal, light);

      // Portes latérales
      for (const zAbs of DOORFRAMES) {
        const zrel = zAbs - cameraZ;
        if (zrel > 0.6 && zrel < zFar) {
          this.drawDoorframeDetail(zrel, cx, horizon, focal, light);
        }
      }

      // Porte blindée
      const zBlast = Z_BLAST - cameraZ;
      if (zBlast > 0.4 && zBlast < zFar) {
        const open = clamp((cameraZ - (Z_BLAST - 8)) / 8);
        this.drawBlastDoorCinematic(zBlast, cx, horizon, focal, light, p, open, cameraZ);
      }

      // Lueur cave
      if (cameraZ > Z_BLAST) {
        const caveT = clamp((cameraZ - Z_BLAST) / (DEPTH - Z_BLAST));
        const glow = ctx.createRadialGradient(cx, horizon + h * 0.05, 5, cx, horizon + h * 0.05, w * 0.55);
        glow.addColorStop(0, `rgba(180,140,60,${0.08 + caveT * 0.25})`);
        glow.addColorStop(0.4, `rgba(100,75,35,${0.04 + caveT * 0.10})`);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
      }

      // Obscurité renforcée
      if (light < 0.35) {
        const v = ctx.createRadialGradient(cx, horizon, w * 0.05, cx, horizon, w * 0.78);
        v.addColorStop(0, "rgba(0,0,0,0)");
        v.addColorStop(1, `rgba(0,0,0,${clamp((0.35 - light) / 0.25) * 0.90})`);
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, w, h);
      }
    }

    // --- Lumières au plafond (néons qui clignotent) ---------------------
    renderFluoLights(cameraZ, cx, horizon, focal, light) {
      const ctx = this.ctx;
      const spacing = 3.8;
      const numLights = 18;
      for (let i = 0; i < numLights; i++) {
        const zAbs = spacing + i * spacing;
        const zrel = zAbs - cameraZ;
        if (zrel < 0.8 || zrel > 55) continue;
        const rect = this.openingRect(zrel, cx, horizon, focal);
        const tubeW = (rect.r - rect.l) * 0.55;
        const tubeH = (rect.t - 0) * 0.12;
        const tx = cx - tubeW / 2;
        const ty = 0;

        // Flicker individuel
        const flickerI = 0.75 + 0.25 * Math.sin(this.time * 4.1 + i * 2.3 + Math.sin(this.time * 1.7 + i * 0.7));
        const tubeLit = flickerI * (0.88 + Math.random() * 0.12);

        // Lueur du néon
        const glowSize = tubeW * 1.8;
        const neonGlow = ctx.createRadialGradient(cx, ty + tubeH/2, 0, cx, ty + tubeH/2, glowSize);
        neonGlow.addColorStop(0, `rgba(210,230,255,${0.04 * tubeLit * light})`);
        neonGlow.addColorStop(0.5, `rgba(180,210,240,${0.02 * tubeLit * light})`);
        neonGlow.addColorStop(1, "rgba(180,210,240,0)");
        ctx.fillStyle = neonGlow;
        ctx.fillRect(cx - glowSize, ty - glowSize/2, glowSize * 2, glowSize);

        // Tube fluorescent
        ctx.fillStyle = `rgba(200,225,255,${0.15 * tubeLit * light})`;
        ctx.fillRect(tx, ty, tubeW, tubeH);

        // Boîtier métallique
        ctx.fillStyle = `rgba(80,85,95,${0.3 * light})`;
        ctx.fillRect(cx - tubeW/2 - 3, ty - 1, tubeW + 6, tubeH + 2);
      }
    }

    // --- Particules de poussière ----------------------------------------
    renderDust(cameraZ, cx, horizon, focal, light) {
      const ctx = this.ctx;
      for (const p of this.dustParticles) {
        // Animation lente
        p.x += p.drift + Math.sin(this.time * 0.3 + p.z) * 0.0005;
        p.y += Math.sin(this.time * 0.5 + p.x * 2) * 0.0003;

        // Z relatif à la caméra
        const zrel = p.z - cameraZ;
        if (zrel < 0.5 || zrel > 45) continue;

        const rect = this.openingRect(zrel, cx, horizon, focal);
        const spanX = rect.r - rect.l;
        const spanY = rect.b - rect.t;
        const dx = cx + (p.x * focal) / zrel;
        const dy = horizon + (p.y * focal) / zrel;

        if (dx < 0 || dx > this.w || dy < 0 || dy > this.h) continue;

        const size = p.size * (3.5 / zrel);
        if (size < 0.15) continue;

        const alpha = clamp(light * 0.8 * (1 - zrel / 45)) * 0.5;
        ctx.fillStyle = `rgba(200,210,220,${alpha})`;
        ctx.beginPath();
        ctx.arc(dx, dy, Math.max(size, 0.2), 0, Math.PI * 2);
        ctx.fill();
      }
      // Réinitialiser particules qui sortent
      for (const p of this.dustParticles) {
        if (p.z - cameraZ < 0.2) {
          p.z = cameraZ + rand(20, 55);
          p.x = rand(-2.5, 2.5);
          p.y = rand(-0.5, 2.0);
        }
      }
    }

    openingRect(z, cx, horizon, focal) {
      return {
        l: cx - (HW * focal) / z,
        r: cx + (HW * focal) / z,
        t: horizon - (CEIL * focal) / z,
        b: horizon + (FLOOR * focal) / z,
      };
    }

    // --- Bande de couloir (avec texture béton + taches d'eau) -----------
    drawBandCinematic(far, near, z, light, cameraZ) {
      const ctx = this.ctx;
      const fog = clamp(1 - z / 58);
      const l = light * (0.08 + 0.92 * fog);

      // Couleur de base : béton gris froid (teal/steel)
      const baseR = 128, baseG = 132, baseB = 142;

      // Fonction shade avec texture
      const shadeWall = (rx, ry, mult) => {
        // Bruit procédural simple
        const n = sampleNoise(rx * 1.5 + z * 0.02, ry * 3 + z * 0.01) * 0.12;
        // Taches d'eau (plus sombres)
        const stain = Math.sin(rx * 3.7 + 1.2) * Math.sin(ry * 5.1 + z * 0.04) * 0.15;
        const w = clamp(mult * l + n - Math.max(0, stain));
        return this.tealSteel(baseR * w, baseG * w, baseB * w, 1);
      };

      // Sol (poli, réflectif)
      const shadeFloor = (mult) => {
        const v = mult * l * 0.9;
        return this.tealSteel(80 * v, 85 * v, 95 * v, 1);
      };

      // Plafond (sombre)
      const shadeCeil = (mult) => {
        const v = mult * l * 0.4;
        return this.tealSteel(60 * v, 62 * v, 68 * v, 1);
      };

      // Mur gauche
      ctx.fillStyle = shadeWall(far.l, far.t / this.h, 0.42);
      this.quad(far.l, far.t, far.l, far.b, near.l, near.b, near.l, near.t);

      // Mur droit
      ctx.fillStyle = shadeWall(far.r, far.t / this.h, 0.48);
      this.quad(far.r, far.t, far.r, far.b, near.r, near.b, near.r, near.t);

      // Sol avec reflets
      ctx.fillStyle = shadeFloor(0.50);
      this.quad(far.l, far.b, far.r, far.b, near.r, near.b, near.l, near.b);
      // Ligne de reflet au sol (bande claire longitudinale)
      const reflW = (far.r - far.l) * 0.08;
      ctx.fillStyle = `rgba(120,140,160,${0.04 * l})`;
      this.quad(
        far.l + (far.r - far.l) * 0.46, far.b,
        far.l + (far.r - far.l) * 0.54, far.b,
        near.l + (near.r - near.l) * 0.54, near.b,
        near.l + (near.r - near.l) * 0.46, near.b,
      );

      // Plafond
      ctx.fillStyle = shadeCeil(0.30);
      this.quad(far.l, far.t, far.r, far.t, near.r, near.t, near.l, near.t);

      // Joints verticaux murs (tous les 4m)
      const joint = Math.floor(z * (cameraZ > 30 ? 0.25 : 0.5));
      if (joint % 2 === 0) {
        ctx.strokeStyle = `rgba(90,95,105,${0.08 * l})`;
        ctx.lineWidth = 0.5;
        // Jointure verticale approximative à mi-bande
      }
    }

    quad(x1, y1, x2, y2, x3, y3, x4, y4) {
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.closePath();
      ctx.fill();
    }

    // --- Cadre de porte latéral -----------------------------------------
    drawDoorframeDetail(z, cx, horizon, focal, light) {
      const ctx = this.ctx;
      const rect = this.openingRect(z, cx, horizon, focal);
      const fog = clamp(1 - z / 55);
      const l = light * fog;
      const thick = Math.max(1.5, (0.3 * focal) / z);
      const doorW = (rect.r - rect.l) * 0.28;
      const doorH = (rect.b - rect.t) * 0.65;
      const doorX = rect.l + 2;
      const doorY = rect.t + (rect.b - rect.t - doorH) / 2;

      // Cadre plus foncé que le mur
      ctx.strokeStyle = `rgba(60,65,75,${0.5 * l})`;
      ctx.lineWidth = thick * 0.8;
      ctx.strokeRect(doorX, doorY, doorW, doorH);

      // Porte en bois/métal sombre
      if (z > 3) {
        ctx.fillStyle = `rgba(50,55,65,${0.35 * l})`;
        ctx.fillRect(doorX + thick, doorY + thick, doorW - thick * 2, doorH - thick * 2);
        // Poignée
        ctx.fillStyle = `rgba(180,170,150,${0.3 * l})`;
        const pSize = thick * 0.6;
        ctx.fillRect(doorX + doorW * 0.75, doorY + doorH * 0.5, pSize, pSize * 2);
      }
    }

    // --- Porte blindée (version cinématographique) ----------------------
    drawBlastDoorCinematic(z, cx, horizon, focal, light, p, open, cameraZ) {
      const ctx = this.ctx;
      const rect = this.openingRect(z, cx, horizon, focal);
      const R = Math.min(rect.r - rect.l, rect.b - rect.t) * 0.47;
      const ccx = cx;
      const ccy = horizon;
      const l = light;
      const aperture = open * R * 1.05;
      const boltsOut = clamp(open * 2);

      // --- Motif d'ouverture : tourne et recule -------------------------
      const wheelAngle = p * Math.PI * 6 + open * Math.PI * 4;

      ctx.save();

      // 1) Disque de porte (métal brossé)
      ctx.beginPath();
      ctx.arc(ccx, ccy, R, 0, Math.PI * 2);
      if (aperture > 1) ctx.arc(ccx, ccy, aperture, 0, Math.PI * 2, true);

      const metal = ctx.createRadialGradient(
        ccx - R * 0.25, ccy - R * 0.25, R * 0.1,
        ccx, ccy, R
      );
      const m = l * 0.9;
      metal.addColorStop(0, `rgb(${Math.round(160 * m)},${Math.round(165 * m)},${Math.round(175 * m)})`);
      metal.addColorStop(0.3, `rgb(${Math.round(120 * m)},${Math.round(125 * m)},${Math.round(135 * m)})`);
      metal.addColorStop(0.7, `rgb(${Math.round(85 * m)},${Math.round(88 * m)},${Math.round(95 * m)})`);
      metal.addColorStop(1, `rgb(${Math.round(50 * m)},${Math.round(52 * m)},${Math.round(58 * m)})`);
      ctx.fillStyle = metal;
      ctx.fill("evenodd");

      // 2) Anneaux concentriques (usinés)
      ctx.strokeStyle = `rgba(30,32,38,${0.75 * l})`;
      ctx.lineWidth = Math.max(1, R * 0.025);
      for (const rr of [0.92, 0.78, 0.62, 0.46]) {
        if (aperture < R * rr) {
          ctx.beginPath();
          ctx.arc(ccx, ccy, R * rr, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // 3) Verrous rétractables
      const numBolts = 16;
      for (let i = 0; i < numBolts; i++) {
        const a = (i / numBolts) * Math.PI * 2;
        const bx = ccx + Math.cos(a) * R * 0.88;
        const by = ccy + Math.sin(a) * R * 0.88;
        const boltR = Math.max(1.5, R * 0.035);
        // Les verrous se rétractent vers l'intérieur
        const retractOff = boltsOut * boltR * 1.5;
        const rbx = bx + Math.cos(a) * retractOff;
        const rby = by + Math.sin(a) * retractOff;

        ctx.fillStyle = `rgba(${Math.round(180 * l)},${Math.round(175 * l)},${Math.round(160 * l)},${0.85 * l})`;
        ctx.beginPath();
        ctx.arc(rbx, rby, boltR, 0, Math.PI * 2);
        ctx.fill();
        // Ombrage boulon
        ctx.fillStyle = `rgba(40,42,48,${0.5 * l})`;
        ctx.beginPath();
        ctx.arc(rbx + boltR * 0.2, rby + boltR * 0.2, boltR * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4) Volant central (spoked wheel)
      if (aperture < R * 0.50) {
        ctx.save();
        ctx.translate(ccx, ccy);
        ctx.rotate(wheelAngle);

        // Rayons
        const numSpokes = 5;
        ctx.strokeStyle = `rgba(${Math.round(200 * l)},${Math.round(205 * l)},${Math.round(215 * l)},0.9)`;
        ctx.lineWidth = Math.max(1.5, R * 0.04);
        for (let i = 0; i < numSpokes; i++) {
          const angle = (i / numSpokes) * Math.PI * 2;
          ctx.save();
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(0, -R * 0.21);
          ctx.lineTo(0, -R * 0.52);
          ctx.stroke();
          ctx.restore();
        }

        // Rebord extérieur volant
        ctx.strokeStyle = `rgba(${Math.round(180 * l)},${Math.round(185 * l)},${Math.round(195 * l)},0.85)`;
        ctx.lineWidth = Math.max(2, R * 0.035);
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.51, 0, Math.PI * 2);
        ctx.stroke();

        // Rebord intérieur
        ctx.strokeStyle = `rgba(${Math.round(160 * l)},${Math.round(165 * l)},${Math.round(175 * l)},0.6)`;
        ctx.lineWidth = Math.max(1, R * 0.025);
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.22, 0, Math.PI * 2);
        ctx.stroke();

        // Moyeu central
        ctx.fillStyle = `rgba(200,162,74,${0.85 * l})`;
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(160,130,55,${0.5 * l})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
      }

      // 5) Lumière rouge de statut
      if (aperture < R * 0.6) {
        const redGlow = 0.6 + 0.4 * Math.sin(this.time * 2.5);
        const rlx = ccx + R * 0.38;
        const rly = ccy - R * 0.38;
        // Halo rouge
        const rGrad = ctx.createRadialGradient(rlx, rly, 0, rlx, rly, R * 0.15);
        rGrad.addColorStop(0, `rgba(255,50,30,${0.5 * redGlow})`);
        rGrad.addColorStop(0.5, `rgba(200,30,15,${0.2 * redGlow})`);
        rGrad.addColorStop(1, "rgba(200,30,15,0)");
        ctx.fillStyle = rGrad;
        ctx.fillRect(rlx - R * 0.2, rly - R * 0.2, R * 0.4, R * 0.4);
        // Point lumineux
        ctx.fillStyle = `rgba(255,60,30,${0.9 * redGlow})`;
        ctx.beginPath();
        ctx.arc(rlx, rly, Math.max(2, R * 0.025), 0, Math.PI * 2);
        ctx.fill();
      }

      // 6) Faisceau lumineux traversant la porte ouverte (volume)
      if (aperture > R * 0.3 && cameraZ > Z_BLAST - 3) {
        const beamLight = clamp((aperture / R) * 0.3);
        const beam = ctx.createRadialGradient(ccx, ccy + R * 0.2, 0, ccx, ccy + R * 0.2, R * 1.3);
        const be = 80 + 60 * Math.sin(this.time * 0.5);
        beam.addColorStop(0, `rgba(${be * 0.5},${be * 0.4},${be * 0.15},${0.08 * beamLight})`);
        beam.addColorStop(0.5, `rgba(${be * 0.3},${be * 0.25},${be * 0.1},${0.03 * beamLight})`);
        beam.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = beam;
        ctx.fillRect(ccx - R * 1.5, ccy - R * 1.5, R * 3, R * 3);
      }

      ctx.restore();
    }
  }

  window.ProceduralScene = ProceduralScene;
})();
