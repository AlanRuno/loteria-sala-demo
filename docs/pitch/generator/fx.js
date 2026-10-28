// Efectos compartidos de la sala: contadores suaves, confeti y sonido.
window.FX = (function () {
  // ---- Contador tipo odómetro: una casilla de ancho fijo por carácter; solo giran las cifras que
  // cambian. Los dígitos que no cambian no se mueven ni un píxel (nada "corre" ni baila en X). ----
  function counter(el, fmt, opts) {
    opts = opts || {};
    const dur = opts.upDur || opts.dur || 800;
    let cur = null, cells = [];
    el.classList.add('odo');
    function build(str) {
      el.innerHTML = ''; cells = [];
      for (const ch of str) {
        const c = document.createElement('span');
        c.className = 'odo-c' + (/\d/.test(ch) ? ' odo-d' : (ch === '$' ? ' odo-s odo-cur' : ' odo-s'));
        c.innerHTML = '<span class="odo-in"><span class="odo-v">' + ch + '</span></span>';
        el.appendChild(c); cells.push({ el: c, ch });
      }
    }
    function roll(cell, from, to) {
      // apila "from" arriba y "to" abajo; desliza una casilla hacia arriba (ease-out suave)
      const inn = cell.el.querySelector('.odo-in');
      inn.style.transition = 'none'; inn.style.transform = 'translateY(0)';
      inn.innerHTML = '<span class="odo-v">' + from + '</span><span class="odo-v">' + to + '</span>';
      void inn.offsetHeight;
      inn.style.transition = 'transform ' + dur + 'ms cubic-bezier(.22,.9,.3,1)';
      inn.style.transform = 'translateY(-50%)';
      cell.ch = to;
      clearTimeout(cell.t);
      cell.t = setTimeout(() => { inn.style.transition = 'none'; inn.innerHTML = '<span class="odo-v">' + to + '</span>'; inn.style.transform = 'translateY(0)'; }, dur + 30);
    }
    return function set(v, instant) {
      const str = fmt(v);
      if (cur === null || instant || str.length !== cells.length) { cur = v; build(str); return; }
      if (v === cur) return;
      cur = v;
      for (let i = 0; i < str.length; i++) if (str[i] !== cells[i].ch) roll(cells[i], cells[i].ch, str[i]);
      el.classList.add('rolling'); clearTimeout(el._rt); el._rt = setTimeout(() => el.classList.remove('rolling'), dur + 60);
    };
  }
  // CSS del odómetro (se inyecta una vez): celdas de ancho fijo con cifras tabulares
  if (typeof document !== 'undefined' && !document.getElementById('odo-css')) {
    const st = document.createElement('style'); st.id = 'odo-css';
    st.textContent = '.odo{display:inline-flex;align-items:baseline;font-variant-numeric:tabular-nums lining-nums;font-feature-settings:"tnum" 1,"lnum" 1}' +
      '.odo-c{display:inline-block;overflow:hidden;height:1.02em;line-height:1.02em;vertical-align:baseline;text-align:center}' +
      '.odo-d{width:.62em}.odo-s{width:.34em}.odo-s.odo-cur{width:.66em}' +
      '.odo-in{display:flex;flex-direction:column;will-change:transform}.odo-v{display:block;height:1.02em;line-height:1.02em}';
    document.head.appendChild(st);
  }

  // ---- Confeti (canvas a pantalla completa, colores de la marca + de las cartas) ----
  const COLORS = ['#C9A24B', '#E6CE85', '#F6EFDD', '#B23A2E', '#3E8C63', '#2F7FC1', '#F2C14E', '#E86A9A'];
  let canvas = null, ctx = null, parts = [], running = false;
  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 });
    document.body.appendChild(canvas); ctx = canvas.getContext('2d');
  }
  function confetti(opts) {
    opts = opts || {};
    ensureCanvas();
    const W = canvas.width = canvas.offsetWidth || innerWidth, H = canvas.height = canvas.offsetHeight || innerHeight;
    const n = opts.count || 220, dur = opts.duration || 4200, t0 = performance.now();
    for (let i = 0; i < n; i++) {
      parts.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.4, w: 8 + Math.random() * 10, h: 5 + Math.random() * 6,
        c: COLORS[i % COLORS.length], vx: -1.2 + Math.random() * 2.4, vy: 2 + Math.random() * 3.5, rot: Math.random() * Math.PI, vr: -0.15 + Math.random() * 0.3, born: t0 + Math.random() * 900 });
    }
    if (running) return;
    running = true;
    (function loop(t) {
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      for (const p of parts) {
        if (t < p.born) { alive++; continue; }
        p.x += p.vx + Math.sin((t + p.rot * 100) / 300) * 0.8; p.y += p.vy; p.vy += 0.035; p.rot += p.vr;
        if (p.y < H + 30 && t - t0 < dur + 3000) alive++;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
        ctx.globalAlpha = Math.max(0, Math.min(1, 1 - (t - t0 - dur) / 1500));
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * (0.4 + 0.6 * Math.abs(Math.cos(p.rot)))); ctx.restore();
      }
      if (alive) requestAnimationFrame(loop); else { running = false; parts = []; ctx.clearRect(0, 0, W, H); }
    })(t0);
  }

  // ---- Sonido: voz del cantor (ogg por carta) + fanfarria sintetizada ----
  const SND = (typeof location !== 'undefined' && location.protocol !== 'file:') ? '../../../sounds/' : 'file:///F:/Proyectos/LoteriaLive/sounds/';
  let actx = null, unlocked = false, muted = false;
  function ac() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return actx; }
  // El navegador bloquea audio hasta la primera interacción: desbloqueamos en el primer click/toque.
  function unlock() { if (unlocked) return; unlocked = true; const a = ac(); if (a && a.state === 'suspended') a.resume(); }
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, unlock, { once: true, passive: true }));
  const cache = {};
  function play(file, vol, onfail) {
    if (muted) return null;
    try { const a = cache[file] || (cache[file] = new Audio(SND + file)); const node = a.cloneNode(); node.volume = vol == null ? 1 : vol; node.play().catch(() => { if (onfail) onfail(); }); return node; } catch (e) { if (onfail) onfail(); return null; }
  }
  // ¡Buenas!: música de fondo (BuenasBgm.ogg, 5.2 s) y encima la voz (Buenas.ogg, 1.75 s).
  // Si cae el pozo, la música se repite una vez más para alargar la celebración.
  let bgmNode = null;
  function buenas(big) {
    if (bgmNode) { try { bgmNode.pause(); } catch (e) {} bgmNode = null; }
    bgmNode = play('BuenasBgm.ogg', 0.85, () => fanfare(big));
    if (bgmNode && big) bgmNode.addEventListener('ended', () => { bgmNode = play('BuenasBgm.ogg', 0.7); }, { once: true });
    setTimeout(() => play('Buenas.ogg', 1), 350);
  }
  // Apertura: "¡Iniciamos!" (voz sintética, no hay archivo) y "¡corre y se va con…" (default_0.ogg)
  const sayStart = () => { try { if (muted || !('speechSynthesis' in window)) return; const u = new SpeechSynthesisUtterance('¡Iniciamos!'); u.lang = 'es-MX'; u.rate = 0.95; u.pitch = 1.05; const v = speechSynthesis.getVoices().find((x) => /es[-_](MX|US|419)/i.test(x.lang)) || speechSynthesis.getVoices().find((x) => /^es/i.test(x.lang)); if (v) u.voice = v; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {} };
  const sayCorre = () => play('baraja/default_0.ogg', 1);
  const beep = (hi) => { const a = ac(); if (!a) return; tone(hi ? 1320 : 880, a.currentTime, hi ? 0.35 : 0.12, 'square', 0.06); };
  const sayCard = (n) => { play('sacarCarta.ogg', 0.5); setTimeout(() => play('baraja/default_' + n + '.ogg', 1), 280); };
  function tone(f, t, dur, type, gain) { const a = ac(); if (!a || muted) return; const o = a.createOscillator(), g = a.createGain(); o.type = type || 'triangle'; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain || 0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05); }
  // Fanfarria "¡Buenas!": arpegio ascendente + acorde final con brillo
  function fanfare(big) {
    const a = ac(); if (!a) return; const t = a.currentTime + 0.02;
    const seq = [523, 659, 784, 1047]; seq.forEach((f, i) => tone(f, t + i * 0.11, 0.3, 'triangle', 0.22));
    [1047, 1319, 1568].forEach((f) => tone(f, t + 0.5, 1.1, 'triangle', 0.18));
    [523, 659, 784].forEach((f) => tone(f, t + 0.5, 1.3, 'sine', 0.12));
    if (big) { [1568, 2093, 2637].forEach((f, i) => tone(f, t + 1.2 + i * 0.09, 0.9, 'sine', 0.14)); tone(131, t + 0.5, 1.6, 'sawtooth', 0.08); }
  }
  const sad = () => { const a = ac(); if (!a) return; const t = a.currentTime + 0.02; tone(392, t, 0.28, 'sine', 0.12); tone(330, t + 0.22, 0.45, 'sine', 0.1); };
  const tick = () => { const a = ac(); if (!a) return; tone(880, a.currentTime, 0.06, 'square', 0.04); };
  // "cha-ching": arpegio corto de monedas (premio chico, cobros)
  const chaching = () => { const a = ac(); if (!a || muted) return; const t = a.currentTime + 0.02; [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, t + i * 0.07, 0.16, 'sine', 0.09)); tone(4186, t + 0.3, 0.55, 'triangle', 0.05); tone(2093, t + 0.34, 0.5, 'sine', 0.04); };
  function setMuted(m) { muted = !!m; }
  return { counter, confetti, sayCard, sayStart, sayCorre, beep, fanfare, buenas, sad, tick, chaching, setMuted, unlock };
})();
