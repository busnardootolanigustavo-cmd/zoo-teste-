/* ==========================================================
   Texturas de pele desenhadas na hora, em <canvas>.
   Nenhuma imagem externa: cada padrão é gerado por código e
   "emenda" nas bordas, então pode repetir sem costura.
   ========================================================== */
(() => {
  const S = 480;               // tamanho do bloco da textura (px)
  const TAU = Math.PI * 2;

  /* ---------- utilitários ---------- */
  const seeded = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

  function makeCanvas() {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    return [c, c.getContext('2d')];
  }

  // forma irregular (mancha) — pontos relativos ao centro
  function blobShape(R, r, { sx = 1, sy = 1, rot = 0, wobble = 0.25 } = {}) {
    const n = 9 + Math.floor(R() * 4);
    const p1 = R() * TAU, p2 = R() * TAU;
    const a1 = wobble * (0.5 + R()), a2 = wobble * 0.5 * R();
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const rr = r * (1 + a1 * 0.5 * Math.sin(2 * a + p1) + a2 * Math.sin(3 * a + p2) + (R() - 0.5) * wobble * 0.6);
      const x = Math.cos(a) * rr * sx, y = Math.sin(a) * rr * sy;
      pts.push([x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)]);
    }
    return pts;
  }

  function drawShape(ctx, pts, cx, cy) {
    const n = pts.length;
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const s = mid(pts[n - 1], pts[0]);
    ctx.beginPath();
    ctx.moveTo(cx + s[0], cy + s[1]);
    for (let i = 0; i < n; i++) {
      const p = pts[i], m = mid(p, pts[(i + 1) % n]);
      ctx.quadraticCurveTo(cx + p[0], cy + p[1], cx + m[0], cy + m[1]);
    }
    ctx.closePath();
    ctx.fill();
  }

  // desenha a mesma forma nas posições vizinhas pra não ter costura
  function wrapped(ctx, pts, x, y, pad) {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const X = x + dx * S, Y = y + dy * S;
      if (X > -pad && X < S + pad && Y > -pad && Y < S + pad) drawShape(ctx, pts, X, Y);
    }
  }

  function jitterGrid(R, g, j) {
    const out = [], c = S / g;
    for (let i = 0; i < g; i++) for (let k = 0; k < g; k++)
      out.push([(i + 0.5 + (R() - 0.5) * j) * c, (k + 0.5 + (R() - 0.5) * j) * c]);
    return out;
  }

  function grain(ctx, amt, R) {
    const img = ctx.getImageData(0, 0, S, S), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (R() - 0.5) * amt;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }

  function softPatches(ctx, R, colors, count, alpha) {
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = css(rgb(colors[i % colors.length]), alpha);
      wrapped(ctx, blobShape(R, S * (0.06 + R() * 0.12), { wobble: 0.5 }), R() * S, R() * S, S * 0.3);
    }
  }

  // tracinhos de pelo, em camadas
  function hairs(ctx, R, { tones, n, len, angle, spread, width, alpha, flow }) {
    const ph = R() * TAU;
    ctx.lineCap = 'round';
    ctx.lineWidth = width;
    for (let pass = 0; pass < 3; pass++) {
      const paths = tones.map(() => new Path2D());
      for (let i = 0; i < n / 3; i++) {
        const x = R() * S, y = R() * S;
        const a = angle + (R() - 0.5) * spread + flow * Math.sin(TAU * (2 * x / S + y / S) + ph);
        const l = len[0] + R() * (len[1] - len[0]);
        const dx = Math.cos(a) * l, dy = Math.sin(a) * l;
        const p = paths[Math.floor(R() * tones.length)];
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
          const X = x + ox * S, Y = y + oy * S;
          if (X + l < -2 || X - l > S + 2 || Y + l < -2 || Y - l > S + 2) continue;
          p.moveTo(X, Y); p.lineTo(X + dx, Y + dy);
        }
      }
      tones.forEach((t, i) => { ctx.strokeStyle = css(rgb(t), alpha); ctx.stroke(paths[i]); });
    }
  }

  /* ---------- geradores ---------- */

  // onça / gato-maracajá: rosetas
  function rosettes({ base, mid, ink, bgVar, seed, g = 5, size = 0.34, dots = 0.6, extra = 2 }) {
    const R = seeded(seed); const [c, ctx] = makeCanvas();
    ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
    if (bgVar) softPatches(ctx, R, [bgVar], 16, 0.2);
    const cell = S / g;

    for (const [x, y] of jitterGrid(R, g, 0.55)) {
      const r = cell * size * (0.8 + R() * 0.45);
      const sq = 0.8 + R() * 0.35;
      ctx.fillStyle = mid;
      wrapped(ctx, blobShape(R, r * 0.82, { sy: sq, wobble: 0.3 }), x, y, r * 2);
      ctx.fillStyle = ink;
      const k = 4 + Math.floor(R() * 3), step = TAU / k, a0 = R() * TAU;
      for (let i = 0; i < k; i++) {
        if (R() < 0.08) continue;
        const a = a0 + i * step + (R() - 0.5) * step * 0.3;
        const s = r * (0.26 + R() * 0.14);
        wrapped(ctx, blobShape(R, s, { sx: 1.5, sy: 0.7, rot: a + Math.PI / 2, wobble: 0.35 }),
          x + Math.cos(a) * r, y + Math.sin(a) * r * sq, r * 3);
      }
      if (R() < dots) {
        const nd = 1 + Math.floor(R() * 2);
        for (let i = 0; i < nd; i++)
          wrapped(ctx, blobShape(R, r * (0.1 + R() * 0.08), { wobble: 0.3 }),
            x + (R() - 0.5) * r * 0.6, y + (R() - 0.5) * r * 0.6, r * 3);
      }
    }
    // pintas soltas entre as rosetas
    ctx.fillStyle = ink;
    for (const [x, y] of jitterGrid(R, g, 0.9)) {
      const n = Math.floor(R() * (extra + 1));
      for (let i = 0; i < n; i++)
        wrapped(ctx, blobShape(R, cell * (0.035 + R() * 0.05), { sx: 1 + R() * 0.6, rot: R() * TAU, wobble: 0.4 }),
          x + cell / 2 + (R() - 0.5) * cell * 0.35, y + cell / 2 + (R() - 0.5) * cell * 0.35, cell);
    }
    grain(ctx, 14, R);
    return c;
  }

  // zebra / tigre / tigre-d'água: listras por campo de ondas periódicas
  function stripes({ base, base2, ink, seed, freq = 8, warp = 0.07, thr = 0, thrVar = 0.25, breakup = 0.15, edge = 0.08, horizontal = false }) {
    const R = seeded(seed); const [c, ctx] = makeCanvas();
    const img = ctx.createImageData(S, S), d = img.data;
    const B = rgb(base), B2 = rgb(base2 || base), I = rgb(ink);
    const ph = Array.from({ length: 8 }, () => R() * TAU);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        let u = x / S, v = y / S;
        if (horizontal) [u, v] = [v, u];
        const w = warp * (Math.sin(TAU * 2 * v + ph[0]) + 0.6 * Math.sin(TAU * (u + 3 * v) + ph[1])
          + 0.35 * Math.sin(TAU * (2 * u - 5 * v) + ph[2]) + 0.2 * Math.sin(TAU * (7 * v + u) + ph[3]));
        const s = Math.sin(TAU * freq * (u + w));
        const th = thr + thrVar * Math.sin(TAU * (u + 2 * v) + ph[4])
          + breakup * Math.sin(TAU * (3 * u + 4 * v) + ph[5]) * Math.sin(TAU * (2 * v - u) + ph[6]);
        const a = smooth(th - edge, th + edge, s);
        const bg = mix(B, B2, 0.5 + 0.5 * Math.sin(TAU * (u + v) + ph[7]));
        const col = mix(bg, I, a);
        const o = (y * S + x) * 4;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    grain(ctx, 12, R);
    return c;
  }

  // girafa / casco de jabuti: células de Voronoi
  function cells({ base, line, seed, g = 6, jitter = 0.85, gap = 0.07, soft = 0.025, vary = 0.2,
    hex = false, center = null, centerR = 0.3, rings = 0, scallop = 0.02, darkCenter = 0.12 }) {
    const R = seeded(seed); const [c, ctx] = makeCanvas();
    const cell = S / g, pts = [], cols = [];
    const B = rgb(base), L = rgb(line), C = center ? rgb(center) : null;
    for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) {
      const off = hex && j % 2 ? 0.5 : 0;
      pts.push([(i + 0.5 + off + (R() - 0.5) * jitter) * cell, (j + 0.5 + (R() - 0.5) * jitter) * cell]);
      const v = (R() - 0.5) * vary;
      cols.push(v > 0 ? mix(B, [255, 236, 200], v) : mix(B, [0, 0, 0], -v));
    }
    const img = ctx.createImageData(S, S), d = img.data, half = S / 2;
    const ph = [R() * TAU, R() * TAU];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let d1 = 1e9, d2 = 1e9, k1 = 0;
      for (let k = 0; k < pts.length; k++) {
        let dx = Math.abs(x - pts[k][0]); if (dx > half) dx = S - dx;
        let dy = Math.abs(y - pts[k][1]); if (dy > half) dy = S - dy;
        const dd = dx * dx + dy * dy;
        if (dd < d1) { d2 = d1; d1 = dd; k1 = k; } else if (dd < d2) d2 = dd;
      }
      const f1 = Math.sqrt(d1), f2 = Math.sqrt(d2), u = x / S, v = y / S;
      const e = (f2 - f1) / cell + scallop * Math.sin(TAU * (11 * u + 3 * v) + ph[0]) * Math.sin(TAU * (4 * u - 9 * v) + ph[1]);
      const a = smooth(gap - soft, gap + soft, e);
      const rr = f1 / cell;
      let col = cols[k1];
      if (darkCenter) col = mix(col, [0, 0, 0], darkCenter * clamp(1 - rr * 1.6, 0, 1));
      if (rings) col = mix(col, L, 0.3 * smooth(0.7, 1, Math.sin(rr * rings * TAU)));
      if (C) col = mix(col, C, smooth(centerR, centerR * 0.6, rr));
      const out = mix(L, col, a);
      const o = (y * S + x) * 4;
      d[o] = out[0]; d[o + 1] = out[1]; d[o + 2] = out[2]; d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    grain(ctx, 12, R);
    return c;
  }

  // pelagem lisa (lobo-guará, mico, anta, ariranha)
  function fur({ base, tones, seed, n = 9000, len = [4, 10], angle = Math.PI / 2, spread = 0.4, width = 1.1, alpha = 0.4, flow = 0.35 }) {
    const R = seeded(seed); const [c, ctx] = makeCanvas();
    ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
    softPatches(ctx, R, tones, 18, 0.12);
    hairs(ctx, R, { tones, n, len, angle, spread, width, alpha, flow });
    grain(ctx, 12, R);
    return c;
  }

  // tamanduá-bandeira: pelo grisalho + a faixa diagonal preta e branca
  function tamandua() {
    const c = fur({ base: '#6f665a', tones: ['#8d8475', '#4f483f', '#aaa08f', '#2e2924'], seed: 21, n: 11000, len: [6, 15], angle: Math.PI * 0.3, spread: 0.5 });
    const ctx = c.getContext('2d'), R = seeded(22);
    const band = (c0, c1, col) => {
      ctx.fillStyle = col;
      for (let k = -2; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(c0 + k * S, 0); ctx.lineTo(c1 + k * S, 0);
        ctx.lineTo(c1 + k * S + S, S); ctx.lineTo(c0 + k * S + S, S);
        ctx.closePath(); ctx.fill();
      }
    };
    band(S * 0.30, S * 0.62, '#e6dccb');
    band(S * 0.37, S * 0.55, '#16120f');
    hairs(ctx, R, { tones: ['#e6dccb', '#16120f', '#8d8475'], n: 6000, len: [6, 14], angle: Math.PI * 0.3, spread: 0.5, width: 1.1, alpha: 0.3, flow: 0.3 });
    grain(ctx, 10, R);
    return c;
  }

  // pele lisa e enrugada (hipopótamo)
  function skin({ base, tones, wrinkle, seed }) {
    const R = seeded(seed); const [c, ctx] = makeCanvas();
    ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
    softPatches(ctx, R, tones, 60, 0.12);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = css(rgb(tones[i % tones.length]), 0.18);
      wrapped(ctx, blobShape(R, 1 + R() * 3, { wobble: 0.3 }), R() * S, R() * S, 10);
    }
    const W = rgb(wrinkle);
    ctx.lineCap = 'round';
    for (let i = 0; i < 140; i++) {
      const x = R() * S, y = R() * S, l = 20 + R() * 50, a = (R() - 0.5) * 0.8;
      const bx = (R() - 0.5) * 24, by = (R() - 0.5) * 24;
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const X = x + ox * S, Y = y + oy * S;
        const ex = X + Math.cos(a) * l, ey = Y + Math.sin(a) * l;
        ctx.strokeStyle = css(W, 0.22); ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(X, Y); ctx.quadraticCurveTo((X + ex) / 2 + bx, (Y + ey) / 2 + by, ex, ey); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,235,225,0.10)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(X, Y + 1.5); ctx.quadraticCurveTo((X + ex) / 2 + bx, (Y + ey) / 2 + by + 1.5, ex, ey + 1.5); ctx.stroke();
      }
    }
    grain(ctx, 16, R);
    return c;
  }

  // penas / escamas sobrepostas (arara, tucano, grou)
  function scales({ tones, edge, hi, seed, w = 32, h = 20, rachis = true }) {
    const R = seeded(seed); const [c, ctx] = makeCanvas();
    const cols = Math.round(S / w), rows = Math.round(S / h);
    const E = rgb(edge), H = rgb(hi);
    ctx.fillStyle = edge; ctx.fillRect(0, 0, S, S);
    const memo = {};
    const pick = (i, j) => {
      const k = (((i % cols) + cols) % cols) + ',' + (((j % rows) + rows) % rows);
      if (!(k in memo)) memo[k] = [rgb(tones[Math.floor(R() * tones.length)]), 0.6 + R() * 0.8];
      return memo[k];
    };
    const r = w * 0.62;
    for (let j = rows; j >= -1; j--) {
      const off = (((j % 2) + 2) % 2) * w / 2;
      for (let i = -1; i <= cols; i++) {
        const x = i * w + off, y = j * h;
        const [T, k] = pick(i, j);
        const g = ctx.createLinearGradient(0, y - h * 1.8, 0, y + r);
        g.addColorStop(0, css(mix(T, E, 0.4)));
        g.addColorStop(0.7, css(T));
        g.addColorStop(1, css(mix(T, H, 0.12 * k)));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x + r, y - h * 1.8); ctx.lineTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI, false);
        ctx.lineTo(x - r, y - h * 1.8); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = css(E, 0.55); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(x, y, r, 0.1, Math.PI - 0.1); ctx.stroke();
        ctx.strokeStyle = css(H, 0.18); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y - 1.5, r - 3, 0.4, Math.PI - 0.4); ctx.stroke();
        if (rachis) {
          ctx.strokeStyle = css(E, 0.25);
          ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x, y + r - 3); ctx.stroke();
        }
      }
    }
    grain(ctx, 10, R);
    return c;
  }

  /* ---------- catálogo ---------- */
  const PELES = {
    'onca':        () => rosettes({ base: '#dba04a', mid: '#c07a2a', ink: '#1c130b', bgVar: '#ecbd6c', seed: 7 }),
    'tigre':       () => stripes({ base: '#d9781f', base2: '#e9a14a', ink: '#15100b', seed: 3, freq: 7, warp: 0.07, thr: 0.42, thrVar: 0.18, breakup: 0.35 }),
    'zebra':       () => stripes({ base: '#f1ebdd', base2: '#e6dfcf', ink: '#141210', seed: 5, freq: 9, warp: 0.08, thr: 0, thrVar: 0.25, breakup: 0.15 }),
    'girafa':      () => cells({ base: '#8f4c1d', line: '#efe2c4', seed: 9, g: 6, gap: 0.08, vary: 0.3 }),
    'onca-preta':  () => rosettes({ base: '#27221e', mid: '#1e1a17', ink: '#0d0b0a', bgVar: '#312a24', seed: 11 }),
    'jabuti':      () => cells({ base: '#3a2a1a', line: '#120e0a', seed: 13, g: 6, jitter: 0.15, gap: 0.05, soft: 0.02, vary: 0.25, hex: true, center: '#c99a3c', centerR: 0.28, rings: 6, scallop: 0.004, darkCenter: 0 }),
    'maracaja':    () => rosettes({ base: '#c9975a', mid: '#a9743d', ink: '#24180e', bgVar: '#dcb37a', seed: 15, g: 7, size: 0.36, dots: 0.2, extra: 3 }),
    'lobo':        () => fur({ base: '#c4652a', tones: ['#e08a3e', '#9c4a1c', '#f0a65a', '#7a3614'], seed: 17, len: [6, 14] }),
    'mico':        () => fur({ base: '#d98b24', tones: ['#f2b23a', '#b8661a', '#ffcf5c', '#a35514'], seed: 19, len: [10, 22], spread: 0.6, flow: 0.6 }),
    'tamandua':    tamandua,
    'anta':        () => fur({ base: '#4a3a30', tones: ['#5e4a3d', '#382b23', '#6b5747'], seed: 23, n: 14000, len: [2, 5], alpha: 0.5 }),
    'ariranha':    () => fur({ base: '#3a2617', tones: ['#4e3420', '#2a1a0f', '#7a5634'], seed: 25, n: 10000, len: [4, 8], angle: 0.2, flow: 0.5 }),
    'hipo':        () => skin({ base: '#7d6f6c', tones: ['#8f7f7a', '#6a5d5c', '#a3897f', '#5c504f'], wrinkle: '#3e3533', seed: 27 }),
    'arara':       () => scales({ tones: ['#1f6fb2', '#2a86c9', '#195a94', '#3b9ad6'], edge: '#0c2c4a', hi: '#bfe6ff', seed: 29 }),
    'tucano':      () => scales({ tones: ['#151515', '#1e1c1a', '#0e0e0e', '#2a2623'], edge: '#000000', hi: '#8a8a8a', seed: 31, w: 24, h: 16 }),
    'grou':        () => scales({ tones: ['#8e8e8a', '#a3a39d', '#7a7a76', '#b4b3ac'], edge: '#3d3d3a', hi: '#f4f4ee', seed: 33, w: 40, h: 24 }),
    'tigre-dagua': () => stripes({ base: '#3d5a2c', base2: '#2c4520', ink: '#e2c34a', seed: 35, freq: 12, warp: 0.04, thr: 0.78, thrVar: 0.08, breakup: 0.08, edge: 0.06, horizontal: true }),
  };

  async function gerar() {
    const root = document.documentElement;
    for (const [nome, fn] of Object.entries(PELES)) {
      await new Promise((r) => setTimeout(r, 0)); // deixa o navegador respirar entre uma e outra
      const canvas = fn();
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
      root.style.setProperty(`--tex-${nome}`, `url(${URL.createObjectURL(blob)})`);
    }
    root.classList.add('texturas-prontas');
  }

  gerar();
})();
