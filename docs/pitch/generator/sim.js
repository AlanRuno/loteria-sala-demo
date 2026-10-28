// Simulación determinista y sincronizada de la sala, derivada del reloj.
// Todas las ventanas que carguen este archivo calculan el MISMO estado para el mismo instante,
// sin servidor: ronda = f(tiempo), orden de cartas = f(semilla de la ronda).
window.SIM = (function () {
  const EPOCH = Date.UTC(2026, 9, 24, 0, 0, 0);
  const LOBBY = 30, START = 5, INTERVAL = 2.8, CYCLE = 170, SHOW_WIN = 2.0;   // START: 3 s "¡Iniciamos!" + 2 s "¡corre y se va con…"
  const PRICE = 20, RAKE = 0.05, ACC = 0.05, JACK_BASE = 300000, JACK_MAX = 21, SMALL_PCT = 0.20;   // pozo: tabla llena en JACK_MAX cartas o menos (<22); SMALL_PCT del bote = premio chico (4 figuras)
  const NAMES = ["", "El gallo", "El diablito", "La dama", "El catrín", "El paraguas", "La sirena", "La escalera", "La botella", "El barril", "El árbol", "El melón", "El valiente", "El gorrito", "La muerte", "La pera", "La bandera", "El bandolón", "El violoncello", "La garza", "El pájaro", "La mano", "La bota", "La luna", "El cotorro", "El borracho", "El negrito", "El corazón", "La sandía", "El tambor", "El camarón", "Las jaras", "El músico", "La araña", "El soldado", "La estrella", "El cazo", "El mundo", "El apache", "El nopal", "El alacrán", "La rosa", "La calavera", "La campana", "El cantarito", "El venado", "El sol", "La corona", "La chalupa", "El pino", "El pescado", "La palma", "La maceta", "El arpa", "La rana"];
  const VERSES = ["", "El que le cantó a San Pedro no le volverá a cantar.", "Pórtate bien cuatito, si no te lleva el coloradito.", "Puliendo el paso, por toda la calle real.", "Don Ferruco en la alameda, su bastón quería tirar.", "Para el sol y para el agua.", "Con los cantos de sirena, no te vayas a marear.", "Súbeme paso a pasito, no quieras pegar brinquitos.", "La herramienta del borracho.", "Tanto bebió el albañil, que quedó como barril.", "El que a buen árbol se arrima, buena sombra le cobija.", "Me lo das o me lo quitas.", "¿Por qué le corres, cobarde, trayendo tan buen puñal?", "Ponle su gorrito al nene, no se nos vaya a resfriar.", "La muerte tilica y flaca.", "El que espera, desespera.", "Verde, blanco y colorado, la bandera del soldado.", "Tocando su bandolón, está el mariachi Simón.", "Creciendo se fue hasta el cielo, y como no fue violín, tuvo que ser violoncello.", "Al otro lado del río tengo mi banco de arena.", "Tú me traes a puros brincos, como pájaro en la rama.", "La mano de un criminal.", "Una bota igual que la otra.", "El farol de los enamorados.", "Cotorro, cotorro, saca la pata y empiézame a platicar.", "¡Ah, qué borracho tan necio! Ya no lo puedo aguantar.", "El que se comió el azúcar.", "No me extrañes, corazón, que regreso en el camión.", "La barriga que Juan tenía, era empacho de sandía.", "No te arrugues, cuero viejo, que te quiero pa' tambor.", "Camarón que se duerme, se lo lleva la corriente.", "Las jaras del indio Adán, donde pegan, dan.", "El músico trompas de hule, ya no me quiere tocar.", "Atarántamela a palos, no me la dejes llegar.", "Uno, dos y tres, el soldado p'al cuartel.", "La guía de los marineros.", "El caso que te hago es poco.", "Este mundo es una bola, y nosotros un bolón.", "¡Ah, Chihuahua! Cuánto apache con pantalón y huarache.", "Al nopal lo van a ver, nomás cuando tiene tunas.", "El que con la cola pica, le dan una paliza.", "Rosita, Rosaura, ven que te quiero ahora.", "Al pasar por el panteón, me encontré un calaverón.", "Tú con la campana y yo con tu hermana.", "Tanto va el cántaro al agua, que se quiebra y te moja las enaguas.", "Saltando va buscando, pero no ve nada.", "La cobija de los pobres.", "El sombrero de los reyes.", "Rema que rema Lupita, sentada en su chalupita.", "Fresco y oloroso, en todo tiempo hermoso.", "El que por la boca muere, aunque mudo fuere.", "Palmero, sube a la palma y bájame un coco real.", "El que nace pa' maceta, no sale del corredor.", "Arpa vieja de mi suegra, ya no sirves pa' tocar.", "Al ver a la verde rana, qué brinco pegó tu hermana."];
  const ALIASES = ["Rosa M.", "Lupita G.", "Miguel A.", "Carlos R.", "Ana P.", "Jorge L.", "Paty S.", "Beto H.", "Chayo V.", "Memo T."];

  function rng(seed) { let a = (seed * 2654435761) >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const deck = () => Array.from({ length: 54 }, (_, i) => i + 1);

  // ── Anuncios entre ventanas: cuando la terminal gana (chico o grande), todas las vistas terminan la partida en esa carta ──
  // Relé local sala-bus.cjs (SSE + POST, puerto 3999). Si no está corriendo, la terminal sigue funcionando sola.
  const BUS = "http://localhost:3999";
  // el relé es local: si la página viene de un servidor remoto (demo publicada) no se intenta siquiera
  const REMOTO = typeof location !== "undefined" && /^https?:$/.test(location.protocol) && !/^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(location.hostname);
  const NOBUS = REMOTO || (typeof window !== "undefined" && window.__LL_NOBUS) || (typeof location !== "undefined" && /[?&]nobus=1/.test(location.search));   // ?nobus=1: la vista no se conecta ni anuncia (pruebas)
  const OVS = {}, seen = new Set();
  function applyOverride(o) { if (!o || typeof o.round !== "number") return false; const id = JSON.stringify(o); if (seen.has(id)) return false; seen.add(id); OVS[o.round] = Object.assign({}, OVS[o.round] || {}, o); cache.delete(o.round); return true; }
  function announce(o) { applyOverride(o); try { if (typeof parent !== "undefined" && parent !== window) parent.postMessage({ __ll_announce: o }, "*"); } catch (e) {}
    if (NOBUS) return; try { if (typeof fetch === "function") fetch(BUS + "/announce", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) }).catch(() => {}); } catch (e) {} }
  // la página contenedora (sala 3D) reparte los anuncios entre todas las vistas embebidas
  try { if (typeof addEventListener === "function") addEventListener("message", (e) => { const d = e && e.data; if (d && d.__ll_announce) applyOverride(d.__ll_announce); }); } catch (e) {}
  try { if (!NOBUS && typeof EventSource !== "undefined") { const es = new EventSource(BUS + "/events"); es.onmessage = (e) => { try { applyOverride(JSON.parse(e.data)); } catch (err) {} }; es.addEventListener("snapshot", (e) => { try { const all = JSON.parse(e.data); Object.keys(all).forEach((k) => applyOverride(all[k])); } catch (err) {} }); es.onerror = () => {}; } } catch (e) {}

  const cache = new Map();
  function round(r) {
    if (cache.has(r)) return cache.get(r);
    const R = rng(r + 1);
    const order = shuffle(deck(), R);
    const jackRound = R() < 0.14;                          // demo: ~1 de cada 7 rondas cae el pozo (en la realidad con 18 cartas casi nunca pasaría)
    const k = jackRound ? 19 + Math.floor(R() * 3) : 28 + Math.floor(R() * 15);   // carta ganadora: 19-21 si cae el pozo; si no, entre la 28 y la 42
    const jackpotHit = k <= JACK_MAX;
    // premio chico: el primero con 4 figuras (línea, diagonal, cuadro chico o esquinas). Con cientos de tablas cae entre la carta 5 y la 10.
    const kSmall = 5 + Math.floor(R() * 5) + (R() < 0.3 ? 1 : 0);
    const smallOnline = R() < 0.25;
    const smallWinner = { online: smallOnline, alias: smallOnline ? "@" + ["pepe_mty", "lucha", "elguero", "karlita"][Math.floor(R() * 4)] : ALIASES[Math.floor(R() * ALIASES.length)], terminal: smallOnline ? null : 10 + Math.floor(R() * 290), pattern: ["línea", "línea", "cuadro chico", "diagonal", "esquinas"][Math.floor(R() * 5)] };
    const soldBase = 520 + Math.floor(R() * 90);
    const soldFinal = soldBase + 300 + Math.floor(R() * 120);
    // tabla ganadora: 15 cartas de las primeras k-1 + la carta k
    const pool = shuffle(order.slice(0, k - 1), R).slice(0, 15); pool.push(order[k - 1]);
    const winTabla = shuffle(pool, R);
    const isMe = false;   // la terminal T-117 es un jugador real: solo gana si la terminal lo anuncia (SIM.announce)
    const online = R() < 0.25;
    const winner = {
      isMe, online: !isMe && online,
      alias: isMe ? "María L." : (online ? "@" + ["jcarlos", "lau_mty", "elpollo", "marianita"][Math.floor(R() * 4)] : ALIASES[Math.floor(R() * ALIASES.length)]),
      terminal: isMe ? 117 : (online ? null : 10 + Math.floor(R() * 290)),
      folio: "F-" + (2300 + ((r * 7) % 900)),
    };
    // mis tablas (terminal 117)
    const t1 = isMe ? winTabla : shuffle(deck(), rng(r * 31 + 7)).slice(0, 16);
    const t2 = shuffle(deck(), rng(r * 53 + 11)).slice(0, 16);
    const out = { r, order, k, jackpotHit, kSmall, smallWinner, soldBase, soldFinal, winTabla, winner, myTablas: [t1, t2], players: { sala: 150 + Math.floor(R() * 60), online: 20 + Math.floor(R() * 30) }, active: 160 + Math.floor(R() * 40) };
    const ov = OVS[r];   // anuncio de una terminal: la partida termina en su carta y con su ganador
    if (ov && ov.big) { out.k = ov.big.k; out.jackpotHit = ov.big.k <= JACK_MAX; out.winner = Object.assign({}, out.winner, ov.big.winner); if (ov.big.cards) out.winTabla = ov.big.cards; }
    if (ov && ov.small) { out.kSmall = ov.small.k; out.smallWinner = Object.assign({}, out.smallWinner, ov.small.winner); }
    cache.set(r, out); return out;
  }
  const potOf = (rd, sold) => Math.round(sold * PRICE * (1 - RAKE - ACC));
  const smallOf = (pot) => Math.round(pot * SMALL_PCT), bigOf = (pot) => pot - smallOf(pot);   // el bote se parte: chico (4 figuras) y grande (tabla llena)
  const contrib = (rd) => Math.round(rd.soldFinal * PRICE * ACC);   // 5 % de las ventas de la ronda, y nada más

  // ?sim_t=<segundos dentro del ciclo> congela la simulación en ese instante (para capturas/QA)
  const FORCE = (typeof location !== "undefined" && new URLSearchParams(location.search).get("sim_t"));
  function state(now) {
    now = now || Date.now();
    let t = (now - EPOCH) / 1000;
    if (FORCE !== null && FORCE !== undefined && FORCE !== "") t = Math.floor(t / CYCLE) * CYCLE + Number(FORCE);
    const r = Math.floor(t / CYCLE);
    const tt = t - r * CYCLE;
    const rd = round(r);
    let phase, lobbyLeft = 0, drawnCount = 0;
    let startLeft = 0;
    if (tt < LOBBY) { phase = "lobby"; lobbyLeft = LOBBY - tt; }
    else if (tt < LOBBY + START) { phase = "start"; startLeft = LOBBY + START - tt; }
    else {
      drawnCount = Math.min(rd.k, Math.floor((tt - LOBBY - START) / INTERVAL) + 1);
      const winAt = LOBBY + START + (rd.k - 1) * INTERVAL;
      phase = (tt >= winAt + SHOW_WIN) ? "results" : "running";
    }
    const lobbyProgress = Math.min(1, tt / LOBBY);
    // Ventas: suben SEGUNDO a segundo durante la venta (escalonado por segundo, como marcador de casino).
    const sec = Math.floor(tt);
    const sold = phase === "lobby" ? Math.round(rd.soldBase + (rd.soldFinal - rd.soldBase) * Math.min(1, sec / LOBBY)) : rd.soldFinal;
    const pot = potOf(rd, sold);
    // Pozo acumulado: lo ganado desde el último golpe + lo de esta partida (5 % de las ventas de sala)
    // + la aportación de las salas/jugadores en línea de todo el país, que no se detiene: crece cada
    // segundo durante TODO el ciclo (venta, sorteo y resultados).
    // Histórico: TODAS las rondas cerradas desde el último golpe (la ronda r-1 incluida) — así el
    // pozo nunca retrocede al cambiar de ronda.
    let jackpot = JACK_BASE;
    for (let j = r - 1; j >= r - 80; j--) { const q = round(j); if (q.jackpotHit) break; jackpot += contrib(q); }
    // Aportación de esta ronda: EXACTAMENTE el 5 % (ACC) de lo vendido hasta ahora — sala y en línea
    // compran en la misma ventana de venta. Sube segundo a segundo mientras hay captación y se
    // congela al cerrar la venta: sin tablas vendidas no hay con qué alimentar el pozo (art. 128:
    // la participación se paga antes de iniciar). Nada entra "de la nada" durante el sorteo.
    const soldSoFar = phase === "lobby" ? Math.round(rd.soldFinal * Math.min(1, sec / LOBBY)) : rd.soldFinal;
    const curContrib = Math.round(soldSoFar * PRICE * ACC);
    const jackpotShown = jackpot + curContrib;
    const drawn = rd.order.slice(0, drawnCount);
    const recent = [];
    for (let j = r - 1; j >= r - 4; j--) { const q = round(j); recent.push({ round: 4800 + j, k: q.k, amount: bigOf(potOf(q, q.soldFinal)), winner: q.winner, jackpotHit: q.jackpotHit }); }
    return {
      round: r, roundNo: 4800 + r, phase, tt, lobbyLeft, startLeft, nextIn: CYCLE - tt, drawnCount, drawn, k: rd.k, lastCard: drawn[drawn.length - 1] || 0,
      sold, pot, jackpot: jackpotShown, jackpotHit: rd.jackpotHit, jackpotWon: phase === "results" && rd.jackpotHit,
      small: smallOf(pot), big: bigOf(pot), kSmall: rd.kSmall, smallWinner: rd.smallWinner, smallDone: (phase === "running" || phase === "results") && drawnCount >= rd.kSmall,
      winner: { ...rd.winner, amount: bigOf(pot) }, myTablas: rd.myTablas, myWin: rd.winner.isMe, players: rd.players, active: rd.active,
      recent, LOBBY, START, INTERVAL,
    };
  }
  const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
  const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
  // base de recursos: relativa si la pagina se sirve por HTTP (sala 3D), absoluta si se abre como archivo
  const ASSETS = (typeof location !== "undefined" && location.protocol !== "file:") ? "../../../public/assets/" : "file:///F:/Proyectos/LoteriaLive/public/assets/";
  const card = (n) => ASSETS + "cards/" + n + ".png";
  const back = () => ASSETS + "cards/back.png";
  const bean = (i) => ASSETS + "beans/bean" + (1 + (i % 2)) + ".png";
  // tween numérico suave para los contadores de dinero
  function tweener(el, fmt) { let cur = null, target = null; return function (v) { target = v; if (cur === null) { cur = v; el.textContent = fmt(cur); return; } const step = () => { if (cur === target) return; cur += (target - cur) * 0.18; if (Math.abs(target - cur) < 1) cur = target; el.textContent = fmt(cur); if (cur !== target) requestAnimationFrame(step); }; requestAnimationFrame(step); }; }
  return { state, round, money, mmss, card, back, bean, NAMES, VERSES, tweener, announce, LOBBY, START, INTERVAL, CYCLE, PRICE, JACK_MAX, SMALL_PCT };
})();
