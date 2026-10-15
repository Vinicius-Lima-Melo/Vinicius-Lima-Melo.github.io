// Fundo animado: um <canvas> fixo atrás da página com trilhas de circuito.
// Com "reduzir movimento" no sistema, desenha um quadro parado.
(() => {
  const root = document.documentElement;
  const canvas = document.querySelector('.backdrop__canvas');
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const view = { w: 0, h: 0, dpr: 1 };
  let scene = null;
  let state = null;
  let raf = 0;
  let last = 0;

  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const rgba = (c, alpha) => `rgba(${c[0]},${c[1]},${c[2]},${alpha.toFixed(3)})`;

  /**
   * Cores do tema atual, todas no roxo da foto: `a` traços, `b` brilhos (pulsos,
   * cabeça da chuva, sol), `c` halos. `k` baixa a intensidade no claro, onde o
   * mesmo traço pesa mais.
   */
  const colors = () => (root.dataset.theme === 'light'
    ? { a: [90, 15, 158], b: [168, 30, 200], c: [116, 23, 201], text: [87, 74, 107], star: [90, 15, 158], k: 0.8 }
    : { a: [201, 163, 255], b: [240, 171, 252], c: [91, 8, 155], text: [179, 166, 200], star: [240, 232, 255], k: 1 });

  const moving = () => !reduceMotion.matches;

  // =================================================================== Cenas

  /** Ponto a uma distância `d` ao longo de uma trilha do circuito. */
  const pointAt = (trace, d) => {
    if (d < 0 || d > trace.len) return null;
    let i = 1;
    while (i < trace.cum.length - 1 && trace.cum[i] < d) i++;
    const span = trace.cum[i] - trace.cum[i - 1];
    const f = span ? (d - trace.cum[i - 1]) / span : 0;
    const [x0, y0] = trace.pts[i - 1];
    const [x1, y1] = trace.pts[i];
    return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
  };

  const SCENES = {
    // --------------------------------------------------------------- Circuito
    // Trilhas de placa em ângulos de 45°, com pulsos de luz correndo por elas.
    circuito: {
      setup() {
        const { w, h, dpr } = view;
        const pal = colors();
        const cell = w < 640 ? 22 : 26;
        const cols = Math.ceil(w / cell) + 1;
        const rows = Math.ceil(h / cell) + 1;
        const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
        const used = new Set();
        const key = (x, y) => `${x},${y}`;
        const traces = [];
        const target = Math.round((cols * rows) / 16);

        for (let tries = 0; tries < target * 4 && traces.length < target; tries++) {
          let x = Math.floor(rand(0, cols));
          let y = Math.floor(rand(0, rows));
          if (used.has(key(x, y))) continue;
          let dir = Math.floor(rand(0, 4)) * 2; // começa reto
          const cells = [[x, y]];
          used.add(key(x, y));
          const length = Math.floor(rand(4, 18));
          for (let k = 0; k < length; k++) {
            if (k > 1 && Math.random() < 0.22) dir = (dir + (Math.random() < 0.5 ? 1 : 7)) % 8;
            const nx = x + DIRS[dir][0];
            const ny = y + DIRS[dir][1];
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || used.has(key(nx, ny))) break;
            x = nx;
            y = ny;
            cells.push([x, y]);
            used.add(key(x, y));
          }
          if (cells.length < 4) continue;
          const pts = cells.map(([cx, cy]) => [cx * cell, cy * cell]);
          const cum = [0];
          for (let i = 1; i < pts.length; i++) {
            cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
          }
          traces.push({ pts, cum, len: cum[cum.length - 1] });
        }

        // As trilhas não mudam: desenhadas uma vez numa camada à parte.
        const layer = document.createElement('canvas');
        layer.width = Math.round(w * dpr);
        layer.height = Math.round(h * dpr);
        const o = layer.getContext('2d');
        o.scale(dpr, dpr);
        o.lineCap = 'round';
        o.lineJoin = 'round';
        o.lineWidth = 1.25;
        o.strokeStyle = rgba(pal.a, 0.17 * pal.k);
        for (const t of traces) {
          o.beginPath();
          t.pts.forEach(([px, py], i) => (i ? o.lineTo(px, py) : o.moveTo(px, py)));
          o.stroke();
        }
        for (const t of traces) {
          const [sx, sy] = t.pts[0];
          const [ex, ey] = t.pts[t.pts.length - 1];
          o.fillStyle = rgba(pal.a, 0.32 * pal.k);
          o.beginPath();
          o.arc(sx, sy, 2, 0, Math.PI * 2);
          o.fill();
          o.strokeStyle = rgba(pal.a, 0.34 * pal.k);
          o.beginPath();
          o.arc(ex, ey, 3.2, 0, Math.PI * 2);
          o.stroke();
        }

        const pulses = traces
          .filter(() => Math.random() < 0.45)
          .map((t) => ({ t, pos: rand(0, t.len), speed: rand(45, 120), alt: Math.random() < 0.5 }));
        return { layer, traces, pulses };
      },
      draw(dt) {
        const { w, h } = view;
        const pal = colors();
        const TAIL = 46;
        const STEPS = 6;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(state.layer, 0, 0, w, h);
        ctx.lineCap = 'round';
        ctx.lineWidth = 1.6;
        for (const p of state.pulses) {
          p.pos += (p.speed * dt) / 1000;
          if (p.pos - TAIL > p.t.len) {
            p.t = pick(state.traces);
            p.pos = 0;
            p.speed = rand(45, 120);
          }
          const col = p.alt ? pal.b : pal.a;
          for (let i = 0; i < STEPS; i++) {
            const from = pointAt(p.t, p.pos - TAIL + (TAIL / STEPS) * i);
            const to = pointAt(p.t, p.pos - TAIL + (TAIL / STEPS) * (i + 1));
            if (!from || !to) continue;
            ctx.strokeStyle = rgba(col, ((i + 1) / STEPS) * 0.75 * pal.k);
            ctx.beginPath();
            ctx.moveTo(from[0], from[1]);
            ctx.lineTo(to[0], to[1]);
            ctx.stroke();
          }
          const head = pointAt(p.t, p.pos);
          if (!head) continue;
          ctx.fillStyle = rgba(col, 0.16 * pal.k);
          ctx.beginPath();
          ctx.arc(head[0], head[1], 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = rgba(col, 0.95 * pal.k);
          ctx.beginPath();
          ctx.arc(head[0], head[1], 1.9, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    },

  };

  // =================================================================== Motor

  const fit = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return false;
    view.w = w;
    view.h = h;
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * view.dpr);
    canvas.height = Math.round(h * view.dpr);
    return true;
  };

  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const loop = (now) => {
    // Aba em segundo plano para o requestAnimationFrame; na volta, sem salto.
    const dt = Math.min(50, now - last);
    last = now;
    scene.draw(dt, now);
    raf = requestAnimationFrame(loop);
  };

  const run = () => {
    stop();
    if (!scene || !scene.draw || !moving()) return;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  };

  /** Monta a cena do zero (troca de tema ou de tamanho). */
  const start = () => {
    stop();
    if (!view.w && !fit()) return;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, view.w, view.h);
    scene = SCENES.circuito;
    state = scene.setup();
    if (!scene.draw) return;
    if (moving()) {
      if (scene.warm) scene.warm();
      run();
    }
    else if (scene.still) scene.still();
    else scene.draw(0, performance.now());
  };

  // Tamanho: só recomeça quando muda de verdade (girar o celular, redimensionar a janela).
  let resizeTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (canvas.clientWidth === view.w && canvas.clientHeight === view.h) return;
      if (fit()) start();
    }, 150);
  }).observe(canvas);

  // O tema troca as cores da cena.
  new MutationObserver(start).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  reduceMotion.addEventListener('change', start);

  fit();
  start();

})();
