(() => {
  'use strict';

  const PLACES = window.XIAN_PLACES || [];
  const BASE = window.XIAN_I18N;
  const TXT = window.ISLAND_I18N;
  const LANGS = ['en', 'zh'];
  const LANG_KEY = 'xian-lang';
  const FAV_KEY = 'xian-fav';
  const INTRO_KEY = 'xian-island-intro';
  const INK = '#2d2a32';
  const TAU = Math.PI * 2;
  const FONT = "Fredoka, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', sans-serif";
  const EMOJI_FONT = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => innerWidth <= 820;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  /* ================= language ================= */
  function detectLang() {
    const u = new URLSearchParams(location.search).get('lang');
    if (LANGS.includes(u)) return u;
    try { const s = localStorage.getItem(LANG_KEY); if (LANGS.includes(s)) return s; } catch (e) { /* ignore */ }
    return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }
  let lang = detectLang();
  const tx = (k) => { const v = TXT[lang][k]; return v === undefined ? TXT.en[k] : v; };
  const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => (o[k] === undefined ? '' : o[k]));
  const placeText = (p, f) => (lang === 'zh' && BASE.places.zh[p.id] && BASE.places.zh[p.id][f]) || p[f];
  const nameOf = (p) => (lang === 'zh' ? p.zh : p.name);
  const subOf = (p) => (lang === 'zh' ? p.name : p.zh);
  const typeLabel = (p) => tx(p.type === 'food' ? 'food' : 'sight');

  /* ================= colour helpers ================= */
  const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const colorMemo = new Map();
  function shade(c, t) {
    const key = c + '|' + t;
    let v = colorMemo.get(key);
    if (!v) {
      const A = hex2rgb(c); const target = t < 0 ? 0 : 255; const a = Math.abs(t);
      v = `rgb(${A.map((x) => Math.round(x + (target - x) * a)).join(',')})`;
      colorMemo.set(key, v);
    }
    return v;
  }
  const mix = (a, b, t) => { const A = hex2rgb(a); const B = hex2rgb(b); return `rgb(${A.map((x, i) => Math.round(x + (B[i] - x) * t)).join(',')})`; };

  /* ================= world data ================= */
  const ISLANDS = {
    core:   { c: '#e8503a', x: 0,    y: 0,    r: 165, center: 'belltower', ids: ['belltower', 'drumtower', 'citywall', 'beilin'], wall: true },
    muslim: { c: '#3fb68b', x: -470, y: -20,  r: 215, center: 'muslimquarter', ids: ['muslimquarter', 'mosque', 'roujiamo', 'skewers', 'baozi', 'persimmon', 'zengao', 'paomo', 'biangbiang', 'liangpi'] },
    tang:   { c: '#ffc93c', x: 30,   y: 410,  r: 150, center: 'biggoose', ids: ['biggoose', 'smallgoose', 'everbright', 'tangparadise', 'museum'] },
    daming: { c: '#7ccbf5', x: 150,  y: -370, r: 95,  center: 'daming', ids: ['daming'] },
    trip:   { c: '#ff9ebb', x: 500,  y: 40,   r: 110, ids: ['terracotta', 'huaqing'] },
  };
  const ORDER = ['core', 'muslim', 'tang', 'daming', 'trip'];
  const ADJ = { core: ['muslim', 'tang', 'daming', 'trip'], muslim: ['core'], tang: ['core'], daming: ['core'], trip: ['core'] };
  const BRIDGES = [['core', 'muslim'], ['core', 'tang'], ['core', 'daming'], ['core', 'trip']];

  const KIND = {
    belltower:     { k: 'tower', roof: '#3f8f9a' },
    drumtower:     { k: 'tower', roof: '#8a6f64' },
    citywall:      { k: 'gate' },
    beilin:        { k: 'hall', roof: '#7d8a96' },
    muslimquarter: { k: 'paifang', roof: '#3fb68b' },
    mosque:        { k: 'hall', roof: '#3fb68b', wall: '#f5ecd2' },
    smallgoose:    { k: 'pagoda', tiers: 5 },
    biggoose:      { k: 'pagoda', tiers: 7 },
    museum:        { k: 'hall', roof: '#8a6f64' },
    everbright:    { k: 'paifang', roof: '#e8a02e' },
    tangparadise:  { k: 'hall', roof: '#e8a02e' },
    daming:        { k: 'hall', roof: '#8a8f98', big: true },
    terracotta:    { k: 'army' },
    huaqing:       { k: 'hall', roof: '#c0532f' },
  };
  const WALLS = ['#fff1d6', '#ffe9c9', '#fde2e4', '#e3f4ec', '#e6f1fb', '#fff6c9'];

  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  const buildings = [];
  const bById = new Map();
  ORDER.forEach((key) => {
    const d = ISLANDS[key];
    d.key = key;
    const ps = d.ids.map((id) => PLACES.find((p) => p.id === id)).filter(Boolean);
    d.count = ps.length;
    const ring = ps.filter((p) => p.id !== d.center);
    const n = ring.length;
    const two = n > 6; // crowded islands get an inner and an outer ring
    ps.forEach((p) => {
      let x = d.x; let y = d.y;
      const j = ring.indexOf(p);
      if (j >= 0) {
        const outer = two ? j % 2 === 0 : true; const m = two ? Math.ceil(n / 2) : n; const jj = two ? Math.floor(j / 2) : j;
        const cnt = two ? (outer ? m : n - m) : n;
        const rad = d.r * (two ? (outer ? 0.7 : 0.38) : n <= 2 ? 0.42 : 0.62);
        const a = n === 2 ? (j ? 0 : Math.PI) : (jj / cnt) * TAU - Math.PI / 2 + (two && !outer ? Math.PI / cnt : 0);
        x += Math.cos(a) * rad; y += Math.sin(a) * rad * 0.9;
      }
      const kind = KIND[p.id] || { k: 'shop' };
      const idx = PLACES.indexOf(p);
      const b = { p, id: p.id, island: key, x, y, kind, idx, hit: null };
      if (kind.k === 'shop') { b.h = 24 + ((idx * 37) % 5) * 5; b.w = 50; b.hh = b.h + 22; }
      else if (kind.k === 'pagoda') { b.w = 56; b.hh = 12 + kind.tiers * 13 + 16; }
      else if (kind.k === 'tower') { b.w = 80; b.hh = 92; }
      else if (kind.k === 'gate') { b.w = 78; b.hh = 62; }
      else if (kind.k === 'paifang') { b.w = 72; b.hh = 56; }
      else if (kind.k === 'army') { b.w = 64; b.hh = 40; }
      else { b.w = kind.big ? 84 : 72; b.hh = kind.big ? 62 : 54; }
      b.wall = kind.wall || WALLS[idx % WALLS.length];
      buildings.push(b); bById.set(p.id, b);
    });
  });

  // trees
  const trees = [];
  ORDER.forEach((key) => {
    const d = ISLANDS[key];
    const count = Math.round(d.r / 7);
    let tries = 0;
    while (trees.length < 400 && tries < count * 8 && trees.filter((t) => t.k === key).length < count) {
      tries++;
      const a = rnd() * TAU; const rr = d.r * (0.55 + rnd() * 0.33);
      const x = d.x + Math.cos(a) * rr; const y = d.y + Math.sin(a) * rr * 0.86;
      if (buildings.some((b) => Math.hypot(b.x - x, (b.y - y) * 1.3) < 38)) continue;
      trees.push({ x, y, k: key, s: 0.75 + rnd() * 0.5, c: rnd() });
    }
  });

  // lanterns along the bridges
  const lamps = [];
  BRIDGES.forEach(([a, b]) => {
    const A = ISLANDS[a]; const B = ISLANDS[b];
    const dx = B.x - A.x; const dy = B.y - A.y; const L = Math.hypot(dx, dy);
    const ux = dx / L; const uy = dy / L;
    const s0 = A.r * 0.95 + 12; const s1 = L - B.r * 0.95 - 12;
    const n = Math.max(2, Math.round((s1 - s0) / 45));
    for (let i = 0; i < n; i++) {
      const s = s0 + ((s1 - s0) * (i + 0.5)) / n;
      lamps.push({ x: A.x + ux * s - uy * 16, y: A.y + uy * s + ux * 16 });
    }
  });

  const islets = [];
  for (let t = 0, tries = 0; t < 10 && tries < 200; tries++) {
    const a = rnd() * TAU; const rr = 560 + rnd() * 330;
    const x = Math.cos(a) * rr * 1.15; const y = Math.sin(a) * rr * 0.8; const r = 26 + rnd() * 34;
    if (ORDER.some((k) => Math.hypot(ISLANDS[k].x - x, (ISLANDS[k].y - y) * 1.2) < ISLANDS[k].r + r + 50)) continue;
    islets.push({ x, y, r, c: rnd() }); t++;
  }
  const boats = [0, 1, 2, 3, 4].map((i) => ({ a: rnd() * TAU, v: (0.0006 + rnd() * 0.0007) * (i % 2 ? -1 : 1), c: ['#e8503a', '#ffffff', '#ffc93c'][i % 3], rx: 780 + i * 22, ry: 590 + i * 14 }));
  const clouds = Array.from({ length: 7 }, () => ({ x: rnd() * 1800 - 900, y: rnd() * 1300 - 650, s: 0.6 + rnd() * 0.8, v: 6 + rnd() * 8 }));
  const waves = Array.from({ length: 160 }, () => ({ x: rnd() * 2000 - 1000, y: rnd() * 1500 - 750, ph: rnd() * TAU, s: 0.7 + rnd() * 0.7 }));

  /* ================= people ================= */
  const SHIRT = ['#ff8a5c', '#5b9bd5', '#ffd166', '#5cc8b0', '#ffffff', '#b48ad8', '#ff7aa2', '#7ccf6e'];
  const HAIR = ['#3b2a20', '#5a3d2b', '#2b2b3a', '#8a5a3c', '#c98f4e'];
  const people = [];
  const hubPoint = (key) => { const d = ISLANDS[key]; return [d.x + (rnd() - 0.5) * 36, d.y + d.r * 0.3 + (rnd() - 0.5) * 16]; };
  function islandPath(a, b) {
    if (a === b) return [];
    const prev = { [a]: null }; const q = [a];
    while (q.length) { const c = q.shift(); if (c === b) break; ADJ[c].forEach((n) => { if (!(n in prev)) { prev[n] = c; q.push(n); } }); }
    const r = []; let c = b; while (c !== a) { r.unshift(c); c = prev[c]; } return r;
  }
  function route(p, dest, x, y) {
    const pts = [];
    if (p.isl !== dest) { pts.push(hubPoint(p.isl)); islandPath(p.isl, dest).forEach((k) => pts.push(hubPoint(k))); }
    pts.push([x, y]);
    p.path = pts; p.destIsl = dest;
  }
  function goPlace(p, bi) {
    const b = buildings[bi]; p.to = bi; p.target = 'place';
    route(p, b.island, b.x + (Math.random() - 0.5) * 24, b.y + 16 + Math.random() * 8);
  }
  const personName = (p) => (p.owner ? tx('emperorName') : tx('names')[p.nameIdx % 20] + (p.nameIdx >= 20 ? '²' : ''));
  const targetName = (p) => (p.to !== undefined ? nameOf(buildings[p.to].p) : '');

  for (let i = 0; i < 26; i++) {
    const bi = Math.floor(rnd() * buildings.length); const b = buildings[bi];
    const p = {
      id: i, nameIdx: i, x: b.x + (rnd() - 0.5) * 30, y: b.y + 18, isl: b.island,
      shirt: SHIRT[i % 8], hair: HAIR[i % 5], style: i % 4, v: 30 + rnd() * 18, k: 1,
      wait: rnd() * 6, ph: rnd() * 6, face: 1, say: '', sayT: 0, cool: rnd() * 6, path: [], moving: false, eatEmoji: '', eatT: 0, replyAt: 0, replyTxt: '',
    };
    goPlace(p, Math.floor(rnd() * buildings.length));
    people.push(p);
  }
  const emperor = {
    id: 99, owner: true, nameIdx: 0, x: ISLANDS.core.x, y: ISLANDS.core.y + 50, isl: 'core', shirt: '#ffc93c', hair: '#2b2b3a', style: 4, v: 34, k: 1.35,
    wait: 3, ph: 0, face: 1, say: '', sayT: 0, cool: 10, path: [], moving: false, eatEmoji: '', eatT: 0, decT: 12, replyAt: 0, replyTxt: '',
  };
  people.push(emperor);

  const fx = [];
  function heart(p, ch) { for (let i = 0; i < 3; i++) fx.push({ x: p.x + (Math.random() - 0.5) * 14, y: p.y, z: 26, vz: 22 + Math.random() * 16, life: 1.4, ch: ch || '💛' }); }
  function say(p, text, dur) { p.say = text; p.sayT = dur || 5; }

  /* ================= journal ================= */
  const logsEl = $('logs');
  let lastLogAt = 0;
  function addLog(html, cls, force) {
    const now = performance.now();
    if (!force && now - lastLogAt < 900) return;
    lastLogAt = now;
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.innerHTML = html;
    logsEl.prepend(d);
    while (logsEl.children.length > 40) logsEl.lastChild.remove();
  }

  function decree() {
    const r = Math.random(); const b = pick(buildings); let text;
    if (r < 0.45) { const foods = buildings.filter((x) => x.p.type === 'food'); text = fill(pick(tx('declFood')), { s: nameOf(pick(foods).p) }); }
    else if (r < 0.75) { const sights = buildings.filter((x) => x.p.type === 'sight'); text = fill(pick(tx('declSight')), { s: nameOf(pick(sights).p) }); }
    else text = pick(tx('declGen'));
    void b;
    say(emperor, text, 7);
    $('decreeTx').textContent = text;
    addLog(fill(tx('logDecree'), { t: esc(text) }), 'own', true);
  }

  function arrive(p) {
    p.isl = p.destIsl;
    if (p.target === 'place') {
      const b = buildings[p.to];
      p.wait = 4 + Math.random() * 6;
      const isFood = b.p.type === 'food';
      say(p, fill(pick(tx(isFood ? 'eatFood' : 'seeSight')), { s: nameOf(b.p) }), 4);
      heart(p, isFood ? '💛' : '✨');
      p.eatEmoji = b.p.emoji; p.eatT = p.wait * 0.8;
      if (p.owner || Math.random() < 0.4) addLog(fill(tx(isFood ? 'logEat' : 'logSee'), { n: esc(personName(p)), s: esc(nameOf(b.p)), e: b.p.emoji }));
    } else p.wait = 2 + Math.random() * 3;
  }
  function nextTarget(p) {
    if (p.owner) {
      if (Math.random() < 0.7) goPlace(p, Math.floor(Math.random() * buildings.length));
      else { const k = pick(ORDER); const d = ISLANDS[k]; const a = Math.random() * TAU; const rr = Math.sqrt(Math.random()) * d.r * 0.5; p.target = 'spot'; p.to = undefined; route(p, k, d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr * 0.8); }
    } else {
      let n; do { n = Math.floor(Math.random() * buildings.length); } while (n === p.to);
      goPlace(p, n);
    }
  }

  function updatePeople(dt, time) {
    for (const p of people) {
      if (p.sayT > 0) p.sayT -= dt;
      if (p.eatT > 0) p.eatT -= dt;
      if (p.cool > 0) p.cool -= dt;
      if (p.replyAt && time > p.replyAt) { say(p, p.replyTxt, 4); p.replyAt = 0; }
      if (p.wait > 0) { p.wait -= dt; p.moving = false; if (p.wait <= 0) nextTarget(p); continue; }
      if (!p.path.length) { nextTarget(p); continue; }
      const [tx_, ty_] = p.path[0];
      const dx = tx_ - p.x; const dy = ty_ - p.y; const d = Math.hypot(dx, dy); const step = p.v * dt;
      if (d <= step) { p.x = tx_; p.y = ty_; p.path.shift(); p.moving = false; if (!p.path.length) arrive(p); }
      else {
        p.x += (dx / d) * step; p.y += (dy / d) * step;
        if (Math.abs(dx) > 0.2) p.face = dx > 0 ? 1 : -1;
        p.ph += dt * 9 * (p.v / 40); p.moving = true;
      }
    }
    emperor.decT -= dt;
    if (emperor.decT <= 0) { decree(); emperor.decT = 20 + Math.random() * 14; }
    for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.life -= dt; f.z += f.vz * dt; if (f.life <= 0) fx.splice(i, 1); }
  }
  let chatClock = 0;
  function chatter(time) {
    for (let i = 0; i < people.length; i++) {
      const a = people[i]; if (a.cool > 0 || a.sayT > 0) continue;
      for (let j = i + 1; j < people.length; j++) {
        const b = people[j]; if (b.cool > 0 || b.sayT > 0) continue;
        if (Math.hypot(a.x - b.x, (a.y - b.y) * 1.4) < 24 && Math.random() < 0.4) {
          const place = nameOf(pick(buildings).p);
          say(a, fill(pick(tx('greet')), { n: personName(b), s: place }), 4.5);
          b.replyAt = time + 1.6; b.replyTxt = fill(pick(tx('reply')), { s: place });
          a.cool = b.cool = 14; a.wait = Math.max(a.wait, 3.5); b.wait = Math.max(b.wait, 3.5); a.moving = b.moving = false;
          addLog(fill(tx('logChat'), { n: esc(personName(a)), m: esc(personName(b)) }));
          break;
        }
      }
    }
  }

  /* ================= canvas / camera ================= */
  const cv = $('cv'); const g = cv.getContext('2d');
  let W = 0; let H = 0; let DPR = 1;
  function resize() {
    DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
  }
  const cam = { x: 0, y: 30, z: 0.6, tx: 0, ty: 30, tz: 0.6, tilt: 0.58, ttilt: 0.58 };
  let bird = false;
  const sx = (x) => (x - cam.x) * cam.z + W / 2;
  const sy = (y, z) => (y - cam.y) * cam.z * cam.tilt + H / 2 - (z || 0) * cam.z;

  function fitAll() { // whole world
    const z = isMobile() ? Math.min(W / 1400, H / (1030 * cam.ttilt + 420)) : Math.min(W / 1400, H / (1030 * cam.ttilt + 190));
    cam.tz = clamp(z, 0.2, 1.3); cam.tx = 0; cam.ty = 40;
  }
  function fitStart() {
    if (isMobile()) { cam.tz = clamp(Math.min(W / 760, H / 620), 0.3, 1); cam.tx = -90; cam.ty = 30; }
    else fitAll();
  }
  let follow = null; let emperorMode = false;
  function flyTo(x, y, z) { cam.tx = x; cam.ty = y; if (z) cam.tz = Math.max(cam.tz, z); follow = null; refreshFollow(); }

  function zoomAt(px, py, f) {
    const wx = (px - W / 2) / cam.z + cam.x; const wy = (py - H / 2) / (cam.z * cam.tilt) + cam.y;
    const nz = clamp(cam.z * f, 0.2, 3);
    cam.z = cam.tz = nz;
    cam.x = cam.tx = wx - (px - W / 2) / nz; cam.y = cam.ty = wy - (py - H / 2) / (nz * cam.tilt);
  }

  /* ---------- drawing helpers ---------- */
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function box(x, y, w, h, c, r) { rr(x, y, w, h, r || 0); g.fillStyle = c; g.fill(); g.stroke(); }
  function poly(pts, c) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fillStyle = c; g.fill(); g.stroke(); }
  function ell(x, y, rx, ry, c, stroke) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fillStyle = c; g.fill(); if (stroke) g.stroke(); }
  function emoji(ch, x, y, size) { g.font = `${size}px ${EMOJI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK; g.fillText(ch, x, y); }
  function onScreen(x, y, m) { return x > -m && x < W + m && y > -m && y < H + m; }
  function hexPath(cx, cy, r, dy) {
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * TAU) / 6; const X = sx(cx + Math.cos(a) * r); const Y = sy(cy + Math.sin(a) * r) + (dy || 0) * cam.z;
      if (i) g.lineTo(X, Y); else g.moveTo(X, Y);
    }
    g.closePath();
  }

  /* ---------- environment (time of day) ---------- */
  const TOD = [{ m: [255, 212, 186], n: 0.15 }, { m: [255, 255, 255], n: 0 }, { m: [255, 168, 124], n: 0.35 }, { m: [92, 110, 190], n: 1 }];
  const env = { m: [255, 255, 255], n: 0 };
  let todIdx = 1; let autoTod = false; let autoClock = 0;
  function updateEnv(dt) {
    const T = TOD[todIdx]; const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 2.5);
    for (let i = 0; i < 3; i++) env.m[i] += (T.m[i] - env.m[i]) * k;
    env.n += (T.n - env.n) * k;
    if (autoTod && !reduceMotion) { autoClock += dt; if (autoClock > 12) { autoClock = 0; todIdx = (todIdx + 1) % 4; syncTodButtons(); } }
  }

  /* ---------- buildings ---------- */
  let lw = 2;
  const lights = [];
  function roofShape(y, wBot, wTop, h, color) {
    const hb = wBot / 2; const ht = wTop / 2;
    poly([[-hb, y], [hb, y], [ht, y - h], [-ht, y - h]], color);
    // upturned eaves
    g.beginPath(); g.moveTo(-hb, y); g.quadraticCurveTo(-hb - 3, y - 2, -hb - 6, y - 7); g.quadraticCurveTo(-hb + 3, y - 4, -hb + 6, y - 3); g.closePath(); g.fillStyle = color; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(hb, y); g.quadraticCurveTo(hb + 3, y - 2, hb + 6, y - 7); g.quadraticCurveTo(hb - 3, y - 4, hb - 6, y - 3); g.closePath(); g.fillStyle = color; g.fill(); g.stroke();
    // tile lines
    g.save(); g.globalAlpha = 0.28; g.beginPath();
    for (let x = -hb + 7; x < hb - 3; x += 7) { const f = x / hb; g.moveTo(x, y - 1); g.lineTo(f * ht, y - h + 1); }
    g.stroke(); g.restore();
  }
  function drawShop(b, night) {
    const w = 36; const h = b.h; const d = 10;
    const island = ISLANDS[b.island]; const roof = shade(island.c, -0.22); const roofSide = shade(island.c, -0.36);
    ell(5, 2, 28, 7, 'rgba(0,0,0,.18)');
    box(-w / 2, -h, w, h, b.wall);
    poly([[w / 2, 0], [w / 2 + d, -5], [w / 2 + d, -h - 5], [w / 2, -h]], shade(b.wall, -0.2));
    // roof (front + side)
    poly([[w / 2 + 5, -h + 1], [w / 2 + d + 5, -h - 4], [w / 2 + d - 5, -h - 19], [w / 2 - 5, -h - 14]], roofSide);
    poly([[-w / 2 - 5, -h + 1], [w / 2 + 5, -h + 1], [w / 2 - 5, -h - 14], [-w / 2 + 5, -h - 14]], roof);
    // awning stripes
    const sw = w / 6;
    for (let i = 0; i < 6; i++) box(-w / 2 + i * sw, -h + 1, sw, 8, i % 2 ? '#ffffff' : island.c);
    // sign
    box(-12, -h / 2 - 7, 24, 20, night ? '#ffe9a8' : '#ffffff', 5);
    emoji(b.p.emoji, 0, -h / 2 + 3, 15);
    if (night > 0.2) lights.push([0, -h / 2 + 3, 30, '255,200,110']);
  }
  function drawPagoda(b) {
    const n = b.kind.tiers; ell(4, 2, 34, 8, 'rgba(0,0,0,.18)');
    box(-28, -6, 56, 6, '#d8d0bf');
    let y = -6; const wall = '#e2b98a'; const trim = '#a8764a';
    for (let i = 0; i < n; i++) {
      const wb = 38 - (i * 22) / n; const wt = wb - 3; const th = 11;
      poly([[-wb / 2, y], [wb / 2, y], [wt / 2, y - th], [-wt / 2, y - th]], wall);
      poly([[wb / 2 - 7, y], [wb / 2, y], [wt / 2, y - th], [wt / 2 - 6, y - th]], shade(wall, -0.18));
      box(-2.5, y - 8, 5, 6, '#5b4a3c', 2);
      poly([[-wb / 2 - 4, y - th], [wb / 2 + 4, y - th], [wb / 2 - 1, y - th - 4], [-wb / 2 + 1, y - th - 4]], trim);
      y -= th + 3;
    }
    g.beginPath(); g.moveTo(0, y + 3); g.lineTo(0, y - 10); g.stroke();
    g.beginPath(); g.arc(0, y - 12, 3, 0, TAU); g.fillStyle = '#ffc93c'; g.fill(); g.stroke();
  }
  function drawTower(b, night) {
    ell(6, 2, 46, 9, 'rgba(0,0,0,.18)');
    box(-30, -22, 60, 22, '#cfc7b6');
    poly([[30, 0], [40, -6], [40, -28], [30, -22]], '#a9a190');
    g.beginPath(); g.moveTo(-9, 0); g.lineTo(-9, -11); g.quadraticCurveTo(0, -24, 9, -11); g.lineTo(9, 0); g.closePath(); g.fillStyle = '#4a3b30'; g.fill(); g.stroke();
    box(-23, -42, 46, 20, '#c8553d');
    for (let x = -17; x <= 17; x += 11.5) { g.beginPath(); g.moveTo(x, -42); g.lineTo(x, -22); g.stroke(); }
    box(-5, -38, 10, 12, night > 0.2 ? '#ffd873' : '#7a2f20', 3);
    roofShape(-42, 80, 54, 13, b.kind.roof);
    box(-13, -66, 26, 12, '#c8553d');
    roofShape(-66, 54, 30, 13, b.kind.roof);
    g.beginPath(); g.moveTo(0, -79); g.lineTo(0, -88); g.stroke();
    g.beginPath(); g.arc(0, -90, 3.5, 0, TAU); g.fillStyle = '#ffc93c'; g.fill(); g.stroke();
    if (night > 0.2) lights.push([0, -32, 40, '255,190,90']);
  }
  function drawGate(b, night) {
    ell(6, 2, 46, 9, 'rgba(0,0,0,.18)');
    box(-36, -26, 72, 26, '#cbc3ae');
    poly([[36, 0], [46, -6], [46, -32], [36, -26]], '#a39b86');
    for (let i = 0; i < 9; i++) box(-36 + i * 8, -31, 5, 5, '#cbc3ae');
    g.beginPath(); g.moveTo(-10, 0); g.lineTo(-10, -14); g.quadraticCurveTo(0, -28, 10, -14); g.lineTo(10, 0); g.closePath(); g.fillStyle = '#4a3b30'; g.fill(); g.stroke();
    box(-17, -44, 34, 13, '#c8553d');
    box(-4, -41, 8, 8, night > 0.2 ? '#ffd873' : '#7a2f20', 2);
    roofShape(-44, 50, 28, 13, '#5c6670');
    g.beginPath(); g.moveTo(0, -57); g.lineTo(0, -66); g.stroke();
    poly([[0, -66], [11, -62], [0, -58]], '#e8503a');
    if (night > 0.2) lights.push([0, -14, 34, '255,190,90']);
  }
  function drawHall(b, night) {
    const big = b.kind.big; const s = big ? 1.15 : 1;
    ell(6, 2, 42 * s, 8, 'rgba(0,0,0,.18)');
    box(-36 * s, -6, 72 * s, 6, '#d8d0bf');
    box(-30 * s, -28, 60 * s, 22, b.kind.wall || '#f3e3c2');
    poly([[30 * s, -6], [38 * s, -11], [38 * s, -33], [30 * s, -28]], shade(b.kind.wall || '#f3e3c2', -0.2));
    g.save(); g.lineWidth = lw * 2; g.strokeStyle = '#c8553d';
    for (let x = -24 * s; x <= 24 * s; x += 16 * s) { g.beginPath(); g.moveTo(x, -28); g.lineTo(x, -6); g.stroke(); }
    g.restore();
    box(-6, -22, 12, 16, night > 0.2 ? '#ffd873' : '#5b4a3c', 3);
    roofShape(-28, 78 * s, 46 * s, 20, b.kind.roof);
    box(-8, -52, 16, 5, shade(b.kind.roof, -0.2));
    if (night > 0.2) lights.push([0, -14, 38, '255,190,90']);
  }
  function drawPaifang(b, night) {
    ell(4, 2, 40, 7, 'rgba(0,0,0,.18)');
    box(-31, -34, 6, 34, '#c8553d'); box(25, -34, 6, 34, '#c8553d');
    box(-12, -30, 4, 30, '#c8553d'); box(8, -30, 4, 30, '#c8553d');
    box(-32, -42, 64, 12, '#fff1d6', 3);
    emoji(b.p.emoji, 0, -35, 12);
    roofShape(-42, 76, 54, 10, b.kind.roof);
    if (night > 0.2) lights.push([0, -34, 36, '255,190,90']);
  }
  function drawArmy() {
    ell(4, 2, 42, 11, '#b88a5a', true); ell(4, 0, 34, 8, '#9c7348');
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
      const x = -22 + c * 11 + (r % 2) * 5; const y = -7 + r * 5;
      box(x - 2.5, y - 8, 5, 8, '#d9a273', 1.5); ell(x, y - 10, 2.8, 2.8, '#e5b385', true);
    }
    g.beginPath(); g.moveTo(34, 0); g.lineTo(34, -26); g.stroke(); poly([[34, -26], [46, -22], [34, -17]], '#e8503a');
  }
  function drawBuilding(b) {
    const X = sx(b.x); const Y = sy(b.y + 6);
    if (!onScreen(X, Y, 130 * cam.z)) { b.hit = null; return; }
    const k = cam.z; lw = Math.max(1.3 / k, 2);
    g.save(); g.translate(X, Y); g.scale(k, k);
    g.lineWidth = lw; g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = INK;
    const night = env.n; const hl = (selId === b.id) ? 1 : 0;
    switch (b.kind.k) {
      case 'shop': drawShop(b, night); break;
      case 'pagoda': drawPagoda(b); break;
      case 'tower': drawTower(b, night); break;
      case 'gate': drawGate(b, night); break;
      case 'paifang': drawPaifang(b, night); break;
      case 'army': drawArmy(); break;
      default: drawHall(b, night);
    }
    if (b.p.type === 'sight') { // emoji badge floating above landmarks
      const by = -b.hh - 12 + Math.sin(time * 2 + b.idx) * 1.5;
      g.beginPath(); g.arc(0, by, 11, 0, TAU); g.fillStyle = '#fffdf6'; g.fill(); g.stroke(); emoji(b.p.emoji, 0, by + 1, 13);
    }
    if (hl) { g.globalAlpha = 0.9; g.strokeStyle = '#ffc93c'; g.lineWidth = 4; g.beginPath(); g.ellipse(4, 3, b.w * 0.62, 11 + Math.sin(time * 5) * 1.2, 0, 0, TAU); g.stroke(); }
    g.restore();
    for (const L of lights) { L.X = X; L.Y = Y; }
    b.hit = { x: X - (b.w / 2) * k, y: Y - b.hh * k - 8 * k, w: b.w * k, h: (b.hh + 14) * k };
    flushLights(X, Y, k);
  }
  function flushLights(X, Y, k) {
    for (const L of lights) litList.push([X + L[0] * k, Y + L[1] * k, L[2] * k, L[3]]);
    lights.length = 0;
  }
  const litList = [];

  /* ---------- trees, lamps, people ---------- */
  function drawTree(t) {
    const X = sx(t.x); const Y = sy(t.y); if (!onScreen(X, Y, 50)) return;
    const k = cam.z * t.s; g.save(); g.translate(X, Y); g.scale(k, k);
    g.lineWidth = Math.max(1.2 / k, 1.8); g.strokeStyle = INK; g.lineJoin = 'round';
    ell(2, 1, 11, 4, 'rgba(0,0,0,.16)');
    box(-2.2, -11, 4.4, 11, '#8a5a32');
    const col = t.c < 0.55 ? '#6cc070' : t.c < 0.78 ? '#4fae6b' : t.c < 0.9 ? '#ffb3c7' : '#ffa23c';
    ell(0, -20, 11, 10, col, true); ell(-5, -17, 6, 5.5, shade(col, 0.25));
    if (t.c >= 0.9) { g.fillStyle = '#e8503a'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-5 + i * 3.5, -17 + (i % 2) * 6 - 3, 1.7, 0, TAU); g.fill(); } }
    g.restore();
  }
  function drawLamp(l) {
    const X = sx(l.x); const Y = sy(l.y); if (!onScreen(X, Y, 40)) return;
    const k = cam.z; g.save(); g.translate(X, Y); g.scale(k, k);
    g.lineWidth = Math.max(1.2 / k, 1.8); g.strokeStyle = INK; g.lineJoin = 'round';
    box(-1.5, -26, 3, 26, '#6b4a30');
    ell(0, -29, 7, 8.5, '#e8503a', true);
    g.beginPath(); g.moveTo(-3, -36); g.lineTo(3, -36); g.stroke();
    box(-3, -21, 6, 3, '#ffc93c');
    g.restore();
    if (env.n > 0.15) litList.push([X, Y - 29 * k, 34 * k, '255,150,70']);
  }
  function drawPerson(p) {
    const X = sx(p.x); const Y = sy(p.y); if (!onScreen(X, Y, 60)) return;
    const k = Math.max(cam.z, 0.5) * p.k; g.save(); g.translate(X, Y); g.scale(k, k);
    g.lineWidth = Math.max(1.1 / k, 1.6); g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round';
    const sw = p.moving ? Math.sin(p.ph) * 4 : 0; const bob = p.moving ? -Math.abs(Math.sin(p.ph)) * 1.6 : Math.sin(time * 2 + p.id) * 0.4;
    ell(0, 0, 8, 3, 'rgba(0,0,0,.2)');
    const f = p.face;
    if (p.style === 3 || p.style === 4) { // long robe
      poly([[-8, 0], [8, 0], [5.5, -15], [-5.5, -15]], p.style === 4 ? '#e8503a' : shade(p.shirt, -0.12));
    } else {
      g.save(); g.lineWidth = 3.6; g.strokeStyle = '#3b3a4a';
      g.beginPath(); g.moveTo(-2.6, -9 + bob); g.lineTo(-2.6 + sw, -0.5); g.moveTo(2.6, -9 + bob); g.lineTo(2.6 - sw, -0.5); g.stroke(); g.restore();
    }
    box(-6, -21 + bob, 12, 13, p.shirt, 4.5);
    if (p.style === 4) { g.save(); g.fillStyle = '#ffc93c'; g.fillRect(-1.5, -21 + bob, 3, 13); g.restore(); }
    g.save(); g.lineWidth = 3; g.strokeStyle = shade(p.shirt, -0.3);
    g.beginPath(); g.moveTo(-6, -18 + bob); g.lineTo(-8, -12 + bob - sw * 0.3); g.moveTo(6, -18 + bob); g.lineTo(8, -12 + bob + sw * 0.3); g.stroke(); g.restore();
    const hy = -28 + bob;
    ell(0, hy, 7.6, 7.6, '#ffdcb8', true);
    // hair / headwear
    g.beginPath(); g.arc(0, hy, 7.8, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.fillStyle = p.hair; g.fill(); g.stroke();
    if (p.style === 1 || p.style === 3) ell(0, hy - 9, 3.8, 3.8, p.hair, true);
    if (p.style === 2) poly([[-11, hy - 4], [11, hy - 4], [0, hy - 15]], '#e8c98a');
    if (p.style === 4) {
      box(-9, hy - 12, 18, 5, '#ffc93c', 1.5);
      g.save(); g.lineWidth = 1; for (let i = -6; i <= 6; i += 3) { g.beginPath(); g.moveTo(i, hy - 7); g.lineTo(i, hy - 3); g.stroke(); } g.restore();
    }
    // face
    g.fillStyle = INK; g.beginPath(); g.arc(f * 2.2 - 2.4, hy + 0.5, 1.2, 0, TAU); g.arc(f * 2.2 + 2.4, hy + 0.5, 1.2, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,120,120,.45)'; g.beginPath(); g.arc(f * 2.2 - 4.6, hy + 3, 1.7, 0, TAU); g.arc(f * 2.2 + 4.6, hy + 3, 1.7, 0, TAU); g.fill();
    if (p.eatT > 0 && p.eatEmoji) emoji(p.eatEmoji, f * 10, -15 + bob + Math.sin(time * 6) * 1.5, 11);
    g.restore();
    p.sx = X; p.sy = Y; p.sk = k;
  }

  /* ---------- world layers ---------- */
  let time = 0;
  function drawWater() {
    g.fillStyle = '#58b9d6'; g.fillRect(0, 0, W, H);
    g.save(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = Math.max(1, 1.6 * cam.z); g.lineCap = 'round';
    for (const w of waves) {
      const X = sx(w.x); const Y = sy(w.y); if (!onScreen(X, Y, 20)) continue;
      const a = 0.5 + 0.5 * Math.sin(time * 1.4 + w.ph); g.globalAlpha = 0.2 + a * 0.5;
      const s = 9 * cam.z * w.s; g.beginPath(); g.moveTo(X - s, Y); g.quadraticCurveTo(X - s / 2, Y - s * 0.5, X, Y); g.quadraticCurveTo(X + s / 2, Y + s * 0.5, X + s, Y); g.stroke();
    }
    g.restore();
  }
  function drawIslets() {
    for (const s of islets) {
      const X = sx(s.x); const Y = sy(s.y); const rx = s.r * cam.z; const ry = s.r * cam.z * cam.tilt; if (!onScreen(X, Y, rx + 20)) continue;
      g.lineWidth = Math.max(1.2, 2 * cam.z); g.strokeStyle = INK;
      g.beginPath(); g.ellipse(X, Y + 7 * cam.z, rx, ry, 0, 0, TAU); g.fillStyle = '#b98f63'; g.fill(); g.stroke();
      g.beginPath(); g.ellipse(X, Y, rx, ry, 0, 0, TAU); g.fillStyle = s.c < 0.5 ? '#f5e6c4' : '#8fd18a'; g.fill(); g.stroke();
      if (s.c >= 0.5) { g.beginPath(); g.ellipse(X, Y - 1 * cam.z, rx * 0.6, ry * 0.6, 0, 0, TAU); g.fillStyle = '#6cc070'; g.fill(); }
    }
  }
  function drawBoats() {
    for (const b of boats) {
      if (!paused) b.a += b.v * 16.7 * 0.06 * (lastDt * 60);
      const x = Math.cos(b.a) * b.rx; const y = Math.sin(b.a) * b.ry; const X = sx(x); const Y = sy(y) + Math.sin(time * 2 + b.a * 9) * 1.5; if (!onScreen(X, Y, 40)) continue;
      const k = Math.max(cam.z, 0.5); g.save(); g.translate(X, Y); g.scale(k, k);
      g.lineWidth = Math.max(1.2 / k, 1.6); g.strokeStyle = INK; g.lineJoin = 'round';
      ell(0, 3, 12, 3, 'rgba(0,50,80,.25)');
      poly([[-11, -4], [11, -4], [7, 3], [-7, 3]], b.c); g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -18); g.stroke(); poly([[0, -18], [9, -8], [0, -8]], '#ffffff');
      g.restore();
    }
  }
  function drawBridge(a, b) {
    const A = ISLANDS[a]; const B = ISLANDS[b]; const dx = B.x - A.x; const dy = B.y - A.y; const L = Math.hypot(dx, dy); const ux = dx / L; const uy = dy / L;
    const s0 = A.r * 0.78; const s1 = L - B.r * 0.78; const x0 = A.x + ux * s0; const y0 = A.y + uy * s0; const x1 = A.x + ux * s1; const y1 = A.y + uy * s1;
    g.lineCap = 'butt';
    g.beginPath(); g.moveTo(sx(x0), sy(y0)); g.lineTo(sx(x1), sy(y1)); g.strokeStyle = INK; g.lineWidth = 25 * cam.z; g.stroke();
    g.strokeStyle = '#d9a86c'; g.lineWidth = 20 * cam.z; g.stroke();
    g.strokeStyle = 'rgba(110,70,35,.55)'; g.lineWidth = Math.max(1, 1.8 * cam.z); g.beginPath();
    for (let s = s0; s < s1; s += 14) { const cx = A.x + ux * s; const cy = A.y + uy * s; g.moveTo(sx(cx - uy * 11), sy(cy + ux * 11)); g.lineTo(sx(cx + uy * 11), sy(cy - ux * 11)); }
    g.stroke();
  }
  function drawIslandBase(d) {
    const z = cam.z; const depth = 32; g.lineJoin = 'round';
    // soft shadow on the water
    hexPath(d.x, d.y, d.r, depth + 8); g.fillStyle = 'rgba(0,60,90,.22)'; g.fill();
    // sides
    hexPath(d.x, d.y, d.r - 8, depth); g.strokeStyle = INK; g.lineWidth = 21 * z; g.stroke();
    for (let o = depth; o >= 0; o -= 4) {
      hexPath(d.x, d.y, d.r - 8, o); const c = mix('#a57d52', '#c9a173', 1 - o / depth);
      g.fillStyle = c; g.strokeStyle = c; g.lineWidth = 16 * z; g.fill(); g.stroke();
    }
    // top: sand rim then tinted plaza
    hexPath(d.x, d.y, d.r - 8, 0); g.strokeStyle = INK; g.lineWidth = 21 * z; g.stroke();
    g.fillStyle = '#f5e6c4'; g.strokeStyle = '#f5e6c4'; g.lineWidth = 16 * z; g.fill(); g.stroke();
    const tint = mix(d.c, '#ffffff', 0.78);
    hexPath(d.x, d.y, d.r - 34, 0); g.fillStyle = tint; g.strokeStyle = tint; g.lineWidth = 10 * z; g.fill(); g.stroke();
    // city wall ring
    if (d.wall) {
      hexPath(d.x, d.y, d.r - 2, 0); g.strokeStyle = INK; g.lineWidth = 17 * z; g.stroke(); g.strokeStyle = '#d8cfb8'; g.lineWidth = 12 * z; g.stroke();
      g.fillStyle = '#d8cfb8'; g.strokeStyle = INK; g.lineWidth = Math.max(1, 1.4 * z);
      for (let i = 0; i < 6; i++) {
        const a0 = (i * TAU) / 6; const a1 = ((i + 1) * TAU) / 6;
        for (let t = 0.04; t < 1; t += 0.08) {
          const a = a0 + (a1 - a0) * t; const px = d.x + Math.cos(a) * (d.r - 2); const py = d.y + Math.sin(a) * (d.r - 2);
          // interpolate along the straight edge instead of the arc
          const ex = d.x + Math.cos(a0) * (d.r - 2); const ey = d.y + Math.sin(a0) * (d.r - 2);
          const fx_ = d.x + Math.cos(a1) * (d.r - 2); const fy_ = d.y + Math.sin(a1) * (d.r - 2);
          void px; void py;
          const X = sx(ex + (fx_ - ex) * t); const Y = sy(ey + (fy_ - ey) * t) - 7 * z;
          g.beginPath(); g.rect(X - 2.6 * z, Y - 3 * z, 5.2 * z, 6 * z); g.fill(); g.stroke();
        }
      }
    }
    // little paths to every building
    g.lineCap = 'round'; g.strokeStyle = '#fff8e6'; g.lineWidth = 9 * z;
    buildings.filter((b) => b.island === d.key).forEach((b) => {
      g.beginPath(); g.moveTo(sx(d.x), sy(d.y + 20)); g.lineTo(sx(b.x), sy(b.y + 14)); g.stroke();
    });
  }

  function drawClouds() {
    for (const c of clouds) {
      if (!paused) { c.x += c.v * lastDt; if (c.x > 1000) c.x = -1000; }
      const X = sx(c.x); const Y = sy(c.y, 130); const k = cam.z * c.s; if (!onScreen(X, Y, 120 * k)) continue;
      const SY = sy(c.y);
      g.fillStyle = 'rgba(0,50,80,.1)'; g.beginPath(); g.ellipse(X, SY + 20 * k, 50 * k, 12 * k, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.88)'; g.beginPath();
      g.arc(X - 28 * k, Y, 18 * k, 0, TAU); g.arc(X, Y - 10 * k, 24 * k, 0, TAU); g.arc(X + 28 * k, Y, 19 * k, 0, TAU); g.rect(X - 28 * k, Y, 56 * k, 18 * k);
      g.fill();
    }
  }

  /* ---------- screen-space overlays ---------- */
  function pill(text, x, y, o) {
    o = o || {}; const size = o.size || 13;
    g.font = `600 ${size}px ${FONT}`; const w = g.measureText(text).width + 18; const h = size + 11;
    rr(x - w / 2, y - h, w, h, h / 2); g.fillStyle = o.bg || 'rgba(255,253,246,.96)'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
    g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x, y - h / 2 + 1);
  }
  function wrapText(text, maxW) {
    const lines = []; let line = ''; const cjk = /[　-鿿]/.test(text); const toks = cjk ? [...text] : text.split(' ');
    for (const t of toks) {
      const test = line ? (cjk ? line + t : line + ' ' + t) : t;
      if (g.measureText(test).width > maxW && line) { lines.push(line); line = t; } else line = test;
    }
    if (line) lines.push(line);
    return lines.slice(0, 3);
  }
  function drawBubble(p) {
    if (p.sayT <= 0 || !p.say || p.sx === undefined || !onScreen(p.sx, p.sy, 80)) return;
    const k = p.sk; const size = clamp(12 * Math.max(cam.z, 0.7), 11, 15);
    g.font = `500 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = wrapText(p.say, 150); const w = Math.max(...lines.map((l) => g.measureText(l).width)) + 16; const lh = size + 3; const h = lines.length * lh + 10;
    const x = clamp(p.sx, w / 2 + 4, W - w / 2 - 4); const yb = p.sy - 40 * k - 4; const a = Math.min(1, p.sayT * 1.5);
    g.save(); g.globalAlpha = a;
    rr(x - w / 2, yb - h, w, h, 10); g.fillStyle = p.owner ? '#fff3c4' : '#ffffff'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.moveTo(p.sx - 5, yb - 1); g.lineTo(p.sx, yb + 6); g.lineTo(p.sx + 5, yb - 1); g.fillStyle = p.owner ? '#fff3c4' : '#ffffff'; g.fill();
    g.beginPath(); g.moveTo(p.sx - 5, yb); g.lineTo(p.sx, yb + 6); g.lineTo(p.sx + 5, yb); g.stroke();
    g.fillStyle = INK; lines.forEach((l, i) => g.fillText(l, x, yb - h + 5 + lh * (i + 0.5)));
    g.restore();
  }
  function drawLabels() {
    // island titles
    if (labelsOn && cam.z < 1.5) {
      ORDER.forEach((key) => {
        const d = ISLANDS[key]; const X = sx(d.x); const Y = sy(d.y - d.r * 0.82) - 18 * cam.z;
        if (!onScreen(X, Y, 120)) return;
        pill(`${tx('islands')[key]} · ${d.count}`, X, Y, { size: clamp(15 * Math.sqrt(cam.z), 12, 18), bg: mix(d.c, '#ffffff', 0.72) });
      });
    }
    // place names
    const list = [...buildings].sort((a, b) => a.y - b.y);
    for (const b of list) {
      const show = (labelsOn && cam.z >= 1.3) || hoverB === b || selId === b.id;
      if (!show || !b.hit) continue;
      pill(nameOf(b.p), b.hit.x + b.hit.w / 2, b.hit.y - (b.p.type === 'sight' ? 14 * cam.z : 0), { size: 13, bg: selId === b.id ? '#ffe680' : undefined });
    }
    // emperor tag
    if (emperor.sx !== undefined && labelsOn && cam.z >= 0.4) pill('👑 ' + tx('emperorName'), emperor.sx, emperor.sy - 52 * emperor.sk, { size: 12, bg: '#ffe680' });
    if (followP && followP.sx !== undefined) {
      const t = (performance.now() / 300) % TAU; g.save(); g.fillStyle = '#e8503a'; g.strokeStyle = INK; g.lineWidth = 2; const y = followP.sy - 50 * followP.sk + Math.sin(t) * 3;
      g.beginPath(); g.moveTo(followP.sx - 7, y - 10); g.lineTo(followP.sx + 7, y - 10); g.lineTo(followP.sx, y); g.closePath(); g.fill(); g.stroke(); g.restore();
    }
  }
  function drawPlanRoute() {
    if (planRoute.length < 1) return;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    const pts = planRoute.map((id) => { const b = bById.get(id); return [sx(b.x), sy(b.y + 10)]; });
    if (pts.length > 1) {
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.strokeStyle = INK; g.lineWidth = 7; g.setLineDash([]); g.globalAlpha = 0.9; g.stroke();
      g.strokeStyle = '#ffc93c'; g.lineWidth = 4; g.setLineDash([10, 8]); g.lineDashOffset = -time * 20; g.stroke();
    }
    g.setLineDash([]); g.globalAlpha = 1;
    pts.forEach((p, i) => {
      g.beginPath(); g.arc(p[0], p[1], 13, 0, TAU); g.fillStyle = '#e8503a'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
      g.fillStyle = '#fff'; g.font = `700 14px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), p[0], p[1] + 1);
    });
    g.restore();
  }

  /* ---------- frame ---------- */
  let labelsOn = true; let paused = false; let hoverB = null; let selId = null; let followP = null; let planRoute = [];
  let lastDt = 0.016;
  function render() {
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    litList.length = 0;
    drawWater(); drawIslets(); drawBoats();
    BRIDGES.forEach(([a, b]) => drawBridge(a, b));
    [...ORDER].map((k) => ISLANDS[k]).sort((a, b) => a.y - b.y).forEach(drawIslandBase);

    const items = [];
    buildings.forEach((b) => items.push([b.y + 6, () => drawBuilding(b)]));
    trees.forEach((t) => items.push([t.y, () => drawTree(t)]));
    lamps.forEach((l) => items.push([l.y, () => drawLamp(l)]));
    people.forEach((p) => items.push([p.y + 1, () => drawPerson(p)]));
    items.sort((a, b) => a[0] - b[0]);
    items.forEach((it) => it[1]());

    // floating hearts
    fx.forEach((f) => { const X = sx(f.x); const Y = sy(f.y, f.z); g.globalAlpha = clamp(f.life, 0, 1); emoji(f.ch, X, Y, 14 * Math.max(cam.z, 0.7)); g.globalAlpha = 1; });

    drawClouds();
    // tint for time of day
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = `rgb(${env.m.map(Math.round).join(',')})`; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    if (env.n > 0.05) {
      for (const L of litList) {
        const grd = g.createRadialGradient(L[0], L[1], 0, L[0], L[1], L[2]);
        grd.addColorStop(0, `rgba(${L[3]},${0.55 * env.n})`); grd.addColorStop(1, `rgba(${L[3]},0)`);
        g.fillStyle = grd; g.fillRect(L[0] - L[2], L[1] - L[2], L[2] * 2, L[2] * 2);
      }
    }
    g.globalCompositeOperation = 'source-over';

    drawPlanRoute();
    drawLabels();
    people.forEach(drawBubble);
  }

  let last = performance.now(); let uiClock = 0; let chatT = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; lastDt = dt;
    if (!paused) { time += dt; updatePeople(dt, time); chatT += dt; if (chatT > 0.7) { chatT = 0; chatter(time); } }
    updateEnv(dt);
    if (followP) { cam.tx = followP.x; cam.ty = followP.y - 8; }
    const e = reduceMotion ? 1 : 1 - Math.exp(-dt * 6);
    cam.x += (cam.tx - cam.x) * e; cam.y += (cam.ty - cam.y) * e; cam.z += (cam.tz - cam.z) * e; cam.tilt += (cam.ttilt - cam.tilt) * e;
    uiClock += dt; if (uiClock > 0.5) { uiClock = 0; refreshFollow(); }
    render();
    requestAnimationFrame(frame);
  }

  /* ================= input ================= */
  const ptrs = new Map(); let moved = 0; let pinch = 0;
  function pinchDist() { const a = [...ptrs.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) moved = 0; if (ptrs.size === 2) pinch = pinchDist();
  });
  cv.addEventListener('pointermove', (e) => {
    const prev = ptrs.get(e.pointerId);
    if (!prev) { if (e.pointerType === 'mouse') hover(e.clientX, e.clientY); return; }
    const dx = e.clientX - prev.x; const dy = e.clientY - prev.y; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) {
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 6) {
        cv.classList.add('drag'); if (followP) stopFollow();
        cam.x -= dx / cam.z; cam.y -= dy / (cam.z * cam.tilt); cam.tx = cam.x; cam.ty = cam.y;
      }
    } else if (ptrs.size === 2) {
      const d = pinchDist(); const a = [...ptrs.values()];
      if (pinch) zoomAt((a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2, d / pinch);
      pinch = d; moved = 99;
    }
  });
  function endPtr(e) {
    const had = ptrs.has(e.pointerId); ptrs.delete(e.pointerId); cv.classList.remove('drag'); pinch = 0;
    if (had && e.type === 'pointerup' && moved < 7 && ptrs.size === 0) clickAt(e.clientX, e.clientY);
  }
  cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); if (followP) stopFollow(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016)); }, { passive: false });
  cv.addEventListener('dblclick', (e) => zoomAt(e.clientX, e.clientY, 1.6));

  function hitBuilding(x, y) {
    let best = null;
    for (const b of buildings) { const h = b.hit; if (h && x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h && (!best || b.y > best.y)) best = b; }
    return best;
  }
  function hitPerson(x, y) {
    let best = null; let bd = 1e9;
    for (const p of people) {
      if (p.sx === undefined) continue; const d = Math.hypot(x - p.sx, y - (p.sy - 14 * p.sk));
      if (d < 16 * p.sk + 6 && d < bd) { best = p; bd = d; }
    }
    return best;
  }
  function hover(x, y) {
    const p = hitPerson(x, y); const b = p ? null : hitBuilding(x, y);
    hoverB = b; cv.style.cursor = p || b ? 'pointer' : '';
  }
  function clickAt(x, y) {
    const p = hitPerson(x, y);
    if (p) { startFollow(p); return; }
    const b = hitBuilding(x, y);
    if (b) { selectBuilding(b); return; }
    closeCard();
  }

  /* ================= selection / card ================= */
  const favs = new Set((() => { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch (e) { return []; } })());
  const saveFavs = () => { try { localStorage.setItem(FAV_KEY, JSON.stringify([...favs])); } catch (e) { /* ignore */ } };
  const planSel = new Set();
  const card = $('card');

  function selectBuilding(b, opts) {
    selId = b.id; if (!(opts && opts.noFly)) { flyTo(b.x, b.y - 24, 1.3); }
    if (isMobile()) { closePanel('drawer'); closePanel('plan'); }
    renderCard(); highlightList();
  }
  function closeCard() { selId = null; card.classList.remove('show'); highlightList(); }
  function renderCard() {
    const b = selId && bById.get(selId); if (!b) { card.classList.remove('show'); return; }
    const p = b.p; const d = ISLANDS[b.island]; const fav = favs.has(p.id); const inRoute = planSel.has(p.id);
    card.innerHTML =
      `<button class="x" type="button" aria-label="${esc(tx('close'))}">×</button>` +
      `<div class="sign" style="background:${d.c}">${p.emoji}</div>` +
      `<div class="body"><h2 lang="${lang}">${esc(nameOf(p))}</h2><div class="sub" lang="${lang === 'zh' ? 'en' : 'zh'}">${esc(subOf(p))}</div>` +
      `<div class="tags"><span class="tag" style="background:${mix(d.c, '#ffffff', 0.55)}">${esc(tx('islands')[b.island])}</span><span class="tag">${esc(typeLabel(p))}${p.far ? ' · ' + esc(tx('dayTrip')) : ''}</span></div>` +
      `<p>${esc(placeText(p, 'blurb'))}</p><div class="tip">💡 ${esc(placeText(p, 'tip'))}</div>` +
      `<div class="acts"><button class="btn" data-act="fav" type="button">${esc(tx(fav ? 'saved' : 'save'))}</button>` +
      `<button class="btn" data-act="route" type="button">${esc(tx(inRoute ? 'inRoute' : 'addRoute'))}</button>` +
      `<a class="btn" href="https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}" target="_blank" rel="noopener">${esc(tx('osm'))}</a></div></div>`;
    card.classList.add('show');
    card.querySelector('.x').onclick = closeCard;
    card.querySelector('[data-act=fav]').onclick = () => { if (favs.has(p.id)) favs.delete(p.id); else favs.add(p.id); saveFavs(); renderCard(); buildList(); };
    card.querySelector('[data-act=route]').onclick = () => { if (planSel.has(p.id)) planSel.delete(p.id); else planSel.add(p.id); renderCard(); buildPlanList(); };
  }

  /* ================= follow / emperor ================= */
  const followEl = $('follow');
  function startFollow(p) {
    followP = p; emperorMode = !!p.owner; cam.tz = Math.max(cam.tz, 1.3);
    $('bFollow').classList.toggle('on', !p.owner); $('bFollow').setAttribute('aria-pressed', String(!p.owner));
    $('bEmperor').classList.toggle('on', !!p.owner); $('bEmperor').setAttribute('aria-pressed', String(!!p.owner));
    refreshFollow();
  }
  function stopFollow() {
    followP = null; emperorMode = false;
    ['bFollow', 'bEmperor'].forEach((id) => { $(id).classList.remove('on'); $(id).setAttribute('aria-pressed', 'false'); });
    refreshFollow();
  }
  function nextFollow() { const others = people.filter((p) => !p.owner && p !== followP); startFollow(pick(others)); }
  function refreshFollow() {
    if (!followP) { followEl.classList.remove('show'); return; }
    const to = targetName(followP);
    followEl.innerHTML = `<span>🧍 ${esc(tx('followingPre'))} <b>${esc(personName(followP))}</b>${to ? ` · ${esc(tx('followingTo'))} ${esc(to)}` : ''}</span>` +
      (followP.owner ? '' : `<button type="button" data-f="next">${esc(tx('followingNext'))}</button>`) + `<button type="button" data-f="stop">${esc(tx('followingStop'))}</button>`;
    followEl.classList.add('show');
    const n = followEl.querySelector('[data-f=next]'); if (n) n.onclick = nextFollow;
    followEl.querySelector('[data-f=stop]').onclick = stopFollow;
  }

  /* ================= panels ================= */
  const PANELS = { drawer: ['drawer', 'bList'], plan: ['plan', 'bPlan'], log: ['log', 'bLog'] };
  function setBtn(id, on) { const b = $(id); b.setAttribute('aria-pressed', String(on)); if (id === 'bList') b.setAttribute('aria-expanded', String(on)); if (id !== 'bList') b.classList.toggle('on', on); }
  function openPanel(name) {
    const [el, btn] = PANELS[name];
    if (isMobile()) Object.keys(PANELS).forEach((n) => { if (n !== name) closePanel(n); });
    if (isMobile() && (name === 'drawer' || name === 'plan')) closeCard();
    $(el).classList.add('show'); setBtn(btn, true);
  }
  function closePanel(name) { const [el, btn] = PANELS[name]; $(el).classList.remove('show'); setBtn(btn, false); }
  const isOpen = (name) => $(PANELS[name][0]).classList.contains('show');
  const togglePanel = (name) => (isOpen(name) ? closePanel(name) : openPanel(name));

  /* ---------- list drawer ---------- */
  let catFilter = 'all'; let query = '';
  function buildChips() {
    const wrap = $('cats'); wrap.replaceChildren();
    const mk = (key, label, color) => {
      const c = document.createElement('button'); c.type = 'button'; c.className = 'chip' + (catFilter === key ? ' on' : ''); c.setAttribute('aria-pressed', String(catFilter === key));
      c.innerHTML = (color ? `<i style="background:${color}"></i>` : '') + esc(label);
      c.onclick = () => { catFilter = key; buildChips(); buildList(); }; wrap.appendChild(c);
    };
    mk('all', tx('chipAll')); mk('fav', tx('chipFav'));
    ORDER.forEach((k) => mk(k, tx('islands')[k], ISLANDS[k].c));
  }
  function buildList() {
    const q = query.trim().toLowerCase(); const out = $('list'); out.replaceChildren(); let any = false;
    ORDER.forEach((k) => {
      if (catFilter !== 'all' && catFilter !== 'fav' && catFilter !== k) return;
      const rows = buildings.filter((b) => b.island === k && (catFilter !== 'fav' || favs.has(b.id)) &&
        (!q || [b.p.name, b.p.zh, placeText(b.p, 'blurb'), placeText(b.p, 'tip')].join(' ').toLowerCase().includes(q)));
      if (!rows.length) return; any = true;
      const h = document.createElement('h4'); h.textContent = tx('islands')[k]; out.appendChild(h);
      rows.forEach((b) => {
        const it = document.createElement('button'); it.type = 'button'; it.className = 'it' + (selId === b.id ? ' sel' : ''); it.dataset.id = b.id;
        it.innerHTML = `<span class="em" style="background:${mix(ISLANDS[k].c, '#ffffff', 0.6)}">${b.p.emoji}</span><span class="tx"><span lang="${lang}">${esc(nameOf(b.p))}</span><small lang="${lang === 'zh' ? 'en' : 'zh'}">${esc(subOf(b.p))}</small></span>${favs.has(b.id) ? '<span class="star">⭐</span>' : ''}`;
        it.onclick = () => selectBuilding(b); out.appendChild(it);
      });
    });
    if (!any) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = tx('noMatches'); out.appendChild(e); }
  }
  function highlightList() { document.querySelectorAll('#list .it').forEach((el) => el.classList.toggle('sel', el.dataset.id === selId)); }
  $('q').addEventListener('input', (e) => { query = e.target.value; buildList(); });

  /* ---------- route planner ---------- */
  const DUR = { terracotta: 180, huaqing: 90, citywall: 90, belltower: 30, drumtower: 30, muslimquarter: 60, mosque: 40, smallgoose: 45, beilin: 60, museum: 120, biggoose: 60, everbright: 45, tangparadise: 120, daming: 90 };
  const MODES = { walk: [4.5, 0], bike: [12, 3], metro: [20, 12], taxi: [24, 6] };
  const PACES = { fast: 0.7, normal: 1, slow: 1.4 };
  const STARTS = { bell: { lat: 34.2610, lng: 108.9423 }, station: { lat: 34.2656, lng: 108.9622 } };
  const hav = (a, b) => {
    const R = 6371; const r = Math.PI / 180; const dLat = (b.lat - a.lat) * r; const dLng = (b.lng - a.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h));
  };
  const fmt = (m) => { m = Math.round(m); const h = Math.floor(m / 60) % 24; return String(h).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

  function fillSelect(el, entries, cur) { el.replaceChildren(...entries.map(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; return o; })); if (cur) el.value = cur; }
  function buildPlanSelects() {
    const keep = (id) => $(id).value;
    const f = keep('pFrom'); const m = keep('pMode'); const pc = keep('pPace');
    fillSelect($('pFrom'), [['bell', tx('fromBell')], ['station', tx('fromStation')], ['first', tx('fromFirst')]], f || 'bell');
    fillSelect($('pMode'), Object.entries(tx('modes')), m || 'taxi');
    fillSelect($('pPace'), Object.entries(tx('paces')), pc || 'normal');
    $('pNote').textContent = tx('planNote');
  }
  function buildPlanList() {
    const out = $('pList'); out.replaceChildren();
    ORDER.forEach((k) => {
      const rows = buildings.filter((b) => b.island === k); if (!rows.length) return;
      const h = document.createElement('h4'); h.innerHTML = `<i style="background:${ISLANDS[k].c}"></i>${esc(tx('islands')[k])}`; out.appendChild(h);
      rows.forEach((b) => {
        const l = document.createElement('label'); l.className = 'pi';
        l.innerHTML = `<input type="checkbox" ${planSel.has(b.id) ? 'checked' : ''}><span>${b.p.emoji}</span><span>${esc(nameOf(b.p))}</span>`;
        l.querySelector('input').onchange = (e) => { if (e.target.checked) planSel.add(b.id); else planSel.delete(b.id); updatePlanCount(); if (selId === b.id) renderCard(); };
        out.appendChild(l);
      });
    });
    updatePlanCount();
  }
  function updatePlanCount() { $('pCount').textContent = fill(tx('selected'), { n: planSel.size }); }

  function orderStops(ids, startKey) {
    const ps = ids.map((id) => bById.get(id).p);
    const nn = (list, from) => {
      const left = [...list]; const out = []; let cur = from || (left.length ? left.shift() : null); if (cur && !out.includes(cur) && !from) out.push(cur);
      while (left.length) { let bi = 0; let bd = 1e9; left.forEach((p, i) => { const d = hav(cur, p); if (d < bd) { bd = d; bi = i; } }); cur = left.splice(bi, 1)[0]; out.push(cur); }
      return out;
    };
    const start = STARTS[startKey] || null;
    const trips = ps.filter((p) => p.far); const city = ps.filter((p) => !p.far);
    const morning = city.filter((p) => p.id === 'zengao'); const dinner = city.filter((p) => p.id === 'skewers');
    const mid = city.filter((p) => p.id !== 'zengao' && p.id !== 'skewers');
    const tripOrder = nn(trips, start); const lastPos = tripOrder.length ? tripOrder[tripOrder.length - 1] : start;
    const midOrder = nn(mid, morning.length ? morning[0] : lastPos);
    return [...tripOrder, ...morning, ...midOrder, ...dinner];
  }
  function planRouteNow() {
    const out = $('pOut');
    if (planSel.size < 2) { out.innerHTML = `<div class="muted">${esc(tx('needTwo'))}</div>`; planRoute = []; return; }
    const from = $('pFrom').value; const mode = $('pMode').value; const pace = PACES[$('pPace').value] || 1;
    const [h, m] = ($('pTime').value || '09:30').split(':').map(Number); let t = h * 60 + m;
    const stops = orderStops([...planSel], from); planRoute = stops.map((p) => p.id);
    let prev = STARTS[from] || null; let totalKm = 0; let html = '<ul class="tl">'; let anyLate = false;
    stops.forEach((p, i) => {
      if (prev) {
        const km = hav(prev, p) * 1.3; let md = mode; if ((md === 'walk' || md === 'bike') && km > 6) md = 'taxi';
        const [sp, oh] = MODES[md]; const mins = (km / sp) * 60 + oh; totalKm += km; t += mins;
        html += `<li class="leg">${tx('leg' + md[0].toUpperCase() + md.slice(1))} ${Math.max(1, Math.round(mins))} min · ${km.toFixed(1)} km</li>`;
      }
      if (p.id === 'skewers' && t < 17.5 * 60) t = 17.5 * 60;
      const stay = Math.round((p.type === 'food' ? 30 : (DUR[p.id] || 45)) * pace); const late = t > 20.5 * 60 && p.type === 'sight'; anyLate = anyLate || late;
      html += `<li class="stop"><span class="no">${i + 1}</span><div><div class="tm">${fmt(t)}–${fmt(t + stay)} <small>${esc(tx('stay'))} ${stay} min</small></div>` +
        `<div class="nm${late ? ' late' : ''}">${p.emoji} ${esc(nameOf(p))}</div></div></li>`;
      t += stay; prev = p;
    });
    html += '</ul>';
    const hasTrip = stops.some((p) => p.far);
    out.innerHTML = `<div class="sum">${esc(fill(tx('summary'), { n: stops.length, km: totalKm.toFixed(1), t: fmt(t) }))}</div>` +
      (hasTrip ? `<div class="warn">${esc(tx('tripBlock'))}</div>` : '') + (anyLate ? `<div class="warn">${esc(tx('late'))}</div>` : '') + html;
    // show the whole route on the map
    const xs = stops.map((p) => bById.get(p.id)); const minX = Math.min(...xs.map((b) => b.x)); const maxX = Math.max(...xs.map((b) => b.x)); const minY = Math.min(...xs.map((b) => b.y)); const maxY = Math.max(...xs.map((b) => b.y));
    follow = null; stopFollow();
    cam.tx = (minX + maxX) / 2; cam.ty = (minY + maxY) / 2 - 10;
    const availW = isMobile() ? W : W - 460; cam.tz = clamp(Math.min(availW / (maxX - minX + 340), (H * (isMobile() ? 0.4 : 0.75)) / ((maxY - minY + 220) * cam.ttilt)), 0.25, 1.3);
    if (!isMobile()) cam.tx -= (W - availW) / 2 / cam.tz;
  }
  $('pGo').onclick = planRouteNow;
  $('pClear').onclick = () => { planSel.clear(); planRoute = []; $('pOut').innerHTML = ''; buildPlanList(); if (selId) renderCard(); };
  $('pFav').onclick = () => { favs.forEach((id) => planSel.add(id)); buildPlanList(); if (selId) renderCard(); };
  $('pclose').onclick = () => closePanel('plan');

  /* ================= toolbar wiring ================= */
  const todEl = $('tod');
  const TOD_ICONS = ['🌅', '☀️', '🌇', '🌙', '🔄'];
  function buildTod() {
    todEl.replaceChildren();
    TOD_ICONS.forEach((ic, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tb'; b.dataset.t = i; b.title = tx('tod')[i]; b.setAttribute('aria-label', tx('tod')[i]);
      b.innerHTML = `<span class="i">${ic}</span>`;
      b.onclick = () => { if (i === 4) { autoTod = !autoTod; autoClock = 0; } else { autoTod = false; todIdx = i; } syncTodButtons(); };
      todEl.appendChild(b);
    });
    syncTodButtons();
  }
  function syncTodButtons() {
    [...todEl.children].forEach((b, i) => { const on = i === 4 ? autoTod : (!autoTod && i === todIdx) || (autoTod && i === todIdx && false); b.classList.toggle('on', on || (autoTod && i === todIdx)); b.setAttribute('aria-pressed', String(b.classList.contains('on'))); });
  }
  $('bLabel').onclick = () => { labelsOn = !labelsOn; setBtn('bLabel', labelsOn); };
  $('bEmperor').onclick = () => { if (followP === emperor) stopFollow(); else startFollow(emperor); };
  $('bFollow').onclick = () => { if (followP && !followP.owner) stopFollow(); else nextFollow(); };
  $('bPause').onclick = () => { paused = !paused; setBtn('bPause', paused); syncPause(); };
  function syncPause() { $('pauseIcon').textContent = paused ? '▶️' : '⏸'; $('pauseTx').textContent = tx('tools')[paused ? 'play' : 'pause']; }
  $('bBird').onclick = () => { bird = !bird; setBtn('bBird', bird); cam.ttilt = bird ? 0.95 : 0.58; stopFollow(); fitAll(); };
  $('bPlan').onclick = () => togglePanel('plan');
  $('bLog').onclick = () => togglePanel('log');
  $('bList').onclick = () => togglePanel('drawer');
  $('bAll').onclick = () => { stopFollow(); closeCard(); fitAll(); };
  $('bHelp').onclick = () => openIntro(0);
  document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  addEventListener('resize', () => { resize(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { if ($('intro').classList.contains('show')) closeIntro(); else { closeCard(); Object.keys(PANELS).forEach(closePanel); } } });

  /* ================= intro tour ================= */
  let introStep = 0;
  function openIntro(i) { introStep = i; renderIntro(); $('intro').classList.add('show'); $('inext').focus(); }
  function closeIntro() { $('intro').classList.remove('show'); try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) { /* ignore */ } }
  function renderIntro() {
    const steps = tx('intro'); const s = steps[introStep];
    $('ist').textContent = s[0]; $('iti').textContent = s[1]; $('itx').textContent = s[2];
    $('idt').replaceChildren(...steps.map((_, i) => { const d = document.createElement('i'); if (i === introStep) d.className = 'on'; return d; }));
    $('iskip').textContent = tx('introSkip'); $('inext').textContent = introStep === steps.length - 1 ? tx('introDone') : tx('introNext');
  }
  $('inext').onclick = () => { if (introStep >= tx('intro').length - 1) closeIntro(); else { introStep++; renderIntro(); } };
  $('iskip').onclick = closeIntro;

  /* ================= static text ================= */
  function applyStatic() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = tx('docTitle');
    const meta = document.querySelector('meta[name="description"]'); if (meta) meta.setAttribute('content', tx('docDesc'));
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = tx(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', tx(el.dataset.i18nAria)); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.setAttribute('placeholder', tx(el.dataset.i18nPh)); });
    document.querySelectorAll('[data-tool]').forEach((el) => { el.textContent = tx('tools')[el.dataset.tool]; });
    document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    $('bHelp').setAttribute('aria-label', tx('help'));
    if (!$('decreeTx').textContent || $('decreeTx').dataset.first) { $('decreeTx').textContent = tx('decreeFirst'); $('decreeTx').dataset.first = '1'; }
    syncPause();
  }
  function setLang(next) {
    if (!LANGS.includes(next) || next === lang) return;
    lang = next; try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
    people.forEach((p) => { p.sayT = 0; p.replyAt = 0; });
    applyStatic(); buildTod(); buildChips(); buildList(); buildPlanSelects(); buildPlanList(); renderCard(); refreshFollow();
    $('decreeTx').textContent = tx('decreeFirst'); $('decreeTx').dataset.first = '1';
    if ($('intro').classList.contains('show')) renderIntro();
    if (planRoute.length) planRouteNow();
  }

  /* ================= start ================= */
  resize(); fitStart(); cam.x = cam.tx; cam.y = cam.ty; cam.z = cam.tz * 0.8;
  if (reduceMotion) { paused = true; setBtn('bPause', true); }
  applyStatic(); buildTod(); buildChips(); buildList(); buildPlanSelects(); buildPlanList();
  decree.first = true;
  addLog(esc(tx('decreeFirst')), 'own', true);
  let introSeen = false; try { introSeen = !!localStorage.getItem(INTRO_KEY); } catch (e) { /* ignore */ }
  if (!introSeen && !new URLSearchParams(location.search).has('nointro')) openIntro(0);
  const qs = new URLSearchParams(location.search);
  if (qs.get('tod') && TOD[+qs.get('tod')]) { todIdx = +qs.get('tod'); Object.assign(env, { m: [...TOD[todIdx].m], n: TOD[todIdx].n }); syncTodButtons(); }
  // warm the world up so the crowd isn't all spawned in a clump
  const warm = qs.has('warm') ? +qs.get('warm') || 0 : 25;
  if (!paused) for (let i = 0; i < warm * 10; i++) { time += 0.1; updatePeople(0.1, time); if (i % 7 === 0) chatter(time); }
  if (qs.get('panel') && PANELS[qs.get('panel')]) openPanel(qs.get('panel'));
  if (qs.get('sel') && bById.has(qs.get('sel'))) selectBuilding(bById.get(qs.get('sel')));
  if (qs.get('route')) { qs.get('route').split(',').forEach((id) => bById.has(id) && planSel.add(id)); buildPlanList(); openPanel('plan'); planRouteNow(); }
  requestAnimationFrame(frame);

  // small hook for debugging/tests
  window.__island = { cam, buildings, people, selectBuilding: (id) => selectBuilding(bById.get(id)), openPanel };
})();
