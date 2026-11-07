(() => {
  'use strict';

  const PLACES = window.XIAN_PLACES || [];
  const BASE = window.XIAN_I18N;
  const TXT = window.CITY_I18N;
  const LANGS = ['en', 'zh'];
  const LANG_KEY = 'xian-lang';
  const FAV_KEY = 'xian-fav';
  const INTRO_KEY = 'xian-city-intro';
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
  // Real lat/lng -> world px. The Bell Tower is the origin, north is up. Inside the wall the map is
  // gently magnified around the centre; outside it is compressed so the suburbs fit in one world.
  const DIST = {
    core:   { c: '#e8503a', ids: ['belltower', 'drumtower', 'citywall', 'beilin', 'biangbiang', 'liangpi'] },
    muslim: { c: '#3fb68b', ids: ['muslimquarter', 'mosque', 'roujiamo', 'skewers', 'baozi', 'persimmon', 'zengao'] },
    tang:   { c: '#ffc93c', ids: ['biggoose', 'smallgoose', 'everbright', 'tangparadise', 'museum', 'paomo'] },
    daming: { c: '#7ccbf5', ids: ['daming'] },
    trip:   { c: '#ff9ebb', ids: ['terracotta', 'huaqing'] },
  };
  const ORDER = ['core', 'muslim', 'tang', 'daming', 'trip'];
  const distOf = {};
  ORDER.forEach((k) => DIST[k].ids.forEach((id) => { distOf[id] = k; }));

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

  const SC = 330; const LAT0 = 34.2610; const LNG0 = 108.9423; const KLAT = 111.2; const KLNG = 91.9;
  const WALL = { x0: -561, x1: 825, y0: -528, y1: 363, t: 26, h: 30 }; // wall centre-line rectangle
  const WORLD = { x0: -900, y0: -1120, x1: 2050, y1: 1180 };
  const COMP = 0.4; const GAP = 90;
  const squeeze = (v, a, b) => (v < a ? a - GAP + (v - a) * COMP : v > b ? b + GAP + (v - b) * COMP : v);
  function project(p) {
    let x = (p.lng - LNG0) * KLNG * SC; let y = -(p.lat - LAT0) * KLAT * SC;
    if (x > WALL.x0 && x < WALL.x1 && y > WALL.y0 && y < WALL.y1) { const r = Math.hypot(x, y); const f = 1 + Math.exp(-((r / 210) ** 2)); x *= f; y *= f; }
    return [squeeze(x, WALL.x0, WALL.x1), squeeze(y, WALL.y0, WALL.y1)];
  }
  const OVERRIDE = { citywall: [0, WALL.y1 + WALL.t / 2], huaqing: [1480, -300], terracotta: [1740, -520] }; // far day trips + the South Gate on the wall
  const PINNED = new Set(['belltower', 'citywall', 'huaqing', 'terracotta']);

  const buildings = [];
  const bById = new Map();
  PLACES.forEach((p, idx) => {
    const kind = KIND[p.id] || { k: 'shop' };
    const [x, y] = OVERRIDE[p.id] || project(p);
    const b = { p, id: p.id, dist: distOf[p.id] || 'core', x, y, x0: x, y0: y, kind, idx, hit: null };
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
  // nudge crowded buildings apart (they stay close to where they really are)
  for (let it = 0; it < 1500; it++) {
    for (let i = 0; i < buildings.length; i++) for (let j = i + 1; j < buildings.length; j++) {
      const a = buildings[i]; const b = buildings[j];
      const sxx = (a.w + b.w) / 2 + 30; const syy = Math.max(64, (a.hh + b.hh) / 2);
      let dx = b.x - a.x; let dy = b.y - a.y; const m = Math.hypot(dx / sxx, dy / syy);
      if (m >= 1) continue;
      if (m < 1e-6) { dx = 1; dy = 0.3; }
      const L = Math.hypot(dx / sxx, dy / syy) || 1; const k = (1 - m) * 0.5;
      const mx = (dx / sxx / L) * sxx * k; const my = (dy / syy / L) * syy * k;
      const pa = PINNED.has(a.id); const pb = PINNED.has(b.id);
      if (!pa) { a.x -= pb ? mx * 2 : mx; a.y -= pb ? my * 2 : my; }
      if (!pb) { b.x += pa ? mx * 2 : mx; b.y += pa ? my * 2 : my; }
    }
    for (const a of buildings) if (!PINNED.has(a.id)) { a.x += (a.x0 - a.x) * 0.004; a.y += (a.y0 - a.y) * 0.004; }
  }
  buildings.forEach((b) => { b.x = Math.round(b.x); b.y = Math.round(b.y); });
  ORDER.forEach((k) => { DIST[k].count = buildings.filter((b) => b.dist === k).length; });
  const doorOf = (b) => [b.x, b.y + 16];

  /* ---------- street graph ---------- */
  const NODES = []; const ADJ = []; const NIDX = new Map(); const SEGS = [];
  function node(x, y) {
    x = Math.round(x); y = Math.round(y); const key = x + ',' + y; let i = NIDX.get(key);
    if (i === undefined) { i = NODES.length; NODES.push([x, y]); NIDX.set(key, i); ADJ.push([]); }
    return i;
  }
  function link(a, b) {
    if (a === b || ADJ[a].some((e) => e[0] === b)) return;
    const w = Math.hypot(NODES[a][0] - NODES[b][0], NODES[a][1] - NODES[b][1]); ADJ[a].push([b, w]); ADJ[b].push([a, w]);
  }
  function addRoad(pts, w, outer) {
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = pts[i - 1]; const [x, y] = pts[i]; const n = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / 80));
      let last = node(px, py);
      for (let s = 1; s <= n; s++) { const id = node(px + ((x - px) * s) / n, py + ((y - py) * s) / n); link(last, id); last = id; }
      SEGS.push([px, py, x, y, w, !!outer]);
    }
  }
  const LX = [-533, -400, -240, -120, 0, 120, 240, 400, 560, 700, 797];
  const LY = [-500, -360, -240, -120, 0, 120, 240, 335];
  const roadW = (v, arr) => (v === 0 ? 34 : v === arr[0] || v === arr[arr.length - 1] ? 18 : 15);
  LX.forEach((x) => addRoad(LY.map((y) => [x, y]), roadW(x, LX)));
  LY.forEach((y) => addRoad(LX.map((x) => [x, y]), roadW(y, LY)));
  const CITY_NODES = NODES.length;
  // roads out of the four gates
  addRoad([[0, 335], [0, 392], [0, 470], [0, 620], [0, 780], [0, 900], [0, 1045], [300, 1045], [560, 1045], [840, 1045]], 24, true);
  addRoad([[300, 1045], [300, 880]], 18, true); addRoad([[560, 1045], [560, 960]], 18, true); addRoad([[840, 1045], [840, 1000]], 18, true);
  addRoad([[0, -500], [0, -650], [0, -800], [0, -880], [200, -880], [400, -880], [491, -880]], 24, true);
  addRoad([[797, 0], [1000, 0], [1200, 0], [1330, -120], [1480, -284]], 24, true);
  addRoad([[1480, -284], [1480, -400], [1600, -504], [1740, -504]], 20, true);
  addRoad([[-533, 0], [-650, 0], [-780, 0]], 22, true);

  function nearestNode(x, y) {
    let bi = 0; let bd = Infinity;
    for (let i = 0; i < NODES.length; i++) { const d = (NODES[i][0] - x) ** 2 + (NODES[i][1] - y) ** 2; if (d < bd) { bd = d; bi = i; } }
    return bi;
  }
  function access(x, y, id) { // short L-shaped lane from a free point onto the street
    const [nx, ny] = NODES[id]; const dx = nx - x; const dy = ny - y;
    if (Math.abs(dx) < 2 || Math.abs(dy) < 2) return [[nx, ny]];
    return Math.abs(dy) <= Math.abs(dx) ? [[x, ny], [nx, ny]] : [[nx, y], [nx, ny]];
  }
  function dijkstra(s, t) {
    const n = NODES.length; const dist = new Float64Array(n).fill(Infinity); const prev = new Int32Array(n).fill(-1); const done = new Uint8Array(n);
    dist[s] = 0;
    for (;;) {
      let u = -1; let best = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0 || u === t) break;
      done[u] = 1;
      for (const [v, w] of ADJ[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
    }
    const out = []; for (let c = t; c !== -1; c = prev[c]) { out.unshift(c); if (c === s) break; }
    return out[0] === s ? out : [s, t];
  }
  function findPath(ax, ay, bx, by) {
    const A = nearestNode(ax, ay); const B = nearestNode(bx, by);
    const pts = [[ax, ay], ...access(ax, ay, A)];
    dijkstra(A, B).slice(1).forEach((i) => pts.push(NODES[i]));
    pts.push(...access(bx, by, B).slice(0, -1).reverse(), [bx, by]);
    return pts.filter((p, i) => !i || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.5);
  }
  buildings.forEach((b) => { const [dx, dy] = doorOf(b); b.lane = [[dx, dy], ...access(dx, dy, nearestNode(dx, dy))]; });

  /* ---------- scenery ---------- */
  const segDist = (px, py, s) => {
    const dx = s[2] - s[0]; const dy = s[3] - s[1]; const L2 = dx * dx + dy * dy || 1;
    const t = clamp(((px - s[0]) * dx + (py - s[1]) * dy) / L2, 0, 1); return Math.hypot(px - (s[0] + dx * t), py - (s[1] + dy * t));
  };
  const nearBuilding = (x, y, m) => buildings.some((b) => Math.hypot((b.x - x) / (b.w / 2 + 22 + m), (b.y - y) / (46 + m)) < 1);
  const nearRoad = (x, y, m) => SEGS.some((s) => segDist(x, y, s) < s[4] / 2 + m) || buildings.some((b) => b.lane.some((p, i) => i && segDist(x, y, [b.lane[i - 1][0], b.lane[i - 1][1], p[0], p[1]]) < 10 + m));
  const insideWall = (x, y, m) => x > WALL.x0 + m && x < WALL.x1 - m && y > WALL.y0 + m && y < WALL.y1 - m;
  const riverY = (x) => -1010 + Math.sin(x / 260) * 24;
  const LAKE = { x: 1030, y: 950, rx: 130, ry: 70 }; const POND = { x: 1620, y: -60, rx: 70, ry: 38 };
  const inWater = (x, y, m) => Math.abs(y - riverY(x)) < 40 + m || [LAKE, POND].some((w) => ((x - w.x) / (w.rx + m)) ** 2 + ((y - w.y) / (w.ry + m)) ** 2 < 1);

  // city blocks, little grey-roofed houses, parks
  const blocks = []; const houses = []; const trees = [];
  const ROOFS = ['#7d8a96', '#6e7b87', '#8a6f64', '#6f8190'];
  for (let i = 0; i < LX.length - 1; i++) for (let j = 0; j < LY.length - 1; j++) {
    const hwx = (v) => roadW(v, LX) / 2 + 2; const hwy = (v) => roadW(v, LY) / 2 + 2;
    const blk = { x0: LX[i] + hwx(LX[i]), x1: LX[i + 1] - hwx(LX[i + 1]), y0: LY[j] + hwy(LY[j]), y1: LY[j + 1] - hwy(LY[j + 1]) };
    const h = (i * 7 + j * 13 + i * j) % 10; blk.kind = h < 2 ? 1 : h === 9 ? 2 : 0; blocks.push(blk);
    if (blk.kind === 1) {
      for (let n = 0; n < 5; n++) {
        const x = blk.x0 + 16 + rnd() * (blk.x1 - blk.x0 - 32); const y = blk.y0 + 14 + rnd() * (blk.y1 - blk.y0 - 28);
        if (!nearBuilding(x, y, -8)) trees.push({ x, y, s: 0.8 + rnd() * 0.5, c: rnd() });
      }
      continue;
    }
    const cols = Math.max(1, Math.floor((blk.x1 - blk.x0) / 52)); const rows = Math.max(1, Math.floor((blk.y1 - blk.y0) / 46));
    for (let cx = 0; cx < cols; cx++) for (let cy = 0; cy < rows; cy++) {
      if (rnd() < 0.28) continue;
      const x = blk.x0 + ((cx + 0.5) * (blk.x1 - blk.x0)) / cols + (rnd() - 0.5) * 8; const y = blk.y0 + ((cy + 0.62) * (blk.y1 - blk.y0)) / rows + (rnd() - 0.5) * 6;
      if (nearBuilding(x, y, 6)) continue;
      houses.push({ x, y, w: 24 + rnd() * 10, h: 13 + rnd() * 8, wall: WALLS[Math.floor(rnd() * WALLS.length)], roof: ROOFS[Math.floor(rnd() * ROOFS.length)] });
    }
    if (rnd() < 0.5) { const x = blk.x0 + 8 + rnd() * (blk.x1 - blk.x0 - 16); const y = blk.y0 + 8 + rnd() * (blk.y1 - blk.y0 - 16); if (!nearBuilding(x, y, 0) && !houses.some((q) => Math.hypot(q.x - x, (q.y - y) * 1.4) < 30)) trees.push({ x, y, s: 0.7 + rnd() * 0.4, c: rnd() }); }
  }
  // countryside trees
  for (let t = 0, tries = 0; t < 190 && tries < 3000; tries++) {
    const x = WORLD.x0 + 30 + rnd() * (WORLD.x1 - WORLD.x0 - 60); const y = WORLD.y0 + 150 + rnd() * (WORLD.y1 - WORLD.y0 - 190);
    if (insideWall(x, y, -90) || inWater(x, y, 24) || nearBuilding(x, y, 18) || nearRoad(x, y, 22)) continue;
    trees.push({ x, y, s: 0.75 + rnd() * 0.55, c: rnd() }); t++;
  }
  // fields
  const fields = [];
  for (let t = 0, tries = 0; t < 34 && tries < 1500; tries++) {
    const w = 90 + rnd() * 110; const h = 60 + rnd() * 70; const x = WORLD.x0 + 40 + rnd() * (WORLD.x1 - WORLD.x0 - 80 - w); const y = WORLD.y0 + 160 + rnd() * (WORLD.y1 - WORLD.y0 - 220 - h);
    const cxm = x + w / 2; const cym = y + h / 2;
    if ([[x, y], [x + w, y], [x, y + h], [x + w, y + h], [cxm, cym]].some(([a, b]) => insideWall(a, b, -90) || inWater(a, b, 30) || nearBuilding(a, b, 40) || nearRoad(a, b, 24))) continue;
    // sample the whole rectangle (tall buildings reach ~100px above their base)
    let clash = false;
    for (let gx = 0; gx <= 4 && !clash; gx++) for (let gy = 0; gy <= 3 && !clash; gy++) {
      const a = x + (w * gx) / 4; const b = y + (h * gy) / 3;
      if (nearBuilding(a, b, 40) || nearBuilding(a, b + 60, 40) || nearBuilding(a, b + 110, 30)) clash = true;
    }
    if (clash) continue;
    if (fields.some((f) => x < f.x + f.w + 16 && x + w + 16 > f.x && y < f.y + f.h + 16 && y + h + 16 > f.y)) continue;
    if (x < 1900 && x + w > 1340 && y < -150 && y + h > -660) continue; // keep the day-trip plot clear
    fields.push({ x, y, w, h, c: Math.floor(rnd() * 3), v: rnd() < 0.5 }); t++;
  }
  trees.forEach((t) => { if (fields.some((f) => t.x > f.x - 6 && t.x < f.x + f.w + 6 && t.y > f.y - 6 && t.y < f.y + f.h + 6)) t.dead = true; });
  for (let i = trees.length - 1; i >= 0; i--) if (trees[i].dead) trees.splice(i, 1);

  const lamps = [];
  for (let y = -440; y <= 300; y += 150) if (Math.abs(y) > 70) { lamps.push({ x: -26, y }); lamps.push({ x: 26, y: y + 6 }); }
  for (let x = -480; x <= 760; x += 150) if (Math.abs(x) > 70) { lamps.push({ x, y: -26 }); lamps.push({ x: x + 6, y: 26 }); }
  for (let y = 470; y <= 1000; y += 150) lamps.push({ x: 28, y });
  for (let y = -640; y >= -860; y -= 110) lamps.push({ x: 28, y });
  for (let x = 900; x <= 1200; x += 150) lamps.push({ x, y: 26 });

  const hills = [];
  for (let x = -860; x < 2020; x += 130 + rnd() * 60) hills.push({ x, y: -1095 + rnd() * 22, w: 200 + rnd() * 90, hgt: 110 + rnd() * 90, lean: (rnd() - 0.5) * 0.3, c: rnd() < 0.5 ? '#a3b4c4' : '#97aebf', snow: true });
  for (let x = 1380; x < 2010; x += 105) hills.push({ x, y: -770 + rnd() * 40, w: 160 + rnd() * 50, hgt: 70 + rnd() * 60, lean: (rnd() - 0.5) * 0.3, c: rnd() < 0.5 ? '#8fb56a' : '#a3c27a', snow: false });
  hills.push({ x: -850, y: 120, w: 170, hgt: 80, lean: 0.05, c: '#8fb56a', snow: false }, { x: -860, y: 330, w: 150, hgt: 60, lean: -0.05, c: '#a3c27a', snow: false });

  const boats = [
    { kind: 'lake', a: 0, v: 0.35, c: '#e8503a' }, { kind: 'lake', a: 3, v: -0.28, c: '#ffc93c' },
    { kind: 'river', x: -300, v: 22, c: '#ffffff' }, { kind: 'river', x: 1100, v: -18, c: '#e8503a' },
  ];
  const clouds = Array.from({ length: 9 }, () => ({ x: rnd() * 3200 - 1000, y: rnd() * 2300 - 1150, s: 0.6 + rnd() * 0.8, v: 6 + rnd() * 8 }));
  const tufts = Array.from({ length: 360 }, () => ({ x: WORLD.x0 + rnd() * (WORLD.x1 - WORLD.x0), y: WORLD.y0 + rnd() * (WORLD.y1 - WORLD.y0), s: 0.7 + rnd() * 0.7 }))
    .filter((t) => !insideWall(t.x, t.y, -70) && !inWater(t.x, t.y, 10) && !nearRoad(t.x, t.y, 6));

  /* ================= people ================= */
  const SHIRT = ['#ff8a5c', '#5b9bd5', '#ffd166', '#5cc8b0', '#ffffff', '#b48ad8', '#ff7aa2', '#7ccf6e'];
  const HAIR = ['#3b2a20', '#5a3d2b', '#2b2b3a', '#8a5a3c', '#c98f4e'];
  const people = [];
  const pickPlace = () => { let k; do { k = Math.floor(Math.random() * buildings.length); } while (buildings[k].p.far && Math.random() < 0.65); return k; };
  function goPlace(p, bi) {
    const b = buildings[bi]; p.to = bi; p.target = 'place';
    p.path = findPath(p.x, p.y, b.x + (Math.random() - 0.5) * 18, b.y + 16 + Math.random() * 6);
  }
  const personName = (p) => (p.owner ? tx('emperorName') : tx('names')[p.nameIdx % 20] + (p.nameIdx >= 20 ? '²' : ''));
  const targetName = (p) => (p.to !== undefined ? nameOf(buildings[p.to].p) : '');

  for (let i = 0; i < 34; i++) {
    const b = buildings[Math.floor(rnd() * buildings.length)];
    const p = {
      id: i, nameIdx: i, x: b.x + (rnd() - 0.5) * 20, y: b.y + 18,
      shirt: SHIRT[i % 8], hair: HAIR[i % 5], style: i % 4, v: 30 + rnd() * 18, k: 1,
      wait: rnd() * 6, ph: rnd() * 6, face: 1, say: '', sayT: 0, cool: rnd() * 6, path: [], moving: false, eatEmoji: '', eatT: 0, replyAt: 0, replyTxt: '',
    };
    goPlace(p, pickPlace());
    people.push(p);
  }
  const emperor = {
    id: 99, owner: true, nameIdx: 0, x: 0, y: 44, shirt: '#ffc93c', hair: '#2b2b3a', style: 4, v: 34, k: 1.35,
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
      if (Math.random() < 0.7) goPlace(p, pickPlace());
      else { const [nx, ny] = NODES[Math.floor(Math.random() * CITY_NODES)]; p.target = 'spot'; p.to = undefined; p.path = findPath(p.x, p.y, nx, ny); }
    } else {
      let n; do { n = pickPlace(); } while (n === p.to);
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

  function rectZoom(x0, y0, x1, y1) {
    const padX = isMobile() ? 16 : 70; const padY = isMobile() ? 190 : 150;
    return clamp(Math.min((W - padX * 2) / (x1 - x0), (H - padY * 2) / ((y1 - y0) * cam.ttilt)), 0.12, 1.3);
  }
  function fitRect(x0, y0, x1, y1) { cam.tz = rectZoom(x0, y0, x1, y1); cam.tx = (x0 + x1) / 2; cam.ty = (y0 + y1) / 2; }
  function fitAll() { fitRect(WORLD.x0, WORLD.y0, WORLD.x1, WORLD.y1 + 40); } // the whole countryside
  function fitCity() { fitRect(WALL.x0 - 90, WALL.y0 - 90, WALL.x1 + 90, WALL.y1 + 90); } // the walled city
  function fitStart() {
    if (isMobile()) { cam.tz = clamp(Math.min(W / 720, H / 640), 0.3, 1); cam.tx = -90; cam.ty = -20; }
    else fitCity();
  }
  let follow = null; let emperorMode = false;
  function flyTo(x, y, z) { cam.tx = x; cam.ty = y; if (z) cam.tz = Math.max(cam.tz, z); follow = null; refreshFollow(); }

  function zoomAt(px, py, f) {
    const wx = (px - W / 2) / cam.z + cam.x; const wy = (py - H / 2) / (cam.z * cam.tilt) + cam.y;
    const nz = clamp(cam.z * f, 0.12, 3);
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
    const dc = DIST[b.dist]; const roof = shade(dc.c, -0.22); const roofSide = shade(dc.c, -0.36);
    ell(5, 2, 28, 7, 'rgba(0,0,0,.18)');
    box(-w / 2, -h, w, h, b.wall);
    poly([[w / 2, 0], [w / 2 + d, -5], [w / 2 + d, -h - 5], [w / 2, -h]], shade(b.wall, -0.2));
    // roof (front + side)
    poly([[w / 2 + 5, -h + 1], [w / 2 + d + 5, -h - 4], [w / 2 + d - 5, -h - 19], [w / 2 - 5, -h - 14]], roofSide);
    poly([[-w / 2 - 5, -h + 1], [w / 2 + 5, -h + 1], [w / 2 - 5, -h - 14], [-w / 2 + 5, -h - 14]], roof);
    // awning stripes
    const sw = w / 6;
    for (let i = 0; i < 6; i++) box(-w / 2 + i * sw, -h + 1, sw, 8, i % 2 ? '#ffffff' : dc.c);
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
  function drawGate(b, night, noArch) {
    ell(6, 2, 46, 9, 'rgba(0,0,0,.18)');
    box(-36, -26, 72, 26, '#cbc3ae');
    poly([[36, 0], [46, -6], [46, -32], [36, -26]], '#a39b86');
    for (let i = 0; i < 9; i++) box(-36 + i * 8, -31, 5, 5, '#cbc3ae');
    if (!noArch) { g.beginPath(); g.moveTo(-10, 0); g.lineTo(-10, -14); g.quadraticCurveTo(0, -28, 10, -14); g.lineTo(10, 0); g.closePath(); g.fillStyle = '#4a3b30'; g.fill(); g.stroke(); }
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
  const strokeW = () => Math.max(1.2, 2.2 * cam.z);
  function rectPath(x0, y0, x1, y1, lift) {
    g.moveTo(sx(x0), sy(y0, lift)); g.lineTo(sx(x1), sy(y0, lift)); g.lineTo(sx(x1), sy(y1, lift)); g.lineTo(sx(x0), sy(y1, lift)); g.closePath();
  }
  function ellPath(x, y, rx, ry) { g.moveTo(sx(x) + rx * cam.z, sy(y)); g.ellipse(sx(x), sy(y), rx * cam.z, ry * cam.z * cam.tilt, 0, 0, TAU); }
  const wallDraw = (m) => { const o = WALL.t / 2 + m; return [WALL.x0 - o, WALL.y0 - o, WALL.x1 + o, WALL.y1 + o]; };

  function drawGround() {
    const z = cam.z; g.lineJoin = 'round'; g.lineCap = 'round';
    g.fillStyle = '#bfe6f7'; g.fillRect(0, 0, W, H); // sky behind the floating world
    // earth slab
    const depth = 50;
    const fx0 = sx(WORLD.x0); const fx1 = sx(WORLD.x1); const fy0 = sy(WORLD.y1); const fy1 = sy(WORLD.y1, -depth);
    g.lineWidth = 3 * Math.max(z, 0.6); g.strokeStyle = INK;
    g.fillStyle = '#b98f63'; g.fillRect(fx0, fy0, fx1 - fx0, fy1 - fy0); g.strokeRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
    g.fillStyle = '#a57d52'; g.fillRect(fx0, fy0 + (fy1 - fy0) * 0.55, fx1 - fx0, (fy1 - fy0) * 0.45);
    g.beginPath(); rectPath(WORLD.x0, WORLD.y0, WORLD.x1, WORLD.y1, 0); g.fillStyle = '#a5db86'; g.fill(); g.stroke();
    // grass tufts
    g.save(); g.strokeStyle = '#7fbf63'; g.lineWidth = Math.max(1, 1.6 * z); g.beginPath();
    for (const t of tufts) {
      const X = sx(t.x); const Y = sy(t.y); if (!onScreen(X, Y, 20)) continue; const s = 5 * z * t.s;
      g.moveTo(X - s, Y); g.lineTo(X - s * 0.6, Y - s * 1.2); g.moveTo(X, Y); g.lineTo(X, Y - s * 1.5); g.moveTo(X + s, Y); g.lineTo(X + s * 0.6, Y - s * 1.2);
    }
    g.stroke(); g.restore();
    // fields
    const FC = [['#f3dc7a', '#e0c04f'], ['#c9e58a', '#a9cc62'], ['#e7c79a', '#cfa66c']];
    g.lineWidth = Math.max(1.2, 2 * z);
    for (const f of fields) {
      const X0 = sx(f.x); const X1 = sx(f.x + f.w); const Y0 = sy(f.y); const Y1 = sy(f.y + f.h); if (X1 < 0 || X0 > W || Y1 < 0 || Y0 > H) continue;
      g.beginPath(); rectPath(f.x, f.y, f.x + f.w, f.y + f.h, 0); g.fillStyle = FC[f.c][0]; g.fill(); g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.strokeStyle = FC[f.c][1]; g.lineWidth = Math.max(1, 3 * z);
      if (f.v) for (let x = f.x + 10; x < f.x + f.w - 4; x += 12) { g.moveTo(sx(x), Y0 + 3); g.lineTo(sx(x), Y1 - 3); }
      else for (let y = f.y + 9; y < f.y + f.h - 4; y += 11) { g.moveTo(X0 + 3, sy(y)); g.lineTo(X1 - 3, sy(y)); }
      g.stroke(); g.lineWidth = Math.max(1.2, 2 * z);
    }
    // river (Wei) along the north, lake and pond
    g.beginPath(); for (let x = WORLD.x0; x <= WORLD.x1 + 40; x += 40) { if (x === WORLD.x0) g.moveTo(sx(x), sy(riverY(x))); else g.lineTo(sx(x), sy(riverY(x))); }
    g.strokeStyle = INK; g.lineWidth = 54 * z; g.lineCap = 'butt'; g.stroke(); g.strokeStyle = '#58b9d6'; g.lineWidth = 48 * z; g.stroke(); g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = Math.max(1, 2 * z); g.setLineDash([14 * z, 30 * z]); g.lineDashOffset = -time * 12 * z; g.beginPath();
    for (let x = WORLD.x0; x <= WORLD.x1 + 40; x += 40) { if (x === WORLD.x0) g.moveTo(sx(x), sy(riverY(x) + 6)); else g.lineTo(sx(x), sy(riverY(x) + 6)); }
    g.stroke(); g.setLineDash([]);
    for (const w of [LAKE, POND]) {
      g.beginPath(); ellPath(w.x, w.y, w.rx + 8, w.ry + 8); g.fillStyle = '#f1e2b8'; g.fill(); g.strokeStyle = INK; g.lineWidth = Math.max(1.2, 2.2 * z); g.stroke();
      g.beginPath(); ellPath(w.x, w.y, w.rx, w.ry); g.fillStyle = '#58b9d6'; g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = Math.max(1, 2 * z); g.beginPath();
      for (let i = 0; i < 4; i++) { const a = time * 0.4 + i * 1.6; const X = sx(w.x + Math.cos(a) * w.rx * 0.5); const Y = sy(w.y + Math.sin(a) * w.ry * 0.5); g.moveTo(X - 7 * z, Y); g.quadraticCurveTo(X, Y - 4 * z, X + 7 * z, Y); }
      g.stroke();
    }
    // district ground: Muslim Quarter market pad, plazas under outer landmarks, the day-trip plot
    for (const k of ORDER) {
      const d = DIST[k]; const mem = buildings.filter((b) => b.dist === k); const tint = mix(d.c, '#ffffff', 0.62);
      g.fillStyle = tint; g.strokeStyle = shade(d.c, -0.25); g.lineWidth = Math.max(1.2, 2 * z); g.setLineDash([10 * z, 7 * z]);
      if (k === 'muslim' || k === 'trip') {
        const m = k === 'trip' ? 130 : 56; const x0 = Math.min(...mem.map((b) => b.x)) - m - 30; const x1 = Math.max(...mem.map((b) => b.x)) + m + 30;
        const y0 = Math.min(...mem.map((b) => b.y)) - m - 30; const y1 = Math.max(...mem.map((b) => b.y)) + m;
        g.globalAlpha = k === 'trip' ? 0.9 : 0.55; g.beginPath(); rectPath(x0, y0, x1, y1, 0); g.fill(); g.globalAlpha = 1; g.stroke();
      } else if (k !== 'core') {
        for (const b of mem) { g.beginPath(); ellPath(b.x, b.y + 6, b.kind.big ? 150 : 66, b.kind.big ? 74 : 38); g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1; g.stroke(); }
      }
      g.setLineDash([]);
    }
    // dirt roads outside the wall
    g.lineCap = 'butt'; g.lineJoin = 'round';
    for (const edge of [true, false]) {
      g.beginPath();
      for (const s of SEGS) { if (!s[5]) continue; g.moveTo(sx(s[0]), sy(s[1])); g.lineTo(sx(s[2]), sy(s[3])); }
      g.strokeStyle = edge ? '#b89355' : '#f0d9a0'; g.lineWidth = (edge ? 27 : 22) * z; g.stroke();
    }
    g.lineCap = 'round';
    // moat
    const mo = wallDraw(58); const mi = wallDraw(8);
    g.beginPath(); rectPath(mo[0], mo[1], mo[2], mo[3], 0); rectPath(mi[0], mi[1], mi[2], mi[3], 0);
    g.fillStyle = '#58b9d6'; g.fill('evenodd'); g.strokeStyle = INK; g.lineWidth = Math.max(1.2, 2.2 * z); g.stroke();
    const ms = wallDraw(33); g.beginPath(); rectPath(ms[0], ms[1], ms[2], ms[3], 0);
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = Math.max(1, 2.2 * z); g.setLineDash([12 * z, 30 * z]); g.lineDashOffset = -time * 10 * z; g.stroke(); g.setLineDash([]);
    // inside the wall: street-coloured ground, blocks, avenues
    g.beginPath(); rectPath(WALL.x0, WALL.y0, WALL.x1, WALL.y1, 0); g.fillStyle = '#ecd9a8'; g.fill();
    const BC = ['#f7edcd', '#cfe8b0', '#efdcae'];
    for (const b of blocks) {
      const X0 = sx(b.x0); const X1 = sx(b.x1); const Y0 = sy(b.y0); const Y1 = sy(b.y1); if (X1 < -4 || X0 > W + 4 || Y1 < -4 || Y0 > H + 4) continue;
      rr(X0, Y0, X1 - X0, Y1 - Y0, 5 * z); g.fillStyle = BC[b.kind]; g.fill();
    }
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = Math.max(1, 2 * z); g.setLineDash([16 * z, 14 * z]); g.beginPath();
    g.moveTo(sx(0), sy(LY[0])); g.lineTo(sx(0), sy(LY[LY.length - 1])); g.moveTo(sx(LX[0]), sy(0)); g.lineTo(sx(LX[LX.length - 1]), sy(0)); g.stroke(); g.setLineDash([]);
    // lanes from every door to the street
    g.strokeStyle = '#f0d9a0'; g.lineWidth = 9 * z; g.lineCap = 'butt'; g.beginPath();
    for (const b of buildings) b.lane.forEach((p, i) => (i ? g.lineTo(sx(p[0]), sy(p[1])) : g.moveTo(sx(p[0]), sy(p[1]))));
    g.stroke(); g.lineCap = 'round';
    // bridges over the moat at the four gates
    const gates = [[0, WALL.y1, 0, 1], [0, WALL.y0, 0, -1], [WALL.x1, 0, 1, 0], [WALL.x0, 0, -1, 0]];
    for (const [gx, gy, dx, dy] of gates) {
      const a = WALL.t / 2 + 6; const b = WALL.t / 2 + 56; const hw = 20;
      const x0 = dx ? gx + Math.min(a * dx, b * dx) : gx - hw; const x1 = dx ? gx + Math.max(a * dx, b * dx) : gx + hw;
      const y0 = dy ? gy + Math.min(a * dy, b * dy) : gy - hw; const y1 = dy ? gy + Math.max(a * dy, b * dy) : gy + hw;
      g.beginPath(); rectPath(x0, y0, x1, y1, 0); g.fillStyle = '#d9a86c'; g.fill(); g.strokeStyle = INK; g.lineWidth = Math.max(1.2, 2.2 * z); g.stroke();
      g.strokeStyle = 'rgba(110,70,35,.55)'; g.lineWidth = Math.max(1, 1.6 * z); g.beginPath();
      if (dy) for (let y = y0 + 6; y < y1; y += 8) { g.moveTo(sx(x0), sy(y)); g.lineTo(sx(x1), sy(y)); } else for (let x = x0 + 6; x < x1; x += 8) { g.moveTo(sx(x), sy(y0)); g.lineTo(sx(x), sy(y1)); }
      g.stroke();
    }
  }

  /* ---------- walls, turrets, gates, houses, hills (drawn y-sorted with everything else) ---------- */
  const statics = [];
  function wallBlock(x0, y0, x1, y1, o) {
    const z = cam.z; const h = WALL.h;
    const X0 = sx(x0); const X1 = sx(x1); const T0 = sy(y0, h); const T1 = sy(y1, h); const B1 = sy(y1);
    if (X1 < -20 || X0 > W + 20 || B1 < -60 || T0 > H + 20) return;
    g.lineWidth = strokeW(); g.strokeStyle = INK; g.lineJoin = 'round';
    g.fillStyle = '#ebe1c6'; g.fillRect(X0, T0, X1 - X0, T1 - T0);
    if (o.front) {
      g.fillStyle = '#cdbd99'; g.fillRect(X0, T1, X1 - X0, B1 - T1);
      g.save(); g.strokeStyle = 'rgba(90,65,40,.28)'; g.lineWidth = Math.max(1, 1.4 * z); g.beginPath();
      for (let i = 1; i < 3; i++) { const yy = T1 + ((B1 - T1) * i) / 3; g.moveTo(X0, yy); g.lineTo(X1, yy); }
      for (let r = 0; r < 3; r++) for (let x = x0 + (r % 2 ? 11 : 0); x < x1; x += 22) { g.moveTo(sx(x), T1 + ((B1 - T1) * r) / 3); g.lineTo(sx(x), T1 + ((B1 - T1) * (r + 1)) / 3); }
      g.stroke(); g.restore();
      g.strokeRect(X0, T1, X1 - X0, B1 - T1);
    }
    g.beginPath();
    if (o.side && !o.first) { g.moveTo(X0, T1); g.lineTo(X0, T0); g.moveTo(X1, T0); g.lineTo(X1, T1); }
    else { g.moveTo(X0, T1); g.lineTo(X0, T0); g.lineTo(X1, T0); g.lineTo(X1, T1); }
    g.stroke();
    if (o.front) { g.beginPath(); g.moveTo(X0, T1); g.lineTo(X1, T1); g.stroke(); }
    // merlons
    g.fillStyle = '#dccfae'; const mw = 8 * z; const mh = 7 * z;
    if (o.side) { for (let yy = y0 + 6; yy < y1 - 3; yy += 16) { const Y = sy(yy, h) - mh * 0.6; g.fillRect(X0 - 1, Y, mw, mh); g.strokeRect(X0 - 1, Y, mw, mh); g.fillRect(X1 - mw + 1, Y, mw, mh); g.strokeRect(X1 - mw + 1, Y, mw, mh); } }
    else { for (let x = x0 + 4; x < x1 - 8; x += 16) { const X = sx(x); g.fillRect(X, T1 - mh, mw, mh); g.strokeRect(X, T1 - mh, mw, mh); g.fillRect(X, T0 - mh, mw, mh); g.strokeRect(X, T0 - mh, mw, mh); } }
  }
  const HT = WALL.t / 2;
  statics.push({ y: WALL.y0 + HT, f: () => wallBlock(WALL.x0 - HT, WALL.y0 - HT, WALL.x1 + HT, WALL.y0 + HT, { front: true }) });
  statics.push({ y: WALL.y1 + HT, f: () => wallBlock(WALL.x0 - HT, WALL.y1 - HT, WALL.x1 + HT, WALL.y1 + HT, { front: true }) });
  [WALL.x0, WALL.x1].forEach((wx) => {
    const cuts = [WALL.y0 + HT, -40, 40]; for (let y = 100; y < WALL.y1 - HT; y += 60) cuts.push(y); for (let y = -100; y > WALL.y0 + HT + 10; y -= 60) cuts.push(y); cuts.push(WALL.y1 - HT);
    cuts.sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) { const a = cuts[i - 1]; const b = cuts[i]; statics.push({ y: b, f: () => wallBlock(wx - HT, a, wx + HT, b, { side: true, first: i === 1, front: i === cuts.length - 1 }) }); }
  });
  // corner turrets
  function drawTurret(x, y, night) {
    const X = sx(x); const Y = sy(y); const k = cam.z; if (!onScreen(X, Y, 90 * k)) return;
    g.save(); g.translate(X, Y); g.scale(k, k); g.lineWidth = Math.max(1.3 / k, 2); g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = INK;
    ell(5, 3, 34, 9, 'rgba(0,0,0,.2)');
    box(-24, -WALL.h - 12, 48, WALL.h + 12, '#cdbd99');
    poly([[24, 0], [32, -6], [32, -WALL.h - 18], [24, -WALL.h - 12]], '#a99a78');
    for (let i = 0; i < 3; i++) box(-24 + i * 17, -WALL.h - 18, 14, 6, '#dccfae');
    box(-15, -WALL.h - 38, 30, 26, '#c8553d');
    box(-4, -WALL.h - 33, 8, 10, night > 0.2 ? '#ffd873' : '#7a2f20', 2);
    roofShape(-WALL.h - 38, 58, 32, 14, '#5c6670');
    if (night > 0.2) lights.push([0, -WALL.h - 26, 36, '255,190,90']);
    g.restore(); flushLights(X, Y, k);
  }
  [[WALL.x0, WALL.y0, WALL.y0 + 61 + HT], [WALL.x1, WALL.y0, WALL.y0 + 61 + HT], [WALL.x0, WALL.y1, WALL.y1 + HT + 12], [WALL.x1, WALL.y1, WALL.y1 + HT + 12]]
    .forEach(([x, y, key]) => statics.push({ y: key, f: () => drawTurret(x, y, env.n) }));
  // the other three gates (the South Gate is a real, clickable landmark)
  function drawDecoGate(x, y, side) {
    const X = sx(x); const Y = sy(y) - (side ? (WALL.h - 4) * cam.z : 0); const k = cam.z; if (!onScreen(X, Y, 100 * k)) return;
    g.save(); g.translate(X, Y); g.scale(k, k); g.lineWidth = Math.max(1.3 / k, 2); g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = INK;
    drawGate({}, env.n, side); g.restore(); flushLights(X, Y, k);
  }
  statics.push({ y: WALL.y0 + HT + 4, f: () => drawDecoGate(0, WALL.y0 + HT, false) });
  statics.push({ y: 41, f: () => drawDecoGate(WALL.x1, 0, true) });
  statics.push({ y: 41, f: () => drawDecoGate(WALL.x0, 0, true) });

  // teleport portal, just inside the South Gate
  const PORTAL = (() => {
    let best = [-140, 250]; let bd = -1;
    for (let x = -360; x <= 360; x += 20) for (let y = 120; y <= 320; y += 20) {
      const d = Math.min(...buildings.map((b) => Math.hypot(b.x - x, (b.y - y) * 1.3)), ...houses.map((h) => Math.hypot(h.x - x, (h.y - y) * 1.3) + 30), ...trees.map((t) => Math.hypot(t.x - x, (t.y - y) * 1.3) + 40));
      if (d > bd) { bd = d; best = [x, y]; }
    }
    return { x: best[0], y: best[1] };
  })();
  if (window.TELE) statics.push({ y: PORTAL.y, f: () => window.TELE.draw(g, sx(PORTAL.x), sy(PORTAL.y), cam.z, time, env.n) });
  buildings.forEach((b) => statics.push({ y: b.y + 6, f: () => drawBuilding(b) }));
  trees.forEach((t) => statics.push({ y: t.y, f: () => drawTree(t) }));
  lamps.forEach((l) => statics.push({ y: l.y, f: () => drawLamp(l) }));
  houses.forEach((h) => statics.push({ y: h.y, f: () => drawHouse(h) }));
  hills.forEach((h) => statics.push({ y: h.y, f: () => drawHill(h) }));
  statics.sort((a, b) => a.y - b.y);

  function drawHouse(h) {
    const X = sx(h.x); const Y = sy(h.y); const k = cam.z; if (!onScreen(X, Y, 40 * k)) return;
    g.save(); g.translate(X, Y); g.scale(k, k); g.lineWidth = Math.max(1.1 / k, 1.6); g.lineJoin = 'round'; g.strokeStyle = INK;
    const w = h.w; const hh = h.h;
    box(-w / 2, -hh, w, hh, h.wall, 1.5);
    poly([[-w / 2 - 4, -hh + 1], [w / 2 + 4, -hh + 1], [w / 2 - 3, -hh - 9], [-w / 2 + 3, -hh - 9]], h.roof);
    box(-2.5, -7, 5, 7, '#7a4e32', 1);
    g.restore();
  }
  function drawHill(h) {
    const X = sx(h.x); const Y = sy(h.y); const w = h.w * cam.z; const hh = h.hgt * cam.z; if (X + w < 0 || X - w > W || Y - hh > H || Y + 14 < 0) return;
    g.lineWidth = Math.max(1.4, 2.4 * cam.z); g.lineJoin = 'round'; g.strokeStyle = INK;
    const px = X + h.lean * w; const py = Y - hh;
    g.beginPath(); g.moveTo(X - w / 2, Y); g.quadraticCurveTo(X - w * 0.2, Y - hh * 0.6, px, py); g.quadraticCurveTo(X + w * 0.2, Y - hh * 0.55, X + w / 2, Y); g.closePath(); g.fillStyle = h.c; g.fill();
    g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(X + w * 0.2, Y - hh * 0.55, X + w / 2, Y); g.lineTo(X + w * 0.02, Y); g.quadraticCurveTo(px + w * 0.02, Y - hh * 0.5, px, py); g.closePath(); g.fillStyle = shade(h.c, -0.14); g.fill();
    if (h.snow) { g.beginPath(); g.moveTo(px, py); g.lineTo(px + w * 0.11, py + hh * 0.22); g.lineTo(px + w * 0.04, py + hh * 0.18); g.lineTo(px - w * 0.02, py + hh * 0.27); g.lineTo(px - w * 0.07, py + hh * 0.2); g.lineTo(px - w * 0.12, py + hh * 0.26); g.closePath(); g.fillStyle = '#ffffff'; g.fill(); }
    g.beginPath(); g.moveTo(X - w / 2, Y); g.quadraticCurveTo(X - w * 0.2, Y - hh * 0.6, px, py); g.quadraticCurveTo(X + w * 0.2, Y - hh * 0.55, X + w / 2, Y); g.stroke();
  }

  function boatPos(b) {
    if (b.kind === 'lake') return [LAKE.x + Math.cos(b.a) * LAKE.rx * 0.55, LAKE.y + Math.sin(b.a) * LAKE.ry * 0.5];
    return [b.x, riverY(b.x) + 4];
  }
  function drawBoat(b) {
    const [x, y] = boatPos(b); const X = sx(x); const Y = sy(y) + Math.sin(time * 2 + (b.a || b.x)) * 1.5; if (!onScreen(X, Y, 40)) return;
    const k = Math.max(cam.z, 0.5); g.save(); g.translate(X, Y); g.scale(k, k);
    g.lineWidth = Math.max(1.2 / k, 1.6); g.strokeStyle = INK; g.lineJoin = 'round';
    ell(0, 3, 12, 3, 'rgba(0,50,80,.25)');
    poly([[-11, -4], [11, -4], [7, 3], [-7, 3]], b.c); g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -18); g.stroke(); poly([[0, -18], [9, -8], [0, -8]], '#ffffff');
    g.restore();
  }
  function moveBoats(dt) {
    for (const b of boats) {
      if (b.kind === 'lake') b.a += b.v * dt;
      else { b.x += b.v * dt; if (b.x > WORLD.x1 + 40) b.x = WORLD.x0 - 40; if (b.x < WORLD.x0 - 40) b.x = WORLD.x1 + 40; }
    }
  }

  function drawClouds() {
    for (const c of clouds) {
      if (!paused) { c.x += c.v * lastDt; if (c.x > 2300) c.x = -1100; }
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
  function pillRect(text, x, y, size) { g.font = `600 ${size}px ${FONT}`; const w = g.measureText(text).width + 18; const h = size + 11; return [x - w / 2, y - h, w, h]; }
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
  const LABEL_AT = (() => {
    const at = { core: [380, -250] };
    ORDER.forEach((k) => {
      if (at[k]) return; const mem = buildings.filter((b) => b.dist === k);
      at[k] = [mem.reduce((a, b) => a + b.x, 0) / mem.length, Math.min(...mem.map((b) => b.y)) - (k === 'trip' ? 140 : k === 'daming' ? 100 : 90)];
    });
    return at;
  })();
  const TRIP_SIGN = [1010, -30];
  function drawLabels() {
    const taken = [];
    const free = (r) => !taken.some((t) => r[0] < t[0] + t[2] && r[0] + r[2] > t[0] && r[1] < t[1] + t[3] && r[1] + r[3] > t[1]);
    // district titles
    if (labelsOn && cam.z < 1.5) {
      ORDER.forEach((key) => {
        const d = DIST[key]; const [wx, wy] = LABEL_AT[key]; const X = sx(wx); const Y = sy(wy);
        if (!onScreen(X, Y, 140)) return;
        const size = clamp(15 * Math.sqrt(cam.z), 12, 18); const text = `${tx('districts')[key]} · ${d.count}`;
        pill(text, X, Y, { size, bg: mix(d.c, '#ffffff', 0.72) }); taken.push(pillRect(text, X, Y, size));
      });
      if (cam.z > 0.3) { const X = sx(TRIP_SIGN[0]); const Y = sy(TRIP_SIGN[1]); if (onScreen(X, Y, 140)) pill(tx('tripSign'), X, Y, { size: 12, bg: '#ffe9f1' }); }
    }
    if (labelsOn && window.TELE && cam.z > 0.2 && cam.z < 1.6) {
      const X = sx(PORTAL.x); const Y = sy(PORTAL.y, 92 + 14 / cam.z); const text = '🌀 ' + window.TELE.portalLabel();
      if (onScreen(X, Y, 80)) { const r = pillRect(text, X, Y, 12); if (free(r)) { pill(text, X, Y, { size: 12, bg: '#e9e3ff' }); taken.push(r); } }
    }
    // place names: landmarks first, then food; overlapping tags are skipped
    const list = [...buildings].sort((a, b) => (selId === b.id) - (selId === a.id) || (hoverB === b) - (hoverB === a) || (b.p.type === 'sight') - (a.p.type === 'sight') || a.y - b.y);
    for (const b of list) {
      const forced = hoverB === b || selId === b.id;
      const show = forced || (labelsOn && (b.p.type === 'sight' ? cam.z >= 0.55 : cam.z >= 1.1));
      if (!show || !b.hit) continue;
      const x = b.hit.x + b.hit.w / 2; const y = b.hit.y - (b.p.type === 'sight' ? 14 * cam.z : 0); const r = pillRect(nameOf(b.p), x, y, 13);
      if (!forced && !free(r)) continue;
      pill(nameOf(b.p), x, y, { size: 13, bg: selId === b.id ? '#ffe680' : undefined }); taken.push(r);
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
    if (planPath.length > 1) {
      g.beginPath(); planPath.forEach((p, i) => (i ? g.lineTo(sx(p[0]), sy(p[1])) : g.moveTo(sx(p[0]), sy(p[1]))));
      g.strokeStyle = INK; g.lineWidth = 7; g.setLineDash([]); g.globalAlpha = 0.9; g.stroke();
      g.strokeStyle = '#ffc93c'; g.lineWidth = 4; g.setLineDash([10, 8]); g.lineDashOffset = -time * 20; g.stroke();
    }
    g.setLineDash([]); g.globalAlpha = 1;
    planRoute.forEach((id, i) => {
      const b = bById.get(id); const X = sx(b.x); const Y = sy(b.y + 16);
      g.beginPath(); g.arc(X, Y, 13, 0, TAU); g.fillStyle = '#e8503a'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
      g.fillStyle = '#fff'; g.font = `700 14px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), X, Y + 1);
    });
    g.restore();
  }

  /* ---------- frame ---------- */
  let labelsOn = true; let paused = false; let hoverB = null; let selId = null; let followP = null; let planRoute = []; let planPath = [];
  let lastDt = 0.016;
  function render() {
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    litList.length = 0;
    drawGround();

    // everything standing on the ground, back to front: the static scenery merged with the moving things
    const dyn = [];
    people.forEach((p) => dyn.push({ y: p.y + 1, f: () => drawPerson(p) }));
    boats.forEach((b) => dyn.push({ y: boatPos(b)[1], f: () => drawBoat(b) }));
    dyn.sort((a, b) => a.y - b.y);
    let di = 0;
    for (let si = 0; si < statics.length; si++) {
      while (di < dyn.length && dyn[di].y <= statics[si].y) dyn[di++].f();
      statics[si].f();
    }
    while (di < dyn.length) dyn[di++].f();

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
    if (!paused) { time += dt; updatePeople(dt, time); moveBoats(dt); chatT += dt; if (chatT > 0.7) { chatT = 0; chatter(time); } }
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
  const hitPortal = (x, y) => !!window.TELE && window.TELE.hit(x, y, sx(PORTAL.x), sy(PORTAL.y), cam.z);
  function hover(x, y) {
    if (hitPortal(x, y)) { hoverB = null; cv.style.cursor = 'pointer'; return; }
    const p = hitPerson(x, y); const b = p ? null : hitBuilding(x, y);
    hoverB = b; cv.style.cursor = p || b ? 'pointer' : '';
  }
  function clickAt(x, y) {
    if (hitPortal(x, y)) { window.TELE.open(); return; }
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
    const p = b.p; const d = DIST[b.dist]; const fav = favs.has(p.id); const inRoute = planSel.has(p.id);
    card.innerHTML =
      `<button class="x" type="button" aria-label="${esc(tx('close'))}">×</button>` +
      `<div class="sign" style="background:${d.c}">${p.emoji}</div>` +
      `<div class="body"><h2 lang="${lang}">${esc(nameOf(p))}</h2><div class="sub" lang="${lang === 'zh' ? 'en' : 'zh'}">${esc(subOf(p))}</div>` +
      `<div class="tags"><span class="tag" style="background:${mix(d.c, '#ffffff', 0.55)}">${esc(tx('districts')[b.dist])}</span><span class="tag">${esc(typeLabel(p))}${p.far ? ' · ' + esc(tx('dayTrip')) : ''}</span></div>` +
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
    ORDER.forEach((k) => mk(k, tx('districts')[k], DIST[k].c));
  }
  function buildList() {
    const q = query.trim().toLowerCase(); const out = $('list'); out.replaceChildren(); let any = false;
    ORDER.forEach((k) => {
      if (catFilter !== 'all' && catFilter !== 'fav' && catFilter !== k) return;
      const rows = buildings.filter((b) => b.dist === k && (catFilter !== 'fav' || favs.has(b.id)) &&
        (!q || [b.p.name, b.p.zh, placeText(b.p, 'blurb'), placeText(b.p, 'tip')].join(' ').toLowerCase().includes(q)));
      if (!rows.length) return; any = true;
      const h = document.createElement('h4'); h.textContent = tx('districts')[k]; out.appendChild(h);
      rows.forEach((b) => {
        const it = document.createElement('button'); it.type = 'button'; it.className = 'it' + (selId === b.id ? ' sel' : ''); it.dataset.id = b.id;
        it.innerHTML = `<span class="em" style="background:${mix(DIST[k].c, '#ffffff', 0.6)}">${b.p.emoji}</span><span class="tx"><span lang="${lang}">${esc(nameOf(b.p))}</span><small lang="${lang === 'zh' ? 'en' : 'zh'}">${esc(subOf(b.p))}</small></span>${favs.has(b.id) ? '<span class="star">⭐</span>' : ''}`;
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
      const rows = buildings.filter((b) => b.dist === k); if (!rows.length) return;
      const h = document.createElement('h4'); h.innerHTML = `<i style="background:${DIST[k].c}"></i>${esc(tx('districts')[k])}`; out.appendChild(h);
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
    if (planSel.size < 2) { out.innerHTML = `<div class="muted">${esc(tx('needTwo'))}</div>`; planRoute = []; planPath = []; return; }
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
    stopFollow();
    planPath = [];
    for (let i = 1; i < xs.length; i++) { const a = doorOf(xs[i - 1]); const c = doorOf(xs[i]); findPath(a[0], a[1], c[0], c[1]).forEach((p, k) => { if (planPath.length && !k) return; planPath.push(p); }); }
    cam.tx = (minX + maxX) / 2; cam.ty = (minY + maxY) / 2 - 10;
    const availW = isMobile() ? W : W - 460; cam.tz = clamp(Math.min(availW / (maxX - minX + 340), (H * (isMobile() ? 0.4 : 0.75)) / ((maxY - minY + 220) * cam.ttilt)), 0.12, 1.3);
    if (!isMobile()) cam.tx -= (W - availW) / 2 / cam.tz;
  }
  $('pGo').onclick = planRouteNow;
  $('pClear').onclick = () => { planSel.clear(); planRoute = []; planPath = []; $('pOut').innerHTML = ''; buildPlanList(); if (selId) renderCard(); };
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
  $('bAll').onclick = () => { stopFollow(); closeCard(); if (Math.abs(cam.tz - rectZoom(WORLD.x0, WORLD.y0, WORLD.x1, WORLD.y1 + 40)) < 0.04) fitCity(); else fitAll(); };
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
    if (window.TELE) window.TELE.refresh();
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
  if (window.TELE) window.TELE.init({ here: 'xian', getLang: () => lang });
  { const pq = new URLSearchParams(location.search).get('portal'); if (pq) { Object.assign(cam, { x: PORTAL.x, y: PORTAL.y - 20, z: 1.1, tx: PORTAL.x, ty: PORTAL.y - 20, tz: 1.1 }); if (pq === 'open') window.TELE.open(); } }
  addLog(esc(tx('decreeFirst')), 'own', true);
  let introSeen = false; try { introSeen = !!localStorage.getItem(INTRO_KEY); } catch (e) { /* ignore */ }
  if (!introSeen && !new URLSearchParams(location.search).has('nointro')) openIntro(0);
  const qs = new URLSearchParams(location.search);
  if (qs.get('tod') && TOD[+qs.get('tod')]) { todIdx = +qs.get('tod'); Object.assign(env, { m: [...TOD[todIdx].m], n: TOD[todIdx].n }); syncTodButtons(); }
  // warm the world up so the crowd isn't all spawned in a clump
  const warm = qs.has('warm') ? +qs.get('warm') || 0 : 25;
  if (!paused) for (let i = 0; i < warm * 10; i++) { time += 0.1; updatePeople(0.1, time); if (i % 7 === 0) chatter(time); }
  if (qs.get('cam')) { const [cx, cy, cz] = qs.get('cam').split(',').map(Number); Object.assign(cam, { x: cx, y: cy, z: cz, tx: cx, ty: cy, tz: cz }); }
  if (qs.get('view') === 'world') { fitAll(); cam.x = cam.tx; cam.y = cam.ty; cam.z = cam.tz; }
  if (qs.get('panel') && PANELS[qs.get('panel')]) openPanel(qs.get('panel'));
  if (qs.get('sel') && bById.has(qs.get('sel'))) selectBuilding(bById.get(qs.get('sel')));
  if (qs.get('route')) { qs.get('route').split(',').forEach((id) => bById.has(id) && planSel.add(id)); buildPlanList(); openPanel('plan'); planRouteNow(); }
  requestAnimationFrame(frame);

  // small hook for debugging/tests
  window.__city = { cam, buildings, people, selectBuilding: (id) => selectBuilding(bById.get(id)), openPanel };
})();
