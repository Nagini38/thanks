/* ============================================================
   scene.js — Rendu procédural du parcours (mode placeholder)
   ------------------------------------------------------------
   Aucune image externe : tout est dessiné au canvas à partir
   d'une seule valeur `p` (progression 0 → 1). C'est ce qui donne
   la sensation d'une "vidéo qui avance selon le scroll".

   Quand tu auras ta vraie vidéo ultra-réaliste, tu n'as PAS à
   toucher ce fichier : tu passes CONFIG.mode à "frames" ou
   "video" dans main.js (voir README).
   ============================================================ */

(function () {
  "use strict";

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);

  // --- Réglages du monde ---------------------------------------------------
  const HW = 2.7;        // demi-largeur du couloir (unités monde)
  const CEIL = 2.3;      // hauteur plafond au-dessus de l'œil
  const FLOOR = 1.7;     // profondeur du sol sous l'œil
  const INTERIOR_DEPTH = 96;   // distance totale parcourue à l'intérieur
  const Z_BLAST = 66;    // profondeur de la porte blindée
  const Z_CAVE = 80;     // début de la cave

  // Cadres de porte le long du couloir (unités monde)
  const DOORFRAMES = [14, 24, 34, 44, 54];

  class ProceduralScene {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
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

    // Projection d'un point (x,y monde) à profondeur relative z (>0)
    proj(x, y, z, cx, horizon, focal) {
      return {
        x: cx + (x * focal) / z,
        y: horizon + (y * focal) / z,
      };
    }

    render(p) {
      const ctx = this.ctx;
      const w = this.w, h = this.h;
      ctx.clearRect(0, 0, w, h);

      // Phases : extérieur (rue) puis intérieur (couloir → cave)
      const EXT_END = 0.14;
      const XFADE = 0.035; // fondu enchaîné extérieur↔intérieur

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
    }

    // ---- Extérieur : la rue et la façade -------------------------------
    renderExterior(t, p) {
      const ctx = this.ctx, w = this.w, h = this.h;
      const approach = smooth(t);

      // Ciel crépusculaire
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#141a2b");
      sky.addColorStop(0.55, "#26283b");
      sky.addColorStop(1, "#3a2f38");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Sol / trottoir
      const groundY = h * (0.66 + approach * 0.12);
      const g = ctx.createLinearGradient(0, groundY, 0, h);
      g.addColorStop(0, "#1b1c22");
      g.addColorStop(1, "#0a0a0d");
      ctx.fillStyle = g;
      ctx.fillRect(0, groundY, w, h - groundY);

      // Façade du bâtiment qui grandit à l'approche
      const cx = w / 2;
      const fw = w * lerp(0.5, 1.9, approach);     // largeur façade
      const fh = h * lerp(0.5, 1.9, approach);
      const fx = cx - fw / 2;
      const fy = groundY - fh;

      ctx.fillStyle = "#101319";
      ctx.fillRect(fx, fy, fw, fh);

      // Fenêtres (quelques carrés éclairés)
      ctx.save();
      ctx.beginPath();
      ctx.rect(fx, fy, fw, fh);
      ctx.clip();
      const cols = 5, rows = 4;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const lit = (i * 7 + j * 3) % 5 < 2;
          ctx.fillStyle = lit ? "rgba(200,170,90,0.5)" : "rgba(120,140,170,0.10)";
          const wx = fx + fw * (0.1 + (i / cols) * 0.8);
          const wy = fy + fh * (0.08 + (j / rows) * 0.55);
          ctx.fillRect(wx, wy, fw * 0.09, fh * 0.07);
        }
      }
      ctx.restore();

      // Porte d'entrée éclairée, centrée, qui grandit jusqu'à "avaler" l'écran
      const doorW = fw * lerp(0.16, 0.42, approach);
      const doorH = fh * lerp(0.28, 0.7, approach);
      const dx = cx - doorW / 2;
      const dy = groundY - doorH;

      const halo = ctx.createRadialGradient(cx, dy + doorH * 0.5, doorW * 0.1, cx, dy + doorH * 0.5, doorW * 1.4);
      halo.addColorStop(0, `rgba(210,180,110,${0.35 + approach * 0.4})`);
      halo.addColorStop(1, "rgba(210,180,110,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(dx - doorW, dy - doorH * 0.4, doorW * 3, doorH * 1.8);

      const door = ctx.createLinearGradient(0, dy, 0, dy + doorH);
      door.addColorStop(0, "#c8a24a");
      door.addColorStop(1, "#6e5a28");
      ctx.fillStyle = door;
      ctx.fillRect(dx, dy, doorW, doorH);

      // Assombrissement final avant de "rentrer"
      ctx.fillStyle = `rgba(0,0,0,${clamp((t - 0.7) / 0.3) * 0.9})`;
      ctx.fillRect(0, 0, w, h);
    }

    // ---- Intérieur : couloir → porte blindée → cave --------------------
    renderInterior(t, p) {
      const ctx = this.ctx, w = this.w, h = this.h;
      const cx = w / 2;
      const horizon = h * 0.5;
      const focal = w * 0.82;

      const cameraZ = smooth(t) * INTERIOR_DEPTH;

      // Lumière globale : claire au début, quasi noire dans la cave
      let light;
      if (cameraZ < Z_BLAST) light = lerp(0.9, 0.5, clamp(cameraZ / Z_BLAST));
      else if (cameraZ < Z_CAVE) light = lerp(0.5, 0.14, clamp((cameraZ - Z_BLAST) / (Z_CAVE - Z_BLAST)));
      else light = 0.12;

      // Teinte d'ambiance selon la zone
      const cool = [150, 165, 190];  // hall/couloir (froid)
      const warmSteel = [120, 120, 130];
      const zoneTint = cameraZ < Z_BLAST ? cool : warmSteel;

      // Fond (fond du couloir / obscurité)
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      // --- Couloir en bandes de profondeur (loin → près) ---------------
      const zFar = 58, zNear = 0.6;
      const bands = 46;
      let prev = null;
      for (let i = 0; i <= bands; i++) {
        // répartition logarithmique : plus de détail au loin
        const f = i / bands;
        const zrel = zFar * Math.pow(zNear / zFar, f);
        const rect = this.openingRect(zrel, cx, horizon, focal);
        if (prev) {
          this.drawBand(prev, rect, prev.z, zoneTint, light);
        }
        prev = rect;
        prev.z = zrel;
      }

      // --- Cadres de porte le long du couloir --------------------------
      for (const zAbs of DOORFRAMES) {
        const zrel = zAbs - cameraZ;
        if (zrel > 0.6 && zrel < zFar) this.drawDoorframe(zrel, cx, horizon, focal, light);
      }

      // --- Porte blindée -----------------------------------------------
      const zBlast = Z_BLAST - cameraZ;
      if (zBlast > 0.4 && zBlast < zFar) {
        const open = clamp((cameraZ - (Z_BLAST - 7)) / 7); // 0 loin → 1 au contact
        this.drawBlastDoor(zBlast, cx, horizon, focal, light, p, open);
      }

      // --- Cave : nappe de lumière chaude au fond pour le "merci" ------
      if (cameraZ > Z_BLAST) {
        const caveT = clamp((cameraZ - Z_BLAST) / (INTERIOR_DEPTH - Z_BLAST));
        const glow = ctx.createRadialGradient(cx, horizon + h * 0.05, 10, cx, horizon + h * 0.05, w * 0.5);
        glow.addColorStop(0, `rgba(200,162,74,${0.10 + caveT * 0.28})`);
        glow.addColorStop(0.5, `rgba(120,90,40,${0.05 + caveT * 0.12})`);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
      }

      // Vignette d'obscurité renforcée dans la cave
      if (light < 0.4) {
        const v = ctx.createRadialGradient(cx, horizon, w * 0.1, cx, horizon, w * 0.75);
        v.addColorStop(0, "rgba(0,0,0,0)");
        v.addColorStop(1, `rgba(0,0,0,${clamp((0.4 - light) / 0.3) * 0.85})`);
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, w, h);
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

    // Une "tranche" de couloir : 4 trapèzes (plafond, sol, mur G, mur D)
    drawBand(far, near, z, tint, light) {
      const ctx = this.ctx;
      const fog = clamp(1 - z / 60);          // 1 près, 0 loin
      const base = 0.10 + 0.9 * fog;           // atténuation avec la distance
      const shade = (mult) => {
        const v = base * light * mult;
        return `rgb(${Math.round(tint[0] * v)},${Math.round(tint[1] * v)},${Math.round(tint[2] * v)})`;
      };

      // Sol (le plus clair)
      ctx.fillStyle = shade(0.55);
      this.quad(far.l, far.b, far.r, far.b, near.r, near.b, near.l, near.b);
      // Plafond (sombre)
      ctx.fillStyle = shade(0.30);
      this.quad(far.l, far.t, far.r, far.t, near.r, near.t, near.l, near.t);
      // Mur gauche
      ctx.fillStyle = shade(0.42);
      this.quad(far.l, far.t, far.l, far.b, near.l, near.b, near.l, near.t);
      // Mur droit
      ctx.fillStyle = shade(0.48);
      this.quad(far.r, far.t, far.r, far.b, near.r, near.b, near.r, near.t);
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

    drawDoorframe(z, cx, horizon, focal, light) {
      const ctx = this.ctx;
      const rect = this.openingRect(z, cx, horizon, focal);
      const fog = clamp(1 - z / 60);
      const thick = Math.max(2, (0.28 * focal) / z);
      ctx.strokeStyle = `rgba(${Math.round(200 * light)},${Math.round(205 * light)},${Math.round(215 * light)},${0.25 + 0.55 * fog})`;
      ctx.lineWidth = thick;
      ctx.strokeRect(rect.l, rect.t, rect.r - rect.l, rect.b - rect.t);
    }

    drawBlastDoor(z, cx, horizon, focal, light, p, open) {
      const ctx = this.ctx;
      const rect = this.openingRect(z, cx, horizon, focal);
      const R = Math.min(rect.r - rect.l, rect.b - rect.t) * 0.46;
      const ccx = cx;
      const ccy = horizon;

      // Ouverture : un disque noir au centre grandit (on voit la cave derrière)
      const aperture = open * R * 1.05;

      ctx.save();
      // Disque de la porte (métal), évidé par l'ouverture
      ctx.beginPath();
      ctx.arc(ccx, ccy, R, 0, Math.PI * 2);
      if (aperture > 1) ctx.arc(ccx, ccy, aperture, 0, Math.PI * 2, true);
      const metal = ctx.createRadialGradient(ccx - R * 0.3, ccy - R * 0.3, R * 0.1, ccx, ccy, R);
      const m = light;
      metal.addColorStop(0, `rgb(${Math.round(150 * m)},${Math.round(155 * m)},${Math.round(165 * m)})`);
      metal.addColorStop(1, `rgb(${Math.round(60 * m)},${Math.round(62 * m)},${Math.round(70 * m)})`);
      ctx.fillStyle = metal;
      ctx.fill("evenodd");

      // Anneaux concentriques
      ctx.lineWidth = Math.max(1, R * 0.03);
      ctx.strokeStyle = `rgba(20,22,26,${0.8})`;
      for (const rr of [0.9, 0.72, 0.5]) {
        if (aperture < R * rr) {
          ctx.beginPath();
          ctx.arc(ccx, ccy, R * rr, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Boulons sur le pourtour
      const bolts = 12;
      ctx.fillStyle = `rgba(${Math.round(210 * m)},${Math.round(200 * m)},${Math.round(180 * m)},0.9)`;
      for (let i = 0; i < bolts; i++) {
        const a = (i / bolts) * Math.PI * 2;
        const bx = ccx + Math.cos(a) * R * 0.86;
        const by = ccy + Math.sin(a) * R * 0.86;
        ctx.beginPath();
        ctx.arc(bx, by, Math.max(1, R * 0.03), 0, Math.PI * 2);
        ctx.fill();
      }

      // Volant cranté qui tourne selon le scroll (en plus du HUD)
      if (aperture < R * 0.55) {
        const angle = p * Math.PI * 8;   // tourne de plus en plus
        ctx.translate(ccx, ccy);
        ctx.rotate(angle);
        ctx.strokeStyle = `rgba(${Math.round(210 * m)},${Math.round(215 * m)},${Math.round(225 * m)},0.95)`;
        ctx.lineWidth = Math.max(2, R * 0.06);
        for (let i = 0; i < 3; i++) {
          ctx.rotate(Math.PI / 3);
          ctx.beginPath();
          ctx.moveTo(0, -R * 0.5);
          ctx.lineTo(0, R * 0.5);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        // moyeu
        ctx.fillStyle = "rgba(200,162,74,0.9)";
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  window.ProceduralScene = ProceduralScene;
})();
