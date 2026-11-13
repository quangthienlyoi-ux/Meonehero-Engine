/* ============================================================
   MNHR-engine — engine.js Alpha 9.0.0
   Auto-detect đa frame + Hệ thống Biến (Events)
   ============================================================ */
window.MNHR = (function () {
'use strict';

/* ============================================================
   MINI RUNTIME — self-contained (embedded verbatim in export)
   ============================================================ */
function MiniRuntime() {
  const VW = 640, VH = 360;
  const BASE_SPEED = 2.6, BASE_JUMP = 9.2, BASE_GRAVITY = 0.55;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  function defaultUI() {
    return {
      mode: 'arrows',
      layout: {
        left:  { x: 42,        y: VH - 46, r: 26 },
        right: { x: 106,       y: VH - 46, r: 26 },
        fire:  { x: VW - 104,  y: VH - 46, r: 24 },
        jump:  { x: VW - 46,   y: VH - 46, r: 28 },
        joyBase: { x: 90, y: VH - 80, r: 56 },
        joyKnob: { x: 90, y: VH - 80, r: 24 }
      },
      buttons: [],
      mainMenu: {
        enabled: false, title: 'MNHR Game', subtitle: 'Nhấn để chơi',
        bg: '#0e1116', titleColor: '#ffb86b', subColor: '#a8b6cc'
      }
    };
  }

  /* ---------- HITBOXES ---------- */
  function frameOf(it) {
    const A = it.animations; if (!A) return null;
    const an = it.kind === 'sprite' ? (A[it._state] || A.idle) : A.default;
    if (!an || !an.frames || !an.frames.length) return null;
    return an.frames[(it._animFrame || 0) % an.frames.length] || null;
  }
  function cleanList(L) {   // hitbox hỏng (NaN / kích thước <= 0) không được làm nhân vật xuyên map
    for (let i = 0; i < L.length; i++) {
      const h = L[i];
      if (!isFinite(h.ox) || !isFinite(h.oy) || !(h.w > 0) || !(h.h > 0)) {
        return L.map(b => ({ ox: +b.ox || 0, oy: +b.oy || 0, w: Math.max(1, +b.w || 1), h: Math.max(1, +b.h || 1) }));
      }
    }
    return L;
  }
  function hbList(it) {
    const f = frameOf(it);
    if (f && f.hitboxes && f.hitboxes.length) return cleanList(f.hitboxes);
    return (it.hitboxes && it.hitboxes.length) ? cleanList(it.hitboxes) : null;
  }
  function faceOf(it) { return it.kind === 'sprite' && it._facing < 0 ? -1 : 1; }
  function scOf(it) { return (it.kind === 'sprite' && it._scaleBuff && it._scaleBuff.mult > 0) ? it._scaleBuff.mult : 1; }
  function getHitboxes(it) {
    if (it.kind === 'block' && it._xf) return blockBoxes(it, it._xf);
    const L = hbList(it);
    if (!L) return [getBounds(it)];
    const fx = faceOf(it), sc = scOf(it);
    return L.map(h => ({ x: it.x + h.ox * fx * sc - h.w * sc / 2, y: it.y + h.oy * sc - h.h * sc / 2, w: h.w * sc, h: h.h * sc }));
  }
  function getBounds(it) {
    if (it.kind === 'block' && it._xf) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const b of blockBoxes(it, it._xf)) { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    const fx = faceOf(it), sc = scOf(it);
    const L = hbList(it);
    if (L) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const h of L) {
        const x1 = it.x + h.ox * fx * sc - h.w * sc / 2, y1 = it.y + h.oy * sc - h.h * sc / 2;
        if (x1 < minX) minX = x1;
        if (y1 < minY) minY = y1;
        if (x1 + h.w * sc > maxX) maxX = x1 + h.w * sc;
        if (y1 + h.h * sc > maxY) maxY = y1 + h.h * sc;
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    if (it.kind === 'sprite' && it.hb) {
      return { x: it.x + it.hb.ox * fx * sc - it.hb.hw * sc, y: it.y + it.hb.oy * sc - it.hb.hh * sc, w: it.hb.hw * 2 * sc, h: it.hb.hh * 2 * sc };
    }
    return { x: it.x - it.w * sc / 2, y: it.y - it.h * sc / 2, w: it.w * sc, h: it.h * sc };
  }
  /* ---------- HÌNH HỌC: hộp có thể xoay (poly = 4 đỉnh) ---------- */
  function polyOf(b) { return b.poly || [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]]; }
  function makeRotBox(cx, cy, w, h, rot) {
    if (!rot) return { x: cx - w / 2, y: cy - h / 2, w, h };
    const c = Math.cos(rot), sn = Math.sin(rot), hw = w / 2, hh = h / 2;
    const poly = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(p => [cx + p[0] * c - p[1] * sn, cy + p[0] * sn + p[1] * c]);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, poly };
  }
  function projPoly(p, ax, ay) {
    let mn = Infinity, mx = -Infinity;
    for (const q of p) { const d = q[0] * ax + q[1] * ay; if (d < mn) mn = d; if (d > mx) mx = d; }
    return [mn, mx];
  }
  function axesOf(p) {
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1;
      out.push([ey / l, -ex / l]);
    }
    return out;
  }
  /* Vector nhỏ nhất đẩy A ra khỏi B (null nếu không chồng nhau) */
  function satMTV(A, B) {
    const pa = polyOf(A), pb = polyOf(B);
    let best = Infinity, nx = 0, ny = 0;
    const axes = axesOf(pa).concat(axesOf(pb));
    for (let i = 0; i < axes.length; i++) {
      const ax = axes[i][0], ay = axes[i][1];
      const ra = projPoly(pa, ax, ay), rb = projPoly(pb, ax, ay);
      const o1 = ra[1] - rb[0], o2 = rb[1] - ra[0];
      if (o1 <= 1e-9 || o2 <= 1e-9) return null;
      const o = Math.min(o1, o2);
      if (o < best) { best = o; if (o1 < o2) { nx = -ax; ny = -ay; } else { nx = ax; ny = ay; } }
    }
    return { nx, ny, depth: best };
  }
  function pointInBox(px, py, b) {
    if (!b.poly) return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
    const p = b.poly; let sign = 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], c = p[(i + 1) % p.length];
      const cr = (c[0] - a[0]) * (py - a[1]) - (c[1] - a[1]) * (px - a[0]);
      if (cr !== 0) { const sg = cr > 0 ? 1 : -1; if (sign === 0) sign = sg; else if (sg !== sign) return false; }
    }
    return true;
  }
  function hullOf(pts) {
    pts = pts.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    lo.pop(); up.pop();
    return lo.concat(up);
  }
  /* Quãng đường tối thiểu đẩy A ngược hướng chuyển động (dirSign trên trục axis) để hết chồng B — dùng khi có hộp xoay */
  function axisPush(a, b, axis, dirSign) {
    const pa = polyOf(a), pb = polyOf(b), pts = [];
    for (const q of pb) for (const r of pa) pts.push([q[0] - r[0], q[1] - r[1]]);
    const H = hullOf(pts), ux = axis === 'x' ? -dirSign : 0, uy = axis === 'y' ? -dirSign : 0;
    let best = null;
    for (let i = 0; i < H.length; i++) {
      const p = H[i], q = H[(i + 1) % H.length], ex = q[0] - p[0], ey = q[1] - p[1];
      const den = ux * ey - uy * ex; if (Math.abs(den) < 1e-12) continue;
      const t = (p[0] * ey - p[1] * ex) / den, sp = (p[0] * uy - p[1] * ux) / den;
      if (t > 1e-9 && sp >= -1e-9 && sp <= 1 + 1e-9 && (best === null || t < best)) best = t;
    }
    return best === null ? 0 : best;
  }
  /* Hộp của khối sau khi áp dụng animation kỹ thuật (dịch / co giãn / xoay quanh tâm) */
  function blockBoxes(it, T) {
    const cx = it.x + T.dx, cy = it.y + T.dy, c = Math.cos(T.rot), sn = Math.sin(T.rot);
    const L = hbList(it);
    const rects = (L && L.length) ? L : [{ ox: 0, oy: 0, w: it.w, h: it.h }];
    return rects.map(h => {
      const lx = h.ox * T.sx, ly = h.oy * T.sy;
      return makeRotBox(cx + lx * c - ly * sn, cy + lx * sn + ly * c, h.w * T.sx, h.h * T.sy, T.rot);
    });
  }
  function aabb(a, b) {
    if (a.poly || b.poly) return satMTV(a, b) !== null;
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function anyHitboxOverlap(boxesA, boxesB) {
    for (let i = 0; i < boxesA.length; i++) {
      const a = boxesA[i];
      for (let j = 0; j < boxesB.length; j++) if (aabb(a, boxesB[j])) return { a, b: boxesB[j] };
    }
    return null;
  }
  function deepestHitboxPair(boxesA, boxesB, axis, dirSign) {
    let best = null, bestDepth = 0;
    for (let i = 0; i < boxesA.length; i++) {
      const a = boxesA[i];
      for (let j = 0; j < boxesB.length; j++) {
        const b = boxesB[j];
        if (!aabb(a, b)) continue;
        let depth;
        if (a.poly || b.poly) depth = axisPush(a, b, axis, dirSign);
        else if (axis === 'x') depth = dirSign > 0 ? (a.x + a.w) - b.x : (b.x + b.w) - a.x;
        else depth = dirSign > 0 ? (a.y + a.h) - b.y : (b.y + b.h) - a.y;
        if (depth > bestDepth) { bestDepth = depth; best = { a, b }; }
      }
    }
    return best ? { pair: best, depth: bestDepth } : null;
  }

  /* ---------- AN TOÀN / THÂN VA CHẠM ---------- */
  function safeDraw(ctx, img, ...a) {
    if (!img || img.complete === false || img.naturalWidth === 0) return false;
    try { ctx.drawImage(img, ...a); return true; } catch (e) { return false; }
  }
  /* Hộp va chạm địa hình: KHÔNG phụ thuộc frame/animation → hết kẹt khi đổi frame (hitbox theo frame chỉ dùng cho sát thương/chạm) */
  /* Hitbox va chạm của nhân vật: dùng đúng hitbox đã tạo (hitbox riêng của frame nếu có, không thì hitbox chung), neo chân chống lún/nổi */
  function bodyBoxes(it) {
    if (it.kind !== 'sprite') return getHitboxes(it);
    const fx = faceOf(it), sc = scOf(it);
    const def = (it.hitboxes && it.hitboxes.length) ? cleanList(it.hitboxes) : null;
    const area = (a) => a.reduce((t, h) => t + h.w * h.h, 0);
    let L = hbList(it);
    if (L && def && L !== def && area(L) < 4) L = def;   // hitbox frame suy biến (gần như rỗng) → dùng mặc định
    if (L) {
      let dy = 0;   // neo "chân": đáy hitbox frame trùng đáy hitbox mặc định
      const bot = (a) => a.reduce((m, h) => Math.max(m, h.oy + h.h / 2), -Infinity);
      if (L !== def) {
        if (def) dy = bot(def) - bot(L);
        else if (it.hb) dy = (it.hb.oy + it.hb.hh) - bot(L);
      }
      return L.map(h => ({ x: it.x + h.ox * fx * sc - h.w * sc / 2, y: it.y + (h.oy + dy) * sc - h.h * sc / 2, w: h.w * sc, h: h.h * sc }));
    }
    if (it.hb) return [{ x: it.x + it.hb.ox * fx * sc - it.hb.hw * sc, y: it.y + it.hb.oy * sc - it.hb.hh * sc, w: it.hb.hw * 2 * sc, h: it.hb.hh * 2 * sc }];
    return [{ x: it.x - it.w * sc / 2, y: it.y - it.h * sc / 2, w: it.w * sc, h: it.h * sc }];
  }
  /* Đẩy nhân vật ra khỏi khối đặc theo trục nông nhất (lật hướng, đổi frame khối, spawn trong khối) */
  function depenetrate(state, it) {
    for (let iter = 0; iter < 4; iter++) {
      const mine = bodyBoxes(it);
      let fixed = false;
      for (let i = 0; i < state.items.length && !fixed; i++) {
        const o = state.items[i];
        if (o === it || o.kind !== 'block' || !o.solid || o._dead) continue;
        const ob = getHitboxes(o);
        for (let a = 0; a < mine.length && !fixed; a++) {
          for (let b = 0; b < ob.length; b++) {
            const A = mine[a], B = ob[b];
            if (!aabb(A, B)) continue;
            if (A.poly || B.poly) {   // hộp xoay: đẩy theo vector nhỏ nhất (SAT)
              const m = satMTV(A, B);
              if (m) {
                const dd = Math.min(m.depth, 32);
                it.x += m.nx * dd; it.y += m.ny * dd;
                if (m.ny < -0.3) { it._onGround = true; if (it._vy > 0) it._vy = 0; }
                else if (m.ny > 0.3 && it._vy < 0) it._vy = 0;
                if (m.nx * it._vx < 0) it._vx = 0;
              }
              fixed = true; break;
            }
            const px = Math.min(A.x + A.w - B.x, B.x + B.w - A.x);
            const py = Math.min(A.y + A.h - B.y, B.y + B.h - A.y);
            if (px < py) {
              const s = (A.x + A.w / 2 < B.x + B.w / 2) ? -1 : 1;
              it.x += s * Math.min(px, 32);
              if (it._vx * s < 0) it._vx = 0;
            } else {
              const s = (A.y + A.h / 2 < B.y + B.h / 2) ? -1 : 1;
              it.y += s * Math.min(py, 32);
              if (s < 0) { it._onGround = true; if (it._vy > 0) it._vy = 0; }
              else if (it._vy < 0) it._vy = 0;
            }
            fixed = true; break;
          }
        }
      }
      if (!fixed) return;
    }
  }
  function killY(state) {
    let m = VH;
    for (const o of state.items) if (o.kind === 'block' && !o._dead) m = Math.max(m, o.y + o.h / 2);
    return m + 500;
  }
  function respawnItem(it) {
    it.x = isFinite(it._spawnX) ? it._spawnX : VW / 2;
    it.y = isFinite(it._spawnY) ? it._spawnY : 0;
    it._vx = 0; it._vy = 0;
  }

  /* ---------- BIẾN / ĐIỀU KIỆN ---------- */
  function getVar(state, it, name) {
    switch (name) {
      case 'hp': return it.hp;
      case 'maxHp': return it.maxHp;
      case 'hpPercent': return it.maxHp ? it.hp / it.maxHp * 100 : 0;
      case 'x': return it.x;
      case 'y': return it.y;
      case 'time': return state.time || 0;
    }
    const v = state.vars ? state.vars[name] : undefined;
    return v === undefined ? 0 : v;
  }
  function cmpVals(a, op, b) {
    const na = typeof a === 'number' ? a : parseFloat(a), nb = typeof b === 'number' ? b : parseFloat(b);
    const num = isFinite(na) && isFinite(nb);
    const x = num ? na : String(a), y = num ? nb : String(b);
    switch (op) {
      case '!=': return x !== y;
      case '>': return x > y;
      case '<': return x < y;
      case '>=': return x >= y;
      case '<=': return x <= y;
      default: return x === y;
    }
  }
  function condPass(state, it, c) {
    if (!c || !c.var) return true;
    const rhs = (typeof c.value === 'string' && c.value.charAt(0) === '$') ? getVar(state, it, c.value.slice(1)) : c.value;
    return cmpVals(getVar(state, it, c.var), c.op || '==', rhs);
  }
  function initVars(defs) {
    const v = {};
    (defs || []).forEach(d => {
      if (!d || !d.name) return;
      const s = String(d.value != null ? d.value : '0').trim();
      v[d.name] = /^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : s;
    });
    return v;
  }
  /* tham số "$tên" = giá trị biến lúc chạy; text có thể chứa {tênBiến} */
  function resolveParams(state, it, params) {
    const out = {};
    for (const k in (params || {})) {
      let v = params[k];
      if (typeof v === 'string') {
        if (k === 'text') {
          v = v.replace(/\{([^}]+)\}/g, (m, n) => {
            const x = getVar(state, it, n.trim());
            return typeof x === 'number' ? String(Math.round(x * 100) / 100) : String(x);
          });
        } else if (v.charAt(0) === '$') {
          const x = getVar(state, it, v.slice(1));
          v = typeof x === 'number' ? x : (isFinite(parseFloat(x)) ? parseFloat(x) : 0);
        }
      }
      out[k] = v;
    }
    return out;
  }
  function evPass(state, it, ev) {
    const m = it._evMeta || (it._evMeta = {});
    const s = m[ev.id] || (m[ev.id] = { n: 0, cd: 0 });
    if (ev.once && s.n > 0) return false;
    if (s.cd > 0) return false;
    if (ev.cond && !condPass(state, it, ev.cond)) return false;
    if (ev.chance != null && ev.chance < 100 && Math.random() * 100 >= ev.chance) return false;
    s.n++; s.cd = ev.cooldown > 0 ? ev.cooldown : 0;
    return true;
  }
  function nearPlayer(state, it, dist) {
    for (let j = 0; j < state.items.length; j++) {
      const o = state.items[j];
      if (o === it || o.kind !== 'sprite' || o.control !== 'player' || o._dead) continue;
      const dx = o.x - it.x, dy = o.y - it.y;
      if (dx * dx + dy * dy <= dist * dist) return true;
    }
    return false;
  }

  /* ---------- EVENTS ---------- */
  function ensureEventState(state, it) {
    if (!it._pendingActions) it._pendingActions = [];
    if (!it._everyTimers) it._everyTimers = {};
    if (!it._keyState) it._keyState = {};
    if (!it._idleFired) it._idleFired = {};
    if (!it._touchSet) it._touchSet = new Set();
    if (!it._varState) it._varState = {};
    if (!it._nearEv) it._nearEv = {};
    if (!it._evMeta) it._evMeta = {};
  }
  function scheduleEventAction(state, it, ev) {
    if (!evPass(state, it, ev)) return;
    if (!it._pendingActions) it._pendingActions = [];
    if (it._pendingActions.length > 200) return;   // chống tràn hàng đợi
    it._pendingActions.push({
      action: ev.action,
      actionParams: ev.actionParams || {},
      timeLeft: Math.max(0, ev.delay || 0)
    });
  }
  function fireEvent(state, it, triggerKey) {
    if (!it.events || !it.events.length) return;
    for (let i = 0; i < it.events.length; i++) {
      if (it.events[i].trigger === triggerKey) scheduleEventAction(state, it, it.events[i]);
    }
  }
  function updateTimedEvents(state, it, dt) {
    if (!it.events || !it.events.length) return;
    ensureEventState(state, it);
    for (const k in it._evMeta) if (it._evMeta[k].cd > 0) it._evMeta[k].cd -= dt;
    for (let i = 0; i < it.events.length; i++) {
      const ev = it.events[i];
      const tp = ev.triggerParams || {};
      if (ev.trigger === 'onEvery') {
        const interval = Math.max(0.05, tp.interval != null ? tp.interval : 1);
        it._everyTimers[ev.id] = (it._everyTimers[ev.id] || 0) + dt;
        if (it._everyTimers[ev.id] >= interval) {
          it._everyTimers[ev.id] -= interval;
          scheduleEventAction(state, it, ev);
        }
      } else if (ev.trigger === 'onKeyPress' || ev.trigger === 'onUIButton') {
        const ub = ev.trigger === 'onUIButton' ? (((state.ui && state.ui.buttons) || []).find(b => b.id === tp.button) || null) : null;
        const k = ev.trigger === 'onUIButton' ? (ub && ub.key) : tp.key, mode = tp.mode || 'press';
        const was = !!it._keyState[ev.id];
        const now = !!(k && state.keys[k]);
        if (mode === 'release') { if (!now && was) scheduleEventAction(state, it, ev); }
        else if (mode === 'hold') {
          if (now) {
            const t = (it._everyTimers[ev.id] || 0) + dt, r = Math.max(0.05, tp.repeat || 0.2);
            if (!was || t >= r) { scheduleEventAction(state, it, ev); it._everyTimers[ev.id] = 0; }
            else it._everyTimers[ev.id] = t;
          }
        } else if (now && !was) scheduleEventAction(state, it, ev);
        it._keyState[ev.id] = now;
      } else if (ev.trigger === 'onHpBelow') {
        const thr = (tp.percent != null ? tp.percent : 50) / 100 * it.maxHp;
        const prev = it._prevHp != null ? it._prevHp : it.hp;
        if (it.hp <= thr && prev > thr) scheduleEventAction(state, it, ev);
      } else if (ev.trigger === 'onIdle') {
        const secs = tp.seconds != null ? tp.seconds : 2;
        if (it._state === 'idle' && (it._idleTime || 0) >= secs) {
          if (!it._idleFired[ev.id]) { it._idleFired[ev.id] = true; scheduleEventAction(state, it, ev); }
        } else if (it._state !== 'idle') {
          it._idleFired[ev.id] = false;
        }
      } else if (ev.trigger === 'onNearPlayer') {
        const near = nearPlayer(state, it, tp.distance != null ? tp.distance : 100);
        if (near && !it._nearEv[ev.id]) scheduleEventAction(state, it, ev);
        it._nearEv[ev.id] = near;
      } else if (ev.trigger === 'onVar') {
        const ok = condPass(state, it, { var: tp.name, op: tp.op, value: tp.value });
        if (ok && !it._varState[ev.id]) scheduleEventAction(state, it, ev);
        it._varState[ev.id] = ok;
      }
    }
    it._prevHp = it.hp;
  }
  function updatePendingActions(state, it, dt) {
    if (!it._pendingActions || !it._pendingActions.length) return;
    for (let i = it._pendingActions.length - 1; i >= 0; i--) {
      const p = it._pendingActions[i];
      p.timeLeft -= dt;
      if (p.timeLeft <= 0) {
        executeAction(state, it, p.action, p.actionParams);
        it._pendingActions.splice(i, 1);
      }
    }
  }
  /* ---------- MỤC TIÊU / TÍN HIỆU GIỮA CÁC NHÂN VẬT ---------- */
  function findTarget(state, it, t) {
    if (!t || t === 'self') return it;
    if (t === '__player') return state.items.find(o => o.kind === 'sprite' && o.control === 'player') || null;
    return state.items.find(o => o.id === t) || state.items.find(o => o.name === t) || null;
  }
  /* Nhóm: group:player = NV (người chơi) · group:bot = Bot · group:npc = NPC đứng yên · group:all = tất cả */
  function inGroup(o, g) {
    if (o.kind !== 'sprite') return false;
    if (g === 'group:all') return true;
    if (g === 'group:player') return o.control === 'player';
    if (g === 'group:bot') return o.control === 'bot';
    if (g === 'group:npc') return o.control === 'none';
    return false;
  }
  function targetList(state, it, t) {
    if (typeof t === 'string' && t.indexOf('group:') === 0) return state.items.filter(o => inGroup(o, t));
    const o = findTarget(state, it, t);
    return o ? [o] : [];
  }
  function sendSignal(state, from, name, to) {
    if (!name) return;
    for (const o of state.items) {
      if (o.kind === 'block' && o.techAnim && o.techAnim.enabled && o.techAnim.trigger && o.techAnim.trigger.type === 'signal' && o.techAnim.trigger.name === name) {
        if (!to || to === 'all' || to === 'group:all' || to === o.id) startTech(state, o);
        continue;
      }
      if (o.kind !== 'sprite' || !o.events) continue;
      if (to && to !== 'all' && targetList(state, from, to).indexOf(o) < 0) continue;
      for (const ev of o.events) {
        if (ev.trigger !== 'onSignal') continue;
        const tp = ev.triggerParams || {};
        if (tp.name !== name) continue;
        if (tp.from && tp.from !== 'any' && targetList(state, o, tp.from).indexOf(from) < 0) continue;
        scheduleEventAction(state, o, ev);
      }
    }
  }
  /* ============================================================
     ANIMATION KỸ THUẬT (chỉ dành cho khối)
     ============================================================ */
  const TA_DEFAULT = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, alpha: 1 };
  function bezier(x1, y1, x2, y2, t) {
    if (t <= 0) return 0; if (t >= 1) return 1;
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = (u) => ((ax * u + bx) * u + cx) * u, dX = (u) => (3 * ax * u + 2 * bx) * u + cx;
    let u = t;
    for (let i = 0; i < 8; i++) { const e = X(u) - t; if (Math.abs(e) < 1e-6) break; const d = dX(u); if (Math.abs(d) < 1e-6) break; u -= e / d; }
    if (!(u >= 0 && u <= 1) || Math.abs(X(u) - t) > 1e-4) {
      let lo = 0, hi = 1; u = t;
      for (let i = 0; i < 30; i++) { if (X(u) < t) lo = u; else hi = u; u = (lo + hi) / 2; }
    }
    return ((ay * u + by) * u + cy) * u;
  }
  function easeFn(st, u) {
    u = Math.max(0, Math.min(1, u));
    switch (st.ease) {
      case 'in': return u * u;                                   // nhanh dần
      case 'out': return 1 - (1 - u) * (1 - u);                  // chậm dần
      case 'inout': return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      case 'back': { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); }
      case 'bounce': {
        const n = 7.5625, d = 2.75;
        if (u < 1 / d) return n * u * u;
        if (u < 2 / d) { u -= 1.5 / d; return n * u * u + 0.75; }
        if (u < 2.5 / d) { u -= 2.25 / d; return n * u * u + 0.9375; }
        u -= 2.625 / d; return n * u * u + 0.984375;
      }
      case 'elastic': { if (u === 0 || u === 1) return u; return Math.pow(2, -10 * u) * Math.sin((u * 10 - 0.75) * (2 * Math.PI) / 3) + 1; }
      case 'bezier': { const b = st.bez || [0.25, 0.1, 0.25, 1]; return bezier(b[0], b[1], b[2], b[3], u); }
      default: return u;                                          // đều
    }
  }
  /* Thời điểm bắt đầu tuyệt đối của từng bước (tính từ lúc kích hoạt chuỗi) */
  function techSchedule(ta) {
    const steps = ta.steps || [], S = {}, byId = {}, vis = {};
    steps.forEach(st => { byId[st.id] = st; });
    let cyc = false;
    const start = (st) => {
      if (S[st.id] != null) return S[st.id];
      if (vis[st.id]) { cyc = true; return 0; }
      vis[st.id] = true;
      const a = st.after || { ref: 'start', mode: 'end', delay: 0 };
      let t = 0;
      if (a.ref && a.ref !== 'start' && a.ref !== st.id && byId[a.ref]) {
        const r = byId[a.ref];
        t = start(r) + (a.mode === 'start' ? 0 : Math.max(0, r.dur || 0));
      }
      t += Math.max(0, a.delay || 0);
      vis[st.id] = false; S[st.id] = t;
      return t;
    };
    steps.forEach(start);
    let total = 0;
    steps.forEach(st => { total = Math.max(total, S[st.id] + Math.max(0, st.dur || 0)); });
    (ta.rules || []).forEach(r => {
      const st = byId[r.step]; if (!st) return;
      total = Math.max(total, S[st.id] + (r.when === 'end' ? Math.max(0, st.dur || 0) : 0) + Math.max(0, r.delay || 0));
    });
    return { S, total, cyc };
  }
  function propAt(list, n, t, base) {
    let v = base;
    for (let k = 0; k < n; k++) {
      const q = list[k];
      if (t < q.S) break;
      const from = q.p.from == null ? propAt(list, k, q.S, base) : +q.p.from;
      const to = +q.p.to;
      v = (q.dur <= 0 || t >= q.S + q.dur) ? to : from + (to - from) * easeFn(q.st, (t - q.S) / q.dur);
    }
    return v;
  }
  function evalTech(it, ta, t, sched) {
    sched = sched || techSchedule(ta);
    const rel = ta.space !== 'abs', out = {};
    for (const key in TA_DEFAULT) {
      const list = (ta.steps || []).filter(st => st.props && st.props[key] && st.props[key].on)
        .map(st => ({ st, S: sched.S[st.id], dur: Math.max(0, st.dur || 0), p: st.props[key] }))
        .sort((a, b) => a.S - b.S);
      let base = TA_DEFAULT[key];
      if (!rel && key === 'x') base = it.x;
      if (!rel && key === 'y') base = it.y;
      out[key] = list.length ? propAt(list, list.length, t, base) : base;
    }
    return {
      dx: rel ? out.x : out.x - it.x, dy: rel ? out.y : out.y - it.y,
      rot: out.rot * Math.PI / 180,
      sx: Math.max(0.01, out.sx), sy: Math.max(0.01, out.sy),
      alpha: Math.max(0, Math.min(1, out.alpha))
    };
  }
  function applyFlag(cur, v) { return v === 'on' ? true : v === 'off' ? false : !cur; }
  function runTechAction(state, b, r) {
    const p = r.params || {};
    switch (r.action) {
      case 'shake': executeAction(state, b, 'shakeScreen', { intensity: Math.max(0, +p.level || 1) * 2, duration: p.dur != null ? +p.dur : 0.5 }); break;
      case 'customAnim': {
        if (p.mode === 'stop') { b._customAnim = null; break; }
        const an = b.animations && b.animations['custom:' + (p.name || '')];
        if (!an || !an.frames.length) break;
        b._customAnim = { key: 'custom:' + p.name, loop: p.mode === 'loop', t: an.frames.length / Math.max(1, an.fps || 8) };
        b._animFrame = 0; b._animTime = 0;
        break;
      }
      case 'signal': sendSignal(state, b, String(p.name || ''), p.to || 'all'); break;
      case 'solid': b.solid = applyFlag(b.solid, p.value); break;
      case 'hazard': b.hazard = applyFlag(b.hazard, p.value); break;
      case 'visible': b._hidden = !applyFlag(!b._hidden, p.value); break;
      case 'var': executeAction(state, b, 'setVar', { name: p.name, mode: p.mode || 'set', value: p.value }); break;
      case 'sound': executeAction(state, b, 'playSound', p); break;
      case 'startBlock': { const o = state.items.find(i => i.id === p.target && i.kind === 'block'); if (o) startTech(state, o); break; }
      case 'stopAnim': if (b._ta) b._ta.running = false; break;
    }
  }
  function techRules(state, b, ta, sched, a, z) {   // chạy các hành động có thời điểm trong (a, z]
    for (const r of (ta.rules || [])) {
      const st = (ta.steps || []).find(x => x.id === r.step);
      if (!st) continue;
      const tau = sched.S[st.id] + (r.when === 'end' ? Math.max(0, st.dur || 0) : 0) + Math.max(0, r.delay || 0);
      if (tau > a && tau <= z) runTechAction(state, b, r);
    }
  }
  function techState(b) {
    return b._ta || (b._ta = { running: false, e: 0, prevT: -1e-9, cycle: 0, used: false, init: false, prevTouch: false, prevKey: false, prevCond: false, sched: null });
  }
  function startTech(state, b) {
    const ta = b.techAnim;
    if (!ta || !ta.enabled || !ta.steps || !ta.steps.length) return;
    const R = techState(b);
    if (R.running && ta.retrigger !== 'restart') return;
    if (ta.once && R.used) return;
    R.used = true; R.running = true; R.e = 0; R.prevT = -1e-9; R.cycle = 0; R.sched = techSchedule(ta);
  }
  function updateTechAnims(state, dt) {
    for (const b of state.items) {
      if (b.kind !== 'block' || !b.techAnim || !b.techAnim.enabled || !b.techAnim.steps || !b.techAnim.steps.length) continue;
      const ta = b.techAnim, R = techState(b), tg = ta.trigger || { type: 'start' };
      let fire = false;
      if (tg.type === 'start') { if (!R.init) { R.init = true; fire = true; } }
      else if (tg.type === 'touch') {
        const bb = getHitboxes(b).map(x => ({ x: x.x - 3, y: x.y - 3, w: x.w + 6, h: x.h + 6, poly: x.poly }));
        let touching = false;
        for (const s of state.items) if (s.kind === 'sprite' && s.control === 'player' && !s._dead && anyHitboxOverlap(bodyBoxes(s), bb)) { touching = true; break; }
        if (touching && !R.prevTouch) fire = true;
        R.prevTouch = touching;
      } else if (tg.type === 'button') {
        const ub = ((state.ui && state.ui.buttons) || []).find(x => x.id === tg.button);
        const down = !!(ub && state.keys && state.keys[ub.key]);
        if (down && !R.prevKey) fire = true;
        R.prevKey = down;
      } else if (tg.type === 'var') {
        const ok = condPass(state, b, tg.cond);
        if (ok && !R.prevCond) fire = true;
        R.prevCond = ok;
      }
      if (fire) startTech(state, b);
      if (!R.running) continue;
      const sched = R.sched, T = Math.max(0.0001, sched.total), lp = ta.repeat || 'none', cnt = Math.max(0, Math.round(ta.count || 0));
      R.e += dt;
      let t, ft, cyc = 0, finished = false;
      if (lp === 'none') { t = Math.min(R.e, T); ft = t; finished = R.e >= T; }
      else {
        const period = lp === 'pingpong' ? 2 * T : T;
        cyc = Math.floor(R.e / period);
        if (cnt > 0 && cyc >= cnt) { finished = true; cyc = cnt - 1; t = lp === 'pingpong' ? 0 : T; ft = lp === 'pingpong' ? null : T; }
        else { const u = R.e - cyc * period; if (lp === 'pingpong' && u > T) { t = 2 * T - u; ft = null; } else { t = u; ft = u; } }
      }
      const old = getHitboxes(b), oldXf = b._xf;
      const xf = evalTech(b, ta, t, sched);
      b._xf = xf;
      if (cyc !== R.cycle) { techRules(state, b, ta, sched, R.prevT, T); R.prevT = -1e-9; R.cycle = cyc; }
      if (ft != null) { techRules(state, b, ta, sched, R.prevT, ft); R.prevT = ft; }
      else { techRules(state, b, ta, sched, R.prevT, T); R.prevT = T; }
      if (finished) { techRules(state, b, ta, sched, R.prevT, T); R.running = false; }
      // chở nhân vật đứng trên khối đặc đang di chuyển (không xoay)
      if (b.solid && !xf.rot && !(oldXf && oldXf.rot)) {
        const ddx = xf.dx - (oldXf ? oldXf.dx : 0), ddy = xf.dy - (oldXf ? oldXf.dy : 0);
        if (ddx || ddy) {
          for (const s of state.items) {
            if (s.kind !== 'sprite' || s._dead || !s._onGround) continue;
            let fx0 = Infinity, fx1 = -Infinity, feet = -Infinity;
            for (const q of bodyBoxes(s)) { fx0 = Math.min(fx0, q.x); fx1 = Math.max(fx1, q.x + q.w); feet = Math.max(feet, q.y + q.h); }
            for (const ob of old) {
              if (ob.poly) continue;
              if (fx1 > ob.x + 1 && fx0 < ob.x + ob.w - 1 && Math.abs(feet - ob.y) <= 3) { s.x += ddx; s.y += ddy; break; }
            }
          }
        }
      }
    }
  }

  /* ---------- NHẠC NỀN ---------- */
  function createBGM(tracks) {
    const rs = [];
    (tracks || []).forEach(t => { if (t && t.url) rs.push({ t, a: null, st: 'idle', wait: 0, time: 0, plays: 0, fo: 0, foMax: 0, blocked: false }); });
    const base = r => Math.max(0, Math.min(1, r.t.volume != null ? r.t.volume : 0.8));
    const audioOf = (r) => {
      if (!r.a) {
        if (typeof Audio === 'undefined') return null;
        const a = new Audio(); a.preload = 'auto'; a.src = r.t.url;
        a.addEventListener('ended', () => {
          if (r.st !== 'playing') return;
          r.plays++;
          if (r.t.loop !== 'infinite' && r.plays >= Math.max(1, r.t.loopCount || 1)) { r.st = 'done'; return; }
          try { a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
        });
        r.a = a;
      }
      return r.a;
    };
    const begin = (r) => {
      const a = audioOf(r);
      if (!a) { r.st = 'done'; return; }
      r.st = 'playing'; r.time = 0; r.plays = 0; r.blocked = false;
      a.loop = r.t.loop === 'infinite';
      try { a.currentTime = 0; } catch (e) {}
      a.volume = r.t.fadeIn > 0 ? 0 : base(r);
      const p = a.play(); if (p && p.catch) p.catch(() => { r.blocked = true; });
    };
    const end = (r) => { r.st = 'done'; if (r.a) { try { r.a.pause(); } catch (e) {} } };
    const halt = (r) => {
      if (r.st === 'wait') { r.st = 'done'; return; }
      if (r.st !== 'playing') return;
      if (r.t.fadeOut > 0) { r.fo = r.foMax = r.t.fadeOut; r.st = 'fading'; } else end(r);
    };
    return {
      trigger(name) {
        for (const r of rs) if ((name === 'start' && r.t.stopMode === 'onPlay') || (name === 'death' && r.t.stopMode === 'onDeath')) halt(r);
        for (const r of rs) if (r.t.startOn === name && (r.st === 'idle' || r.st === 'done')) {
          r.wait = Math.max(0, r.t.delay || 0); r.st = 'wait'; if (r.wait <= 0) begin(r);
        }
      },
      update(dt) {
        for (const r of rs) {
          if (r.st === 'wait') { r.wait -= dt; if (r.wait <= 0) begin(r); }
          else if (r.st === 'playing' || r.st === 'fading') {
            r.time += dt;
            if (r.st === 'playing' && r.t.stopMode === 'afterSec' && r.time >= Math.max(0.1, r.t.stopAfter || 30)) halt(r);
            let v = base(r);
            if (r.t.fadeIn > 0 && r.time < r.t.fadeIn) v *= r.time / r.t.fadeIn;
            if (r.st === 'fading') { r.fo -= dt; if (r.fo <= 0) { end(r); continue; } v *= r.fo / r.foMax; }
            if (r.a) r.a.volume = Math.max(0, Math.min(1, v));
          }
        }
      },
      unlock() { for (const r of rs) if (r.blocked && r.a && (r.st === 'playing' || r.st === 'fading')) { const p = r.a.play(); if (p && p.then) p.then(() => { r.blocked = false; }).catch(() => {}); } },
      stopAll() { for (const r of rs) { r.st = 'idle'; if (r.a) { try { r.a.pause(); } catch (e) {} } } }
    };
  }
  function updateBGM(state, dt) {
    const c = state.bgmCtl; if (!c) return;
    let dead = false;
    for (const it of state.items) if (it.kind === 'sprite' && it.control === 'player' && it._dead) { dead = true; break; }
    if (dead && !state._bgmDead) c.trigger('death');
    state._bgmDead = dead;
    c.update(dt);
  }

  function executeAction(state, it, action, params) {
    params = resolveParams(state, it, params);
    switch (action) {
      case 'shakeScreen':
        state.shakeScreen = {
          intensity: Math.max(0, params.intensity != null ? params.intensity : 8),
          timeLeft: Math.max(0, params.duration != null ? params.duration : 0.5),
          duration: Math.max(0.001, params.duration != null ? params.duration : 0.5)
        };
        break;
      case 'changeHp': {
        let amt = Number(params.amount); if (!isFinite(amt)) amt = 0;
        if (params.mode === 'percent') amt = it.maxHp * amt / 100;
        if (amt < 0) damage(state, it, -amt);
        else it.hp = Math.min(it.maxHp, it.hp + amt);
        break;
      }
      case 'teleport':
        if (isFinite(+params.dx)) it.x += +params.dx;
        if (isFinite(+params.dy)) it.y += +params.dy;
        break;
      case 'setPos':
        if (params.x != null && isFinite(+params.x)) it.x = +params.x;
        if (params.y != null && isFinite(+params.y)) it.y = +params.y;
        break;
      case 'spawnBullet':
        if (it.shoot && it.shoot.enabled) {
          const n = clamp(Math.round(params.count || 1), 1, 12), sp = (params.spread || 0) * Math.PI / 180;
          for (let k = 0; k < n; k++) spawnBullet(state, it, it._facing || 1, n > 1 ? (k - (n - 1) / 2) * (sp / (n - 1)) : 0);
        }
        break;
      case 'setInvuln':
        it._invuln = Math.max(it._invuln || 0, params.seconds != null ? params.seconds : 1);
        break;
      case 'destroySelf':
        it._dead = true; if (it.kind === 'sprite') it.hp = 0;
        break;
      case 'changeControl':
        it.control = params.mode || it.control;
        break;
      case 'showText':
        state.floatingTexts.push({
          x: it.x, y: it.y - it.h / 2,
          text: params.text != null ? String(params.text) : '!',
          color: params.color || '#ffd166',
          life: params.duration != null ? params.duration : 1.5,
          totalLife: params.duration != null ? params.duration : 1.5,
          vy: -40
        });
        break;
      case 'spawnParticles': {
        const count = Math.max(1, params.count != null ? params.count : 12);
        for (let i = 0; i < count; i++) {
          state.particles.push({
            x: it.x, y: it.y,
            vx: (Math.random() - 0.5) * 200,
            vy: (Math.random() - 0.5) * 200 - 40,
            life: params.life != null ? params.life : 0.8,
            totalLife: params.life != null ? params.life : 0.8,
            color: params.color || '#ffb86b',
            size: params.size != null ? params.size : 4
          });
        }
        break;
      }
      case 'flash':
        it._flash = {
          color: params.color || '#ffffff',
          timeLeft: params.duration != null ? params.duration : 0.3,
          duration: params.duration != null ? params.duration : 0.3
        };
        break;
      case 'playSound':
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (AC) {
            const audio = state._ac || (state._ac = new AC());
            if (audio.state === 'suspended' && audio.resume) audio.resume();
            const osc = audio.createOscillator();
            const gain = audio.createGain();
            osc.type = params.wave || 'sine';
            osc.frequency.value = params.frequency != null ? params.frequency : 440;
            osc.connect(gain); gain.connect(audio.destination);
            const dur = params.duration != null ? params.duration : 0.2;
            gain.gain.setValueAtTime(0.12, audio.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
            osc.start();
            osc.stop(audio.currentTime + dur);
          }
        } catch (e) {}
        break;
      case 'setSpeed':
        it._speedBuff = {
          mult: params.multiplier != null ? params.multiplier : 2,
          timeLeft: params.duration != null ? params.duration : 3
        };
        break;
      case 'setGravity':
        it._gravityBuff = {
          mult: params.multiplier != null ? params.multiplier : 0,
          timeLeft: params.duration != null ? params.duration : 3
        };
        break;
      case 'setScale':
        it._scaleBuff = {
          mult: params.multiplier != null ? params.multiplier : 1.5,
          timeLeft: params.duration != null ? params.duration : 3
        };
        break;
      case 'playAnim': {
        for (const tg of targetList(state, it, params.target)) {
          if (tg.kind !== 'sprite') continue;
          if (params.mode === 'stop') { tg._customAnim = null; continue; }
          const an = tg.animations && tg.animations['custom:' + String(params.anim || '')];
          if (!an || !an.frames.length) continue;
          tg._customAnim = { key: 'custom:' + String(params.anim || ''), loop: params.mode === 'loop', lock: !!params.lock, t: an.frames.length / Math.max(1, an.fps || 8) };
          tg._animFrame = 0; tg._animTime = 0;
        }
        break;
      }
      case 'sendSignal':
        sendSignal(state, it, String(params.name || ''), params.to || 'all');
        break;
      case 'setBotAI': {
        const v = Number(params.value), k = params.key;
        for (const tg of targetList(state, it, params.target)) {
          if (tg.kind !== 'sprite') continue;
          if (k === 'botRange' || k === 'botPatrol') {
            if (isFinite(v)) { const cur = tg[k] != null ? tg[k] : (k === 'botRange' ? 150 : 80); tg[k] = clampAI(k, params.mode === 'add' ? cur + v : v); }
            continue;
          }
          if (!(k in AI_DEF)) continue;
          if (!tg.ai) tg.ai = {};
          const cur = tg.ai[k] != null ? tg.ai[k] : AI_DEF[k];
          if (typeof AI_DEF[k] === 'boolean') tg.ai[k] = params.mode === 'toggle' ? !cur : v > 0;
          else if (isFinite(v)) tg.ai[k] = clampAI(k, params.mode === 'add' ? cur + v : v);
        }
        break;
      }
      case 'setVar': {
        const name = String(params.name || '').trim();
        if (!name) break;
        const vars = state.vars || (state.vars = {});
        const cur = parseFloat(vars[name]), cn = isFinite(cur) ? cur : 0;
        const n = parseFloat(params.value), mode = params.mode || 'set';
        if (mode === 'toggle') vars[name] = cn ? 0 : 1;
        else if (mode === 'rand') vars[name] = Math.floor(Math.random() * (isFinite(n) ? n : 1));
        else if (isFinite(n)) vars[name] = mode === 'add' ? cn + n : mode === 'sub' ? cn - n : mode === 'mul' ? cn * n : n;
        else vars[name] = params.value;
        break;
      }
      case 'setHp': {
        const v = Number(params.amount);
        if (isFinite(v)) it.hp = clamp(v, 0, it.maxHp);
        if (it.hp <= 0 && !it._dead) { it._dead = true; fireEvent(state, it, 'onDeath'); }
        break;
      }
      case 'respawn':
        respawnItem(it);
        break;
      case 'setCameraTarget':
        for (let i = 0; i < state.items.length; i++) {
          const o = state.items[i];
          if (o.kind === 'sprite') o.camera = (o === it);
        }
        break;
    }
  }

  function updateParticles(state, dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }
  function updateFloatingTexts(state, dt) {
    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
      const f = state.floatingTexts[i];
      f.y += f.vy * dt;
      f.life -= dt;
      if (f.life <= 0) state.floatingTexts.splice(i, 1);
    }
  }
  function updateShake(state, dt) {
    if (state.shakeScreen && state.shakeScreen.timeLeft > 0) {
      state.shakeScreen.timeLeft -= dt;
      if (state.shakeScreen.timeLeft < 0) state.shakeScreen.timeLeft = 0;
    }
  }

  /* ---------- DAMAGE ---------- */
  function damage(state, it, amount) {
    if (it._invuln > 0 || it._dead) return;
    it.hp = Math.max(0, it.hp - amount);
    it._invuln = it.iframe;
    if (state) fireEvent(state, it, 'onHurt');
    if (it.hp <= 0) {
      it._dead = true;
      if (state) fireEvent(state, it, 'onDeath');
    }
  }

  function pushSprites(state, it) {
    if (it._dead || !(it.hitboxes && it.hitboxes.length)) return;
    const isPlayer = it.control === 'player';
    const mine = bodyBoxes(it);
    for (let i = 0; i < state.items.length; i++) {
      const o = state.items[i];
      if (o === it || o.kind !== 'sprite' || o._dead || o.noPush) continue;
      if (!isPlayer && o.control === 'player') continue;   // bot/NPC không đẩy được người chơi
      const ob = bodyBoxes(o);
      if (!anyHitboxOverlap(mine, ob)) continue;
      let dir = o.x > it.x ? 1 : (o.x < it.x ? -1 : (state.items.indexOf(o) > state.items.indexOf(it) ? 1 : -1));
      const d = deepestHitboxPair(mine, ob, 'x', dir);
      const before = o.x;
      o.x += dir * Math.min(d ? d.depth : 1, isPlayer ? 3 : 1.5);
      depenetrate(state, o);
      if (!isFinite(o.x)) o.x = before;
    }
  }

  /* Đi xuống dốc của khối xoay: bám sát mặt dốc (không bị coi là đang rơi) */
  function snapSlope(state, it) {
    let best = null;
    for (const o of state.items) {
      if (o === it || o.kind !== 'block' || !o.solid || o._dead) continue;
      const ob = getHitboxes(o);
      if (!ob.some(q => q.poly)) continue;
      const moved = bodyBoxes(it).map(b => ({ x: b.x, y: b.y + 10, w: b.w, h: b.h, poly: b.poly }));
      if (!anyHitboxOverlap(moved, ob)) continue;
      const d = deepestHitboxPair(moved, ob, 'y', 1);
      if (!d) continue;
      const shift = 10 - d.depth;
      if (shift > 0.01 && shift <= 10 && (best === null || shift < best)) best = shift;
    }
    if (best !== null) { it.y += best; it._vy = 0; it._onGround = true; }
  }
  function resolveCollisions(state, it, axis) {
    let mine = bodyBoxes(it);
    for (let i = 0; i < state.items.length; i++) {
      const other = state.items[i];
      if (other === it || other.kind !== 'block' || other._dead) continue;
      const ob = getHitboxes(other);
      if (other.hazard && it.hp > 0 && anyHitboxOverlap(getHitboxes(it), ob)) damage(state, it, 10);
      if (!other.solid || !anyHitboxOverlap(mine, ob)) continue;
      if (axis === 'x') {
        const slope = it._onGround && ob.some(q => q.poly);   // leo dốc nhẹ của khối xoay: nâng lên thay vì chặn ngang
        if (it._vx > 0) {
          const d = deepestHitboxPair(mine, ob, 'x', 1);
          const up = slope ? deepestHitboxPair(mine, ob, 'y', 1) : null;
          if (up && up.depth <= Math.abs(it._vx) * 1.2 + 0.5) { it.y -= up.depth; mine = bodyBoxes(it); continue; }
          if (d) it.x -= Math.min(d.depth, 24);
          it._vx = 0;
        } else if (it._vx < 0) {
          const d = deepestHitboxPair(mine, ob, 'x', -1);
          const up = slope ? deepestHitboxPair(mine, ob, 'y', 1) : null;
          if (up && up.depth <= Math.abs(it._vx) * 1.2 + 0.5) { it.y -= up.depth; mine = bodyBoxes(it); continue; }
          if (d) it.x += Math.min(d.depth, 24);
          it._vx = 0;
        }
      } else {
        if (it._vy > 0) {
          const d = deepestHitboxPair(mine, ob, 'y', 1);
          if (d) it.y -= Math.min(d.depth, 24);
          it._vy = 0; it._onGround = true;
        } else if (it._vy < 0) {
          const d = deepestHitboxPair(mine, ob, 'y', -1);
          if (d) it.y += Math.min(d.depth, 24);
          it._vy = 0;
        }
      }
      mine = bodyBoxes(it);
    }
    if (axis === 'x' && it._onGround && it._vy >= 0 && it._vx !== 0) snapSlope(state, it);
  }

  /* ---------- BULLETS ---------- */
  function bulletDir(dir, f) {
    switch (dir) {
      case 'up': return { dx: 0, dy: -1 };
      case 'down': return { dx: 0, dy: 1 };
      case 'diagUp': return { dx: f * 0.7071, dy: -0.7071 };
      case 'diagDown': return { dx: f * 0.7071, dy: 0.7071 };
      default: return { dx: f, dy: 0 };
    }
  }
  function spawnBullet(state, it, facing, rot) {
    const s = it.shoot;
    if (!s || !s.enabled) return;
    const d = bulletDir(s.dir, facing), spd = s.speed || 8;
    if (rot) { const c = Math.cos(rot * facing), sn = Math.sin(rot * facing), nx = d.dx * c - d.dy * sn; d.dy = d.dx * sn + d.dy * c; d.dx = nx; }
    const w = s.bulletW || 14, h = s.bulletH || 14;
    const ang = Math.atan2(d.dy, Math.abs(d.dx));
    const ca = Math.abs(Math.cos(ang)), sa = Math.abs(Math.sin(ang));
    const an = it.animations && it.animations.bullet;
    state.projectiles.push({
      x: it.x + (s.offsetX || 0) * facing,
      y: it.y + (s.offsetY || 0),
      vx: d.dx * spd, vy: d.dy * spd,
      w, h, cw: w * ca + h * sa, ch: w * sa + h * ca, ang,
      damage: s.damage || 10,
      owner: it.id, anim: (an && an.frames && an.frames.length) ? an : null, t: 0,
      life: 5, facing: d.dx < -0.001 ? -1 : (d.dx > 0.001 ? 1 : facing),
      useGravity: !!s.useGravity,
      bulletGravity: s.bulletGravity != null ? s.bulletGravity : 5
    });
  }
  function tryShoot(state, it) {
    if (!it.shoot || !it.shoot.enabled) return;
    if (it._shootCd > 0) return;
    it._shootCd = it.shoot.cooldown || 0.3;
    const delay = it.shoot.delay || 0;
    if (delay > 0) {
      if (!it._pendingShots) it._pendingShots = [];
      it._pendingShots.push({ t: delay, facing: it._facing });
    } else spawnBullet(state, it, it._facing);
    if (it.animations && it.animations.shoot && it.animations.shoot.frames.length) {
      it._shootAnimTime = 0.3;
    }
    fireEvent(state, it, 'onShoot');
  }
  function updatePendingShots(state, it, dt) {
    if (!it._pendingShots || !it._pendingShots.length) return;
    for (let i = it._pendingShots.length - 1; i >= 0; i--) {
      const p = it._pendingShots[i];
      p.t -= dt;
      if (p.t <= 0) { spawnBullet(state, it, p.facing); it._pendingShots.splice(i, 1); }
    }
  }

  const AI_DEF = { chaseSpeed: 0.7, reaction: 0, attackRange: 0, attackCd: 0, aggression: 100, keepDist: 50,
    fleeHp: 0, loseTime: 0, alertRadius: 0, patrolWait: 0, jumpChance: 0, turnOnWall: false, edgeSafe: false };
  const AI_RANGE = { botRange: [0, 3000], botPatrol: [0, 3000], chaseSpeed: [0.1, 5], reaction: [0, 10], attackRange: [0, 2000], attackCd: [0, 30],
    aggression: [0, 100], keepDist: [0, 1000], fleeHp: [0, 100], loseTime: [0, 60], alertRadius: [0, 2000], patrolWait: [0, 60], jumpChance: [0, 100] };
  function clampAI(k, v) { const r = AI_RANGE[k]; return r ? Math.max(r[0], Math.min(r[1], v)) : v; }
  function aiOf(it) { const a = it.ai || {}, o = {}; for (const k in AI_DEF) o[k] = a[k] != null ? a[k] : AI_DEF[k]; return o; }
  function groundAhead(state, it, dir) {
    let x0 = Infinity, x1 = -Infinity, bot = -Infinity;
    for (const b of bodyBoxes(it)) { x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x + b.w); bot = Math.max(bot, b.y + b.h); }
    const px = dir > 0 ? x1 + 4 : x0 - 4, py = bot + 6;
    for (const o of state.items) {
      if (o.kind !== 'block' || !o.solid || o._dead) continue;
      for (const h of getHitboxes(o)) if (pointInBox(px, py, h)) return true;
    }
    return false;
  }
  function alertNearby(state, it, r) {
    for (const o of state.items) {
      if (o === it || o.kind !== 'sprite' || o.control !== 'bot' || o._dead) continue;
      if (Math.abs(o.x - it.x) <= r && Math.abs(o.y - it.y) <= r) o._alertT = 3;
    }
  }
  function updateBotAI(state, it, dt) {
    if (it._patrolOrigin === undefined) { it._patrolOrigin = it.x; it._patrolDir = 1; }
    const ai = aiOf(it);
    const range = it.botRange != null ? it.botRange : 150;
    const patrolRange = it.botPatrol != null ? it.botPatrol : 80;
    const blocked = it._aiLastX !== undefined && Math.abs(it.x - it._aiLastX) < 0.05 && Math.abs(it._aiWant || 0) > 0.2 && it._onGround;
    it._aiLastX = it.x;
    let target = null, minDist = Infinity;
    for (let i = 0; i < state.items.length; i++) {
      const o = state.items[i];
      if (o === it || o.kind !== 'sprite') continue;
      if (o.control !== 'player' || o._dead) continue;
      const dx = o.x - it.x, dy = o.y - it.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < minDist) { minDist = d; target = o; }
    }
    const seen = !!(target && minDist <= range);
    if (seen) { it._loseT = ai.loseTime; if (ai.alertRadius > 0) alertNearby(state, it, ai.alertRadius); }
    else if (it._loseT > 0) it._loseT -= dt;
    if (it._alertT > 0) it._alertT -= dt;
    const engaged = !!target && (seen || it._loseT > 0 || it._alertT > 0);
    if (engaged && !it._engaged && ai.reaction > 0) it._reactT = ai.reaction;
    it._engaged = engaged;
    if (engaged) {
      it._facing = target.x > it.x ? 1 : -1;
      if (it._reactT > 0) { it._reactT -= dt; it._vx = 0; it._aiWant = 0; return; }
      const hpPct = it.maxHp > 0 ? (it.hp / it.maxHp) * 100 : 100;
      if (ai.fleeHp > 0 && hpPct < ai.fleeHp) {
        it._facing = -it._facing;
        it._vx = it._facing * (BASE_SPEED * it.speed * ai.chaseSpeed);
      } else {
        const atk = ai.attackRange > 0 ? ai.attackRange : range;
        if (it.shoot && it.shoot.enabled && minDist <= atk && Math.random() * 100 < ai.aggression) {
          const before = it._shootCd;
          tryShoot(state, it);
          if (!(before > 0) && ai.attackCd > 0) it._shootCd += ai.attackCd;
        }
        if (minDist > range * 0.65)      it._vx = it._facing * (BASE_SPEED * it.speed * ai.chaseSpeed);
        else if (minDist < ai.keepDist)  it._vx = -it._facing * (BASE_SPEED * it.speed * 0.5);
        else                              it._vx = 0;
      }
    } else if (patrolRange <= 0) {
      it._vx = 0;   // phạm vi tuần = 0 → đứng yên (không tuần tra)
    } else if (it._waitT > 0) {
      it._waitT -= dt; it._vx = 0;
    } else {
      if (it.x > it._patrolOrigin + patrolRange && it._patrolDir !== -1) { it._patrolDir = -1; it._waitT = ai.patrolWait; }
      else if (it.x < it._patrolOrigin - patrolRange && it._patrolDir !== 1) { it._patrolDir = 1; it._waitT = ai.patrolWait; }
      else if (ai.turnOnWall && blocked) { it._patrolDir = -it._patrolDir; it._waitT = ai.patrolWait; }
      it._facing = it._patrolDir;
      it._vx = it._waitT > 0 ? 0 : it._patrolDir * (BASE_SPEED * it.speed * 0.6);
    }
    if (ai.edgeSafe && it._onGround && it._vx !== 0 && !groundAhead(state, it, it._vx > 0 ? 1 : -1)) {
      it._vx = 0;
      if (!engaged) it._patrolDir = -it._patrolDir;
    }
    if (ai.jumpChance > 0 && blocked && it._onGround) {
      it._aiJumpT = (it._aiJumpT || 0) - dt;
      if (it._aiJumpT <= 0) { it._aiJumpT = 0.4; if (Math.random() * 100 < ai.jumpChance) it._vy = -BASE_JUMP * it.jumpPower; }
    }
    it._aiWant = it._vx;   // vận tốc bot MUỐN đi (để nhận biết bị chặn bởi tường)
  }

  function stepAnimation(it, dt) {
    const anim = (it.animations && (it.animations[it._state] || it.animations.idle)) || null;
    if (!anim || !anim.frames || !anim.frames.length) { it._animFrame = 0; return; }
    const fps = anim.fps || 8;
    it._animTime = (it._animTime || 0) + dt;
    const frameDur = 1 / fps;
    while (it._animTime >= frameDur) {
      it._animTime -= frameDur;
      it._animFrame = (it._animFrame || 0) + 1;
      if (it._animFrame >= anim.frames.length) {
        if (anim.loop === false) { it._animFrame = anim.frames.length - 1; break; }
        it._animFrame = 0;
      }
    }
  }
  function currentFrameImage(it, stateKey) {
    if (!it.animations) return null;
    const anim = it.animations[stateKey || it._state] || it.animations.idle;
    if (!anim || !anim.frames || !anim.frames.length) return null;
    const idx = (it._animFrame || 0) % anim.frames.length;
    const f = anim.frames[idx];
    return f && f.img ? f.img : null;
  }

  function updateItem(state, it, dt, keys) {
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.05) dt = 0.05;
    if (it._shootCd > 0) it._shootCd -= dt;
    if (it._shootAnimTime > 0) it._shootAnimTime -= dt;

    // onStart (one shot)
    if (it._spawnX == null) { it._spawnX = it.x; it._spawnY = it.y; }
    if (!it._startFired) {
      it._startFired = true;
      fireEvent(state, it, 'onStart');
    }

    ensureEventState(state, it);
    updateTimedEvents(state, it, dt);
    updatePendingActions(state, it, dt);
    updatePendingShots(state, it, dt);

    if (it._flash) {
      it._flash.timeLeft -= dt;
      if (it._flash.timeLeft <= 0) it._flash = null;
    }
    if (it._speedBuff)   { it._speedBuff.timeLeft   -= dt; if (it._speedBuff.timeLeft   <= 0) it._speedBuff = null; }
    if (it._gravityBuff) { it._gravityBuff.timeLeft -= dt; if (it._gravityBuff.timeLeft <= 0) it._gravityBuff = null; }
    if (it._scaleBuff)   { it._scaleBuff.timeLeft   -= dt; if (it._scaleBuff.timeLeft   <= 0) it._scaleBuff = null; }
    if (it._turnTime > 0) it._turnTime -= dt;
    if (it._customAnim && !it._customAnim.loop) { it._customAnim.t -= dt; if (it._customAnim.t <= 0) it._customAnim = null; }

    if (it._dead) { it._vx = 0; it._vy = 0; stepAnimation(it, dt); return; }
    if (it._invuln > 0) { it._invuln -= dt; if (it._invuln < 0) it._invuln = 0; }

    const speedMult = it._speedBuff ? it._speedBuff.mult : 1;
    const gravMult  = it._gravityBuff ? it._gravityBuff.mult : (isFinite(it.gravity) ? it.gravity : 1);

    let moveX = 0, jump = false, fire = false;
    if (it.control === 'player') {
      if (keys['ArrowLeft']  || keys['a'] || keys['A']) moveX -= 1;
      if (keys['ArrowRight'] || keys['d'] || keys['D']) moveX += 1;
      if (keys['ArrowUp'] || keys['w'] || keys['W'] || keys[' ']) jump = true;
      if (keys['Fire'] || keys['x'] || keys['X'] || keys['f'] || keys['F']) fire = true;
      if (keys['_joy_active']) {
        const jx = keys['_joy_x'] || 0, jy = keys['_joy_y'] || 0;
        if (jx < -0.28) moveX = -1;
        else if (jx > 0.28) moveX = 1;
        else moveX = jx * 1.2;
        if (jy < -0.65 && it._onGround) jump = true;
      }
      if (fire) tryShoot(state, it);
      if (jump && it._onGround && !(it._customAnim && it._customAnim.lock)) {   // animation khoá di chuyển cũng khoá nhảy
        it._vy = -BASE_JUMP * it.jumpPower;
        it._onGround = false;
        fireEvent(state, it, 'onJump');
      }
      if (moveX !== 0) {
        const nf = moveX > 0 ? 1 : -1, tn = it.animations && it.animations.turn;
        if (nf !== it._facing) {
          if (it._turnTime > 0) it._turnTime = 0;   // đổi hướng lại giữa chừng → huỷ animation lật (tránh vẽ sai hướng)
          else if (state.opts && state.opts.turnAnim && it._onGround && tn && tn.frames.length) {
            it._turnFrom = it._facing; it._turnTime = tn.frames.length / Math.max(1, tn.fps || 8);
          }
        }
        it._facing = nf;
      }
      it._vx = moveX * BASE_SPEED * it.speed * speedMult;
    } else if (it.control === 'bot') {
      updateBotAI(state, it, dt);
    } else { it._vx = 0; }

    if (it._customAnim && it._customAnim.lock) it._vx = 0;   // animation tuỳ chỉnh khoá di chuyển
    const wasOnGround = it._onGround;
    if (gravMult > 0) it._vy += BASE_GRAVITY * gravMult * dt * 60;
    else { it._vy *= 0.85; if (Math.abs(it._vy) < 0.02) it._vy = 0; }
    if (!isFinite(it._vx)) it._vx = 0;
    if (!isFinite(it._vy)) it._vy = 0;
    it._vy = clamp(it._vy, -30, 25);
    depenetrate(state, it);   // hướng nhìn vừa đổi / frame khối đổi → thoát khỏi khối trước khi di chuyển
    // chia nhỏ bước di chuyển để không xuyên khối mỏng
    const steps = clamp(Math.ceil(Math.max(Math.abs(it._vx), Math.abs(it._vy)) * dt * 60 / 6), 1, 12);
    let grounded = false;
    for (let s = 0; s < steps; s++) {
      it.x += it._vx * dt * 60 / steps;
      resolveCollisions(state, it, 'x');
      it._onGround = false;
      it.y += it._vy * dt * 60 / steps;
      resolveCollisions(state, it, 'y');
      if (it._onGround) grounded = true;
    }
    it._onGround = grounded;
    depenetrate(state, it);
    pushSprites(state, it);
    if (it._onGround === false && grounded) it._onGround = true;
    it.x = clamp(it.x, -5000, 5000);
    if (!isFinite(it.x) || !isFinite(it.y) || (it.y > VH + 500 && it.y > killY(state))) respawnItem(it);
    if (!wasOnGround && it._onGround) fireEvent(state, it, 'onLand');

    // Determine state
    let st = 'idle';
    if (it.hp <= 0) st = 'die';
    else if (it._customAnim && it.animations[it._customAnim.key] && it.animations[it._customAnim.key].frames.length) st = it._customAnim.key;
    else if (it._shootAnimTime > 0 && it.animations.shoot && it.animations.shoot.frames.length) st = 'shoot';
    else if (it._invuln > 0 && it.animations.hurt && it.animations.hurt.frames.length) st = 'hurt';
    else if (it._turnTime > 0 && it.animations.turn && it.animations.turn.frames.length) st = 'turn';
    else if (!it._onGround) st = 'jump';
    else if (Math.abs(it._vx) > 0.15) st = 'run';

    if (it._prevState !== st) {
      it._animFrame = 0; it._animTime = 0;
      if (st === 'run' && it._prevState !== 'run') fireEvent(state, it, 'onRun');
      it._prevState = st;
    }
    it._state = st;

    // Idle time tracking
    if (st === 'idle') it._idleTime = (it._idleTime || 0) + dt;
    else it._idleTime = 0;

    // onHitBlock / onHitSprite — edge detection
    if (it.events && it.events.length) {
      const currentTouching = new Set();
      const myBoxes = getHitboxes(it);
      for (let j = 0; j < state.items.length; j++) {
        const o = state.items[j];
        if (o === it || o._dead) continue;
        const oBoxes = getHitboxes(o);
        if (!anyHitboxOverlap(myBoxes, oBoxes)) continue;
        currentTouching.add(o.id);
        if (!it._touchSet.has(o.id)) {
          fireEvent(state, it, o.kind === 'block' ? 'onHitBlock' : 'onHitSprite');
        }
      }
      it._touchSet = currentTouching;
    }

    stepAnimation(it, dt);
  }

  function updateBlock(it, dt) {
    if (it._customAnim && !it._customAnim.loop) {
      it._customAnim.t -= dt;
      if (it._customAnim.t <= 0) { it._customAnim = null; it._animFrame = 0; it._animTime = 0; }
    }
    const anim = it.animations && it.animations[it._customAnim ? it._customAnim.key : 'default'];
    if (!anim || !anim.frames || !anim.frames.length) return;
    const fps = anim.fps || 8;
    it._animTime = (it._animTime || 0) + dt;
    const frameDur = 1 / fps;
    while (it._animTime >= frameDur) {
      it._animTime -= frameDur;
      it._animFrame = (it._animFrame || 0) + 1;
      if (it._animFrame >= anim.frames.length) {
        if (anim.loop === false) { it._animFrame = anim.frames.length - 1; break; }
        it._animFrame = 0;
      }
    }
  }

  function updateProjectiles(state, dt) {
    const cam = state.camera || { x: VW / 2, y: VH / 2 };
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      if (p.useGravity) p.vy += BASE_GRAVITY * p.bulletGravity * dt * 60 * 0.5;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.life -= dt; p.t = (p.t || 0) + dt;
      if (p.life <= 0 || Math.abs(p.x - cam.x) > 1400 || Math.abs(p.y - cam.y) > 1400) {
        state.projectiles.splice(i, 1); continue;
      }
      const cw = p.cw || p.w, ch = p.ch || p.h;
      const pb = { x: p.x - cw / 2, y: p.y - ch / 2, w: cw, h: ch };
      let hit = false;
      for (let j = 0; j < state.items.length; j++) {
        const other = state.items[j];
        if (other.kind === 'block' && !other._dead) {
          const boxes = getHitboxes(other);
          for (let k = 0; k < boxes.length; k++) if (aabb(pb, boxes[k])) { hit = true; break; }
        } else if (other.kind === 'sprite' && other.id !== p.owner && !other._dead) {
          const boxes = getHitboxes(other);
          for (let k = 0; k < boxes.length; k++) {
            if (aabb(pb, boxes[k])) { damage(state, other, p.damage); hit = true; break; }
          }
        }
        if (hit) break;
      }
      if (hit) state.projectiles.splice(i, 1);
    }
  }

  function updateCamera(state, dt) {
    let target = null;
    for (let i = 0; i < state.items.length; i++) {
      const it = state.items[i];
      if (it.kind === 'sprite' && it.camera && !it._dead) { target = it; break; }
    }
    const tx = target ? target.x : VW / 2;
    const ty = target ? target.y : VH / 2;
    const k = 1 - Math.pow(0.001, dt);
    state.camera.x += (tx - state.camera.x) * Math.min(1, k * 1.6);
    state.camera.y += (ty - state.camera.y) * Math.min(1, k * 1.6);
  }

  /* ---------- DRAW ---------- */
  function drawGrid(ctx, cx, cy) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.045)'; ctx.lineWidth = 1;
    const sX = Math.floor((cx - VW/2) / 40) * 40;
    const eX = Math.ceil((cx + VW/2) / 40) * 40;
    const sY = Math.floor((cy - VH/2) / 40) * 40;
    const eY = Math.ceil((cy + VH/2) / 40) * 40;
    for (let x = sX; x <= eX; x += 40) { ctx.beginPath(); ctx.moveTo(x, sY); ctx.lineTo(x, eY); ctx.stroke(); }
    for (let y = sY; y <= eY; y += 40) { ctx.beginPath(); ctx.moveTo(sX, y); ctx.lineTo(eX, y); ctx.stroke(); }
    ctx.restore();
  }
  function drawSprite(ctx, it) {
    const flicker = it._invuln > 0 && Math.floor(it._invuln * 14) % 2 === 0;
    ctx.save();
    if (flicker) ctx.globalAlpha = 0.35;
    const img = currentFrameImage(it);
    const sc = it._scaleBuff ? it._scaleBuff.mult : 1;
    const dw = it.w * sc, dh = it.h * sc;
    if (img) {
      ctx.translate(it.x, it.y);
      ctx.scale(((it._state === 'turn' && it._turnFrom) ? it._turnFrom : it._facing) < 0 ? -1 : 1, 1);
      safeDraw(ctx, img, -dw / 2, -dh / 2, dw, dh);
    } else {
      ctx.fillStyle = it._dead ? '#5c2130' : (it.control === 'bot' ? '#ff5a6e' : '#7c5cff');
      ctx.fillRect(it.x - dw / 2, it.y - dh / 2, dw, dh);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((it.name || '').slice(0, 9), it.x, it.y);
    }
    // Flash overlay
    if (it._flash) {
      const a = Math.min(1, it._flash.timeLeft / Math.max(0.001, it._flash.duration));
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = it._flash.color;
      ctx.fillRect(it.x - dw / 2, it.y - dh / 2, dw, dh);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }
  function drawHPBar(ctx, it) {
    const w = 52, h = 6;
    const x = it.x - w/2, y = it.y - it.h/2 - 14;
    const pct = Math.max(0, Math.min(1, it.hp / it.maxHp));
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#2a1420'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = pct > 0.5 ? '#3ddc84' : pct > 0.25 ? '#ffb86b' : '#ff5a6e';
    ctx.fillRect(x, y, w * pct, h);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();
  }
  function drawBlock(ctx, it, editor) {
    if (it._hidden) return;
    const T = it._xf;
    if (!T) { drawBlockBase(ctx, it, editor); return; }
    ctx.save();
    ctx.globalAlpha *= Math.max(0, Math.min(1, T.alpha));
    ctx.translate(it.x + T.dx, it.y + T.dy); ctx.rotate(T.rot); ctx.scale(T.sx, T.sy); ctx.translate(-it.x, -it.y);
    drawBlockBase(ctx, it, editor);
    ctx.restore();
  }
  function drawBlockBase(ctx, it, editor) {
    const anim = it.animations && it.animations[it._customAnim ? it._customAnim.key : 'default'];
    if (anim && anim.frames && anim.frames.length) {
      const idx = (it._animFrame || 0) % anim.frames.length;
      const f = anim.frames[idx];
      if (f && f.img) {
        safeDraw(ctx, f.img, it.x - it.w/2, it.y - it.h/2, it.w, it.h);
        if (editor) drawBlockEditorOverlay(ctx, it);
        return;
      }
    }
    const hasTex = it.tex && (it.tex.all || it.tex.top || it.tex.bottom || it.tex.left || it.tex.right);
    if (hasTex) {
      ctx.save();
      ctx.beginPath(); ctx.rect(it.x - it.w/2, it.y - it.h/2, it.w, it.h); ctx.clip();
      if (it.tex.all && it.tex.all.img) {
        safeDraw(ctx, it.tex.all.img, it.x - it.w/2, it.y - it.h/2, it.w, it.h);
      } else {
        const x0 = it.x - it.w/2, y0 = it.y - it.h/2;
        const parts = [
          ['top', x0, y0, it.w, it.h/2],
          ['bottom', x0, y0 + it.h/2, it.w, it.h/2],
          ['left', x0, y0, it.w/2, it.h],
          ['right', x0 + it.w/2, y0, it.w/2, it.h]
        ];
        for (const [k, x, y, w, h] of parts) {
          const t = it.tex[k];
          if (t && t.img) safeDraw(ctx, t.img, x, y, w, h);
          else { ctx.fillStyle = 'rgba(40,46,60,.85)'; ctx.fillRect(x, y, w, h); }
        }
      }
      ctx.restore();
    } else if (editor) {
      ctx.save();
      ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5;
      ctx.strokeStyle = it.hazard ? 'rgba(255,90,110,.75)' : 'rgba(124,92,255,.55)';
      ctx.fillStyle = it.hazard ? 'rgba(255,90,110,.06)' : 'rgba(124,92,255,.06)';
      ctx.fillRect(it.x - it.w/2, it.y - it.h/2, it.w, it.h);
      ctx.strokeRect(it.x - it.w/2, it.y - it.h/2, it.w, it.h);
      ctx.restore();
    }
    if (editor) drawBlockEditorOverlay(ctx, it);
  }
  function drawBlockEditorOverlay(ctx, it) {
    ctx.save();
    ctx.strokeStyle = it.hazard ? 'rgba(255,90,110,.9)' : 'rgba(124,92,255,.75)';
    ctx.lineWidth = 1.5; ctx.setLineDash([]);
    ctx.strokeRect(it.x - it.w/2, it.y - it.h/2, it.w, it.h);
    ctx.restore();
  }
  function drawProjectile(ctx, p) {
    ctx.save();
    let img = null;
    if (p.anim) {
      const fr = p.anim.frames;
      let i = Math.floor((p.t || 0) * (p.anim.fps || 8));
      i = p.anim.loop === false ? Math.min(i, fr.length - 1) : i % fr.length;
      img = fr[i] && fr[i].img;
    }
    if (img) {
      ctx.translate(p.x, p.y);
      if (p.facing < 0) ctx.scale(-1, 1);
      if (p.ang) ctx.rotate(p.ang);
      safeDraw(ctx, img, -p.w / 2, -p.h / 2, p.w, p.h);
    } else {
      ctx.fillStyle = '#ffb86b';
      ctx.shadowColor = '#ffb86b'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.w / 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function drawParticle(ctx, p) {
    const a = Math.max(0, p.life / Math.max(0.001, p.totalLife));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function drawFloatingText(ctx, f) {
    const a = Math.max(0, f.life / Math.max(0.001, f.totalLife));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawCircleBtn(ctx, b, label, active, color) {
    if (!b) return;
    ctx.save();
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.fillStyle = active ? color + 'cc' : 'rgba(255,255,255,.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#e6e9ef';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, b.x, b.y + 1);
    ctx.restore();
  }

  function drawUI(ctx, state) {
    const ui = state.ui || defaultUI();
    if (ui.mainMenu && ui.mainMenu.enabled && state.showMenu) {
      ctx.save();
      ctx.fillStyle = ui.mainMenu.bg || '#0e1116';
      ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = ui.mainMenu.titleColor || '#ffb86b';
      ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ui.mainMenu.title || 'Game', VW/2, VH/2 - 24);
      ctx.fillStyle = ui.mainMenu.subColor || '#a8b6cc';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(ui.mainMenu.subtitle || 'Nhấn để bắt đầu', VW/2, VH/2 + 28);
      ctx.restore();
      return;
    }
    if (!state.playing) return;
    const L = ui.layout;
    if (ui.mode === 'joystick') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(L.joyBase.x, L.joyBase.y, L.joyBase.r, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 2; ctx.stroke();
      const jx = state.keys['_joy_x'] || 0, jy = state.keys['_joy_y'] || 0;
      const kx = L.joyBase.x + jx * (L.joyBase.r - L.joyKnob.r);
      const ky = L.joyBase.y + jy * (L.joyBase.r - L.joyKnob.r);
      ctx.beginPath();
      ctx.arc(kx, ky, L.joyKnob.r, 0, Math.PI*2);
      ctx.fillStyle = state.keys['_joy_active'] ? 'rgba(124,92,255,.85)' : 'rgba(124,92,255,.55)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      drawCircleBtn(ctx, L.jump, '▲', state.keys[' '], '#7c5cff');
      drawCircleBtn(ctx, L.fire, 'F', state.keys['Fire'], '#ff7b5a');
    } else {
      drawCircleBtn(ctx, L.left,  '◀', state.keys['ArrowLeft'],  '#7c5cff');
      drawCircleBtn(ctx, L.right, '▶', state.keys['ArrowRight'], '#7c5cff');
      drawCircleBtn(ctx, L.fire,  'F', state.keys['Fire'],       '#ff7b5a');
      drawCircleBtn(ctx, L.jump,  '▲', state.keys[' '],           '#3ddc84');
    }
    if (ui.buttons && ui.buttons.length) {
      for (const b of ui.buttons) {
        const active = state.keys[b.key];
        ctx.save();
        const w = b.w || 70, h = b.h || 40;
        roundRect(ctx, b.x - w/2, b.y - h/2, w, h, 10);
        ctx.fillStyle = active ? 'rgba(124,92,255,.75)' : 'rgba(255,255,255,.14)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#e6e9ef';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(b.label || b.key, b.x, b.y + 1);
        ctx.restore();
      }
    }
  }

  function hitUIButton(p, ui) {
    ui = ui || defaultUI();
    if (ui.mainMenu && ui.mainMenu.enabled) return '__menu__';
    const L = ui.layout;
    const test = (b, key) => {
      if (!b) return null;
      const dx = p.x - b.x, dy = p.y - b.y;
      return (dx*dx + dy*dy <= b.r*b.r) ? key : null;
    };
    if (ui.mode === 'joystick') {
      let k;
      if ((k = test(L.jump, ' '))) return k;
      if ((k = test(L.fire, 'Fire'))) return k;
      const dx = p.x - L.joyBase.x, dy = p.y - L.joyBase.y;
      if (dx*dx + dy*dy <= L.joyBase.r * L.joyBase.r) return '__joy__';
    } else {
      let k;
      if ((k = test(L.left, 'ArrowLeft'))) return k;
      if ((k = test(L.right, 'ArrowRight'))) return k;
      if ((k = test(L.jump, ' '))) return k;
      if ((k = test(L.fire, 'Fire'))) return k;
    }
    if (ui.buttons) {
      for (const b of ui.buttons) {
        const w = b.w || 70, h = b.h || 40;
        if (p.x >= b.x - w/2 && p.x <= b.x + w/2 && p.y >= b.y - h/2 && p.y <= b.y + h/2) return b.key;
      }
    }
    return null;
  }

  function render(ctx, state, opts) {
    opts = opts || {};
    const editor = !!opts.editor;
    const cam = (editor && state.editCam) ? state.editCam : (state.camera || { x: VW/2, y: VH/2 });

    ctx.clearRect(0, 0, VW, VH);
    ctx.fillStyle = '#0e1116';
    ctx.fillRect(0, 0, VW, VH);

    // Screen shake
    ctx.save();
    const shake = state.shakeScreen;
    if (!editor && shake && shake.timeLeft > 0) {
      const k = shake.timeLeft / Math.max(0.001, shake.duration);
      const dx = (Math.random() - 0.5) * 2 * shake.intensity * k;
      const dy = (Math.random() - 0.5) * 2 * shake.intensity * k;
      ctx.translate(dx, dy);
    }
    ctx.translate(VW/2 - cam.x, VH/2 - cam.y);
    if (editor) drawGrid(ctx, cam.x, cam.y);

    for (const it of state.items) if (it.kind === 'block' && !it._dead) drawBlock(ctx, it, editor);
    for (const it of state.items) {
      if (it.kind === 'sprite') {
        drawSprite(ctx, it);
        if (it.hpMode === 'bar' && !it._dead) drawHPBar(ctx, it);
      }
    }
    for (const p of state.projectiles) drawProjectile(ctx, p);
    if (!editor && state.particles) for (const p of state.particles) drawParticle(ctx, p);
    if (!editor && state.floatingTexts) for (const f of state.floatingTexts) drawFloatingText(ctx, f);

    if (editor && state.selectedId) {
      const sel = state.items.find(i => i.id === state.selectedId);
      if (sel) {
        const b = getBounds(sel);
        ctx.save();
        ctx.strokeStyle = '#7c5cff'; ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
        if (sel.hitboxes && sel.hitboxes.length) {
          const boxes = getHitboxes(sel);
          ctx.strokeStyle = 'rgba(61,220,132,.95)';
          ctx.fillStyle = 'rgba(61,220,132,.12)';
          ctx.setLineDash([]); ctx.lineWidth = 1.5;
          for (const hb of boxes) {
            ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
            ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
          }
        } else if (sel.kind === 'sprite') {
          ctx.strokeStyle = 'rgba(61,220,132,.95)';
          ctx.setLineDash([]); ctx.lineWidth = 1.5;
          ctx.strokeRect(b.x, b.y, b.w, b.h);
        }
        if (sel.kind === 'sprite' && sel.camera) {
          ctx.fillStyle = 'rgba(255,200,80,.9)';
          ctx.font = 'bold 12px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('CAM', sel.x, sel.y - sel.h/2 - 24);
        }
        if (sel.kind === 'sprite' && sel.control === 'bot') {
          const r = sel.botRange != null ? sel.botRange : 150;
          ctx.strokeStyle = 'rgba(255,90,110,.4)';
          ctx.setLineDash([4, 6]);
          ctx.beginPath(); ctx.arc(sel.x, sel.y, r, 0, Math.PI*2); ctx.stroke();
        }
        if (sel.kind === 'sprite' && sel.shoot && sel.shoot.enabled) {
          ctx.fillStyle = '#ffb86b';
          ctx.beginPath();
          ctx.arc(sel.x + (sel.shoot.offsetX||0), sel.y + (sel.shoot.offsetY||0), 4, 0, Math.PI*2);
          ctx.fill();
        }
        if (sel.kind === 'sprite' && sel.events && sel.events.length) {
          // small badge to indicate events
          ctx.fillStyle = 'rgba(255,184,107,.9)';
          ctx.font = 'bold 11px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('EV ' + sel.events.length, sel.x, sel.y - sel.h/2 - 40);
        }
        ctx.restore();
      }
    }
    ctx.restore();

    if (!editor || opts.forceUIDraw) drawUI(ctx, state);
  }

  return {
    VW, VH,
    BASE_SPEED, BASE_JUMP, BASE_GRAVITY,
    defaultUI,
    getBounds, getHitboxes, aabb, damage,
    resolveCollisions, updateItem, updateBlock,
    updateProjectiles, updateCamera,
    updateParticles, updateFloatingTexts, updateShake,
    render, drawUI, hitUIButton, spawnBullet, tryShoot,
    fireEvent, executeAction, frameOf, initVars, bodyBoxes, respawnItem, AI_DEF, clampAI, createBGM, updateBGM, updateTechAnims, evalTech, techSchedule, startTech, blockBoxes, satMTV, makeRotBox, axisPush, easeFn
  };
}

/* ============================================================
   STORAGE: OPFS -> IndexedDB -> localStorage   +   PROJECTS
   ============================================================ */
const Store = (function () {
  let impl = null;
  function opfs() {
    let dir = null;
    const D = async () => dir || (dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('mnhr-projects', { create: true }));
    return {
      name: 'OPFS',
      get: async (k) => {
        const d = await D();
        try { return await (await (await d.getFileHandle(k)).getFile()).text(); }
        catch (e) { if (e && e.name === 'NotFoundError') return null; throw e; }
      },
      set: async (k, s) => {
        const fh = await (await D()).getFileHandle(k, { create: true });
        const w = await fh.createWritable();
        try { await w.write(s); await w.close(); }
        catch (e) { try { await w.abort(); } catch (_) {} throw e; }
        if ((await fh.getFile()).size !== new Blob([s]).size) throw new Error('Ghi thiếu dữ liệu');
      },
      del: async (k) => { try { await (await D()).removeEntry(k); } catch (e) { if (!e || e.name !== 'NotFoundError') throw e; } }
    };
  }
  function idb() {
    let P = null;
    const open = () => P || (P = new Promise((res, rej) => {
      const r = indexedDB.open('mnhr', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const run = (mode, fn) => open().then(db => new Promise((res, rej) => {
      const t = db.transaction('kv', mode), q = fn(t.objectStore('kv'));
      t.oncomplete = () => res(q.result); t.onerror = t.onabort = () => rej(t.error);
    }));
    return {
      name: 'IndexedDB',
      get: async (k) => { const v = await run('readonly', s => s.get(k)); return v == null ? null : v; },
      set: (k, s) => run('readwrite', st => st.put(s, k)),
      del: (k) => run('readwrite', s => s.delete(k))
    };
  }
  function ls() {
    return {
      name: 'localStorage',
      get: async (k) => localStorage.getItem('mnhr:' + k),
      set: async (k, s) => { localStorage.setItem('mnhr:' + k, s); },
      del: async (k) => { localStorage.removeItem('mnhr:' + k); }
    };
  }
  async function init() {
    const cands = [];
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.getDirectory) cands.push(opfs);
    if (typeof indexedDB !== 'undefined') cands.push(idb);
    cands.push(ls);
    for (const mk of cands) {
      try {
        const b = mk();
        await b.set('__probe', 'ok');
        if ((await b.get('__probe')) !== 'ok') throw new Error('probe');
        await b.del('__probe');
        impl = b; break;
      } catch (e) { console.warn('storage backend failed:', e); }
    }
    if (!impl) impl = ls();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (_) {}
    return impl.name;
  }
  return { init, name: () => impl ? impl.name : '?', get: k => impl.get(k), set: (k, s) => impl.set(k, s), del: k => impl.del(k) };
})();

const Projects = (function () {
  const LEGACY = 'mnhr_projects_v2';
  let idx = { projects: [], currentId: null };
  const pkey = id => 'p_' + id + '.json';
  const saveIndex = () => Store.set('index.json', JSON.stringify(idx));
  function emptyScene() {
    const VW = 640, VH = 360;
    return {
      vw: VW, vh: VH,
      items: [{
        kind: 'block', id: 'ground', name: 'Mặt đất',
        x: VW/2, y: VH - 16, w: VW, h: 32,
        solid: true, hazard: false,
        tex: { all: null, top: null, bottom: null, left: null, right: null },
        hitboxes: [],
        animations: { default: { frames: [], fps: 8, loop: true } }
      }],
      ui: MiniRuntime().defaultUI()
    };
  }
  async function init() {
    const raw = await Store.get('index.json');
    if (raw) { try { idx = JSON.parse(raw); } catch (e) { idx = null; } }
    if (!idx || !Array.isArray(idx.projects)) idx = { projects: [], currentId: null };
    if (!raw) {
      try {
        const old = JSON.parse(localStorage.getItem(LEGACY) || 'null');
        if (old && old.projects && old.projects.length) {
          for (const p of old.projects) {
            const s = JSON.stringify(p.data || emptyScene());
            await Store.set(pkey(p.id), s);
            idx.projects.push({ id: p.id, name: p.name, updatedAt: p.updatedAt || Date.now(), size: s.length });
          }
          idx.currentId = old.currentId || idx.projects[0].id;
          await saveIndex();
        }
      } catch (e) { console.warn('legacy migrate fail', e); }
    }
  }
  return {
    init, empty: emptyScene,
    list: () => idx.projects,
    meta: (id) => idx.projects.find(p => p.id === id),
    currentId: () => idx.currentId,
    setCurrent: async (id) => { idx.currentId = id; try { await saveIndex(); } catch (e) {} },
    read: async (id) => { const raw = await Store.get(pkey(id)); return raw ? JSON.parse(raw) : null; },
    create: async (name, data) => {
      const id = 'p' + Date.now() + Math.random().toString(36).slice(2, 6);
      const s = JSON.stringify(data || emptyScene());
      await Store.set(pkey(id), s);
      const m = { id, name: name || 'Dự án mới', updatedAt: Date.now(), size: s.length };
      idx.projects.unshift(m); idx.currentId = id;
      await saveIndex();
      return m;
    },
    save: async (id, data) => {
      const m = idx.projects.find(x => x.id === id);
      if (!m) throw new Error('Không tìm thấy dự án');
      const s = JSON.stringify(data);
      await Store.set(pkey(id), s);
      m.updatedAt = Date.now(); m.size = s.length;
      await saveIndex();
      return s.length;
    },
    remove: async (id) => {
      idx.projects = idx.projects.filter(p => p.id !== id);
      if (idx.currentId === id) idx.currentId = idx.projects[0] ? idx.projects[0].id : null;
      await saveIndex();
      try { await Store.del(pkey(id)); } catch (e) {}
    }
  };
})();

/* ============================================================
   EDITOR
   ============================================================ */
const RT = MiniRuntime();
const VW = RT.VW, VH = RT.VH;
const uid = () => 'x' + Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

let canvas, ctx, imgCache;
let saveTimer = null;

const State = {
  items: [], selectedId: null, playing: false,
  keys: {}, time: 0,
  drag: null, panMode: false, panStart: null,
  pointerToBtn: new Map(),
  joystick: { active: false, pointerId: null },
  camera: { x: VW/2, y: VH/2 },
  editCam: { x: VW/2, y: VH/2 },
  projectiles: [],
  particles: [],
  floatingTexts: [],
  shakeScreen: { intensity: 0, timeLeft: 0, duration: 0.001 },
  currentProjectId: null,
  tab: 'scene',
  ui: RT.defaultUI(),
  uiSelected: null, uiDrag: null,
  showMenu: false, fullscreen: false, dirty: false,
  varDefs: [], vars: {},
  res: { scale: 1, pixel: false },
  opts: { turnAnim: true }, music: { tracks: [] }, bgmCtl: null
};

function toast(msg, kind, ms) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + (kind || '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.className = ''; }, ms || 2200);
}

/* ============================================================
   FILE PICKING
   ============================================================ */
function pickFiles(opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = opts.accept || 'image/*';
    input.multiple = !!opts.multiple || !!opts.directory;
    if (opts.directory) input.webkitdirectory = true;
    input.style.cssText = 'position:fixed;left:-10000px;top:0;';
    document.body.appendChild(input);
    let settled = false;
    const finish = (files) => {
      if (settled) return;
      settled = true;
      try { document.body.removeChild(input); } catch (_) {}
      resolve(files || []);
    };
    input.addEventListener('change', () => finish(Array.from(input.files || [])));
    const onFocus = () => setTimeout(() => {
      window.removeEventListener('focus', onFocus);
      if (!settled) finish([]);
    }, 400);
    window.addEventListener('focus', onFocus);
    input.click();
  });
}
function readAsDataURL(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });
}
function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = document.createElement('img');
    img.style.cssText = 'position:absolute;width:1px;height:1px;';
    imgCache.appendChild(img);
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/* ============================================================
   IMPORT HELPERS
   ============================================================ */
async function importBlockTexture(item, key) {
  const files = await pickFiles({ accept: 'image/*' });
  if (!files.length) return;
  const url = await readAsDataURL(files[0]);
  const img = await loadImage(url);
  if (!img) { toast('Không tải được ảnh', 'err'); return; }
  item.tex[key] = { url, img };
  renderInspector(); renderLayers(); scheduleSave();
  toast('Đã import texture', 'ok');
}
async function importAnimFrames(ctx2) {
  const files = await pickFiles({ accept: 'image/*' });
  if (!files.length) return;
  const item = State.items.find(i => i.id === ctx2.itemId);
  if (!item) { toast('Không tìm thấy item', 'err'); return; }
  const anim = item.animations[ctx2.key];
  if (!anim) { toast('Animation không tồn tại', 'err'); return; }
  const url = await readAsDataURL(files[0]);
  if (!url) { toast('Không đọc được file', 'err'); return; }
  const img = await loadImage(url);
  if (!img) { toast('Không tải được ảnh', 'err'); return; }
  anim.frames.push({ url, img });
  renderAnimFrames(); renderInspector(); renderLayers(); scheduleSave();
  toast('Đã thêm 1 frame', 'ok');
}
const IMG_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
async function unzipImages(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Không phải file ZIP hợp lệ');
  const n = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = [], dec = new TextDecoder();
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + el + cl;
    if (!IMG_RE.test(name) || name.split('/').some(sg => sg.startsWith('.') || sg === '__MACOSX')) continue;
    const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    let data = buf.subarray(start, start + csize);
    if (method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('Trình duyệt không giải nén được ZIP này — hãy dùng thư mục hoặc nén kiểu Store');
      data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    } else if (method !== 0) continue;
    const ext = name.split('.').pop().toLowerCase();
    out.push({ name, blob: new Blob([data], { type: (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : 'image/' + ext }) });
  }
  return out;
}
async function importAnimBulk(kind) {
  if (!animCtx) return;
  const item = State.items.find(i => i.id === animCtx.itemId);
  const anim = item && item.animations[animCtx.key];
  if (!anim) { toast('Animation không tồn tại', 'err'); return; }
  let files = [];
  try {
    if (kind === 'zip') {
      const f = await pickFiles({ accept: '.zip,application/zip,application/x-zip-compressed,*/*' });
      if (!f.length) return;
      toast('Đang giải nén…', 'ok', 1500);
      files = await unzipImages(f[0]);
    } else {
      const f = await pickFiles({ accept: 'image/*', directory: true });
      files = f.filter(x => IMG_RE.test(x.name) || (x.type || '').indexOf('image/') === 0).map(x => ({ name: x.webkitRelativePath || x.name, blob: x }));
    }
  } catch (e) { toast('Import thất bại: ' + ((e && e.message) || e), 'err', 5000); return; }
  if (!files.length) { toast('Không tìm thấy ảnh nào', 'err'); return; }
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  let n = 0;
  for (const f of files) {
    const url = await readAsDataURL(f.blob);
    const img = url ? await loadImage(url) : null;
    if (!img) continue;
    anim.frames.push({ url, img }); n++;
  }
  renderAnimFrames(); renderInspector(); renderLayers(); scheduleSave();
  toast('Đã thêm ' + n + '/' + files.length + ' frame (theo thứ tự tên file)', 'ok', 3500);
}
let sheetCtx = { file: null, url: null, img: null };
async function importSpritesheetFile() {
  const files = await pickFiles({ accept: 'image/*' });
  if (!files.length) return;
  const url = await readAsDataURL(files[0]);
  const img = await loadImage(url);
  if (!img) { toast('Không tải được ảnh', 'err'); return; }
  sheetCtx = { file: files[0], url, img };
  document.getElementById('sheetPanel').style.display = 'block';
  const preview = document.getElementById('sheetPreview');
  preview.innerHTML = '';
  const pi = document.createElement('img');
  pi.src = url;
  preview.appendChild(pi);
  document.getElementById('sheetW').value = img.naturalWidth;
  document.getElementById('sheetH').value = img.naturalHeight;
  document.getElementById('sheetX').value = 0;
  document.getElementById('sheetY').value = 0;
  document.getElementById('sheetPad').value = 0;
  document.getElementById('sheetMax').value = 0;
}
async function doSliceSheet() {
  if (!sheetCtx.img || !animCtx) { toast('Chưa chọn ảnh', 'err'); return; }
  const fw = Math.max(1, parseInt(document.getElementById('sheetW').value, 10) || 64);
  const fh = Math.max(1, parseInt(document.getElementById('sheetH').value, 10) || 64);
  const ox = parseInt(document.getElementById('sheetX').value, 10) || 0;
  const oy = parseInt(document.getElementById('sheetY').value, 10) || 0;
  const pad = parseInt(document.getElementById('sheetPad').value, 10) || 0;
  const maxFrames = parseInt(document.getElementById('sheetMax').value, 10) || 0;
  const item = State.items.find(i => i.id === animCtx.itemId);
  if (!item) return;
  const anim = item.animations[animCtx.key];
  if (!anim) return;
  const img = sheetCtx.img;
  const cols = Math.floor((img.naturalWidth  - ox + pad) / (fw + pad));
  const rows = Math.floor((img.naturalHeight - oy + pad) / (fh + pad));
  let made = 0;
  outer:
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (maxFrames > 0 && made >= maxFrames) break outer;
      const sx = ox + x * (fw + pad);
      const sy = oy + y * (fh + pad);
      const c = document.createElement('canvas');
      c.width = fw; c.height = fh;
      c.getContext('2d').drawImage(img, sx, sy, fw, fh, 0, 0, fw, fh);
      const furl = c.toDataURL('image/png');
      const fimg = await loadImage(furl);
      if (fimg) { anim.frames.push({ url: furl, img: fimg }); made++; }
    }
  }
  renderAnimFrames(); renderInspector(); renderLayers(); scheduleSave();
  toast('Đã cắt ' + made + ' frames', 'ok');
  document.getElementById('sheetPanel').style.display = 'none';
  sheetCtx = { file: null, url: null, img: null };
}

/* ============================================================
   HITBOX EDITOR
   ============================================================ */
const hitboxState = {
  itemId: null, W: 0, H: 0, img: null,
  boxes: [], scale: 1, frameSets: new Map(),
  defBoxes: [], cur: null, item: null, targets: [],
  drawing: false, drawStart: null, drawPreview: null
};
let hitboxCanvas, hitboxCtx2;

function collectFrameObjs(item) {
  const out = [];
  const add = (a) => { if (a && a.frames) for (const f of a.frames) out.push(f); };
  if (item.kind === 'sprite') { for (const k in item.animations) if (k !== 'bullet') add(item.animations[k]); }
  else add(item.animations && item.animations.default);
  return out;
}
function collectAllFrames(item) {
  const imgs = collectFrameObjs(item).map(f => f.img).filter(Boolean);
  if (item.kind === 'block' && item.tex) for (const k in item.tex) if (item.tex[k] && item.tex[k].img) imgs.push(item.tex[k].img);
  return imgs;
}

function openHitboxModal(item) {
  hitboxState.itemId = item.id;
  hitboxState.W = item.w;
  hitboxState.H = item.h;
  hitboxState.img = pickPreviewImage(item);
  hitboxState.frameSets = new Map();
  for (const f of collectFrameObjs(item)) {
    if (f.hitboxes && f.hitboxes.length) hitboxState.frameSets.set(f, f.hitboxes.map(h => ({
      x: h.ox + item.w/2 - h.w/2, y: h.oy + item.h/2 - h.h/2, w: h.w, h: h.h })));
  }
  hitboxState.drawing = false;
  hitboxState.drawStart = null;
  hitboxState.drawPreview = null;

  if (item.hitboxes && item.hitboxes.length) {
    hitboxState.boxes = item.hitboxes.map(h => ({
      x: h.ox + item.w/2 - h.w/2,
      y: h.oy + item.h/2 - h.h/2,
      w: h.w, h: h.h
    }));
  } else if (item.kind === 'sprite' && item.hb) {
    hitboxState.boxes = [{
      x: item.w/2 + item.hb.ox - item.hb.hw,
      y: item.h/2 + item.hb.oy - item.hb.hh,
      w: item.hb.hw * 2, h: item.hb.hh * 2
    }];
  } else {
    hitboxState.boxes = [{ x: 0, y: 0, w: item.w, h: item.h }];
  }

  hitboxState.defBoxes = hitboxState.boxes; hitboxState.cur = null; hitboxState.item = item;
  hbBuildBar(item);
  document.getElementById('hitboxTitle').textContent = 'Hitbox: ' + (item.name || '');
  document.getElementById('hitboxModal').classList.add('show');
  document.getElementById('hitboxAllFrames').checked = true;

  hitboxCanvas = document.getElementById('hitboxCanvas');
  hitboxCtx2 = hitboxCanvas.getContext('2d');

  const maxW = Math.min(640, window.innerWidth - 100);
  const maxH = Math.min(340, window.innerHeight - 340);
  const s = Math.max(1, Math.min(maxW / item.w, maxH / item.h, 12));
  hitboxState.scale = s;

  hitboxCanvas.width = item.w;
  hitboxCanvas.height = item.h;
  hitboxCanvas.style.width  = Math.round(item.w * s) + 'px';
  hitboxCanvas.style.height = Math.round(item.h * s) + 'px';
  hitboxCanvas.style.imageRendering = s >= 4 ? 'pixelated' : 'auto';

  redrawHitboxCanvas();
  renderHitboxList();
  updateHitboxInfo();
}

/* ---- Chọn mục tiêu đang sửa: Mặc định hoặc từng frame ---- */
function hbFrameLabels(item) {
  const out = [];
  const names = { idle: 'Đứng yên', run: 'Chạy', jump: 'Nhảy', hurt: 'Bị đánh', die: 'Chết', shoot: 'Bắn', turn: 'Lật' };
  const add = (key, a) => { if (a && a.frames) a.frames.forEach((f, i) => out.push({ f, label: (names[key] || (key.indexOf('custom:') === 0 ? key.slice(7) : key)) + ' #' + (i + 1) })); };
  if (item.kind === 'sprite') { for (const k in item.animations) if (k !== 'bullet') add(k, item.animations[k]); }
  else add('default', item.animations && item.animations.default);
  return out;
}
function hbBuildBar(item) {
  let bar = document.getElementById('hbTargetBar');
  if (!bar) {
    const wrap = document.getElementById('hitboxWrap');
    bar = document.createElement('div'); bar.id = 'hbTargetBar';
    bar.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0;font-size:12px;';
    wrap.parentNode.insertBefore(bar, wrap);
  }
  hitboxState.targets = hbFrameLabels(item);
  bar.innerHTML = '';
  const lb = document.createElement('span'); lb.textContent = 'Đang sửa:'; bar.appendChild(lb);
  const sel = document.createElement('select'); sel.id = 'hbTargetSel'; sel.style.maxWidth = '230px';
  sel.onchange = () => { const i = parseInt(sel.value, 10); hbSetTarget(i >= 0 ? hitboxState.targets[i].f : null); };
  bar.appendChild(sel);
  const rm = document.createElement('button'); rm.id = 'hbTargetRm'; rm.className = 'btn'; rm.textContent = 'Bỏ hitbox riêng';
  rm.onclick = () => { if (hitboxState.cur) { hitboxState.frameSets.delete(hitboxState.cur); hbSetTarget(hitboxState.cur); } };
  bar.appendChild(rm);
  const lb2 = document.createElement('span'); lb2.textContent = 'Cách Auto-Detect:'; lb2.style.marginLeft = '8px'; bar.appendChild(lb2);
  const ms = document.createElement('select'); ms.id = 'hbMethodSel';
  [['perframe', 'Mỗi frame riêng'], ['one', 'Một frame tự chọn (dùng chung)'], ['merge', 'Gộp tất cả frame thành 1']].forEach(kv => {
    const o = document.createElement('option'); o.value = kv[0]; o.textContent = kv[1]; ms.appendChild(o);
  });
  ms.value = 'perframe'; bar.appendChild(ms);
  const cbx = document.getElementById('hitboxAllFrames');
  if (cbx && cbx.parentNode && cbx.parentNode.style) cbx.parentNode.style.display = 'none';   // thay bằng ô chọn 3 cách
  hbRefreshBar();
}
function hbRefreshBar() {
  const sel = document.getElementById('hbTargetSel'); if (!sel) return;
  sel.innerHTML = '';
  const o0 = document.createElement('option'); o0.value = '-1'; o0.textContent = 'Mặc định (frame chưa có hitbox riêng)'; sel.appendChild(o0);
  hitboxState.targets.forEach((t, i) => {
    const o = document.createElement('option'); o.value = String(i);
    o.textContent = t.label + (hitboxState.frameSets.has(t.f) ? '  ●' : ''); sel.appendChild(o);
  });
  sel.value = String(hitboxState.cur ? hitboxState.targets.findIndex(t => t.f === hitboxState.cur) : -1);
  const rm = document.getElementById('hbTargetRm');
  if (rm) rm.disabled = !(hitboxState.cur && hitboxState.frameSets.has(hitboxState.cur));
}
function hbSetTarget(f) {
  hitboxState.cur = f || null;
  hitboxState.drawing = false; hitboxState.drawPreview = null;
  const base = hitboxState.item ? pickPreviewImage(hitboxState.item) : null;
  if (!f) { hitboxState.boxes = hitboxState.defBoxes; hitboxState.img = base; }
  else {
    hitboxState.boxes = hitboxState.frameSets.has(f) ? hitboxState.frameSets.get(f) : hitboxState.defBoxes.map(b => Object.assign({}, b));
    hitboxState.img = f.img || base;
  }
  hbRefreshBar(); redrawHitboxCanvas(); renderHitboxList(); updateHitboxInfo();
}
function hbCommit() {   // ghi mảng đang sửa vào đúng mục tiêu (mặc định / frame)
  if (hitboxState.cur) hitboxState.frameSets.set(hitboxState.cur, hitboxState.boxes);
  else hitboxState.defBoxes = hitboxState.boxes;
  hbRefreshBar();
}
function hbReplace(arr) { hitboxState.boxes = arr; hbCommit(); }

function pickPreviewImage(item) {
  if (item.kind === 'sprite') {
    const anim = item.animations.idle;
    if (anim && anim.frames.length && anim.frames[0].img) return anim.frames[0].img;
    for (const k in item.animations) {
      const a = item.animations[k];
      if (a && a.frames.length && a.frames[0].img) return a.frames[0].img;
    }
  } else if (item.kind === 'block') {
    const anim = item.animations && item.animations.default;
    if (anim && anim.frames.length && anim.frames[0].img) return anim.frames[0].img;
    if (item.tex.all && item.tex.all.img) return item.tex.all.img;
    if (item.tex.top && item.tex.top.img) return item.tex.top.img;
  }
  return null;
}

function redrawHitboxCanvas() {
  if (!hitboxCtx2) return;
  const W = hitboxState.W, H = hitboxState.H;
  const c = hitboxCtx2;
  c.clearRect(0, 0, W, H);
  if (hitboxState.img) {
    c.drawImage(hitboxState.img, 0, 0, W, H);
  } else {
    c.fillStyle = '#262d3f'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#6d7f99';
    c.font = 'bold 12px system-ui, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('(không có ảnh)', W/2, H/2);
  }
  c.save();
  c.strokeStyle = 'rgba(255,255,255,.06)';
  c.lineWidth = 1;
  for (let x = 0; x <= W; x += 8) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 0; y <= H; y += 8) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.restore();
  c.save();
  for (const b of hitboxState.boxes) {
    c.fillStyle = 'rgba(61,220,132,.22)';
    c.fillRect(b.x, b.y, b.w, b.h);
    c.strokeStyle = '#3ddc84';
    c.lineWidth = 1.5;
    c.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  }
  if (hitboxState.drawing && hitboxState.drawPreview) {
    const p = hitboxState.drawPreview;
    c.fillStyle = 'rgba(255,184,107,.25)';
    c.fillRect(p.x, p.y, p.w, p.h);
    c.strokeStyle = '#ffb86b';
    c.lineWidth = 1.5; c.setLineDash([4, 3]);
    c.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
    c.setLineDash([]);
  }
  c.restore();
}

function renderHitboxList() {
  const el2 = document.getElementById('hitboxList');
  el2.innerHTML = '';
  if (!hitboxState.boxes.length) {
    el2.innerHTML = '<div style="padding:6px;color:#4f5f78;">Chưa có hitbox. Vẽ bằng cách kéo trên ảnh.</div>';
    return;
  }
  hitboxState.boxes.forEach((b, i) => {
    const r = document.createElement('div');
    r.className = 'hb-row';
    r.innerHTML = '<span>#' + (i+1) + '  (x:' + Math.round(b.x) + ', y:' + Math.round(b.y) +
                  ', w:' + Math.round(b.w) + ', h:' + Math.round(b.h) + ')</span>';
    const del = document.createElement('span');
    del.className = 'hb-del';
    del.textContent = '✕';
    del.onclick = () => {
      hitboxState.boxes.splice(i, 1); hbCommit();
      redrawHitboxCanvas(); renderHitboxList(); updateHitboxInfo();
    };
    r.appendChild(del);
    el2.appendChild(r);
  });
}
function updateHitboxInfo() {
  const own = hitboxState.frameSets.size;
  const head = hitboxState.cur ? ('Frame này: ' + (hitboxState.frameSets.has(hitboxState.cur) ? 'hitbox riêng' : 'đang kế thừa mặc định (chưa lưu riêng)')) : 'Mặc định';
  document.getElementById('hitboxInfo').textContent = head + ' · ' + hitboxState.boxes.length + ' vùng' + (own ? ' · ' + own + ' frame có hitbox riêng' : '');
}
function hbPointerPos(e) {
  const r = hitboxCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (hitboxCanvas.width / r.width),
    y: (e.clientY - r.top) * (hitboxCanvas.height / r.height)
  };
}
function hbClamp(p) { return { x: clamp(p.x, 0, hitboxState.W), y: clamp(p.y, 0, hitboxState.H) }; }
function hbPointerDown(e) {
  e.preventDefault();
  const p = hbClamp(hbPointerPos(e));
  hitboxState.drawing = true;
  hitboxState.drawStart = p;
  hitboxState.drawPreview = { x: p.x, y: p.y, w: 0, h: 0 };
  try { hitboxCanvas.setPointerCapture(e.pointerId); } catch (_) {}
}
function hbPointerMove(e) {
  if (!hitboxState.drawing) return;
  const p = hbClamp(hbPointerPos(e));
  const s = hitboxState.drawStart;
  const x = Math.min(s.x, p.x), y = Math.min(s.y, p.y);
  const w = Math.abs(p.x - s.x), h = Math.abs(p.y - s.y);
  hitboxState.drawPreview = { x, y, w, h };
  redrawHitboxCanvas();
}
function hbPointerUp(e) {
  if (!hitboxState.drawing) return;
  hitboxState.drawing = false;
  const p = hitboxState.drawPreview;
  hitboxState.drawPreview = null;
  if (p && p.w >= 2 && p.h >= 2) {
    hitboxState.boxes.push({ x: p.x, y: p.y, w: p.w, h: p.h });
    hbCommit();
    renderHitboxList(); updateHitboxInfo();
  }
  redrawHitboxCanvas();
}

/* ---------- AUTO-DETECT ---------- */
/* Extract solid cells from a given alpha map */
function buildGridFromAlpha(alpha, W, H, cellSize, alphaThreshold) {
  const cols = Math.ceil(W / cellSize);
  const rows = Math.ceil(H / cellSize);
  const grid = [];
  for (let y = 0; y < rows; y++) {
    grid[y] = [];
    for (let x = 0; x < cols; x++) {
      let solid = false;
      const x0 = Math.floor(x * cellSize), y0 = Math.floor(y * cellSize);
      const x1 = Math.min(W, Math.max(x0 + 1, Math.ceil((x + 1) * cellSize))), y1 = Math.min(H, Math.max(y0 + 1, Math.ceil((y + 1) * cellSize)));
      for (let py = y0; py < y1 && !solid; py++) {
        for (let px = x0; px < x1; px++) {
          if (alpha[py * W + px] > alphaThreshold) { solid = true; break; }
        }
      }
      grid[y][x] = solid;
    }
  }
  return { grid, cols, rows };
}
function mergeGridToRects(grid, cols, rows, cellSize, W, H) {
  const used = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const rects = [];
  for (let y = 0; y < rows; y++) {
    let x = 0;
    while (x < cols) {
      if (grid[y][x] && !used[y][x]) {
        let x2 = x;
        while (x2 + 1 < cols && grid[y][x2+1] && !used[y][x2+1]) x2++;
        let y2 = y;
        outer:
        while (y2 + 1 < rows) {
          for (let xx = x; xx <= x2; xx++) {
            if (!grid[y2+1][xx] || used[y2+1][xx]) break outer;
          }
          y2++;
        }
        for (let yy = y; yy <= y2; yy++)
          for (let xx = x; xx <= x2; xx++)
            used[yy][xx] = true;
        rects.push({
          x: x * cellSize, y: y * cellSize,
          w: Math.min((x2 - x + 1) * cellSize, W - x * cellSize),
          h: Math.min((y2 - y + 1) * cellSize, H - y * cellSize)
        });
        x = x2 + 1;
      } else x++;
    }
  }
  return rects;
}

function autoDetectHitboxes(image, W, H, cellSize, alphaThreshold) {
  const cnv = document.createElement('canvas');
  cnv.width = W; cnv.height = H;
  const c2 = cnv.getContext('2d');
  c2.drawImage(image, 0, 0, W, H);
  let data;
  try { data = c2.getImageData(0, 0, W, H).data; } catch (e) { return null; }
  const alpha = new Uint8ClampedArray(W * H);
  for (let i = 0; i < W * H; i++) alpha[i] = data[i * 4 + 3];
  const { grid, cols, rows } = buildGridFromAlpha(alpha, W, H, cellSize, alphaThreshold);
  return mergeGridToRects(grid, cols, rows, cellSize, W, H);
}

/* Mỗi frame một bộ hitbox riêng (Map frame → rects) */
function autoDetectPerFrame(item, W, H, cell, thr) {
  const sets = new Map();
  const cnv = document.createElement('canvas'); cnv.width = W; cnv.height = H;
  const c2 = cnv.getContext('2d');
  for (const f of collectFrameObjs(item)) {
    if (!f.img) continue;
    c2.clearRect(0, 0, W, H); c2.drawImage(f.img, 0, 0, W, H);
    let data; try { data = c2.getImageData(0, 0, W, H).data; } catch (e) { return null; }
    const alpha = new Uint8ClampedArray(W * H);
    for (let i = 0; i < W * H; i++) alpha[i] = data[i * 4 + 3];
    const g = buildGridFromAlpha(alpha, W, H, cell, thr);
    sets.set(f, mergeGridToRects(g.grid, g.cols, g.rows, cell, W, H));
  }
  return sets;
}
/* Union alpha of ALL frames → hitbox mặc định (dự phòng) */
function autoDetectAllFrames(item, W, H, cellSize, alphaThreshold) {
  const allFrames = collectAllFrames(item);
  if (!allFrames.length) return null;
  const cnv = document.createElement('canvas');
  cnv.width = W; cnv.height = H;
  const c2 = cnv.getContext('2d');
  const alpha = new Uint8ClampedArray(W * H);
  for (const img of allFrames) {
    c2.clearRect(0, 0, W, H);
    c2.drawImage(img, 0, 0, W, H);
    let data;
    try { data = c2.getImageData(0, 0, W, H).data; } catch (e) { return null; }
    for (let i = 0; i < W * H; i++) {
      const a = data[i * 4 + 3];
      if (a > alpha[i]) alpha[i] = a;
    }
  }
  const { grid, cols, rows } = buildGridFromAlpha(alpha, W, H, cellSize, alphaThreshold);
  return mergeGridToRects(grid, cols, rows, cellSize, W, H);
}

function hbAutoDetect() {
  if (!hitboxState.itemId) { toast('Không có item', 'err'); return; }
  const item = State.items.find(i => i.id === hitboxState.itemId);
  if (!item) { toast('Không tìm thấy item', 'err'); return; }
  let cellSize = parseFloat(document.getElementById('hitboxCell').value);
  if (!isFinite(cellSize) || cellSize <= 0) cellSize = 16;
  cellSize = clamp(cellSize, 0.25, 128);
  if (cellSize < 1) {
    if (!confirm('Việc đặt Cell Size dưới 1 sẽ không làm HitBox chính xác hơn bao nhiêu nhưng có thể tiềm ẩn rủi ro lỗi engine.\nVẫn tiếp tục?')) return;
    if ((hitboxState.W / cellSize) * (hitboxState.H / cellSize) > 1500000) { toast('Cell Size quá nhỏ so với kích thước ảnh, hãy tăng lên', 'err', 4000); return; }
  }
  const alphaThr = clamp(parseInt(document.getElementById('hitboxAlpha').value, 10) || 10, 0, 255);
  const allFrames = document.getElementById('hitboxAllFrames').checked;

  const msel = document.getElementById('hbMethodSel');
  const method = (msel && msel.value) || 'perframe';
  let rects;
  if (method === 'perframe' || method === 'merge') {
    rects = autoDetectAllFrames(item, hitboxState.W, hitboxState.H, cellSize, alphaThr);
    if (rects === null) { toast('Không có frame nào để nhận diện', 'err'); return; }
    if (!rects.length) { toast('Không tìm thấy vùng đặc', 'err'); return; }
    if (method === 'perframe') {
      hitboxState.frameSets = autoDetectPerFrame(item, hitboxState.W, hitboxState.H, cellSize, alphaThr) || new Map();
      toast('Auto-detect: mỗi frame một hitbox riêng (' + hitboxState.frameSets.size + ' frame)', 'ok', 3200);
    } else {
      if (hitboxState.frameSets.size && !confirm('Hitbox riêng của ' + hitboxState.frameSets.size + ' frame sẽ bị xoá và dùng 1 hitbox chung. Tiếp tục?')) return;
      hitboxState.frameSets = new Map();
      toast('Auto-detect: gộp tất cả frame thành 1 hitbox (' + rects.length + ' vùng)', 'ok', 3200);
    }
    hitboxState.defBoxes = rects;   // hitbox chung = phần gộp mọi frame
    hbSetTarget(null);
    return;
  }
  // 'one': một frame tự chọn → dùng chung cho mọi frame
  if (!hitboxState.img) { toast('Không có ảnh', 'err'); return; }
  rects = autoDetectHitboxes(hitboxState.img, hitboxState.W, hitboxState.H, cellSize, alphaThr);
  if (rects === null) { toast('Không đọc được pixel', 'err'); return; }
  if (!rects.length) { toast('Không tìm thấy vùng đặc', 'err'); return; }
  if (hitboxState.frameSets.size && !confirm('Hitbox riêng của ' + hitboxState.frameSets.size + ' frame sẽ bị xoá và dùng 1 hitbox chung. Tiếp tục?')) return;
  hitboxState.frameSets = new Map();
  hitboxState.defBoxes = rects;
  toast('Auto-detect: dùng frame ' + (hitboxState.cur ? 'đang chọn' : 'đầu tiên') + ' làm hitbox chung (' + rects.length + ' vùng)', 'ok', 3200);
  hbSetTarget(null);
}

function saveHitbox() {
  const item = State.items.find(i => i.id === hitboxState.itemId);
  if (!item) { closeHitboxModal(); return; }
  const W = hitboxState.W, H = hitboxState.H;
  item.hitboxes = hitboxState.defBoxes.map(b => ({
    ox: b.x + b.w/2 - W/2,
    oy: b.y + b.h/2 - H/2,
    w: b.w, h: b.h
  }));
  for (const f of collectFrameObjs(item)) {
    const bx = hitboxState.frameSets.get(f);
    if (bx && bx.length) f.hitboxes = bx.map(b => ({ ox: b.x + b.w/2 - W/2, oy: b.y + b.h/2 - H/2, w: b.w, h: b.h }));
    else delete f.hitboxes;
  }
  renderInspector(); renderLayers(); scheduleSave();
  const own = collectFrameObjs(item).filter(f => f.hitboxes && f.hitboxes.length).length;
  toast('Đã lưu ' + item.hitboxes.length + ' hitbox mặc định' + (own ? ' · ' + own + ' frame có hitbox riêng' : '') +
    '', 'ok', 4500);
  closeHitboxModal();
}
function closeHitboxModal() {
  document.getElementById('hitboxModal').classList.remove('show');
  hitboxState.itemId = null;
  hitboxState.img = null;
  hitboxState.boxes = []; hitboxState.defBoxes = []; hitboxState.cur = null; hitboxState.item = null; hitboxState.targets = [];
  hitboxState.frameSets = new Map();
  hitboxState.drawing = false;
  hitboxState.drawPreview = null;
}

/* ============================================================
   FACTORIES
   ============================================================ */
function countPrefix(items, kind, prefix) {
  let max = 0;
  for (const it of items) {
    if (it.kind !== kind) continue;
    const m = new RegExp(prefix + '\\s+(\\d+)\\s*$').exec(it.name || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}
const emptyAnim = () => ({ frames: [], fps: 8, loop: true });
const mkFrame = f => ({ url: f.url, img: null, hitboxes: (f.hitboxes || []).map(h => ({
  ox: h.ox || 0, oy: h.oy || 0, w: Math.max(1, h.w || 1), h: Math.max(1, h.h || 1) })) });

function makeSprite(o) {
  const w = 64, h = 64;
  const name = 'Nhân vật ' + (countPrefix(State.items, 'sprite', 'Nhân vật') + 1);
  return Object.assign({
    id: uid(), kind: 'sprite', name,
    x: VW/2, y: VH/2 - 40, w, h,
    hb: { ox: 0, oy: 0, hw: w/2, hh: h/2 },
    hitboxes: [],
    events: [],
    control: 'player', camera: false, hpMode: 'default',
    animations: {
      idle: emptyAnim(), run: emptyAnim(), jump: emptyAnim(),
      hurt: emptyAnim(), die: emptyAnim(), shoot: emptyAnim(), bullet: emptyAnim(), turn: emptyAnim()
    },
    shoot: {
      enabled: false, dir: 'forward',
      offsetX: 0, offsetY: 0, delay: 0, cooldown: 0.3, damage: 10,
      speed: 8, bulletW: 14, bulletH: 14,
      useGravity: false, bulletGravity: 5
    },
    botRange: 150, botPatrol: 80, noPush: false, ai: {},
    speed: 1, jumpPower: 1, gravity: 1,
    hp: 92, maxHp: 92, iframe: 1,
    _vx: 0, _vy: 0, _onGround: false, _facing: 1,
    _state: 'idle', _invuln: 0, _dead: false, _shootCd: 0, _shootAnimTime: 0,
    _pendingShots: [], _animFrame: 0, _animTime: 0, _prevState: 'idle',
    _pendingActions: [], _everyTimers: {}, _keyState: {},
    _idleFired: {}, _touchSet: new Set(),
    _flash: null, _speedBuff: null, _gravityBuff: null, _scaleBuff: null,
    _startFired: false, _prevHp: null, _idleTime: 0, _nearPlayer: false
  }, o || {});
}
function makeBot(o) {
  const base = makeSprite(o || {});
  base.name = 'Bot ' + (countPrefix(State.items, 'sprite', 'Bot') + 1);
  base.control = 'bot';
  base.shoot.enabled = true;
  base.shoot.cooldown = 0.8;
  base.shoot.speed = 6;
  return base;
}
function makeBlock(o) {
  const name = 'Khối ' + (countPrefix(State.items, 'block', 'Khối') + 1);
  return Object.assign({
    id: uid(), kind: 'block', name,
    x: VW/2, y: VH - 30, w: 96, h: 32,
    solid: true, hazard: false,
    tex: { all: null, top: null, bottom: null, left: null, right: null },
    hitboxes: [],
    animations: { default: emptyAnim() },
    _animFrame: 0, _animTime: 0
  }, o || {});
}

/* ============================================================
   CANVAS SIZING
   ============================================================ */
function resizeCanvas() {
  const wrap = document.getElementById('stageWrap');
  const aw = Math.max(120, wrap.clientWidth - 24);
  const ah = Math.max(120, wrap.clientHeight - 24);
  const s = Math.min(aw / VW, ah / VH);
  canvas.width = VW; canvas.height = VH;
  canvas.style.width  = Math.floor(VW * s) + 'px';
  canvas.style.height = Math.floor(VH * s) + 'px';
}
function toStage(cx, cy) {
  const r = canvas.getBoundingClientRect();
  return { x: (cx - r.left) * (VW / r.width), y: (cy - r.top) * (VH / r.height) };
}
function toWorld(sx, sy) {
  const cam = State.playing ? State.camera : State.editCam;
  return { x: sx - VW/2 + cam.x, y: sy - VH/2 + cam.y };
}

/* ============================================================
   ANIMATION MODAL
   ============================================================ */
let animCtx = null;

function openAnimModal(item, key, label) {
  animCtx = { itemId: item.id, key };
  const anim = item.animations[key];
  if (!anim) return;
  document.getElementById('animTitle').textContent = 'Animation: ' + label;
  document.getElementById('animFps').value = anim.fps || 8;
  document.getElementById('animLoop').checked = anim.loop !== false;
  renderAnimFrames();
  document.getElementById('sheetPanel').style.display = 'none';
  sheetCtx = { file: null, url: null, img: null };
  document.getElementById('animModal').classList.add('show');
}
function renderAnimFrames() {
  if (!animCtx) return;
  const item = State.items.find(i => i.id === animCtx.itemId);
  if (!item) return;
  const anim = item.animations[animCtx.key];
  const wrap = document.getElementById('animFrames');
  wrap.innerHTML = '';
  if (!anim.frames.length) {
    const e = document.createElement('div');
    e.className = 'empty-frame';
    e.textContent = 'Chưa có frame. Nhấn "Thêm frame" hoặc "Spritesheet".';
    wrap.appendChild(e);
    return;
  }
  anim.frames.forEach((f, i) => {
    const el = document.createElement('div');
    el.className = 'frame';
    const img = document.createElement('img');
    img.src = f.url;
    el.appendChild(img);
    const num = document.createElement('div');
    num.className = 'fnum';
    num.textContent = i + 1;
    el.appendChild(num);
    const del = document.createElement('div');
    del.className = 'fdel';
    del.textContent = '×';
    del.onclick = () => {
      anim.frames.splice(i, 1);
      renderAnimFrames(); renderInspector(); renderLayers(); scheduleSave();
    };
    el.appendChild(del);
    wrap.appendChild(el);
  });
}

/* ============================================================
   LAYERS
   ============================================================ */
const LayerDrag = { t: null, active: false, id: null, sx: 0, sy: 0, over: null, ended: 0 };
function layerDragEnd(cancel) {
  clearTimeout(LayerDrag.t); LayerDrag.t = null;
  if (LayerDrag.active) {
    document.querySelectorAll('#layers .layer-card').forEach(c => { c.style.opacity = ''; c.style.outline = ''; });
    if (!cancel && LayerDrag.over && LayerDrag.over !== LayerDrag.id) moveLayer(LayerDrag.id, LayerDrag.over);
    LayerDrag.ended = Date.now();
  }
  LayerDrag.active = false; LayerDrag.id = null; LayerDrag.over = null;
}
function moveLayer(id, targetId) {
  const a = State.items.findIndex(i => i.id === id), b = State.items.findIndex(i => i.id === targetId);
  if (a < 0 || b < 0) return;
  const A = State.items[a], B = State.items[b];
  if (A.kind !== B.kind) { toast('Khối luôn nằm dưới nhân vật/bot — chỉ đổi thứ tự trong cùng loại', 'err', 3500); return; }
  State.items.splice(a, 1);
  State.items.splice(State.items.findIndex(i => i.id === targetId) + 1, 0, A);   // ngay trên thẻ đích → đè lên thẻ đích
  renderLayers(); scheduleSave();
  toast('"' + A.name + '" đã đè lên "' + B.name + '"', 'ok');
}
function bindLayerDrag() {
  window.addEventListener('pointermove', (e) => {
    if (LayerDrag.t && Math.hypot(e.clientX - LayerDrag.sx, e.clientY - LayerDrag.sy) > 10) { clearTimeout(LayerDrag.t); LayerDrag.t = null; }
    if (!LayerDrag.active) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const card = el && el.closest ? el.closest('#layers .layer-card') : null;
    document.querySelectorAll('#layers .layer-card').forEach(c => { c.style.outline = ''; });
    LayerDrag.over = null;
    if (card && card.dataset.id !== LayerDrag.id) { card.style.outline = '2px solid #ffb86b'; LayerDrag.over = card.dataset.id; }
  });
  window.addEventListener('pointerup', () => layerDragEnd(false));
  window.addEventListener('pointercancel', () => layerDragEnd(true));
  window.addEventListener('touchmove', (e) => { if (LayerDrag.active && e.cancelable) e.preventDefault(); }, { passive: false });
}
function renderLayers() {
  const el = document.getElementById('layers');
  el.innerHTML = '';
  for (let i = State.items.length - 1; i >= 0; i--) {
    const item = State.items[i];
    const card = document.createElement('div');
    card.className = 'layer-card' + (item.id === State.selectedId ? ' sel' : '');
    card.dataset.id = item.id;
    card.onclick = () => { if (Date.now() - LayerDrag.ended < 350) return; State.tab = 'scene'; selectItem(item.id); };
    card.addEventListener('pointerdown', (e) => {
      if (e.target.classList && e.target.classList.contains('del')) return;
      layerDragEnd(true);
      LayerDrag.sx = e.clientX; LayerDrag.sy = e.clientY;
      LayerDrag.t = setTimeout(() => {
        LayerDrag.t = null; LayerDrag.active = true; LayerDrag.id = item.id; card.style.opacity = '.45';
        try { if (navigator.vibrate) navigator.vibrate(15); } catch (_) {}
        toast('Kéo tới thẻ muốn đè lên rồi thả', 'ok', 1800);
      }, 450);
    });
    const thumb = document.createElement('div');
    thumb.className = 'thumb';

    let thumbUrl = null;
    if (item.kind === 'sprite') {
      const idle = item.animations.idle;
      if (idle && idle.frames.length) thumbUrl = idle.frames[0].url;
    } else {
      const anim = item.animations && item.animations.default;
      if (anim && anim.frames.length) thumbUrl = anim.frames[0].url;
      else if (item.tex && item.tex.all) thumbUrl = item.tex.all.url;
    }

    if (thumbUrl) {
      const img = document.createElement('img');
      img.src = thumbUrl;
      thumb.appendChild(img);
    } else {
      thumb.textContent = item.kind === 'sprite'
        ? (item.control === 'bot' ? 'BOT' : 'NV')
        : (item.hazard ? '!' : 'KH');
    }
    card.appendChild(thumb);
    const nm = document.createElement('div');
    nm.className = 'nm';
    nm.textContent = item.name;
    card.appendChild(nm);
    if (item.kind === 'sprite' && item.camera) {
      const cam = document.createElement('div'); cam.className = 'cam'; cam.textContent = 'C';
      card.appendChild(cam);
    }
    if (item.kind === 'sprite' && item.control === 'bot') {
      const b = document.createElement('div'); b.className = 'bot'; b.textContent = 'B';
      card.appendChild(b);
    }
    if (item.kind === 'sprite' && item.events && item.events.length) {
      const ev = document.createElement('div'); ev.className = 'ev'; ev.textContent = 'E';
      card.appendChild(ev);
    }
    const del = document.createElement('div');
    del.className = 'del'; del.textContent = '×';
    del.onclick = ev => { ev.stopPropagation(); deleteItem(item.id); };
    card.appendChild(del);
    el.appendChild(card);
  }
  const add = document.createElement('div');
  add.className = 'layer-add'; add.textContent = '＋';
  add.onclick = () => addSprite();
  el.appendChild(add);
}

/* ============================================================
   DOM HELPERS
   ============================================================ */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function row(label, input) {
  const r = el('div', 'row');
  r.appendChild(el('span', null, label));
  r.appendChild(input);
  return r;
}
function numInput(val, cb, step, min, max) {
  const i = el('input', 'inp');
  i.type = 'number'; i.value = val;
  i.step = step != null ? step : 1;
  if (min != null) i.min = min;
  if (max != null) i.max = max;
  i.oninput = () => { let v = parseFloat(i.value); if (isNaN(v)) v = 0; cb(v); scheduleSave(); };
  return i;
}
function textInput(val, cb) {
  const i = el('input', 'inp'); i.type = 'text'; i.value = val || '';
  i.oninput = () => { cb(i.value); scheduleSave(); };
  return i;
}
function colorInput(val, cb) {
  const i = el('input', 'inp'); i.type = 'color'; i.value = val || '#ffffff';
  i.style.padding = '2px'; i.style.height = '28px';
  i.oninput = () => { cb(i.value); scheduleSave(); };
  return i;
}
function selectInput(val, options, cb) {
  const s = el('select', 'inp');
  for (const [v, t] of options) {
    const o = document.createElement('option');
    o.value = v; o.textContent = t;
    if (v === val) o.selected = true;
    s.appendChild(o);
  }
  s.onchange = () => { cb(s.value); scheduleSave(); };
  return s;
}
function checkbox(val, cb) {
  const wrap = el('div');
  const i = el('input'); i.type = 'checkbox'; i.checked = !!val;
  i.style.accentColor = '#7c5cff'; i.style.width = '18px'; i.style.height = '18px';
  i.onchange = () => { cb(i.checked); scheduleSave(); };
  wrap.appendChild(i);
  return wrap;
}
function sectionHeader(txt) { return el('div', 'ins-sub', txt); }

function animSlot(item, key, label) {
  const anim = item.animations[key];
  if (!anim) return el('div');
  const has = anim.frames.length;
  const wrap = el('div', 'anim-slot' + (has ? ' on' : ''));
  wrap.onclick = () => openAnimModal(item, key, label);
  const prev = el('div', 'anim-prev');
  if (has && anim.frames[0].img) {
    const img = document.createElement('img');
    img.src = anim.frames[0].url;
    prev.appendChild(img);
  } else {
    prev.textContent = '—';
    prev.style.color = '#3f4a5e';
    prev.style.fontSize = '16px';
  }
  wrap.appendChild(prev);
  wrap.appendChild(el('div', 'anim-name', label));
  wrap.appendChild(el('div', 'anim-meta', has ? (anim.frames.length + ' f • ' + anim.fps + ' fps') : 'trống'));
  return wrap;
}
function texSlot(item, key) {
  const labels = { all: 'Toàn bộ', top: 'Trên', bottom: 'Dưới', left: 'Trái', right: 'Phải' };
  const wrap = el('div', 'anim-slot' + (item.tex[key] ? ' on' : ''));
  const prev = el('div', 'anim-prev');
  const a = item.tex[key];
  if (a && a.img) {
    const img = document.createElement('img'); img.src = a.url; prev.appendChild(img);
  } else {
    prev.textContent = labels[key];
    prev.style.color = '#3f4a5e'; prev.style.fontSize = '10px'; prev.style.fontWeight = '700';
  }
  wrap.appendChild(prev);
  wrap.appendChild(el('div', 'anim-name', labels[key]));
  const btns = el('div', 'anim-btns');
  const setB = el('button', 'btn-mini', 'Ảnh');
  setB.onclick = (e) => { e.stopPropagation(); importBlockTexture(item, key); };
  btns.appendChild(setB);
  if (a) {
    const clr = el('button', 'btn-mini danger', '✕');
    clr.onclick = (e) => { e.stopPropagation(); item.tex[key] = null; renderInspector(); scheduleSave(); };
    btns.appendChild(clr);
  }
  wrap.appendChild(btns);
  return wrap;
}
function hitboxButton(item) {
  const wrap = el('div');
  wrap.style.cssText = 'background:#0d1017;border:1px solid #262d3f;border-radius:9px;padding:8px;margin-top:4px;';
  const info = el('div');
  const n = (item.hitboxes && item.hitboxes.length) || 0;
  info.style.cssText = 'font-size:11px;color:#8fa3c0;margin-bottom:6px;';
  info.textContent = n ? (n + ' vùng hitbox đã vẽ') : 'Mặc định (toàn bộ item)';
  wrap.appendChild(info);
  const btn = el('button', 'btn accent', 'Mở trình chỉnh Hitbox');
  btn.style.width = '100%';
  btn.onclick = () => openHitboxModal(item);
  wrap.appendChild(btn);
  if (n) {
    const rst = el('button', 'btn-mini danger', '↺ Về mặc định');
    rst.style.cssText = 'width:100%;padding:5px;margin-top:5px;font-size:10px;';
    rst.onclick = () => {
      item.hitboxes = [];
      for (const f of collectFrameObjs(item)) delete f.hitboxes;
      renderInspector(); renderLayers(); scheduleSave();
      toast('Đã reset hitbox', 'ok');
    };
    wrap.appendChild(rst);
  }
  return wrap;
}

/* ============================================================
   EVENTS UI (Biến)
   ============================================================ */
const CMP_OPS = [['==', '='], ['!=', '≠'], ['>', '>'], ['<', '<'], ['>=', '≥'], ['<=', '≤']];
const TRIGGERS = [
  ['onStart',       'Bắt đầu game'],
  ['onShoot',       'Bắn đạn'],
  ['onJump',        'Nhảy'],
  ['onLand',        'Chạm đất'],
  ['onRun',         'Bắt đầu chạy'],
  ['onHurt',        'Mất máu'],
  ['onDeath',       'Chết'],
  ['onHpBelow',     'Máu dưới X%'],
  ['onKeyPress',    'Bấm phím'],
  ['onNearPlayer',  'Player lại gần'],
  ['onEvery',       'Định kỳ mỗi N giây'],
  ['onIdle',        'Đứng yên N giây'],
  ['onHitBlock',    'Chạm khối'],
  ['onHitSprite',   'Chạm nhân vật khác'],
  ['onVar',         'Biến thỏa điều kiện'],
  ['onUIButton',    'Nhấn nút UI'],
  ['onSignal',      'Nhận tín hiệu']
];
const ACTIONS = [
  ['shakeScreen',   'Rung màn hình'],
  ['changeHp',      'Đổi máu'],
  ['spawnBullet',   'Bắn đạn'],
  ['teleport',      'Dịch chuyển (dx, dy)'],
  ['setPos',        'Đặt vị trí (x, y)'],
  ['setInvuln',     'Bất tử N giây'],
  ['destroySelf',   'Tự huỷ'],
  ['changeControl', 'Đổi kiểu điều khiển'],
  ['showText',      'Hiện text bay lên'],
  ['spawnParticles','Tạo hạt'],
  ['flash',         'Nhấp nháy màu'],
  ['playSound',     'Phát âm thanh (beep)'],
  ['setSpeed',      'Buff tốc độ (N giây)'],
  ['setGravity',    'Buff trọng lực (N giây)'],
  ['setScale',      'Buff kích thước (N giây)'],
  ['setCameraTarget','Đổi mục tiêu camera'],
  ['setVar',        'Đặt / đổi biến'],
  ['setHp',         'Đặt máu'],
  ['respawn',       'Về vị trí xuất phát'],
  ['playAnim',      'Phát animation tuỳ chỉnh'],
  ['sendSignal',    'Gửi tín hiệu cho nhân vật khác'],
  ['setBotAI',      'Đổi biến Bot AI']
];
const TRIGGER_PARAM_DEF = {
  onHpBelow: { percent: 50 },
  onKeyPress: { key: 'Fire', mode: 'press' },
  onUIButton: { button: '', mode: 'press' },
  onSignal: { name: 'sig1', from: 'any' },
  onVar: { name: 'score', op: '>=', value: '10' },
  onNearPlayer: { distance: 100 },
  onEvery: { interval: 2 },
  onIdle: { seconds: 2 }
};
const ACTION_PARAM_DEF = {
  shakeScreen:    { intensity: 10, duration: 0.5 },
  changeHp:       { amount: -10, mode: 'amount' },
  spawnBullet:    { count: 1, spread: 0 },
  setVar:         { name: 'score', mode: 'add', value: '1' },
  playAnim:       { target: 'self', anim: '', mode: 'once', lock: false },
  sendSignal:     { name: 'sig1', to: 'all' },
  setBotAI:       { target: 'self', key: 'chaseSpeed', mode: 'set', value: 1 },
  setHp:          { amount: 100 },
  teleport:       { dx: 0, dy: -40 },
  setPos:         { x: 320, y: 100 },
  setInvuln:      { seconds: 2 },
  changeControl:  { mode: 'player' },
  showText:       { text: '!', color: '#ffd166', duration: 1.5 },
  spawnParticles: { count: 12, color: '#ffb86b', size: 4, life: 0.8 },
  flash:          { color: '#ffffff', duration: 0.3 },
  playSound:      { frequency: 440, duration: 0.2, wave: 'sine' },
  setSpeed:       { multiplier: 2, duration: 3 },
  setGravity:     { multiplier: 0, duration: 3 },
  setScale:       { multiplier: 1.5, duration: 3 }
};

function renderVarsPanel(root) {
  root.appendChild(sectionHeader('Biến toàn cục'));
  State.varDefs.forEach((d, i) => {
    const line = el('div'); line.style.cssText = 'display:flex;gap:4px;margin-bottom:4px;';
    line.appendChild(textInput(d.name, v => { d.name = v.replace(/[^A-Za-z0-9_]/g, ''); }));
    line.appendChild(textInput(String(d.value), v => { d.value = v; }));
    const x = el('button', 'btn-mini danger', '✕');
    x.onclick = () => { State.varDefs.splice(i, 1); renderInspector(); scheduleSave(); };
    line.appendChild(x);
    root.appendChild(line);
  });
  const add = el('button', 'btn', '＋ Thêm biến toàn cục');
  add.style.width = '100%';
  add.onclick = () => { State.varDefs.push({ name: 'var' + (State.varDefs.length + 1), value: '0' }); renderInspector(); scheduleSave(); };
  root.appendChild(add);
  root.appendChild(el('div', 'ev-hint', 'Tên + giá trị ban đầu. Dùng trong Điều kiện, hành động Đặt biến, trigger Biến, và text bay {tênBiến}.'));
}

const AI_LABELS = [['botRange', 'Tầm nhìn'], ['botPatrol', 'Phạm vi tuần'], ['chaseSpeed', 'Tốc độ đuổi'], ['reaction', 'Độ trễ phản ứng'],
  ['attackRange', 'Tầm tấn công'], ['attackCd', 'Hồi chiêu thêm'], ['aggression', 'Độ hung hăng %'], ['keepDist', 'Giữ khoảng cách'],
  ['fleeHp', 'Bỏ chạy khi HP dưới %'], ['loseTime', 'Thời gian mất dấu'], ['alertRadius', 'Bán kính báo động'], ['patrolWait', 'Chờ cuối đường'],
  ['jumpChance', 'Nhảy qua vật cản %'], ['turnOnWall', 'Quay đầu khi gặp tường (0/1)'], ['edgeSafe', 'Tránh rơi mép (0/1)']];
function targetOptions(withSelf) {
  const o = [];
  if (withSelf) o.push(['self', 'Chính nó']);
  o.push(['__player', 'Người chơi (NV đầu tiên)']);
  o.push(['group:all', 'Tất cả nhân vật']);
  o.push(['group:player', 'Tất cả NV (người chơi)']);
  o.push(['group:bot', 'Tất cả Bot (loại "Bot / NPC")']);
  o.push(['group:npc', 'Tất cả nhân vật "Đứng yên"']);
  State.items.filter(i => i.kind === 'sprite').forEach(i => o.push([i.id, i.name]));
  return o;
}
function allCustomAnimNames() {
  const set = new Set();
  State.items.forEach(i => { if (i.kind === 'sprite') Object.keys(i.animations || {}).forEach(k => { if (k.indexOf('custom:') === 0) set.add(k.slice(7)); }); });
  return Array.from(set);
}
function renderEventCard(item, ev, idx) {
  const card = el('div', 'event-card');
  const head = el('div', 'ev-head');
  head.appendChild(el('div', 'ev-num', '#' + (idx + 1)));

  const trigSel = selectInput(ev.trigger, TRIGGERS, v => {
    ev.trigger = v;
    if (!ev.triggerParams) ev.triggerParams = {};
    const def = TRIGGER_PARAM_DEF[v];
    if (def) ev.triggerParams = Object.assign({}, def);
    else ev.triggerParams = {};
    renderInspector(); scheduleSave();
  });
  head.appendChild(trigSel);

  const del = el('button', 'ev-del', '✕');
  del.onclick = () => {
    item.events.splice(idx, 1);
    renderInspector(); renderLayers(); scheduleSave();
  };
  head.appendChild(del);
  card.appendChild(head);

  // Trigger params
  const tp = ev.triggerParams || (ev.triggerParams = {});
  if (ev.trigger === 'onHpBelow') {
    card.appendChild(row('Dưới (%)', numInput(tp.percent != null ? tp.percent : 50,
      v => tp.percent = clamp(v, 0, 100), 1, 0, 100)));
  } else if (ev.trigger === 'onKeyPress') {
    card.appendChild(row('Phím', textInput(tp.key || 'Fire', v => tp.key = v)));
    card.appendChild(el('div', 'ev-hint',
      'Dùng tên phím: Fire, ArrowLeft, ArrowRight, ArrowUp, a, b, ...'));
    card.appendChild(row('Kiểu', selectInput(tp.mode || 'press', [['press', 'Vừa nhấn'], ['hold', 'Đang giữ (lặp)'], ['release', 'Vừa nhả']], v => { tp.mode = v; renderInspector(); })));
    if (tp.mode === 'hold') card.appendChild(row('Lặp mỗi (s)', numInput(tp.repeat != null ? tp.repeat : 0.2, v => tp.repeat = Math.max(0.05, v), 0.05, 0.05)));
  } else if (ev.trigger === 'onUIButton') {
    const btns = State.ui.buttons || [];
    if (!btns.length) card.appendChild(el('div', 'ev-hint', 'Chưa có nút tuỳ chỉnh. Tạo ở tab UI, mục "Nút tùy chỉnh".'));
    else {
      if (!btns.some(b => b.id === tp.button)) tp.button = btns[0].id;
      card.appendChild(row('Nút', selectInput(tp.button, btns.map(b => [b.id, (b.label || 'Nút') + ' (' + b.key + ')']), v => tp.button = v)));
      card.appendChild(row('Kiểu', selectInput(tp.mode || 'press', [['press', 'Vừa nhấn'], ['hold', 'Đang giữ (lặp)'], ['release', 'Vừa nhả']], v => { tp.mode = v; renderInspector(); scheduleSave(); })));
      if (tp.mode === 'hold') card.appendChild(row('Lặp mỗi (s)', numInput(tp.repeat != null ? tp.repeat : 0.2, v => tp.repeat = Math.max(0.05, v), 0.05, 0.05)));
      card.appendChild(el('div', 'ev-hint', 'Mẹo: đặt "Phím" của nút thành tên riêng (vd B1) để không kích hoạt bắn đạn.'));
    }
  } else if (ev.trigger === 'onSignal') {
    card.appendChild(row('Tên tín hiệu', textInput(tp.name || '', v => tp.name = v.replace(/[^A-Za-z0-9_]/g, ''))));
    card.appendChild(row('Từ', selectInput(tp.from || 'any', [['any', 'Bất kỳ ai']].concat(targetOptions(false)), v => tp.from = v)));
    card.appendChild(el('div', 'ev-hint', 'Chạy khi có nhân vật gửi tín hiệu cùng tên (hành động "Gửi tín hiệu").'));
  } else if (ev.trigger === 'onNearPlayer') {
    card.appendChild(row('Khoảng cách', numInput(tp.distance != null ? tp.distance : 100,
      v => tp.distance = Math.max(10, v), 10, 10)));
  } else if (ev.trigger === 'onEvery') {
    card.appendChild(row('Mỗi (giây)', numInput(tp.interval != null ? tp.interval : 2,
      v => tp.interval = Math.max(0.1, v), 0.1, 0.1)));
  } else if (ev.trigger === 'onIdle') {
    card.appendChild(row('Sau (giây)', numInput(tp.seconds != null ? tp.seconds : 2,
      v => tp.seconds = Math.max(0.1, v), 0.1, 0.1)));
  } else if (ev.trigger === 'onVar') {
    card.appendChild(row('Biến', textInput(tp.name || '', v => tp.name = v.trim())));
    card.appendChild(row('So sánh', selectInput(tp.op || '>=', CMP_OPS, v => tp.op = v)));
    card.appendChild(row('Giá trị', textInput(tp.value != null ? String(tp.value) : '0', v => tp.value = v)));
    card.appendChild(el('div', 'ev-hint', 'Chạy 1 lần mỗi khi điều kiện chuyển từ sai sang đúng.'));
  }

  // Delay
  card.appendChild(el('div', 'ev-sub', 'Trễ'));
  card.appendChild(row('Sau (giây)', numInput(ev.delay != null ? ev.delay : 0,
    v => ev.delay = Math.max(0, v), 0.1, 0)));

  card.appendChild(el('div', 'ev-sub', 'Điều kiện & giới hạn'));
  const cd = ev.cond || (ev.cond = { var: '', op: '>=', value: '0' });
  card.appendChild(row('Chỉ khi biến', textInput(cd.var || '', v => cd.var = v.trim())));
  card.appendChild(row('So sánh', selectInput(cd.op || '>=', CMP_OPS, v => cd.op = v)));
  card.appendChild(row('Giá trị', textInput(cd.value != null ? String(cd.value) : '0', v => cd.value = v)));
  card.appendChild(el('div', 'ev-hint', 'Để trống tên biến = luôn chạy. Có sẵn: hp, hpPercent, maxHp, x, y, time. Giá trị có thể là $tênBiến.'));
  card.appendChild(row('Chỉ 1 lần', checkbox(!!ev.once, v => ev.once = v)));
  card.appendChild(row('Hồi chiêu (s)', numInput(ev.cooldown || 0, v => ev.cooldown = Math.max(0, v), 0.1, 0)));
  card.appendChild(row('Xác suất (%)', numInput(ev.chance != null ? ev.chance : 100, v => ev.chance = clamp(v, 0, 100), 5, 0, 100)));

  // Action
  card.appendChild(el('div', 'ev-sub', 'Hành động'));
  const actSel = selectInput(ev.action, ACTIONS, v => {
    ev.action = v;
    const def = ACTION_PARAM_DEF[v];
    ev.actionParams = def ? Object.assign({}, def) : {};
    renderInspector(); scheduleSave();
  });
  card.appendChild(row('Làm', actSel));

  // Action params
  const ap = ev.actionParams || (ev.actionParams = {});
  const r = (label, input) => card.appendChild(row(label, input));

  switch (ev.action) {
    case 'shakeScreen':
      r('Cường độ', numInput(ap.intensity != null ? ap.intensity : 10, v => ap.intensity = Math.max(0, v), 1, 0));
      r('Thời gian (s)', numInput(ap.duration != null ? ap.duration : 0.5, v => ap.duration = Math.max(0.05, v), 0.05, 0.05));
      break;
    case 'changeHp':
      r('Kiểu', selectInput(ap.mode || 'amount', [['amount', 'Số máu'], ['percent', '% máu tối đa']], v => ap.mode = v));
      r('Số lượng', numInput(ap.amount != null ? ap.amount : -10, v => ap.amount = v, 1));
      card.appendChild(el('div', 'ev-hint', 'Số âm = mất máu, số dương = hồi máu.'));
      break;
    case 'teleport':
      r('ΔX', numInput(ap.dx != null ? ap.dx : 0, v => ap.dx = v, 5));
      r('ΔY', numInput(ap.dy != null ? ap.dy : -40, v => ap.dy = v, 5));
      break;
    case 'setPos':
      r('X', numInput(ap.x != null ? ap.x : 320, v => ap.x = v, 10));
      r('Y', numInput(ap.y != null ? ap.y : 100, v => ap.y = v, 10));
      break;
    case 'setInvuln':
      r('Thời gian (s)', numInput(ap.seconds != null ? ap.seconds : 2, v => ap.seconds = Math.max(0, v), 0.5, 0));
      break;
    case 'changeControl':
      r('Kiểu', selectInput(ap.mode || 'player', [
        ['player','Người chơi'], ['bot','Bot / NPC'], ['none','Đứng yên']
      ], v => ap.mode = v));
      break;
    case 'showText':
      r('Text', textInput(ap.text != null ? ap.text : '!', v => ap.text = v));
      r('Màu', colorInput(ap.color || '#ffd166', v => ap.color = v));
      r('Thời gian (s)', numInput(ap.duration != null ? ap.duration : 1.5, v => ap.duration = Math.max(0.1, v), 0.1, 0.1));
      break;
    case 'spawnParticles':
      r('Số hạt', numInput(ap.count != null ? ap.count : 12, v => ap.count = clamp(v, 1, 200), 1, 1, 200));
      r('Màu', colorInput(ap.color || '#ffb86b', v => ap.color = v));
      r('Kích cỡ', numInput(ap.size != null ? ap.size : 4, v => ap.size = Math.max(1, v), 1, 1));
      r('Đời sống (s)', numInput(ap.life != null ? ap.life : 0.8, v => ap.life = Math.max(0.1, v), 0.1, 0.1));
      break;
    case 'flash':
      r('Màu', colorInput(ap.color || '#ffffff', v => ap.color = v));
      r('Thời gian (s)', numInput(ap.duration != null ? ap.duration : 0.3, v => ap.duration = Math.max(0.05, v), 0.05, 0.05));
      break;
    case 'playSound':
      r('Tần số (Hz)', numInput(ap.frequency != null ? ap.frequency : 440, v => ap.frequency = Math.max(20, v), 20, 20));
      r('Thời gian (s)', numInput(ap.duration != null ? ap.duration : 0.2, v => ap.duration = Math.max(0.05, v), 0.05, 0.05));
      r('Dạng sóng', selectInput(ap.wave || 'sine', [
        ['sine','Sine'], ['square','Square'], ['sawtooth','Saw'], ['triangle','Triangle']
      ], v => ap.wave = v));
      break;
    case 'setSpeed':
      r('Hệ số', numInput(ap.multiplier != null ? ap.multiplier : 2, v => ap.multiplier = Math.max(0, v), 0.1, 0));
      r('Thời gian (s)', numInput(ap.duration != null ? ap.duration : 3, v => ap.duration = Math.max(0.1, v), 0.1, 0.1));
      break;
    case 'setGravity':
      r('Hệ số', numInput(ap.multiplier != null ? ap.multiplier : 0, v => ap.multiplier = Math.max(0, v), 0.1, 0));
      r('Thời gian (s)', numInput(ap.duration != null ? ap.duration : 3, v => ap.duration = Math.max(0.1, v), 0.1, 0.1));
      card.appendChild(el('div', 'ev-hint', '0 = bay lơ lửng.'));
      break;
    case 'setScale':
      r('Hệ số', numInput(ap.multiplier != null ? ap.multiplier : 1.5, v => ap.multiplier = Math.max(0.1, v), 0.1, 0.1));
      r('Thời gian (s)', numInput(ap.duration != null ? ap.duration : 3, v => ap.duration = Math.max(0.1, v), 0.1, 0.1));
      break;
    case 'setCameraTarget':
      card.appendChild(el('div', 'ev-hint', 'Đặt nhân vật này làm mục tiêu camera.'));
      break;
    case 'spawnBullet':
      r('Số viên', numInput(ap.count != null ? ap.count : 1, v => ap.count = clamp(Math.round(v), 1, 12), 1, 1, 12));
      r('Góc toả (độ)', numInput(ap.spread != null ? ap.spread : 0, v => ap.spread = clamp(v, 0, 180), 5, 0, 180));
      break;
    case 'playAnim': {
      r('Nhân vật', selectInput(ap.target || 'self', targetOptions(true), v => { ap.target = v; scheduleSave(); }));
      r('Kiểu', selectInput(ap.mode || 'once', [['once', 'Chạy 1 lần'], ['loop', 'Lặp'], ['stop', 'Dừng animation']], v => { ap.mode = v; scheduleSave(); }));
      const names = allCustomAnimNames();
      if (!names.length) card.appendChild(el('div', 'ev-hint', 'Chưa có animation tuỳ chỉnh. Tạo ở Inspector của nhân vật.'));
      else {
        if (!names.includes(ap.anim)) ap.anim = names[0];
        r('Animation', selectInput(ap.anim, names.map(n => [n, n]), v => { ap.anim = v; scheduleSave(); }));
      }
      r('Khoá di chuyển', checkbox(!!ap.lock, v => { ap.lock = v; scheduleSave(); }));
      break;
    }
    case 'sendSignal':
      r('Tên tín hiệu', textInput(ap.name || '', v => ap.name = v.replace(/[^A-Za-z0-9_]/g, '')));
      r('Gửi cho', selectInput(ap.to || 'all', [['all', 'Tất cả']].concat(targetOptions(false)), v => { ap.to = v; scheduleSave(); }));
      card.appendChild(el('div', 'ev-hint', 'Nhân vật nhận cần có trigger "Nhận tín hiệu" cùng tên.'));
      break;
    case 'setBotAI':
      r('Nhân vật', selectInput(ap.target || 'self', targetOptions(true), v => { ap.target = v; scheduleSave(); }));
      r('Biến AI', selectInput(ap.key || 'chaseSpeed', AI_LABELS, v => { ap.key = v; scheduleSave(); }));
      r('Kiểu', selectInput(ap.mode || 'set', [['set', 'Gán ='], ['add', 'Cộng +'], ['toggle', 'Bật/tắt (biến 0/1)']], v => { ap.mode = v; scheduleSave(); }));
      r('Giá trị', numInput(ap.value != null ? ap.value : 1, v => ap.value = v, 0.1));
      break;
    case 'setVar':
      r('Tên biến', textInput(ap.name || '', v => ap.name = v.replace(/[^A-Za-z0-9_]/g, '')));
      r('Kiểu', selectInput(ap.mode || 'add', [['set', 'Gán ='], ['add', 'Cộng +'], ['sub', 'Trừ -'], ['mul', 'Nhân ×'], ['toggle', 'Bật/tắt (0/1)'], ['rand', 'Ngẫu nhiên 0..giá trị']], v => ap.mode = v));
      r('Giá trị', textInput(ap.value != null ? String(ap.value) : '1', v => ap.value = v));
      card.appendChild(el('div', 'ev-hint', 'Giá trị có thể là số, chữ, hoặc $tênBiến khác.'));
      break;
    case 'setHp':
      r('Máu', numInput(ap.amount != null ? ap.amount : 100, v => ap.amount = Math.max(0, v), 5, 0));
      break;
    case 'respawn':
      card.appendChild(el('div', 'ev-hint', 'Đưa về vị trí lúc bấm Chạy.'));
      break;
    case 'destroySelf':
      card.appendChild(el('div', 'ev-hint', 'Không có tham số.'));
      break;
    default:
      break;
  }

  const defs = ACTION_PARAM_DEF[ev.action] || {};
  const nums = Object.keys(defs).filter(k => typeof defs[k] === 'number');
  if (nums.length) {
    card.appendChild(el('div', 'ev-sub', 'Gắn tham số với biến'));
    nums.forEach(k => {
      card.appendChild(row(k, textInput(typeof ap[k] === 'string' ? ap[k].replace(/^\$/, '') : '', v => {
        v = v.trim();
        ap[k] = v ? '$' + v.replace(/^\$/, '') : defs[k];
      })));
    });
    card.appendChild(el('div', 'ev-hint', 'Gõ tên biến để tham số lấy giá trị biến lúc chạy. Để trống = dùng số đã nhập.'));
  }

  return card;
}

/* ============================================================
   INSPECTOR
   ============================================================ */
function renderInspector() {
  const root = document.getElementById('inspector');
  root.innerHTML = '';

  const tabs = el('div', 'tabs');
  const tScene = el('div', 'tab' + (State.tab === 'scene' ? ' on' : ''), 'Scene');
  const tUI    = el('div', 'tab' + (State.tab === 'ui'    ? ' on' : ''), 'UI');
  tScene.onclick = () => { State.tab = 'scene'; State.uiSelected = null;
    document.getElementById('btnUI').classList.remove('on'); renderInspector(); };
  tUI.onclick    = () => { State.tab = 'ui';    State.selectedId = null;
    document.getElementById('btnUI').classList.add('on');    renderInspector(); };
  tabs.appendChild(tScene); tabs.appendChild(tUI);
  root.appendChild(tabs);

  if (State.tab === 'ui') { renderUIInspector(root); return; }

  const item = State.items.find(i => i.id === State.selectedId);
  if (!item) {
    root.appendChild(el('div', 'empty',
      'Chọn một layer để chỉnh sửa<br>hoặc bấm ＋ để thêm nhân vật / khối<br><br>Bấm tab UI để chỉnh giao diện.'));
    return;
  }
  if (item.kind === 'sprite') renderSpriteInspector(root, item);
  else renderBlockInspector(root, item);
}

function renderSpriteInspector(root, item) {
  const isBot = item.control === 'bot';
  root.appendChild(el('div', 'ins-head', isBot ? 'Bot / NPC' : 'Nhân vật'));

  root.appendChild(row('Tên', textInput(item.name, v => { item.name = v; renderLayers(); })));
  root.appendChild(row('X', numInput(Math.round(item.x), v => item.x = v, 1)));
  root.appendChild(row('Y', numInput(Math.round(item.y), v => item.y = v, 1)));

  root.appendChild(sectionHeader('Kích thước'));
  const sg = el('div', 'grid4');
  sg.appendChild(row('W', numInput(item.w, v => { item.w = Math.max(4,v); if (!item.hitboxes || !item.hitboxes.length) item.hb.hw = item.w/2; }, 1, 4)));
  sg.appendChild(row('H', numInput(item.h, v => { item.h = Math.max(4,v); if (!item.hitboxes || !item.hitboxes.length) item.hb.hh = item.h/2; }, 1, 4)));
  root.appendChild(sg);

  root.appendChild(sectionHeader('Hitbox'));
  root.appendChild(hitboxButton(item));

  root.appendChild(sectionHeader('Chuyển động & Camera'));
  root.appendChild(row('Kiểu', selectInput(item.control, [
    ['player', 'Người chơi'], ['bot', 'Bot / NPC'], ['none', 'Đứng yên']
  ], v => {
    item.control = v;
    if (v === 'bot' && item.shoot && !item.shoot.enabled) item.shoot.enabled = true;
    renderInspector(); renderLayers();
  })));
  root.appendChild(row('Không thể bị đẩy', checkbox(!!item.noPush, v => { item.noPush = v; scheduleSave(); })));
  root.appendChild(row('Camera theo', checkbox(item.camera, v => {
    item.camera = v;
    if (v) for (const o of State.items) if (o !== item && o.kind === 'sprite') o.camera = false;
    renderLayers();
  })));

  if (isBot) {
    root.appendChild(sectionHeader('Bot AI'));
    root.appendChild(row('Tầm phát hiện', numInput(item.botRange, v => item.botRange = Math.max(20, v), 10, 20)));
    root.appendChild(row('Phạm vi tuần',  numInput(item.botPatrol, v => item.botPatrol = Math.max(10, v), 10, 10)));
    if (!item.ai) item.ai = {};
    const gv = (k) => item.ai[k] != null ? item.ai[k] : RT.AI_DEF[k];
    const aiNum = (k, label, step, min) => root.appendChild(row(label, numInput(gv(k), v => { item.ai[k] = v; scheduleSave(); }, step, min)));
    const aiChk = (k, label) => root.appendChild(row(label, checkbox(!!gv(k), v => { item.ai[k] = v; scheduleSave(); })));
    aiNum('chaseSpeed', 'Tốc độ đuổi (x)', 0.1, 0.1);
    aiNum('reaction', 'Độ trễ phản ứng (s)', 0.1, 0);
    aiNum('attackRange', 'Tầm tấn công (0 = tầm nhìn)', 10, 0);
    aiNum('attackCd', 'Hồi chiêu thêm (s)', 0.1, 0);
    aiNum('aggression', 'Độ hung hăng (%)', 5, 0);
    aiNum('keepDist', 'Giữ khoảng cách', 5, 0);
    aiNum('fleeHp', 'Bỏ chạy khi HP dưới (%)', 5, 0);
    aiNum('loseTime', 'Thời gian mất dấu (s)', 0.5, 0);
    aiNum('alertRadius', 'Bán kính báo động', 20, 0);
    aiNum('patrolWait', 'Chờ ở cuối đường (s)', 0.5, 0);
    aiNum('jumpChance', 'Nhảy qua vật cản (%)', 5, 0);
    aiChk('turnOnWall', 'Quay đầu khi gặp tường');
    aiChk('edgeSafe', 'Tránh rơi khỏi mép');
  }

  root.appendChild(sectionHeader('Animation (frames)'));
  const ag = el('div', 'anim-grid');
  ag.appendChild(animSlot(item, 'idle',  'Đứng yên'));
  ag.appendChild(animSlot(item, 'run',   'Chạy'));
  ag.appendChild(animSlot(item, 'jump',  'Nhảy'));
  ag.appendChild(animSlot(item, 'hurt',  'Mất máu'));
  ag.appendChild(animSlot(item, 'die',   'Chết'));
  if (!item.animations.turn) item.animations.turn = emptyAnim();
  ag.appendChild(animSlot(item, 'shoot', 'Bắn đạn'));
  ag.appendChild(animSlot(item, 'turn', 'Lật (đổi hướng)'));
  root.appendChild(ag);

  root.appendChild(sectionHeader('Animation tuỳ chỉnh'));
  const cg = el('div', 'anim-grid');
  Object.keys(item.animations).filter(k => k.indexOf('custom:') === 0).forEach(k => {
    const w = el('div');
    w.appendChild(animSlot(item, k, k.slice(7)));
    const rm = el('button', 'btn-mini danger', 'Xoá'); rm.style.width = '100%';
    rm.onclick = () => { if (confirm('Xoá animation "' + k.slice(7) + '"?')) { delete item.animations[k]; renderInspector(); scheduleSave(); } };
    w.appendChild(rm); cg.appendChild(w);
  });
  root.appendChild(cg);
  const addCA = el('button', 'btn accent full', '＋ Thêm animation tuỳ chỉnh');
  addCA.onclick = () => {
    const nm = (prompt('Tên animation (chữ, số, _):', 'skill1') || '').replace(/[^A-Za-z0-9_]/g, '');
    if (!nm) return;
    if (item.animations['custom:' + nm]) { toast('Tên đã tồn tại', 'err'); return; }
    item.animations['custom:' + nm] = emptyAnim(); renderInspector(); scheduleSave();
  };
  root.appendChild(addCA);
  root.appendChild(el('div', 'ev-hint', 'Phát bằng Event: hành động "Phát animation tuỳ chỉnh" (kèm trigger "Nhấn nút UI" hoặc "Nhận tín hiệu").'));

  root.appendChild(sectionHeader('Bắn đạn'));
  root.appendChild(row('Bật bắn đạn', checkbox(item.shoot.enabled, v => {
    item.shoot.enabled = v; renderInspector();
  })));
  if (item.shoot.enabled) {
    if (!item.animations.bullet) item.animations.bullet = emptyAnim();
    const bag = el('div', 'anim-grid'); bag.style.marginBottom = '6px';
    bag.appendChild(animSlot(item, 'bullet', 'Ảnh đạn (anim)'));
    root.appendChild(bag);
    root.appendChild(row('Hướng bắn', selectInput(item.shoot.dir || 'forward', [
      ['forward', 'Theo nhân vật'], ['up', 'Lên trên'], ['down', 'Xuống dưới'],
      ['diagUp', 'Chéo lên'], ['diagDown', 'Chéo xuống']
    ], v => item.shoot.dir = v)));
    const og = el('div', 'grid4');
    og.appendChild(row('X', numInput(item.shoot.offsetX, v => item.shoot.offsetX = v, 1)));
    og.appendChild(row('Y', numInput(item.shoot.offsetY, v => item.shoot.offsetY = v, 1)));
    root.appendChild(og);
    root.appendChild(el('div', 'ev-hint', 'Y âm = đạn xuất hiện phía trên nhân vật, Y dương = phía dưới.'));
    root.appendChild(row('Độ trễ (s)', numInput(item.shoot.delay, v => item.shoot.delay = Math.max(0, v), 0.05, 0)));
    root.appendChild(row('Hồi chiêu (s)', numInput(item.shoot.cooldown, v => item.shoot.cooldown = Math.max(0.02, v), 0.05, 0.02)));
    root.appendChild(row('Tốc độ đạn',   numInput(item.shoot.speed, v => item.shoot.speed = Math.max(0.5, v), 0.5, 0.5)));
    root.appendChild(row('Sát thương',   numInput(item.shoot.damage, v => item.shoot.damage = Math.max(0, v), 1, 0)));
    const bg = el('div', 'grid4');
    bg.appendChild(row('W', numInput(item.shoot.bulletW, v => item.shoot.bulletW = Math.max(2, v), 1, 2)));
    bg.appendChild(row('H', numInput(item.shoot.bulletH, v => item.shoot.bulletH = Math.max(2, v), 1, 2)));
    root.appendChild(bg);
    root.appendChild(row('Trọng lực đạn', checkbox(item.shoot.useGravity, v => {
      item.shoot.useGravity = v; renderInspector();
    })));
    if (item.shoot.useGravity) {
      root.appendChild(row('Hệ số (mặc định 5)', numInput(item.shoot.bulletGravity, v => item.shoot.bulletGravity = Math.max(0, v), 0.5, 0)));
    }
  }

  root.appendChild(sectionHeader('Vật lý'));
  root.appendChild(row('Tốc độ',      numInput(item.speed,     v => item.speed     = Math.max(0, v), 0.1, 0)));
  root.appendChild(row('Độ cao nhảy', numInput(item.jumpPower, v => item.jumpPower = Math.max(0, v), 0.1, 0)));
  root.appendChild(row('Trọng lực',   numInput(item.gravity,   v => item.gravity   = Math.max(0, v), 0.1, 0)));

  root.appendChild(sectionHeader('Máu & Hiển thị'));
  root.appendChild(row('HP tối đa', numInput(item.maxHp, v => {
    item.maxHp = Math.max(1, v);
    item.hp = Math.min(item.hp, item.maxHp);
  }, 1, 1)));
  root.appendChild(row('Kiểu HP', selectInput(item.hpMode, [
    ['default', 'Mặc định'], ['bar', 'Thanh HP trên đầu']
  ], v => item.hpMode = v)));
  root.appendChild(row('Bất tử (s)', numInput(item.iframe, v => item.iframe = Math.max(0, v), 0.1, 0)));

  /* ============ BIẾN (EVENTS) ============ */
  renderVarsPanel(root);
  root.appendChild(sectionHeader('Biến (Sự kiện → Hành động)'));
  if (!item.events) item.events = [];
  const evList = el('div');
  item.events.forEach((ev, i) => evList.appendChild(renderEventCard(item, ev, i)));
  root.appendChild(evList);

  const addEv = el('button', 'btn accent', '＋ Thêm biến');
  addEv.style.width = '100%'; addEv.style.marginTop = '4px';
  addEv.onclick = () => {
    item.events.push({
      id: uid(),
      trigger: 'onShoot',
      triggerParams: {},
      delay: 0,
      action: 'shakeScreen',
      actionParams: { intensity: 10, duration: 0.5 }
    });
    renderInspector(); renderLayers(); scheduleSave();
  };
  root.appendChild(addEv);

  if (item.events.length) {
    const hint = el('div', 'ev-hint');
    hint.style.marginTop = '8px';
    hint.innerHTML = 'Ví dụ: <b>Bắn đạn</b> → <b>sau 3s</b> → <b>rung màn hình</b>.<br>' +
                     'Biến chỉ chạy khi bấm <b>▶ Chạy</b>.';
    root.appendChild(hint);
  }

  const del = el('button', 'btn danger full', 'Xoá ' + (isBot ? 'bot' : 'nhân vật'));
  del.onclick = () => deleteItem(item.id);
  root.appendChild(del);
}

function renderBlockInspector(root, item) {
  root.appendChild(el('div', 'ins-head', 'Khối'));
  root.appendChild(row('Tên', textInput(item.name, v => { item.name = v; renderLayers(); })));
  root.appendChild(row('X', numInput(Math.round(item.x), v => item.x = v, 1)));
  root.appendChild(row('Y', numInput(Math.round(item.y), v => item.y = v, 1)));
  root.appendChild(sectionHeader('Kích thước'));
  const sg = el('div', 'grid4');
  sg.appendChild(row('W', numInput(item.w, v => item.w = Math.max(4, v), 1, 4)));
  sg.appendChild(row('H', numInput(item.h, v => item.h = Math.max(4, v), 1, 4)));
  root.appendChild(sg);

  root.appendChild(sectionHeader('Hitbox'));
  root.appendChild(hitboxButton(item));

  root.appendChild(sectionHeader('Thuộc tính'));
  root.appendChild(row('Rắn (đất/tường)', checkbox(item.solid,  v => item.solid  = v)));
  root.appendChild(row('Gây sát thương',  checkbox(item.hazard, v => item.hazard = v)));

  root.appendChild(sectionHeader('Animation (bầu trời, mây…)'));
  if (!item.animations) item.animations = { default: emptyAnim() };
  if (!item.animations.default) item.animations.default = emptyAnim();
  const ag = el('div', 'anim-grid');
  ag.appendChild(animSlot(item, 'default', 'Animation khối'));
  root.appendChild(ag);

  root.appendChild(sectionHeader('Animation tuỳ chỉnh của khối'));
  const cgb = el('div', 'anim-grid');
  Object.keys(item.animations).filter(k => k.indexOf('custom:') === 0).forEach(k => {
    const w = el('div');
    w.appendChild(animSlot(item, k, k.slice(7)));
    const rm = el('button', 'btn-mini danger', 'Xoá'); rm.style.width = '100%';
    rm.onclick = () => { if (confirm('Xoá animation "' + k.slice(7) + '"?')) { delete item.animations[k]; renderInspector(); scheduleSave(); } };
    w.appendChild(rm); cgb.appendChild(w);
  });
  root.appendChild(cgb);
  const addCB = el('button', 'btn full', '＋ Thêm animation tuỳ chỉnh');
  addCB.onclick = () => {
    const nm = (prompt('Tên animation (chữ, số, _):', 'glow') || '').replace(/[^A-Za-z0-9_]/g, '');
    if (!nm) return;
    if (item.animations['custom:' + nm]) { toast('Tên đã tồn tại', 'err'); return; }
    item.animations['custom:' + nm] = emptyAnim(); renderInspector(); scheduleSave();
  };
  root.appendChild(addCB);

  root.appendChild(sectionHeader('Animation Kỹ Thuật'));
  const tsum = item.techAnim && item.techAnim.steps && item.techAnim.steps.length
    ? (item.techAnim.steps.length + ' bước · ' + RT.techSchedule(item.techAnim).total.toFixed(2) + 's · ' + (item.techAnim.enabled ? 'đang bật' : 'đang tắt'))
    : 'Chưa có animation kỹ thuật.';
  root.appendChild(el('div', 'ev-hint', tsum));
  const tbtn = el('button', 'btn accent full', 'Mở Animation Kỹ Thuật');
  tbtn.onclick = () => openTechModal(item);
  root.appendChild(tbtn);

  root.appendChild(sectionHeader('Texture tĩnh'));
  const grid = el('div', 'anim-grid');
  ['all', 'top', 'bottom', 'left', 'right'].forEach(k => grid.appendChild(texSlot(item, k)));
  root.appendChild(grid);

  const del = el('button', 'btn danger full', 'Xoá khối');
  del.onclick = () => deleteItem(item.id);
  root.appendChild(del);
}

/* ============================================================
   UI INSPECTOR
   ============================================================ */
function renderUIInspector(root) {
  const ui = State.ui;
  root.appendChild(el('div', 'ins-head', 'Giao diện'));
  root.appendChild(sectionHeader('Điều khiển'));
  root.appendChild(row('Kiểu', selectInput(ui.mode, [
    ['arrows', 'Nút mũi tên'], ['joystick', 'Joystick']
  ], v => { ui.mode = v; renderInspector(); })));

  if (ui.mode === 'arrows') {
    for (const [key, label] of [['left','Nút ◀'],['right','Nút ▶'],['jump','Nút ▲'],['fire','Nút Bắn']]) {
      root.appendChild(sectionHeader(label));
      const g = el('div', 'grid4');
      g.appendChild(row('X', numInput(ui.layout[key].x, v => ui.layout[key].x = v, 2)));
      g.appendChild(row('Y', numInput(ui.layout[key].y, v => ui.layout[key].y = v, 2)));
      g.appendChild(row('R', numInput(ui.layout[key].r, v => ui.layout[key].r = Math.max(10, v), 1, 10)));
      root.appendChild(g);
    }
  } else {
    root.appendChild(sectionHeader('Joystick base'));
    const g1 = el('div', 'grid4');
    g1.appendChild(row('X', numInput(ui.layout.joyBase.x, v => ui.layout.joyBase.x = v, 2)));
    g1.appendChild(row('Y', numInput(ui.layout.joyBase.y, v => ui.layout.joyBase.y = v, 2)));
    g1.appendChild(row('R', numInput(ui.layout.joyBase.r, v => ui.layout.joyBase.r = Math.max(20, v), 2, 20)));
    root.appendChild(g1);
    root.appendChild(sectionHeader('Joystick knob'));
    const g2 = el('div', 'grid4');
    g2.appendChild(row('R', numInput(ui.layout.joyKnob.r, v => ui.layout.joyKnob.r = Math.max(8, v), 1, 8)));
    root.appendChild(g2);
    root.appendChild(sectionHeader('Nút nhảy'));
    const g3 = el('div', 'grid4');
    g3.appendChild(row('X', numInput(ui.layout.jump.x, v => ui.layout.jump.x = v, 2)));
    g3.appendChild(row('Y', numInput(ui.layout.jump.y, v => ui.layout.jump.y = v, 2)));
    g3.appendChild(row('R', numInput(ui.layout.jump.r, v => ui.layout.jump.r = Math.max(10, v), 1, 10)));
    root.appendChild(g3);
    root.appendChild(sectionHeader('Nút bắn'));
    const g4 = el('div', 'grid4');
    g4.appendChild(row('X', numInput(ui.layout.fire.x, v => ui.layout.fire.x = v, 2)));
    g4.appendChild(row('Y', numInput(ui.layout.fire.y, v => ui.layout.fire.y = v, 2)));
    g4.appendChild(row('R', numInput(ui.layout.fire.r, v => ui.layout.fire.r = Math.max(10, v), 1, 10)));
    root.appendChild(g4);
  }

  root.appendChild(sectionHeader('Nút tùy chỉnh'));
  (ui.buttons || []).forEach((b, i) => {
    const item = el('div');
    item.style.cssText = 'background:#0d1017;border:1px solid #262d3f;border-radius:8px;padding:6px;margin-bottom:6px;';
    item.appendChild(row('Nhãn', textInput(b.label, v => b.label = v)));
    item.appendChild(row('Phím', textInput(b.key, v => b.key = v)));
    const g = el('div', 'grid4');
    g.appendChild(row('X', numInput(b.x, v => b.x = v, 2)));
    g.appendChild(row('Y', numInput(b.y, v => b.y = v, 2)));
    g.appendChild(row('W', numInput(b.w, v => b.w = Math.max(20, v), 2, 20)));
    g.appendChild(row('H', numInput(b.h, v => b.h = Math.max(16, v), 2, 16)));
    item.appendChild(g);
    const del = el('button', 'btn-mini danger', 'Xoá');
    del.style.width = '100%'; del.style.padding = '6px';
    del.onclick = () => { ui.buttons.splice(i, 1); renderInspector(); scheduleSave(); };
    item.appendChild(del);
    root.appendChild(item);
  });
  const addB = el('button', 'btn accent full', '＋ Thêm nút tùy chỉnh');
  addB.style.marginTop = '6px';
  addB.onclick = () => {
    ui.buttons.push({ id: uid(), label: 'Nút', key: 'Fire', x: VW/2, y: 60, w: 80, h: 40 });
    renderInspector(); scheduleSave();
  };
  root.appendChild(addB);

  root.appendChild(sectionHeader('Main Menu'));
  root.appendChild(row('Bật main menu', checkbox(ui.mainMenu.enabled, v => {
    ui.mainMenu.enabled = v; renderInspector();
  })));
  if (ui.mainMenu.enabled) {
    root.appendChild(row('Tiêu đề', textInput(ui.mainMenu.title, v => ui.mainMenu.title = v)));
    root.appendChild(row('Phụ đề',  textInput(ui.mainMenu.subtitle, v => ui.mainMenu.subtitle = v)));
    root.appendChild(row('Màu nền',  colorInput(ui.mainMenu.bg, v => ui.mainMenu.bg = v)));
    root.appendChild(row('Màu tiêu đề', colorInput(ui.mainMenu.titleColor, v => ui.mainMenu.titleColor = v)));
    root.appendChild(row('Màu phụ đề', colorInput(ui.mainMenu.subColor, v => ui.mainMenu.subColor = v)));
  }
  const reset = el('button', 'btn danger full', '↺ Reset UI về mặc định');
  reset.onclick = () => { State.ui = RT.defaultUI(); renderInspector(); scheduleSave(); };
  root.appendChild(reset);
}

/* ============================================================
   CRUD
   ============================================================ */
function addSprite() {
  const s = makeSprite({});
  State.items.push(s); State.selectedId = s.id; State.tab = 'scene';
  document.getElementById('btnUI').classList.remove('on');
  refreshAll(); scheduleSave(); toast('Đã thêm nhân vật', 'ok');
}
function addBot() {
  const b = makeBot({});
  State.items.push(b); State.selectedId = b.id; State.tab = 'scene';
  document.getElementById('btnUI').classList.remove('on');
  refreshAll(); scheduleSave(); toast('Đã thêm bot', 'ok');
}
function addBlock() {
  const b = makeBlock({});
  State.items.push(b); State.selectedId = b.id; State.tab = 'scene';
  document.getElementById('btnUI').classList.remove('on');
  refreshAll(); scheduleSave(); toast('Đã thêm khối', 'ok');
}
function deleteItem(id) {
  const idx = State.items.findIndex(i => i.id === id);
  if (idx < 0) return;
  State.items.splice(idx, 1);
  if (State.selectedId === id) State.selectedId = null;
  refreshAll(); scheduleSave();
}
function selectItem(id) {
  State.selectedId = id; State.uiSelected = null;
  State.tab = 'scene';
  document.getElementById('btnUI').classList.remove('on');
  refreshAll();
}
function refreshAll() { renderLayers(); renderInspector(); }

/* ============================================================
   PLAY / STOP
   ============================================================ */
function play() {
  for (const it of State.items) {
    if (it.kind === 'sprite') {
      it.hp = it.maxHp;
      it._vx = 0; it._vy = 0; it._onGround = false;
      it._invuln = 0; it._dead = false; it._shootCd = 0; it._shootAnimTime = 0;
      it._state = 'idle'; it._prevState = 'idle';
      it._animFrame = 0; it._animTime = 0;
      it._turnTime = 0; it._customAnim = null; it._engaged = false; it._alertT = 0; it._loseT = 0; it._waitT = 0; it._reactT = 0;
      it._facing = 1;
      it._patrolOrigin = undefined; it._patrolDir = 1;
      it._pendingShots = [];
      it._pendingActions = [];
      it._everyTimers = {};
      it._keyState = {};
      it._idleFired = {};
      it._touchSet = new Set();
      it._flash = null;
      it._speedBuff = null; it._gravityBuff = null; it._scaleBuff = null;
      it._startFired = false;
      it._prevHp = null;
      it._idleTime = 0;
      it._nearPlayer = false;
      it._varState = {}; it._evMeta = {}; it._nearEv = {};
      it._spawnX = it.x; it._spawnY = it.y;
    } else if (it.kind === 'block') {
      it._animFrame = 0; it._animTime = 0; it._dead = false;
      it._solid0 = it.solid; it._hazard0 = it.hazard; it._xf = null; it._ta = null; it._hidden = false; it._customAnim = null;
    }
  }
  State.keys = {};
  State.vars = RT.initVars(State.varDefs);
  State.pointerToBtn.clear();
  State.joystick.active = false; State.joystick.pointerId = null;
  State.projectiles = [];
  State.particles = [];
  State.floatingTexts = [];
  State.shakeScreen = { intensity: 0, timeLeft: 0, duration: 0.001 };
  State.camera = { x: VW/2, y: VH/2 };
  State.showMenu = !!(State.ui.mainMenu && State.ui.mainMenu.enabled);
  if (State.bgmCtl) State.bgmCtl.stopAll();
  State._bgmDead = false;
  State.bgmCtl = RT.createBGM(State.music.tracks);
  State.bgmCtl.trigger(State.showMenu ? 'menu' : 'start');
  State.playing = true;
  document.getElementById('btnPlay').disabled = true;
  document.getElementById('btnStop').disabled = false;
  document.getElementById('inspector').classList.add('hidden');
  document.getElementById('btnPan').classList.remove('on');
  State.panMode = false;
  document.getElementById('stageWrap').classList.remove('panmode');
}
function stop() {
  State.playing = false;
  if (State.bgmCtl) { State.bgmCtl.stopAll(); State.bgmCtl = null; }
  for (const it of State.items) {          // trả nhân vật/khối về trạng thái lúc thiết kế
    if (it.kind === 'sprite') { it._facing = 1; it._state = 'idle'; it._animFrame = 0; it.hp = it.maxHp; it._vx = 0; it._vy = 0; }
    if (it._spawnX != null) { it.x = it._spawnX; it.y = it._spawnY; it._spawnX = null; }
    if (it.kind === 'block') {
      if (it._solid0 != null) { it.solid = it._solid0; it.hazard = it._hazard0; }
      it._solid0 = null; it._hazard0 = null; it._xf = null; it._ta = null; it._hidden = false; it._customAnim = null;
    }
    it._dead = false;
  }
  State.showMenu = false;
  State.keys = {};
  State.pointerToBtn.clear();
  State.joystick.active = false;
  State.projectiles = [];
  State.particles = [];
  State.floatingTexts = [];
  State.shakeScreen = { intensity: 0, timeLeft: 0, duration: 0.001 };
  document.getElementById('btnPlay').disabled = false;
  document.getElementById('btnStop').disabled = true;
  document.getElementById('inspector').classList.remove('hidden');
}

/* ============================================================
   POINTER
   ============================================================ */
function onPointerDown(e) {
  e.preventDefault();
  if (State.playing && State.showMenu) { State.showMenu = false; if (State.bgmCtl) { State.bgmCtl.unlock(); State.bgmCtl.trigger('start'); } return; }
  if (State.playing) {
    const p = toStage(e.clientX, e.clientY);
    const key = RT.hitUIButton(p, State.ui);
    if (key === '__joy__') {
      State.joystick.active = true; State.joystick.pointerId = e.pointerId;
      State.keys['_joy_active'] = true;
      State.keys['_joy_x'] = 0; State.keys['_joy_y'] = 0;
      try { canvas.setPointerCapture(e.pointerId); } catch(_){}
      return;
    }
    if (key) {
      State.pointerToBtn.set(e.pointerId, key);
      State.keys[key] = true;
      try { canvas.setPointerCapture(e.pointerId); } catch(_){}
    }
    return;
  }
  if (State.tab === 'ui') {
    const p = toStage(e.clientX, e.clientY);
    const hit = hitUIAt(p);
    if (hit) {
      State.uiSelected = hit;
      State.uiDrag = { kind: hit.kind, key: hit.key, dx: p.x - hit.x, dy: p.y - hit.y };
      try { canvas.setPointerCapture(e.pointerId); } catch(_){}
      renderInspector();
      return;
    }
    State.uiSelected = null; renderInspector();
    return;
  }
  if (State.panMode) {
    State.panStart = { sx: e.clientX, sy: e.clientY, cx: State.editCam.x, cy: State.editCam.y };
    try { canvas.setPointerCapture(e.pointerId); } catch(_){}
    return;
  }
  const p = toStage(e.clientX, e.clientY);
  const w = toWorld(p.x, p.y);
  for (let i = State.items.length - 1; i >= 0; i--) {
    const item = State.items[i];
    const b = RT.getBounds(item);
    if (w.x >= b.x && w.x <= b.x + b.w && w.y >= b.y && w.y <= b.y + b.h) {
      selectItem(item.id);
      State.drag = { id: item.id, dx: w.x - item.x, dy: w.y - item.y };
      cancelHold();
      State.hold = { x: e.clientX, y: e.clientY, t: setTimeout(() => { State.hold = null; State.drag = null; duplicateItem(item.id); }, 650) };
      try { canvas.setPointerCapture(e.pointerId); } catch(_){}
      return;
    }
  }
  selectItem(null);
}
function hitUIAt(p) {
  const ui = State.ui, L = ui.layout;
  const tryBtn = (key, b) => {
    if (!b) return null;
    const dx = p.x - b.x, dy = p.y - b.y;
    if (dx*dx + dy*dy <= (b.r + 6)*(b.r + 6)) return { kind: 'layout', key, x: b.x, y: b.y };
    return null;
  };
  if (ui.mode === 'joystick') {
    let h;
    if ((h = tryBtn('jump', L.jump))) return h;
    if ((h = tryBtn('fire', L.fire))) return h;
    if ((h = tryBtn('joyBase', L.joyBase))) return h;
  } else {
    let h;
    if ((h = tryBtn('left',  L.left)))  return h;
    if ((h = tryBtn('right', L.right))) return h;
    if ((h = tryBtn('jump',  L.jump)))  return h;
    if ((h = tryBtn('fire',  L.fire)))  return h;
  }
  if (ui.buttons) {
    for (const b of ui.buttons) {
      const w = b.w || 70, h = b.h || 40;
      if (p.x >= b.x - w/2 && p.x <= b.x + w/2 && p.y >= b.y - h/2 && p.y <= b.y + h/2)
        return { kind: 'custom', key: b.id, x: b.x, y: b.y };
    }
  }
  return null;
}
function onPointerMove(e) {
  if (State.playing && State.showMenu) return;
  if (State.playing) {
    const p = toStage(e.clientX, e.clientY);
    if (State.joystick.active && e.pointerId === State.joystick.pointerId) {
      const L = State.ui.layout.joyBase;
      let dx = p.x - L.x, dy = p.y - L.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > L.r) { dx = dx / dist * L.r; dy = dy / dist * L.r; }
      State.keys['_joy_x'] = dx / L.r;
      State.keys['_joy_y'] = dy / L.r;
      return;
    }
    if (!State.pointerToBtn.has(e.pointerId)) return;
    const key = State.pointerToBtn.get(e.pointerId);
    State.keys[key] = RT.hitUIButton(p, State.ui) === key;
    return;
  }
  if (State.tab === 'ui' && State.uiDrag) {
    const p = toStage(e.clientX, e.clientY);
    const d = State.uiDrag;
    if (d.kind === 'layout') {
      State.ui.layout[d.key].x = p.x - d.dx;
      State.ui.layout[d.key].y = p.y - d.dy;
    } else if (d.kind === 'custom') {
      const b = State.ui.buttons.find(x => x.id === d.key);
      if (b) { b.x = p.x - d.dx; b.y = p.y - d.dy; }
    }
    return;
  }
  if (State.panMode && State.panStart) {
    const scale = VW / canvas.getBoundingClientRect().width;
    const dx = (e.clientX - State.panStart.sx) * scale;
    const dy = (e.clientY - State.panStart.sy) * scale;
    State.editCam.x = State.panStart.cx - dx;
    State.editCam.y = State.panStart.cy - dy;
    updateCamInfo();
    return;
  }
  if (State.hold && Math.hypot(e.clientX - State.hold.x, e.clientY - State.hold.y) > 10) cancelHold();
  if (!State.drag) return;
  const p = toStage(e.clientX, e.clientY);
  const w = toWorld(p.x, p.y);
  const item = State.items.find(i => i.id === State.drag.id);
  if (!item) return;
  item.x = w.x - State.drag.dx;
  item.y = w.y - State.drag.dy;
}
function onPointerUp(e) {
  if (State.playing) {
    if (State.joystick.active && e.pointerId === State.joystick.pointerId) {
      State.joystick.active = false; State.joystick.pointerId = null;
      State.keys['_joy_active'] = false;
      State.keys['_joy_x'] = 0; State.keys['_joy_y'] = 0;
      return;
    }
    const key = State.pointerToBtn.get(e.pointerId);
    if (key) { State.keys[key] = false; State.pointerToBtn.delete(e.pointerId); }
    return;
  }
  cancelHold();
  if (State.uiDrag) { State.uiDrag = null; scheduleSave(); return; }
  if (State.panStart) { State.panStart = null; return; }
  if (State.drag) { State.drag = null; renderInspector(); scheduleSave(); }
}
function onKeyDown(e) {
  State.keys[e.key] = true;
  if (State.playing && [' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.key) >= 0) e.preventDefault();
}
function onKeyUp(e) { State.keys[e.key] = false; }
function updateCamInfo() {
  document.getElementById('camInfo').textContent =
    'Camera: ' + Math.round(State.editCam.x) + ', ' + Math.round(State.editCam.y);
}

/* ============================================================
   MAIN LOOP
   ============================================================ */
let lastT = 0;
function loop(t) {
  try { loopBody(t); }
  catch (e) { if (!loop._err) { loop._err = 1; console.error(e); toast('Lỗi runtime: ' + ((e && e.message) || e), 'err', 4000); } }
  requestAnimationFrame(loop);
}
function loopBody(t) {
  if (!lastT) lastT = t;
  let dt = (t - lastT) / 1000;
  lastT = t;
  if (dt > 0.05) dt = 0.05;
  if (dt < 0) dt = 0;
  if (State.playing) RT.updateBGM(State, dt);

  if (State.playing && !State.showMenu) {
    State.time += dt;
    RT.updateTechAnims(State, dt);
    for (const it of State.items) {
      if (it.kind === 'sprite') RT.updateItem(State, it, dt, State.keys);
      else if (it.kind === 'block') RT.updateBlock(it, dt);
    }
    RT.updateProjectiles(State, dt);
    RT.updateParticles(State, dt);
    RT.updateFloatingTexts(State, dt);
    RT.updateShake(State, dt);
    RT.updateCamera(State, dt);
  } else if (State.playing && State.showMenu) {
    for (const it of State.items) {
      if (it.kind === 'sprite') RT.updateItem(State, it, dt, {});
      else if (it.kind === 'block') RT.updateBlock(it, dt);
    }
    RT.updateParticles(State, dt);
    RT.updateFloatingTexts(State, dt);
    RT.updateShake(State, dt);
  } else {
    for (const it of State.items) {
      if (it.kind === 'block' && it.animations && it.animations.default &&
          it.animations.default.frames.length > 1) {
        RT.updateBlock(it, dt);
      }
    }
  }

  RT.render(ctx, State, { editor: !State.playing });
  if (!State.playing && State.tab === 'ui') drawUIEditorOverlay();
}

function drawUIEditorOverlay() {
  const ui = State.ui, L = ui.layout;
  ctx.save();
  if (ui.mainMenu.enabled) {
    ctx.fillStyle = ui.mainMenu.bg || '#0e1116';
    ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = ui.mainMenu.titleColor || '#ffb86b';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ui.mainMenu.title || 'Game', VW/2, VH/2 - 24);
    ctx.fillStyle = ui.mainMenu.subColor || '#a8b6cc';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(ui.mainMenu.subtitle || 'Nhấn để bắt đầu', VW/2, VH/2 + 28);
  }
  const ghost = (b, key, label) => {
    if (!b) return;
    const sel = State.uiSelected && State.uiSelected.kind === 'layout' && State.uiSelected.key === key;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(124,92,255,.2)'; ctx.fill();
    ctx.strokeStyle = sel ? '#ffb86b' : 'rgba(124,92,255,.7)';
    ctx.lineWidth = sel ? 2.5 : 1.5; ctx.stroke();
    ctx.fillStyle = '#e6e9ef';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, b.x, b.y);
  };
  if (ui.mode === 'joystick') {
    ghost(L.joyBase, 'joyBase', 'JOY');
    ghost(L.jump, 'jump', '▲');
    ghost(L.fire, 'fire', 'F');
  } else {
    ghost(L.left, 'left', '◀');
    ghost(L.right, 'right', '▶');
    ghost(L.jump, 'jump', '▲');
    ghost(L.fire, 'fire', 'F');
  }
  if (ui.buttons) {
    for (const b of ui.buttons) {
      const sel = State.uiSelected && State.uiSelected.kind === 'custom' && State.uiSelected.key === b.id;
      const w = b.w || 70, h = b.h || 40;
      const x = b.x - w/2, y = b.y - h/2;
      ctx.save();
      ctx.beginPath();
      const r = 10;
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fillStyle = 'rgba(124,92,255,.2)'; ctx.fill();
      ctx.strokeStyle = sel ? '#ffb86b' : 'rgba(124,92,255,.7)';
      ctx.lineWidth = sel ? 2.5 : 1.5; ctx.stroke();
      ctx.fillStyle = '#e6e9ef';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.label || b.key, b.x, b.y);
      ctx.restore();
    }
  }
  ctx.restore();
}

/* ============================================================
   SERIALIZE / DESERIALIZE
   ============================================================ */
function makeTrack(o) {
  o = o || {};
  return {
    id: o.id || uid(), name: o.name || 'Nhạc', url: o.url || '',
    volume: o.volume != null ? Math.max(0, Math.min(1, +o.volume || 0)) : 0.8,
    startOn: o.startOn || 'start', delay: Math.max(0, +o.delay || 0),
    loop: o.loop === 'count' ? 'count' : 'infinite', loopCount: Math.max(1, Math.round(+o.loopCount || 1)),
    stopMode: o.stopMode || 'never', stopAfter: Math.max(0.1, +o.stopAfter || 30),
    fadeIn: Math.max(0, +o.fadeIn || 0), fadeOut: Math.max(0, +o.fadeOut || 0)
  };
}
function sanitizeAI(a) {
  const o = {};
  if (a && typeof a === 'object') for (const k in RT.AI_DEF) {
    if (a[k] == null) continue;
    o[k] = typeof RT.AI_DEF[k] === 'boolean' ? !!a[k] : (isFinite(+a[k]) ? RT.clampAI(k, +a[k]) : RT.AI_DEF[k]);
  }
  return o;
}
function serializeAnim(anim) {
  if (!anim) return null;
  return {
    frames: anim.frames.map(f => (f.hitboxes && f.hitboxes.length)
      ? { url: f.url, hitboxes: f.hitboxes.map(h => ({ ox: h.ox, oy: h.oy, w: h.w, h: h.h })) }
      : { url: f.url }),
    fps: anim.fps || 8,
    loop: anim.loop !== false
  };
}
function serializeEvents(events) {
  if (!events || !events.length) return [];
  return events.map(ev => ({
    id: ev.id,
    trigger: ev.trigger,
    triggerParams: JSON.parse(JSON.stringify(ev.triggerParams || {})),
    delay: ev.delay != null ? ev.delay : 0,
    action: ev.action,
    actionParams: JSON.parse(JSON.stringify(ev.actionParams || {})),
    cond: ev.cond && ev.cond.var ? { var: ev.cond.var, op: ev.cond.op || '>=', value: ev.cond.value } : undefined,
    once: !!ev.once, cooldown: ev.cooldown || 0, chance: ev.chance != null ? ev.chance : 100
  }));
}
function serialize() {
  return {
    varDefs: State.varDefs.map(d => ({ name: d.name, value: d.value })),

    vw: VW, vh: VH,
    res: { scale: State.res.scale, pixel: !!State.res.pixel },
    opts: { turnAnim: !!State.opts.turnAnim },
    music: { tracks: State.music.tracks.map(t => Object.assign({}, t)) },
    ui: JSON.parse(JSON.stringify(State.ui)),
    items: State.items.map(it => {
      if (it.kind === 'sprite') {
        const animations = {};
        for (const k in it.animations) animations[k] = serializeAnim(it.animations[k]);
        return {
          kind: 'sprite', id: it.id, name: it.name,
          x: it.x, y: it.y, w: it.w, h: it.h,
          hb: { ox: it.hb.ox, oy: it.hb.oy, hw: it.hb.hw, hh: it.hb.hh },
          hitboxes: (it.hitboxes || []).map(h => ({ ox: h.ox, oy: h.oy, w: h.w, h: h.h })),
          events: serializeEvents(it.events),
          control: it.control, camera: !!it.camera, hpMode: it.hpMode || 'default',
          animations,
          shoot: {
            enabled: !!it.shoot.enabled, dir: it.shoot.dir || 'forward',
            offsetX: it.shoot.offsetX || 0, offsetY: it.shoot.offsetY || 0,
            delay: it.shoot.delay || 0,
            cooldown: it.shoot.cooldown != null ? it.shoot.cooldown : 0.3,
            damage: it.shoot.damage != null ? it.shoot.damage : 10,
            speed: it.shoot.speed != null ? it.shoot.speed : 8,
            bulletW: it.shoot.bulletW != null ? it.shoot.bulletW : 14,
            bulletH: it.shoot.bulletH != null ? it.shoot.bulletH : 14,
            useGravity: !!it.shoot.useGravity,
            bulletGravity: it.shoot.bulletGravity != null ? it.shoot.bulletGravity : 5
          },
          botRange: it.botRange != null ? it.botRange : 150,
          botPatrol: it.botPatrol != null ? it.botPatrol : 80,
          noPush: !!it.noPush,
          ai: Object.assign({}, it.ai || {}),
          speed: it.speed, jumpPower: it.jumpPower, gravity: it.gravity,
          hp: it.hp, maxHp: it.maxHp, iframe: it.iframe
        };
      }
      const tex = {};
      for (const k in it.tex) {
        const a = it.tex[k];
        tex[k] = a ? { url: a.url } : null;
      }
      return {
        kind: 'block', id: it.id, name: it.name,
        x: it.x, y: it.y, w: it.w, h: it.h,
        solid: it._solid0 != null ? it._solid0 : it.solid, hazard: it._hazard0 != null ? it._hazard0 : it.hazard, tex,
        hitboxes: (it.hitboxes || []).map(h => ({ ox: h.ox, oy: h.oy, w: h.w, h: h.h })),
        animations: (() => {
          const o = {};
          for (const k in (it.animations || {})) o[k] = serializeAnim(it.animations[k]);
          if (!o.default) o.default = serializeAnim(null);
          return o;
        })(),
        techAnim: it.techAnim ? JSON.parse(JSON.stringify(it.techAnim)) : null
      };
    })
  };
}

function deserialize(data) {
  State.res = { scale: Math.max(1, Math.min(4, Math.round(+(data && data.res && data.res.scale) || 1))), pixel: !!(data && data.res && data.res.pixel) };
  State.opts = { turnAnim: !(data && data.opts) || data.opts.turnAnim !== false };
  State.music = { tracks: ((data && data.music && data.music.tracks) || []).map(makeTrack) };
  State.varDefs = ((data && data.varDefs) || []).map(d => ({ name: String(d.name || ''), value: d.value != null ? String(d.value) : '0' }));
  State.items = [];
  State.selectedId = null;
  State.ui = (data && data.ui) ? JSON.parse(JSON.stringify(data.ui)) : RT.defaultUI();
  const items = (data && data.items) || [];

  let pending = 0;
  const doneOne = () => { pending--; if (pending === 0) refreshAll(); };
  const track = (p) => { pending++; Promise.resolve(p).then(doneOne); };

  for (const d of items) {
    if (d.kind === 'sprite') {
      const animations = {};
      const srcAnims = d.animations || {};
      for (const k in srcAnims) {
        const a = srcAnims[k];
        if (!a) { animations[k] = emptyAnim(); continue; }
        animations[k] = {
          frames: (a.frames || []).map(mkFrame),
          fps: a.fps || 8,
          loop: a.loop !== false
        };
      }
      ['idle','run','jump','hurt','die','shoot','bullet','turn'].forEach(k => {
        if (!animations[k]) animations[k] = emptyAnim();
      });

      const sh = d.shoot || {};
      if (sh.url && !animations.bullet.frames.length) animations.bullet.frames.push(mkFrame({ url: sh.url }));
      const shoot = {
        enabled: !!sh.enabled, dir: sh.dir || 'forward',
        offsetX: sh.offsetX || 0, offsetY: sh.offsetY || 0,
        delay: sh.delay || 0,
        cooldown: sh.cooldown != null ? sh.cooldown : 0.3,
        damage: sh.damage != null ? sh.damage : 10,
        speed: sh.speed != null ? sh.speed : 8,
        bulletW: sh.bulletW != null ? sh.bulletW : 14,
        bulletH: sh.bulletH != null ? sh.bulletH : 14,
        useGravity: !!sh.useGravity,
        bulletGravity: sh.bulletGravity != null ? sh.bulletGravity : 5
      };

      const hitboxes = (d.hitboxes || []).map(h => ({
        ox: h.ox || 0, oy: h.oy || 0,
        w: Math.max(1, h.w || 1), h: Math.max(1, h.h || 1)
      }));

      const events = (d.events || []).map(e => ({
        id: e.id || uid(),
        trigger: e.trigger || 'onStart',
        triggerParams: Object.assign({}, e.triggerParams || {}),
        delay: e.delay != null ? e.delay : 0,
        action: e.action || 'shakeScreen',
        actionParams: Object.assign({}, e.actionParams || {}),
        cond: e.cond ? Object.assign({}, e.cond) : undefined,
        once: !!e.once, cooldown: e.cooldown || 0, chance: e.chance != null ? e.chance : 100
      }));

      const sp = makeSprite({
        id: d.id || uid(), name: d.name,
        x: d.x, y: d.y, w: d.w, h: d.h,
        hb: d.hb, hitboxes, events,
        control: d.control,
        camera: !!d.camera, hpMode: d.hpMode || 'default',
        animations, shoot,
        botRange: d.botRange != null ? d.botRange : 150,
        botPatrol: d.botPatrol != null ? d.botPatrol : 80,
        noPush: !!d.noPush,
        ai: sanitizeAI(d.ai),
        speed: d.speed, jumpPower: d.jumpPower, gravity: d.gravity,
        hp: d.hp, maxHp: d.maxHp || d.hp, iframe: d.iframe
      });
      State.items.push(sp);

      for (const k in animations) {
        const anim = animations[k];
        for (const f of anim.frames) {
          track(loadImage(f.url).then(img => { f.img = img; }));
        }
      }
    } else {
      const tex = {};
      for (const k in d.tex) tex[k] = d.tex[k] ? { url: d.tex[k].url, img: null } : null;
      const hitboxes = (d.hitboxes || []).map(h => ({
        ox: h.ox || 0, oy: h.oy || 0,
        w: Math.max(1, h.w || 1), h: Math.max(1, h.h || 1)
      }));
      const banims = {};
      for (const k in (d.animations || {})) {
        const a = d.animations[k] || {};
        banims[k] = { frames: (a.frames || []).map(mkFrame), fps: a.fps || 8, loop: a.loop !== false };
      }
      if (!banims.default) banims.default = emptyAnim();
      const blockAnim = banims.default;
      const bl = makeBlock({
        id: d.id || uid(), name: d.name,
        x: d.x, y: d.y, w: d.w, h: d.h,
        solid: d.solid, hazard: d.hazard, tex,
        hitboxes,
        animations: banims
      });
      bl.techAnim = sanitizeTech(d.techAnim);
      State.items.push(bl);

      for (const k in bl.tex) {
        const a = bl.tex[k];
        if (!a) continue;
        track(loadImage(a.url).then(img => { a.img = img; }));
      }
      for (const k in banims) for (const f of banims[k].frames) {
        track(loadImage(f.url).then(img => { f.img = img; }));
      }
    }
  }
  refreshAll();
}

/* ============================================================
   LƯU THỦ CÔNG (OPFS / IndexedDB / localStorage)
   ============================================================ */
let saving = false;
function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
function updateSaveBtn() {
  const b = document.getElementById('btnSave'); if (!b) return;
  b.textContent = saving ? 'Đang lưu…' : (State.dirty ? 'Lưu •' : 'Lưu');
  b.classList.toggle('dirty', !!State.dirty);
}
/* ---------- UNDO / REDO (snapshot, ảnh được tham chiếu để nhẹ bộ nhớ) ---------- */
const Hist = { stack: [], idx: -1, timer: null, busy: false, urls: [], map: new Map() };
function histSnap() {
  return JSON.stringify(serialize(), (k, v) => {
    if (k === 'url' && typeof v === 'string' && v.length > 200) {
      let i = Hist.map.get(v);
      if (i == null) { i = Hist.urls.length; Hist.urls.push(v); Hist.map.set(v, i); }
      return '\u0001' + i;
    }
    return v;
  });
}
function histParse(str) {
  return JSON.parse(str, (k, v) => (typeof v === 'string' && v.charCodeAt(0) === 1) ? Hist.urls[+v.slice(1)] : v);
}
function updateHistBtns() {
  const u = document.getElementById('btnUndo'), r = document.getElementById('btnRedo');
  if (u) u.disabled = Hist.idx <= 0;
  if (r) r.disabled = Hist.idx >= Hist.stack.length - 1;
}
const HIST_MAX_BYTES = 40e6;
function histGC() {   // bỏ ảnh không còn bước Undo nào dùng
  const used = new Set(), re = /\\u0001(\d+)/g;
  for (const t of Hist.stack) { let m; re.lastIndex = 0; while ((m = re.exec(t))) used.add(+m[1]); }
  for (let i = 0; i < Hist.urls.length; i++) {
    if (Hist.urls[i] != null && !used.has(i)) { Hist.map.delete(Hist.urls[i]); Hist.urls[i] = null; }
  }
}
function histPush() {
  Hist.timer = null;
  if (Hist.busy || State.playing) return;
  const snap = histSnap();
  if (Hist.stack[Hist.idx] === snap) return;
  Hist.stack.length = Hist.idx + 1;
  Hist.stack.push(snap);
  let dropped = false, total = 0;
  for (const t of Hist.stack) total += t.length;
  while (Hist.stack.length > 1 && (Hist.stack.length > 60 || total > HIST_MAX_BYTES)) { total -= Hist.stack.shift().length; dropped = true; }
  Hist.idx = Hist.stack.length - 1;
  if (dropped) histGC();
  updateHistBtns();
}
function histReset() { clearTimeout(Hist.timer); Hist.timer = null; Hist.stack = [histSnap()]; Hist.idx = 0; updateHistBtns(); }
function histGo(step) {
  if (State.playing) { toast('Hãy dừng game trước khi Undo/Redo', 'err'); return; }
  if (document.querySelector('.modal.show')) { toast('Hãy đóng cửa sổ đang mở trước khi Undo/Redo', 'err'); return; }
  if (Hist.timer) { clearTimeout(Hist.timer); histPush(); }
  const i = Hist.idx + step;
  if (i < 0 || i >= Hist.stack.length) return;
  Hist.busy = true;
  try {
    const sel = State.selectedId;
    deserialize(histParse(Hist.stack[i]));
    if (sel && State.items.some(x => x.id === sel)) selectItem(sel);
    Hist.idx = i; State.dirty = true; updateSaveBtn();
  } catch (e) { console.error(e); toast('Undo/Redo lỗi: ' + ((e && e.message) || e), 'err'); }
  finally { Hist.busy = false; }
  updateHistBtns();
}
function scheduleSave() {   // đánh dấu "chưa lưu" + ghi lịch sử Undo
  State.dirty = true; updateSaveBtn();
  if (Hist.busy || State.playing) return;
  clearTimeout(Hist.timer);
  Hist.timer = setTimeout(histPush, 350);
}

/* ---------- COPY item bằng nhấn giữ ---------- */
function cancelHold() { if (State.hold) { clearTimeout(State.hold.t); State.hold = null; } }
function cloneItem(it) {
  const c = {};
  for (const k in it) {
    const v = it[k];
    if (k[0] === '_') continue;
    if (k === 'animations') {
      c.animations = {};
      for (const a in v) c.animations[a] = Object.assign({}, v[a], { frames: v[a].frames.map(f => Object.assign({}, f, { hitboxes: (f.hitboxes || []).map(h => Object.assign({}, h)) })) });
    } else if (k === 'tex') {
      c.tex = {}; for (const t in v) c.tex[t] = v[t] ? Object.assign({}, v[t]) : v[t];
    } else if (k === 'events' || k === 'hitboxes' || k === 'hb' || k === 'shoot' || k === 'ai' || k === 'techAnim') c[k] = JSON.parse(JSON.stringify(v));
    else c[k] = v;
  }
  return c;
}
function duplicateItem(id) {
  const src = State.items.find(i => i.id === id);
  if (!src) return;
  const isPlayer = src.kind === 'sprite' && src.control === 'player';
  if (!confirm('Copy "' + (src.name || 'Item') + '"?' + (isPlayer ? '\nBản sao của nhân vật điều khiển sẽ là Bot đứng yên (không bắn, không camera).' : ''))) return;
  const base = src.kind === 'sprite' ? makeSprite({}) : makeBlock({});
  const c = Object.assign(base, cloneItem(src), { id: uid(), name: (src.name || 'Item') + ' (copy)', x: src.x + 24, y: src.y + 24 });
  if (isPlayer) { c.control = 'bot'; c.camera = false; c.botPatrol = 0; c.botRange = 0; c.shoot.enabled = false; }
  State.items.push(c);
  selectItem(c.id);
  scheduleSave();
  toast('Đã copy: ' + c.name, 'ok');
}
async function saveProject(silent) {
  if (!State.currentProjectId || saving) return false;
  saving = true; updateSaveBtn();
  try {
    const size = await Projects.save(State.currentProjectId, serialize());
    State.dirty = false;
    if (!silent) toast('Đã lưu (' + fmtSize(size) + ' · ' + Store.name() + ')', 'ok');
    return true;
  } catch (e) {
    console.error(e);
    toast('Lưu thất bại: ' + ((e && e.message) || e), 'err', 5000);
    return false;
  } finally { saving = false; updateSaveBtn(); }
}
async function guardDirty() {
  if (!State.dirty) return true;
  if (confirm('Có thay đổi chưa lưu.\nOK = Lưu rồi tiếp tục\nHủy = Ở lại')) return await saveProject();
  return false;
}
async function loadProject(meta) {
  if (!meta) return;
  let data = null;
  try { data = await Projects.read(meta.id); } catch (e) { console.error(e); }
  if (!data) toast('Không đọc được dữ liệu dự án "' + meta.name + '"', 'err', 4000);
  State.currentProjectId = meta.id;
  await Projects.setCurrent(meta.id);
  deserialize(data || Projects.empty());
  State.editCam = { x: VW/2, y: VH/2 };
  State.dirty = false; updateSaveBtn(); updateCamInfo();
  histReset();
}

/* ============================================================
   PROJECTS UI
   ============================================================ */
/* ============================================================
   CÀI ĐẶT · THEME · FILE .mnhr
   ============================================================ */
const Settings = (function () {
  const KEY = 'mnhr_settings';
  const v = { theme: 'dark', autosave: false, warn: true };
  try { Object.assign(v, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  function apply() {
    document.documentElement.setAttribute('data-theme', v.theme === 'light' ? 'light' : 'dark');
    const m = document.querySelector('meta[name=theme-color]');
    if (m) m.setAttribute('content', v.theme === 'light' ? '#e9edf4' : '#0b0d12');
  }
  function set(k, val) { v[k] = val; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} apply(); }
  return { get: () => v, set, apply };
})();

function projectStats() {
  let sprites = 0, blocks = 0, frames = 0, hb = 0, events = 0, bytes = 0;
  for (const it of State.items) {
    if (it.kind === 'sprite') sprites++; else blocks++;
    events += (it.events || []).length;
    hb += (it.hitboxes || []).length;
    for (const k in (it.animations || {})) {
      for (const f of (it.animations[k].frames || [])) { frames++; hb += (f.hitboxes || []).length; if (f.url) bytes += f.url.length; }
    }
  }
  return { sprites, blocks, frames, hb, events, bytes };
}
async function renderSettings() {
  const st = projectStats(), meta = Projects.meta(State.currentProjectId);
  const lines = [
    ['Dự án', meta ? meta.name : '-'], ['Nhân vật / Bot', st.sprites], ['Khối', st.blocks],
    ['Frame ảnh', st.frames + ' (~' + fmtSize(st.bytes) + ')'], ['Hitbox', st.hb], ['Sự kiện', st.events],
    ['Dung lượng dự án', meta ? fmtSize(meta.size || 0) : '-'], ['Nơi lưu', Store.name()], ['Phiên bản', 'Alpha 9.0.0']
  ];
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      lines.push(['Bộ nhớ trình duyệt', fmtSize(e.usage || 0) + ' / ' + fmtSize(e.quota || 0)]);
    }
  } catch (e) {}
  const box = document.getElementById('setStats');
  box.innerHTML = '';
  for (const kv of lines) {
    const r = document.createElement('div'); r.className = 'set-stat';
    const a = document.createElement('span'); a.textContent = kv[0];
    const b = document.createElement('b'); b.textContent = String(kv[1]);
    r.appendChild(a); r.appendChild(b); box.appendChild(r);
  }
  document.getElementById('setTheme').value = Settings.get().theme;
  document.getElementById('setAutosave').checked = !!Settings.get().autosave;
  document.getElementById('setWarn').checked = Settings.get().warn !== false;
}
function mnhrText() {
  const meta = Projects.meta(State.currentProjectId);
  return JSON.stringify({ mnhr: 1, engine: 'Alpha 9.0.0', name: meta ? meta.name : 'Dự án', savedAt: Date.now(), data: serialize() });
}
function downloadMnhr() {
  try {
    const meta = Projects.meta(State.currentProjectId);
    const name = ((meta && meta.name) || 'du-an').replace(/[^\w\-]+/g, '_').slice(0, 40) || 'du-an';
    const url = URL.createObjectURL(new Blob([mnhrText()], { type: 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url; a.download = name + '.mnhr'; a.rel = 'noopener';
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
    toast('Đã tạo ' + name + '.mnhr', 'ok');
  } catch (e) { toast('Xuất .mnhr thất bại: ' + ((e && e.message) || e), 'err', 5000); }
}
async function copyMnhr() {
  const t = mnhrText();
  try { await navigator.clipboard.writeText(t); toast('Đã copy vào bảng nhớ tạm (' + fmtSize(t.length) + ')', 'ok'); }
  catch (e) {
    const ta = document.getElementById('mnhrPaste');
    ta.value = t; ta.focus(); ta.select();
    try { document.execCommand('copy'); toast('Đã copy (' + fmtSize(t.length) + ')', 'ok'); }
    catch (_) { toast('Trình duyệt chặn clipboard — hãy copy thủ công nội dung trong ô bên dưới', 'ok', 5000); }
  }
}
async function importMnhrText(text) {
  let obj;
  try { obj = JSON.parse(String(text).trim()); } catch (e) { toast('Không phải file .mnhr hợp lệ', 'err', 4000); return; }
  const data = obj && obj.data ? obj.data : obj;
  if (!data || !Array.isArray(data.items)) { toast('File .mnhr thiếu dữ liệu dự án', 'err', 4000); return; }
  if (!(await guardDirty())) return;
  try {
    const m = await Projects.create(((obj && obj.name) || 'Dự án') + ' (nhập)', data);
    await loadProject(m);
    document.getElementById('settingsModal').classList.remove('show');
    toast('Đã nhập: ' + m.name, 'ok');
  } catch (e) { toast('Nhập thất bại: ' + ((e && e.message) || e), 'err', 5000); }
}
function bindSettings() {
  Settings.apply();
  const $ = (id) => document.getElementById(id);
  $('btnSettings').onclick = () => { renderSettings(); $('settingsModal').classList.add('show'); };
  $('btnCloseSettings').onclick = () => $('settingsModal').classList.remove('show');
  $('setTheme').onchange = (e) => Settings.set('theme', e.target.value);
  $('setAutosave').onchange = (e) => Settings.set('autosave', e.target.checked);
  $('setWarn').onchange = (e) => Settings.set('warn', e.target.checked);
  $('btnMnhrSave').onclick = downloadMnhr;
  $('btnMnhrCopy').onclick = copyMnhr;
  $('btnMnhrLoad').onclick = async () => {
    const f = await pickFiles({ accept: '*/*' });
    if (f[0]) importMnhrText(await f[0].text());
  };
  $('btnMnhrPaste').onclick = async () => {
    let t = $('mnhrPaste').value;
    if (!t.trim()) { try { t = await navigator.clipboard.readText(); } catch (e) {} }
    if (!t || !t.trim()) { toast('Chưa có nội dung — dán vào ô rồi bấm lại', 'err', 3500); return; }
    importMnhrText(t);
  };
  setInterval(() => { if (Settings.get().autosave && State.dirty && !State.playing) saveProject(true); }, 30000);
}

/* ============================================================
   MENU NHẠC NỀN
   ============================================================ */
let bgmPrev = null;
function stopBgmPreview() { if (bgmPrev) { try { bgmPrev.a.pause(); } catch (e) {} bgmPrev = null; } }
async function importBgm() {
  const f = await pickFiles({ accept: 'audio/*,.mp3,.ogg,.wav,.m4a' });
  if (!f[0]) return;
  if (f[0].size > 12e6 && !confirm('File nhạc lớn (' + fmtSize(f[0].size) + '). Vẫn import?')) return;
  const url = await readAsDataURL(f[0]);
  if (!url) { toast('Không đọc được file nhạc', 'err'); return; }
  State.music.tracks.push(makeTrack({ name: f[0].name.replace(/\.[^.]+$/, ''), url }));
  renderBgmList(); scheduleSave();
}
function renderBgmList() {
  const box = document.getElementById('bgmList'); box.innerHTML = '';
  if (!State.music.tracks.length) box.appendChild(el('div', 'empty', 'Chưa có nhạc nào.'));
  State.music.tracks.forEach((t, i) => {
    const c = el('div'); c.style.cssText = 'border:1px solid #262d3f;padding:8px;margin-bottom:8px;';
    c.appendChild(row('Tên', textInput(t.name, v => { t.name = v; scheduleSave(); })));
    c.appendChild(row('Âm lượng (%)', numInput(Math.round(t.volume * 100), v => { t.volume = clamp(v, 0, 100) / 100; scheduleSave(); }, 5, 0, 100)));
    c.appendChild(row('Bắt đầu khi', selectInput(t.startOn, [['menu', 'Hiện Main Menu'], ['start', 'Bắt đầu chơi'], ['death', 'Người chơi chết']], v => { t.startOn = v; scheduleSave(); })));
    c.appendChild(row('Trễ (giây)', numInput(t.delay, v => { t.delay = Math.max(0, v); scheduleSave(); }, 0.5, 0)));
    c.appendChild(row('Lặp', selectInput(t.loop, [['infinite', 'Vô hạn'], ['count', 'Số lần']], v => { t.loop = v; scheduleSave(); renderBgmList(); })));
    if (t.loop === 'count') c.appendChild(row('Số lần', numInput(t.loopCount, v => { t.loopCount = Math.max(1, Math.round(v)); scheduleSave(); }, 1, 1)));
    c.appendChild(row('Kết thúc', selectInput(t.stopMode, [['never', 'Không tự dừng'], ['afterSec', 'Sau N giây'], ['onPlay', 'Khi bắt đầu chơi'], ['onDeath', 'Khi người chơi chết']], v => { t.stopMode = v; scheduleSave(); renderBgmList(); })));
    if (t.stopMode === 'afterSec') c.appendChild(row('Sau (giây)', numInput(t.stopAfter, v => { t.stopAfter = Math.max(0.1, v); scheduleSave(); }, 1, 0.1)));
    c.appendChild(row('Fade in (s)', numInput(t.fadeIn, v => { t.fadeIn = Math.max(0, v); scheduleSave(); }, 0.5, 0)));
    c.appendChild(row('Fade out (s)', numInput(t.fadeOut, v => { t.fadeOut = Math.max(0, v); scheduleSave(); }, 0.5, 0)));
    const bar = el('div'); bar.style.cssText = 'display:flex;gap:6px;margin-top:6px;';
    const pv = el('button', 'btn-mini', 'Nghe thử');
    pv.onclick = () => {
      const same = bgmPrev && bgmPrev.t === t; stopBgmPreview(); if (same) return;
      const a = new Audio(t.url); a.volume = t.volume;
      const p = a.play(); if (p && p.catch) p.catch(() => toast('Không phát được file này', 'err'));
      bgmPrev = { a, t };
    };
    const dl = el('button', 'btn-mini danger', 'Xoá');
    dl.onclick = () => { if (confirm('Xoá nhạc "' + t.name + '"?')) { stopBgmPreview(); State.music.tracks.splice(i, 1); renderBgmList(); scheduleSave(); } };
    bar.appendChild(pv); bar.appendChild(dl); c.appendChild(bar);
    box.appendChild(c);
  });
}
function openBgmModal() {
  let m = document.getElementById('bgmModal');
  if (!m) {
    m = document.createElement('div'); m.id = 'bgmModal'; m.className = 'modal';
    m.innerHTML = '<div class="modal-box" style="max-width:560px;"><h3>Nhạc nền</h3><p>Import nhạc, chọn lúc phát, lặp và lúc kết thúc. Nhạc phát khi bấm Chạy và trong game xuất ra (assets/audio).</p><div id="bgmList"></div><div class="modal-actions"><button id="btnBgmAdd" class="btn primary">＋ Import nhạc</button><button id="btnBgmClose" class="btn">Đóng</button></div></div>';
    document.body.appendChild(m);
    document.getElementById('btnBgmClose').onclick = () => { stopBgmPreview(); m.classList.remove('show'); };
    document.getElementById('btnBgmAdd').onclick = importBgm;
  }
  renderBgmList(); m.classList.add('show');
}
/* ============================================================
   ANIMATION KỸ THUẬT (khối): dữ liệu + menu + preview
   ============================================================ */
const TA_EASE = [['linear', 'Đều'], ['out', 'Chậm dần'], ['in', 'Nhanh dần'], ['inout', 'Chậm - nhanh - chậm'], ['back', 'Vọt rồi về'], ['bounce', 'Nảy'], ['elastic', 'Đàn hồi'], ['bezier', 'Tự chỉnh (2 điểm điều khiển)']];
const TA_PROPS = [['x', 'Vị trí X', 1], ['y', 'Vị trí Y', 1], ['rot', 'Xoay (độ)', 1], ['sx', 'Rộng (nhân)', 0.05], ['sy', 'Cao (nhân)', 0.05], ['alpha', 'Độ mờ (0-1)', 0.05]];
const TA_ACTIONS = [['shake', 'Rung màn hình'], ['customAnim', 'Phát animation tuỳ chỉnh của khối'], ['signal', 'Gửi tín hiệu (cho nhân vật / khối)'], ['solid', 'Bật/tắt va chạm (rắn)'],
  ['hazard', 'Bật/tắt gây sát thương'], ['visible', 'Hiện/ẩn khối'], ['var', 'Đổi biến game'], ['startBlock', 'Chạy animation của khối khác'], ['stopAnim', 'Dừng chuỗi này']];
const taUI = { item: null, t: 0, playing: false, last: 0, sel: null };
function newTechAnim() {
  return { enabled: true, trigger: { type: 'start', name: '', button: '', cond: { var: '', op: '>=', value: '1' } }, repeat: 'none', count: 0,
    once: false, retrigger: 'ignore', space: 'rel', steps: [], rules: [] };
}
function newTechStep(ta, it) {
  const last = ta.steps[ta.steps.length - 1];
  return { id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: 'Bước ' + (ta.steps.length + 1), dur: 1,
    after: { ref: last ? last.id : 'start', mode: 'end', delay: 0 },
    props: { x: { on: true, from: ta.space === 'abs' ? it.x : 0, to: ta.space === 'abs' ? it.x + 100 : 100 } }, ease: 'linear', bez: [0.25, 0.1, 0.25, 1] };
}
function sanitizeTech(t) {
  if (!t || typeof t !== 'object') return null;
  const num = (v, d) => isFinite(+v) ? +v : d;
  const out = newTechAnim(), tg = t.trigger || {};
  out.enabled = t.enabled !== false;
  out.trigger = { type: ['start', 'touch', 'signal', 'button', 'var'].indexOf(tg.type) >= 0 ? tg.type : 'start', name: String(tg.name || ''), button: String(tg.button || ''),
    cond: { var: String((tg.cond && tg.cond.var) || ''), op: String((tg.cond && tg.cond.op) || '>='), value: String(tg.cond && tg.cond.value != null ? tg.cond.value : '1') } };
  out.repeat = ['none', 'loop', 'pingpong'].indexOf(t.repeat) >= 0 ? t.repeat : 'none';
  out.count = Math.max(0, Math.round(num(t.count, 0)));
  out.once = !!t.once; out.retrigger = t.retrigger === 'restart' ? 'restart' : 'ignore'; out.space = t.space === 'abs' ? 'abs' : 'rel';
  const ids = {};
  out.steps = (Array.isArray(t.steps) ? t.steps : []).map((st, i) => {
    let id = String((st && st.id) || ('s' + i)); while (ids[id]) id += '_'; ids[id] = 1;
    const props = {};
    ['x', 'y', 'rot', 'sx', 'sy', 'alpha'].forEach(k => {
      const p = st && st.props && st.props[k];
      if (p && p.on) props[k] = { on: true, from: (p.from === null || p.from === undefined || p.from === '') ? null : num(p.from, 0), to: num(p.to, 0) };
    });
    const a = (st && st.after) || {};
    return { id, name: String((st && st.name) || ('Bước ' + (i + 1))), dur: Math.max(0, num(st && st.dur, 1)),
      after: { ref: a.ref ? String(a.ref) : 'start', mode: a.mode === 'start' ? 'start' : 'end', delay: Math.max(0, num(a.delay, 0)) },
      props, ease: TA_EASE.some(e => e[0] === (st && st.ease)) ? st.ease : 'linear',
      bez: (st && Array.isArray(st.bez) && st.bez.length === 4) ? st.bez.map(v => num(v, 0)) : [0.25, 0.1, 0.25, 1] };
  });
  out.rules = (Array.isArray(t.rules) ? t.rules : []).map((r, i) => ({ id: String((r && r.id) || ('r' + i)), step: String((r && r.step) || ''),
    when: (r && r.when === 'start') ? 'start' : 'end', delay: Math.max(0, num(r && r.delay, 0)), action: String((r && r.action) || 'shake'), params: Object.assign({}, (r && r.params) || {}) }));
  return out;
}
function taTotal() { return Math.max(0.01, RT.techSchedule(taUI.item.techAnim).total); }
function taStep(id) { return taUI.item.techAnim.steps.find(x => x.id === id) || null; }

function taDraw() {
  const cv = document.getElementById('taPrev'); if (!cv || !taUI.item) return;
  const it = taUI.item, ta = it.techAnim, g = cv.getContext('2d');
  const sched = RT.techSchedule(ta), T = Math.max(0.01, sched.total);
  let x0 = it.x - it.w / 2, y0 = it.y - it.h / 2, x1 = it.x + it.w / 2, y1 = it.y + it.h / 2;
  const path = [];
  for (let i = 0; i <= 60; i++) {
    const xf = RT.evalTech(it, ta, T * i / 60, sched);
    path.push([it.x + xf.dx, it.y + xf.dy]);
    for (const b of RT.blockBoxes(it, xf)) { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
  }
  const mx = Math.max(40, (x1 - x0) * 0.15), my = Math.max(40, (y1 - y0) * 0.15);
  x0 -= mx; x1 += mx; y0 -= my; y1 += my;
  const W = cv.width, H = cv.height, sc = Math.min(W / (x1 - x0), H / (y1 - y0));
  const ox = (W - (x1 - x0) * sc) / 2 - x0 * sc, oy = (H - (y1 - y0) * sc) / 2 - y0 * sc;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0f1115'; g.fillRect(0, 0, W, H);
  g.setTransform(sc, 0, 0, sc, ox, oy);
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1 / sc; g.beginPath();
  for (let x = Math.floor(x0 / 50) * 50; x <= x1; x += 50) { g.moveTo(x, y0); g.lineTo(x, y1); }
  for (let y = Math.floor(y0 / 50) * 50; y <= y1; y += 50) { g.moveTo(x0, y); g.lineTo(x1, y); }
  g.stroke();
  for (const o of State.items) {
    if (o === it) continue;
    g.fillStyle = o.kind === 'block' ? 'rgba(130,140,160,.28)' : 'rgba(111,168,90,.35)';
    g.fillRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h);
  }
  g.setLineDash([6 / sc, 5 / sc]); g.strokeStyle = 'rgba(255,184,107,.85)'; g.lineWidth = 1.5 / sc; g.beginPath();
  path.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.setLineDash([]);
  g.font = (11 / sc) + 'px sans-serif';
  ta.steps.forEach((st, i) => {
    const a = RT.evalTech(it, ta, sched.S[st.id], sched), b2 = RT.evalTech(it, ta, sched.S[st.id] + st.dur, sched);
    [[a, 'A', '#7fbf63'], [b2, 'B', '#e0a030']].forEach(m => {
      g.fillStyle = m[2]; g.beginPath(); g.arc(it.x + m[0].dx, it.y + m[0].dy, 4 / sc, 0, 7); g.fill();
      g.fillText((i + 1) + m[1], it.x + m[0].dx + 6 / sc, it.y + m[0].dy - 6 / sc);
    });
  });
  const xf = RT.evalTech(it, ta, taUI.t, sched);
  g.save(); g.globalAlpha = xf.alpha; g.translate(it.x + xf.dx, it.y + xf.dy); g.rotate(xf.rot); g.scale(xf.sx, xf.sy);
  const fr = it.animations && it.animations.default && it.animations.default.frames[0];
  const img = (fr && fr.img) || (it.tex && it.tex.all && it.tex.all.img);
  if (img && img.complete !== false) g.drawImage(img, -it.w / 2, -it.h / 2, it.w, it.h);
  else { g.fillStyle = '#6c7a99'; g.fillRect(-it.w / 2, -it.h / 2, it.w, it.h); }
  g.restore();
  g.strokeStyle = '#7fbf63'; g.lineWidth = 1.5 / sc;
  for (const b of RT.blockBoxes(it, xf)) {
    const p = b.poly || [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
    g.beginPath(); p.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.stroke();
  }
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fff'; g.font = '13px sans-serif';
  g.fillText('t = ' + taUI.t.toFixed(2) + 's / ' + T.toFixed(2) + 's   (khung xanh = hitbox)', 8, 16);
}
function taLoop(ts) {
  const m = document.getElementById('taModal');
  if (!taUI.playing || !m || !m.classList.contains('show')) { taUI.playing = false; return; }
  const dt = Math.min(0.1, (ts - taUI.last) / 1000); taUI.last = ts;
  const T = taTotal(); taUI.t += dt; if (taUI.t > T) taUI.t = 0;
  const sk = document.getElementById('taSeek'); if (sk) sk.value = String(Math.round(taUI.t / T * 1000));
  taDraw(); requestAnimationFrame(taLoop);
}
function taCurve(cv, st) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.fillStyle = '#0f1115'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,.15)'; g.strokeRect(10, 10, W - 20, H - 20);
  g.strokeStyle = '#e0a030'; g.lineWidth = 2; g.beginPath();
  for (let i = 0; i <= 60; i++) {
    const u = i / 60, v = RT.easeFn(st, u), x = 10 + u * (W - 20), y = H - 10 - Math.max(-0.5, Math.min(1.5, v)) * (H - 20);
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
}
function taDefaultTo(key, ta, it) {
  if (key === 'x') return ta.space === 'abs' ? it.x + 100 : 100;
  if (key === 'y') return ta.space === 'abs' ? it.y - 100 : -100;
  if (key === 'rot') return 90;
  if (key === 'alpha') return 0;
  return 1;
}
function taStepForm(st, ta, it, box) {
  const order = ta.steps.indexOf(st);
  box.appendChild(row('Tên', textInput(st.name, v => { st.name = v; taRefreshList(); })));
  box.appendChild(row('Thời gian chạy (s)', numInput(st.dur, v => { st.dur = Math.max(0, v); taRefreshAll(); }, 0.1, 0)));
  const others = ta.steps.filter(x => x !== st).map(x => [x.id, x.name]);
  box.appendChild(row('Bắt đầu', selectInput(st.after.ref, [['start', 'Lúc kích hoạt chuỗi']].concat(others), v => { st.after.ref = v; taRender(); })));
  if (st.after.ref !== 'start') box.appendChild(row('…khi bước đó', selectInput(st.after.mode, [['end', 'KẾT THÚC'], ['start', 'BẮT ĐẦU']], v => { st.after.mode = v; taRefreshAll(); })));
  box.appendChild(row('Sau thêm (giây)', numInput(st.after.delay, v => { st.after.delay = Math.max(0, v); taRefreshAll(); }, 0.1, 0)));
  box.appendChild(el('div', 'ev-hint', 'Thuộc tính cần đổi: tích để bật. "Từ" để trống = tiếp nối giá trị hiện tại.' + (ta.space === 'abs' ? ' (Toạ độ tuyệt đối)' : ' (Cộng thêm vào vị trí khối)')));
  TA_PROPS.forEach(pp => {
    const key = pp[0], p = st.props[key];
    const r = el('div', 'row'); r.appendChild(el('span', null, pp[1]));
    const w = el('div'); w.style.cssText = 'display:flex;gap:4px;align-items:center;';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!(p && p.on); cb.style.cssText = 'width:18px;height:18px;';
    cb.onchange = () => {
      if (cb.checked) { st.props[key] = st.props[key] || { on: true, from: null, to: taDefaultTo(key, ta, it) }; st.props[key].on = true; }
      else if (st.props[key]) delete st.props[key];
      taRender(); scheduleSave();
    };
    w.appendChild(cb);
    if (p && p.on) {
      const fr = document.createElement('input'); fr.type = 'text'; fr.className = 'inp'; fr.placeholder = 'tiếp nối'; fr.style.width = '78px';
      fr.value = p.from != null ? String(p.from) : '';
      fr.oninput = () => { p.from = (fr.value.trim() === '' || !isFinite(+fr.value)) ? null : +fr.value; taRefreshAll(); scheduleSave(); };
      const to = document.createElement('input'); to.type = 'number'; to.className = 'inp'; to.step = String(pp[2]); to.style.width = '78px'; to.value = p.to;
      to.oninput = () => { p.to = isFinite(parseFloat(to.value)) ? parseFloat(to.value) : 0; taRefreshAll(); scheduleSave(); };
      w.appendChild(el('span', null, 'từ')); w.appendChild(fr); w.appendChild(el('span', null, 'đến')); w.appendChild(to);
    }
    r.appendChild(w); box.appendChild(r);
  });
  box.appendChild(row('Đường cong', selectInput(st.ease, TA_EASE, v => { st.ease = v; taRender(); })));
  if (st.ease === 'bezier') {
    ['x1', 'y1', 'x2', 'y2'].forEach((lb, i) => box.appendChild(row('Điểm ' + lb, numInput(st.bez[i], v => { st.bez[i] = (i % 2 === 0) ? Math.max(0, Math.min(1, v)) : v; taCurveRefresh(st); taDraw(); }, 0.05))));
  }
  const cv = document.createElement('canvas'); cv.width = 240; cv.height = 110; cv.id = 'taCurve'; cv.style.cssText = 'width:240px;max-width:100%;display:block;margin:4px 0;';
  box.appendChild(cv); taCurve(cv, st);
  const bar = el('div'); bar.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin:6px 0;';
  const up = el('button', 'btn-mini', 'Lên'); up.onclick = () => { if (order > 0) { ta.steps.splice(order, 1); ta.steps.splice(order - 1, 0, st); taRender(); scheduleSave(); } };
  const dn = el('button', 'btn-mini', 'Xuống'); dn.onclick = () => { if (order < ta.steps.length - 1) { ta.steps.splice(order, 1); ta.steps.splice(order + 1, 0, st); taRender(); scheduleSave(); } };
  const dp = el('button', 'btn-mini', 'Nhân bản');
  dp.onclick = () => { const c = JSON.parse(JSON.stringify(st)); c.id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); c.name = st.name + ' (copy)'; ta.steps.splice(order + 1, 0, c); taUI.sel = c.id; taRender(); scheduleSave(); };
  const dl = el('button', 'btn-mini danger', 'Xoá bước');
  dl.onclick = () => {
    if (!confirm('Xoá "' + st.name + '"? Các bước/hành động nối vào nó sẽ bị gỡ liên kết.')) return;
    ta.steps.splice(order, 1);
    ta.steps.forEach(x => { if (x.after.ref === st.id) x.after.ref = 'start'; });
    ta.rules = ta.rules.filter(r => r.step !== st.id);
    taUI.sel = ta.steps[0] ? ta.steps[0].id : null; taRender(); scheduleSave();
  };
  [up, dn, dp, dl].forEach(b => bar.appendChild(b)); box.appendChild(bar);
}
function taCurveRefresh(st) { const cv = document.getElementById('taCurve'); if (cv) taCurve(cv, st); }
function taRuleParams(r, ta, it, box) {
  const p = r.params;
  switch (r.action) {
    case 'shake':
      if (p.level == null) p.level = 5; if (p.dur == null) p.dur = 0.5;
      box.appendChild(row('Cấp độ (1-10)', numInput(p.level, v => p.level = Math.max(1, Math.min(10, v)), 1, 1, 10)));
      box.appendChild(row('Thời gian (s)', numInput(p.dur, v => p.dur = Math.max(0.1, v), 0.1, 0.1)));
      break;
    case 'customAnim': {
      const names = Object.keys(it.animations).filter(k => k.indexOf('custom:') === 0).map(k => [k.slice(7), k.slice(7)]);
      if (!p.mode) p.mode = 'once';
      if (!names.length) box.appendChild(el('div', 'ev-hint', 'Khối chưa có animation tuỳ chỉnh (tạo ở Inspector của khối).'));
      else { if (!names.some(n => n[0] === p.name)) p.name = names[0][0]; box.appendChild(row('Animation', selectInput(p.name, names, v => p.name = v))); }
      box.appendChild(row('Kiểu', selectInput(p.mode, [['once', 'Chạy 1 lần'], ['loop', 'Lặp'], ['stop', 'Dừng']], v => p.mode = v)));
      break;
    }
    case 'signal':
      box.appendChild(row('Tên tín hiệu', textInput(p.name || '', v => p.name = v.replace(/[^A-Za-z0-9_]/g, ''))));
      box.appendChild(row('Gửi cho', selectInput(p.to || 'all', [['all', 'Tất cả']].concat(targetOptions(false)), v => p.to = v)));
      break;
    case 'solid': case 'hazard': case 'visible':
      if (!p.value) p.value = 'off';
      box.appendChild(row('Giá trị', selectInput(p.value, [['on', 'Bật'], ['off', 'Tắt'], ['toggle', 'Đảo']], v => p.value = v)));
      break;
    case 'var': {
      const names = (State.varDefs || []).map(d => [d.name, d.name]);
      box.appendChild(row('Biến', names.length ? selectInput(p.name || names[0][0], names, v => p.name = v) : textInput(p.name || '', v => p.name = v)));
      if (names.length && !p.name) p.name = names[0][0];
      box.appendChild(row('Kiểu', selectInput(p.mode || 'set', [['set', 'Gán ='], ['add', 'Cộng +']], v => p.mode = v)));
      box.appendChild(row('Giá trị', textInput(p.value != null ? p.value : '1', v => p.value = v)));
      break;
    }
    case 'startBlock': {
      const bl = State.items.filter(x => x.kind === 'block' && x !== it).map(x => [x.id, x.name]);
      if (!bl.length) box.appendChild(el('div', 'ev-hint', 'Chưa có khối nào khác.'));
      else { if (!bl.some(b => b[0] === p.target)) p.target = bl[0][0]; box.appendChild(row('Khối', selectInput(p.target, bl, v => p.target = v))); }
      break;
    }
  }
}
function taRefreshList() { if (taUI.item) taRender(); }
function taRefreshAll() { taDraw(); const inf = document.getElementById('taInfo'); if (inf) taInfo(inf); const sk = document.getElementById('taSeek'); if (sk) sk.max = '1000'; }
function taInfo(box) {
  const ta = taUI.item.techAnim, sc = RT.techSchedule(ta), warn = [];
  if (sc.cyc) warn.push('Có bước nối vòng tròn (A chờ B, B chờ A) — hãy đổi lại.');
  ta.steps.forEach(st => {
    if (st.after.ref !== 'start' && !ta.steps.some(x => x.id === st.after.ref)) warn.push('"' + st.name + '" nối vào bước không tồn tại.');
    if (!Object.keys(st.props).length) warn.push('"' + st.name + '" chưa chọn thuộc tính nào để đổi.');
  });
  ta.rules.forEach((r, i) => { if (!ta.steps.some(x => x.id === r.step)) warn.push('Hành động #' + (i + 1) + ' trỏ tới bước không tồn tại.'); });
  box.textContent = 'Tổng thời gian chuỗi: ' + sc.total.toFixed(2) + 's' + (warn.length ? ' · CẢNH BÁO: ' + warn.join(' ') : '');
  box.style.color = warn.length ? '#e08a4c' : '';
}
function taRender() {
  const it = taUI.item, ta = it.techAnim, body = document.getElementById('taBody');
  if (!body) return;
  body.innerHTML = '';
  const add = (n) => body.appendChild(n);
  add(sectionHeader('Kích hoạt chuỗi'));
  add(row('Bật animation', checkbox(ta.enabled, v => ta.enabled = v)));
  add(row('Kiểu kích hoạt', selectInput(ta.trigger.type, [['start', 'Khi bắt đầu game'], ['touch', 'Khi người chơi chạm khối'], ['signal', 'Khi nhận tín hiệu'], ['button', 'Khi nhấn nút UI'], ['var', 'Khi biến thoả điều kiện']], v => { ta.trigger.type = v; taRender(); })));
  if (ta.trigger.type === 'signal') add(row('Tên tín hiệu', textInput(ta.trigger.name, v => ta.trigger.name = v.replace(/[^A-Za-z0-9_]/g, ''))));
  if (ta.trigger.type === 'button') {
    const btns = State.ui.buttons || [];
    if (!btns.length) add(el('div', 'ev-hint', 'Chưa có nút tuỳ chỉnh. Tạo ở tab UI.'));
    else { if (!btns.some(b => b.id === ta.trigger.button)) ta.trigger.button = btns[0].id; add(row('Nút', selectInput(ta.trigger.button, btns.map(b => [b.id, (b.label || 'Nút') + ' (' + b.key + ')']), v => ta.trigger.button = v))); }
  }
  if (ta.trigger.type === 'var') {
    const names = (State.varDefs || []).map(d => [d.name, d.name]);
    add(row('Biến', names.length ? selectInput(ta.trigger.cond.var || names[0][0], names, v => ta.trigger.cond.var = v) : textInput(ta.trigger.cond.var, v => ta.trigger.cond.var = v)));
    if (names.length && !ta.trigger.cond.var) ta.trigger.cond.var = names[0][0];
    add(row('Điều kiện', selectInput(ta.trigger.cond.op, [['==', '='], ['!=', '≠'], ['>', '>'], ['>=', '≥'], ['<', '<'], ['<=', '≤']], v => ta.trigger.cond.op = v)));
    add(row('Giá trị', textInput(ta.trigger.cond.value, v => ta.trigger.cond.value = v)));
  }
  add(row('Chỉ chạy 1 lần', checkbox(ta.once, v => ta.once = v)));
  add(row('Nếu kích hoạt lại', selectInput(ta.retrigger, [['ignore', 'Bỏ qua khi đang chạy'], ['restart', 'Chạy lại từ đầu']], v => ta.retrigger = v)));
  add(sectionHeader('Lặp & toạ độ'));
  add(row('Lặp', selectInput(ta.repeat, [['none', 'Chạy 1 lần'], ['loop', 'Lặp lại'], ['pingpong', 'Đi rồi quay về (ping-pong)']], v => { ta.repeat = v; taRender(); })));
  if (ta.repeat !== 'none') add(row('Số lần (0 = vô hạn)', numInput(ta.count, v => ta.count = Math.max(0, Math.round(v)), 1, 0)));
  add(row('Toạ độ', selectInput(ta.space, [['rel', 'Tương đối (cộng vào vị trí khối)'], ['abs', 'Tuyệt đối (toạ độ thế giới)']], v => {
    if (v !== ta.space) {   // đổi hệ toạ độ: quy đổi các giá trị X, Y đã nhập
      const k = v === 'abs' ? 1 : -1;
      ta.steps.forEach(st => { ['x', 'y'].forEach(ax => { const p = st.props[ax]; if (!p) return; const off = ax === 'x' ? it.x : it.y; if (p.from != null) p.from += k * off; p.to += k * off; }); });
      ta.space = v; taRender(); taDraw();
    }
  })));
  add(sectionHeader('Các bước animation (' + ta.steps.length + ')'));
  const sc = RT.techSchedule(ta);
  ta.steps.forEach((st, i) => {
    const c = el('div'); c.style.cssText = 'border:1px solid ' + (taUI.sel === st.id ? '#e0a030' : '#2e3648') + ';padding:6px;margin-bottom:4px;cursor:pointer;';
    c.textContent = (i + 1) + '. ' + st.name + ' · bắt đầu ' + sc.S[st.id].toFixed(2) + 's · dài ' + st.dur + 's';
    c.onclick = () => { taUI.sel = st.id; taRender(); };
    add(c);
  });
  const addS = el('button', 'btn accent full', '＋ Thêm bước');
  addS.onclick = () => { const st = newTechStep(ta, it); ta.steps.push(st); taUI.sel = st.id; taRender(); scheduleSave(); };
  add(addS);
  const cur = taStep(taUI.sel) || ta.steps[0];
  if (cur) { taUI.sel = cur.id; const box = el('div'); box.style.cssText = 'border:1px solid #e0a030;padding:8px;margin:6px 0;'; box.appendChild(sectionHeader('Chỉnh: ' + cur.name)); taStepForm(cur, ta, it, box); add(box); }
  add(sectionHeader('Biến / Hành động theo bước'));
  ta.rules.forEach((r, i) => {
    const c = el('div'); c.style.cssText = 'border:1px solid #2e3648;padding:6px;margin-bottom:6px;';
    c.appendChild(row('Khi bước', selectInput(r.step, ta.steps.map(x => [x.id, x.name]), v => { r.step = v; taRefreshAll(); })));
    c.appendChild(row('Thời điểm', selectInput(r.when, [['end', 'KẾT THÚC'], ['start', 'BẮT ĐẦU']], v => { r.when = v; taRefreshAll(); })));
    c.appendChild(row('Sau thêm (giây)', numInput(r.delay, v => { r.delay = Math.max(0, v); taRefreshAll(); }, 0.1, 0)));
    c.appendChild(row('Thì', selectInput(r.action, TA_ACTIONS, v => { r.action = v; r.params = {}; taRender(); })));
    taRuleParams(r, ta, it, c);
    const dl = el('button', 'btn-mini danger', 'Xoá hành động'); dl.onclick = () => { ta.rules.splice(i, 1); taRender(); scheduleSave(); };
    c.appendChild(dl); add(c);
  });
  const addR = el('button', 'btn full', '＋ Thêm hành động');
  addR.onclick = () => { if (!ta.steps.length) { toast('Hãy tạo ít nhất 1 bước trước', 'err'); return; } ta.rules.push({ id: 'r' + Date.now().toString(36), step: (taStep(taUI.sel) || ta.steps[0]).id, when: 'end', delay: 0, action: 'shake', params: { level: 5, dur: 0.5 } }); taRender(); scheduleSave(); };
  add(addR);
  const inf = el('div', 'ev-hint'); inf.id = 'taInfo'; add(inf); taInfo(inf);
  const sk = document.getElementById('taSeek'); if (sk) sk.value = String(Math.round(Math.min(1, taUI.t / taTotal()) * 1000));
  taDraw();
}
function openTechModal(item) {
  if (!item.techAnim) item.techAnim = newTechAnim();
  taUI.item = item; taUI.t = 0; taUI.playing = false; taUI.sel = item.techAnim.steps[0] ? item.techAnim.steps[0].id : null;
  let m = document.getElementById('taModal');
  if (!m) {
    m = document.createElement('div'); m.id = 'taModal'; m.className = 'modal';
    m.innerHTML = '<div class="modal-box" style="max-width:760px;max-height:94vh;overflow:auto;"><h3>Animation Kỹ Thuật</h3>' +
      '<div style="position:sticky;top:0;z-index:3;background:#14161c;padding-bottom:6px;"><canvas id="taPrev" width="720" height="300" style="width:100%;display:block;"></canvas>' +
      '<div style="display:flex;gap:8px;align-items:center;margin-top:6px;"><button id="taPlay" class="btn primary">Phát</button><input id="taSeek" type="range" min="0" max="1000" value="0" style="flex:1;"></div></div>' +
      '<div id="taBody"></div><div class="modal-actions"><button id="btnTaClose" class="btn primary">Xong</button></div></div>';
    document.body.appendChild(m);
    document.getElementById('btnTaClose').onclick = () => { taUI.playing = false; m.classList.remove('show'); renderInspector(); };
    document.getElementById('taPlay').onclick = () => {
      taUI.playing = !taUI.playing; document.getElementById('taPlay').textContent = taUI.playing ? 'Dừng' : 'Phát';
      if (taUI.playing) { taUI.last = performance.now(); requestAnimationFrame(taLoop); }
    };
    document.getElementById('taSeek').oninput = (e) => { taUI.playing = false; document.getElementById('taPlay').textContent = 'Phát'; taUI.t = taTotal() * (+e.target.value) / 1000; taDraw(); };
  }
  document.getElementById('taPlay').textContent = 'Phát';
  taRender(); m.classList.add('show');
}

function openProjectsModal() {
  const modal = document.getElementById('projectModal');
  const listEl = document.getElementById('projectList');
  listEl.innerHTML = '';
  const items = Projects.list();
  if (!items.length) listEl.appendChild(el('div', 'empty', 'Chưa có dự án nào.'));
  else for (const p of items) {
    const r = document.createElement('div');
    r.className = 'proj-item' + (p.id === State.currentProjectId ? ' active' : '');
    r.appendChild(el('div', 'pi-name', p.name));
    r.appendChild(el('div', 'pi-meta', fmtSize(p.size || 0) + ' · ' + new Date(p.updatedAt).toLocaleString('vi-VN')));
    const del = el('button', 'pi-del', '✕');
    del.onclick = async (ev) => {
      ev.stopPropagation();
      if (!confirm('Xoá dự án "' + p.name + '"?')) return;
      try {
        await Projects.remove(p.id);
        if (p.id === State.currentProjectId) {
          State.dirty = false;
          await loadProject(Projects.list()[0] || await Projects.create('Dự án mới'));
        }
        toast('Đã xoá dự án', 'ok');
      } catch (e) { toast('Xoá thất bại: ' + ((e && e.message) || e), 'err'); }
      openProjectsModal();
    };
    r.appendChild(del);
    r.onclick = async () => {
      if (p.id === State.currentProjectId) { modal.classList.remove('show'); return; }
      if (!(await guardDirty())) return;
      await loadProject(p);
      modal.classList.remove('show');
      toast('Đã mở: ' + p.name, 'ok');
    };
    listEl.appendChild(r);
  }
  const oldRb = document.getElementById('projResBox'); if (oldRb) oldRb.remove();
  const rb = document.createElement('div'); rb.id = 'projResBox';
  rb.style.cssText = 'margin-top:10px;padding-top:8px;border-top:1px dashed #262d3f;';
  rb.appendChild(sectionHeader('Cài đặt dự án (khi xuất game)'));
  rb.appendChild(row('Độ phân giải', selectInput(String(State.res.scale), [['1', '640x360 (1x)'], ['2', '1280x720 (2x)'], ['3', '1920x1080 (3x)'], ['4', '2560x1440 (4x)']], v => { State.res.scale = +v; scheduleSave(); })));
  rb.appendChild(row('Pixel art (không làm mịn ảnh)', checkbox(!!State.res.pixel, v => { State.res.pixel = v; scheduleSave(); })));
  rb.appendChild(row('Animation lật nhân vật khi đổi hướng', checkbox(!!State.opts.turnAnim, v => { State.opts.turnAnim = v; scheduleSave(); })));
  const mb = el('button', 'btn accent full', 'Nhạc nền (' + State.music.tracks.length + ')');
  mb.style.marginTop = '6px';
  mb.onclick = () => { modal.classList.remove('show'); openBgmModal(); };
  rb.appendChild(mb);
  const box = modal.querySelector('.modal-box');
  box.insertBefore(rb, box.querySelector('.modal-actions'));
  modal.classList.add('show');
}

/* ============================================================
   EXPORTER
   ============================================================ */
const Exporter = (function () {
  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function makeZip(files) {
    const enc = new TextEncoder();
    const entries = [], parts = [];
    let offset = 0;
    for (const name in files) {
      const nameBytes = enc.encode(name);
      const dataBytes = typeof files[name] === 'string' ? enc.encode(files[name]) : files[name];
      const crc = crc32(dataBytes);
      const size = dataBytes.length;
      const lfh = new Uint8Array(30 + nameBytes.length);
      const dv = new DataView(lfh.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true);
      dv.setUint16(6, 0, true); dv.setUint16(8, 0, true);
      dv.setUint16(10, 0, true); dv.setUint16(12, 0, true);
      dv.setUint32(14, crc, true); dv.setUint32(18, size, true); dv.setUint32(22, size, true);
      dv.setUint16(26, nameBytes.length, true); dv.setUint16(28, 0, true);
      lfh.set(nameBytes, 30);
      entries.push({ nameBytes, crc, size, offset });
      parts.push(lfh, dataBytes);
      offset += lfh.length + dataBytes.length;
    }
    const cdStart = offset, cdParts = [];
    for (const e of entries) {
      const cdh = new Uint8Array(46 + e.nameBytes.length);
      const dv = new DataView(cdh.buffer);
      dv.setUint32(0, 0x02014b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 20, true);
      dv.setUint16(8, 0, true); dv.setUint16(10, 0, true); dv.setUint16(12, 0, true);
      dv.setUint16(14, 0, true); dv.setUint32(16, e.crc, true);
      dv.setUint32(20, e.size, true); dv.setUint32(24, e.size, true);
      dv.setUint16(28, e.nameBytes.length, true); dv.setUint16(30, 0, true);
      dv.setUint16(32, 0, true); dv.setUint16(34, 0, true);
      dv.setUint16(36, 0, true); dv.setUint32(38, 0, true); dv.setUint32(42, e.offset, true);
      cdh.set(e.nameBytes, 46);
      cdParts.push(cdh);
      offset += cdh.length;
    }
    const eocd = new Uint8Array(22);
    const dv = new DataView(eocd.buffer);
    dv.setUint32(0, 0x06054b50, true); dv.setUint16(4, 0, true); dv.setUint16(6, 0, true);
    dv.setUint16(8, entries.length, true); dv.setUint16(10, entries.length, true);
    dv.setUint32(12, offset - cdStart, true); dv.setUint32(16, cdStart, true);
    dv.setUint16(20, 0, true);
    const total = offset + eocd.length;
    const out = new Uint8Array(total);
    let p = 0;
    for (const part of parts)   { out.set(part, p); p += part.length; }
    for (const part of cdParts) { out.set(part, p); p += part.length; }
    out.set(eocd, p);
    return out;
  }

  function buildHTML(data, customControlCode) {
    const runtimeSrc = MiniRuntime.toString();
    const safeJson = JSON.stringify(data)
      .replace(/<\/script/gi, '<\\/script')
      .replace(/<!--/g, '<\\!--');
    const customSrc = (customControlCode && customControlCode.trim())
      ? JSON.stringify(customControlCode) : '""';

    const L = [];
    L.push('<!DOCTYPE html>');
    L.push('<html lang="vi"><head>');
    L.push('<meta charset="utf-8">');
    L.push('<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">');
    L.push('<meta name="theme-color" content="#0b0d12">');
    L.push('<title>MNHR Game</title>');
    L.push('<style>');
    L.push('*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}');
    L.push('html,body{height:100%;overflow:hidden;background:#000;font-family:system-ui,sans-serif;}');
    L.push('#wrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;');
    L.push('background:#101010;}');
    L.push('canvas{display:block;background:#0e1116;touch-action:none;');
    L.push('outline:1px solid #363636;}');
    L.push('#imgCache{position:fixed;bottom:0;left:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1;}');
    L.push('</style></head><body>');
    L.push('<div id="wrap"><canvas id="c"></canvas></div>');
    L.push('<div id="imgCache"></div>');
    L.push('<script>');
    L.push(runtimeSrc);
    L.push('<\/script>');
    L.push('<script>');
    L.push('(function(){');
    L.push('var data = ' + safeJson + ';');
    L.push('var CUSTOM_SRC = ' + customSrc + ';');
    L.push('var RT = MiniRuntime();');
    L.push('var VW = RT.VW, VH = RT.VH;');
    L.push('function MF(f){return {url:f.url,img:null,hitboxes:(f.hitboxes||[]).map(function(h){return {ox:h.ox,oy:h.oy,w:h.w,h:h.h};})};}');
    L.push('var canvas = document.getElementById("c");');
    L.push('var ctx = canvas.getContext("2d");');
    L.push('var RES = Math.max(1, Math.min(4, Math.round((data.res && data.res.scale) || 1)));');
    L.push('canvas.width = VW*RES; canvas.height = VH*RES;');
    L.push('if (data.res && data.res.pixel) canvas.style.imageRendering = "pixelated";');
    L.push('var imgCache = document.getElementById("imgCache");');
    L.push('function fit(){var s=Math.min(window.innerWidth/VW,window.innerHeight/VH);');
    L.push('canvas.style.width=Math.floor(VW*s)+"px";canvas.style.height=Math.floor(VH*s)+"px";}');
    L.push('window.addEventListener("resize",fit);');
    L.push('window.addEventListener("orientationchange",function(){setTimeout(fit,250);});');
    L.push('fit();');

    L.push('var state = { items: [], playing: true, keys: {}, time: 0,');
    L.push('camera: {x:VW/2,y:VH/2}, projectiles: [],');
    L.push('particles: [], floatingTexts: [], vars: RT.initVars(data.varDefs||[]),');
    L.push('shakeScreen: {intensity:0, timeLeft:0, duration:0.001},');
    L.push('ui: data.ui || RT.defaultUI(), showMenu: !!(data.ui && data.ui.mainMenu && data.ui.mainMenu.enabled) };');
    L.push('state.opts = data.opts || {};');
    L.push('state.bgmCtl = RT.createBGM((data.music && data.music.tracks) || []);');
    L.push('function unlockAudio(){ state.bgmCtl.unlock(); }');
    L.push('window.addEventListener("pointerdown", unlockAudio); window.addEventListener("keydown", unlockAudio);');

    L.push('function loadImg(url, cb){if(!url) return cb(null);');
    L.push('var img = document.createElement("img");');
    L.push('img.style.cssText="position:absolute;width:1px;height:1px;";');
    L.push('imgCache.appendChild(img);');
    L.push('img.onload=function(){cb(img);};img.onerror=function(){cb(null);};img.src=url;}');

    L.push('data.items.forEach(function(d){');
    L.push('  if (d.kind === "sprite") {');
    L.push('    var animations = {};');
    L.push('    for (var k in d.animations) {');
    L.push('      var src = d.animations[k];');
    L.push('      animations[k] = src ? { fps: src.fps||8, loop: src.loop!==false,');
    L.push('        frames: (src.frames||[]).map(MF) }');
    L.push('        : { frames: [], fps: 8, loop: true };');
    L.push('    }');
    L.push('    ["idle","run","jump","hurt","die","shoot","bullet","turn"].forEach(function(k){');
    L.push('      if(!animations[k]) animations[k]={frames:[],fps:8,loop:true};});');
    L.push('    var sh = d.shoot||{};');
    L.push('    var hitboxes = (d.hitboxes||[]).map(function(h){return {ox:h.ox,oy:h.oy,w:h.w,h:h.h};});');
    L.push('    var events = (d.events||[]).map(function(e){return {');
    L.push('      id:e.id, trigger:e.trigger, triggerParams:e.triggerParams||{},');
    L.push('      delay:e.delay||0, action:e.action, actionParams:e.actionParams||{},');
    L.push('      cond:e.cond, once:!!e.once, cooldown:e.cooldown||0, chance:e.chance!=null?e.chance:100');
    L.push('    };});');
    L.push('    state.items.push({');
    L.push('      kind:"sprite", id:d.id, name:d.name,');
    L.push('      x:d.x, y:d.y, w:d.w, h:d.h,');
    L.push('      hb:d.hb, hitboxes:hitboxes, events:events,');
    L.push('      control:d.control, camera:!!d.camera, hpMode:d.hpMode||"default",');
    L.push('      animations: animations,');
    L.push('      shoot: { enabled:!!sh.enabled, dir:sh.dir||"forward",');
    L.push('        offsetX:sh.offsetX||0, offsetY:sh.offsetY||0, delay:sh.delay||0,');
    L.push('        cooldown:sh.cooldown!=null?sh.cooldown:0.3, damage:sh.damage!=null?sh.damage:10,');
    L.push('        speed:sh.speed!=null?sh.speed:8,');
    L.push('        bulletW:sh.bulletW!=null?sh.bulletW:14, bulletH:sh.bulletH!=null?sh.bulletH:14,');
    L.push('        useGravity:!!sh.useGravity,');
    L.push('        bulletGravity:sh.bulletGravity!=null?sh.bulletGravity:5 },');
    L.push('      botRange:d.botRange!=null?d.botRange:150,');
    L.push('      botPatrol:d.botPatrol!=null?d.botPatrol:80,');
    L.push('      noPush:!!d.noPush,');
    L.push('      ai:d.ai||{},');
    L.push('      speed:d.speed, jumpPower:d.jumpPower, gravity:d.gravity,');
    L.push('      hp:d.hp, maxHp:d.maxHp||d.hp, iframe:d.iframe,');
    L.push('      _vx:0,_vy:0,_onGround:false,_facing:1,_state:"idle",_invuln:0,_dead:false,');
    L.push('      _shootCd:0,_shootAnimTime:0,_pendingShots:[],_animFrame:0,_animTime:0,_prevState:"idle",');
    L.push('      _pendingActions:[],_everyTimers:{},_keyState:{},_idleFired:{},_touchSet:new Set(),');
    L.push('      _flash:null,_speedBuff:null,_gravityBuff:null,_scaleBuff:null,');
    L.push('      _startFired:false,_prevHp:null,_idleTime:0,_nearPlayer:false,');
    L.push('      _patrolOrigin:undefined,_patrolDir:1');
    L.push('    });');
    L.push('  } else {');
    L.push('    var tex = {};');
    L.push('    for (var k2 in d.tex) tex[k2] = d.tex[k2] ? {url:d.tex[k2].url, img:null} : null;');
    L.push('    var blAnims = {};');
    L.push('    for (var ak in (d.animations||{})) { var sa = d.animations[ak] || {}; blAnims[ak] = { fps: sa.fps||8, loop: sa.loop!==false, frames: (sa.frames||[]).map(MF) }; }');
    L.push('    if (!blAnims.default) blAnims.default = { frames: [], fps: 8, loop: true };');
    L.push('    var blHitboxes = (d.hitboxes||[]).map(function(h){return {ox:h.ox,oy:h.oy,w:h.w,h:h.h};});');
    L.push('    state.items.push({kind:"block", id:d.id, name:d.name,');
    L.push('      x:d.x, y:d.y, w:d.w, h:d.h, solid:d.solid, hazard:d.hazard, tex:tex,');
    L.push('      hitboxes: blHitboxes,');
    L.push('      animations: blAnims, techAnim: d.techAnim || null,');
    L.push('      _animFrame:0, _animTime:0});');
    L.push('  }');
    L.push('});');

    L.push('function loadAll(cb){');
    L.push('  var total=0, done=0;');
    L.push('  function tick(){done++;if(done>=total) cb();}');
    L.push('  state.items.forEach(function(it){');
    L.push('    if (it.kind==="sprite") {');
    L.push('      for (var k in it.animations) {');
    L.push('        var anim=it.animations[k];');
    L.push('        (function(anim2){ anim2.frames.forEach(function(f){ total++; loadImg(f.url,function(img){ f.img=img; tick(); }); }); })(anim);');
    L.push('      }');
    L.push('    } else {');
    L.push('      for (var k2 in it.tex) { if(!it.tex[k2]) continue; total++;');
    L.push('        (function(a){ loadImg(a.url,function(img){ a.img=img; tick(); }); })(it.tex[k2]); }');
    L.push('      for (var ak3 in it.animations) { (function(an3){ an3.frames.forEach(function(f){ total++; loadImg(f.url,function(img){ f.img=img; tick(); }); }); })(it.animations[ak3]); }');
    L.push('    }');
    L.push('  });');
    L.push('  if (total===0) cb();');
    L.push('}');

    L.push('var customControl = null;');
    L.push('if (CUSTOM_SRC && CUSTOM_SRC.length) {');
    L.push('  try { customControl = new Function("state","keys","dt","RT","VW","VH", CUSTOM_SRC); }');
    L.push('  catch(e){ console.error("Custom control error:", e); }');
    L.push('}');

    L.push('var pointerToBtn = new Map();');
    L.push('var joystick = { active:false, pointerId:null };');
    L.push('function getP(e){var r=canvas.getBoundingClientRect();');
    L.push('  return {x:(e.clientX-r.left)*(VW/r.width), y:(e.clientY-r.top)*(VH/r.height)};}');

    L.push('canvas.addEventListener("pointerdown", function(e){');
    L.push('  e.preventDefault();');
    L.push('  if (state.showMenu) { state.showMenu = false; state.bgmCtl.trigger("start"); return; }');
    L.push('  var p = getP(e);');
    L.push('  var key = RT.hitUIButton(p, state.ui);');
    L.push('  if (key === "__joy__") {');
    L.push('    joystick.active = true; joystick.pointerId = e.pointerId;');
    L.push('    state.keys["_joy_active"]=true; state.keys["_joy_x"]=0; state.keys["_joy_y"]=0;');
    L.push('    try { canvas.setPointerCapture(e.pointerId); } catch(_){}');
    L.push('    return;');
    L.push('  }');
    L.push('  if (key) { pointerToBtn.set(e.pointerId, key); state.keys[key]=true;');
    L.push('    try { canvas.setPointerCapture(e.pointerId); } catch(_){} }');
    L.push('});');

    L.push('canvas.addEventListener("pointermove", function(e){');
    L.push('  if (state.showMenu) return;');
    L.push('  var p = getP(e);');
    L.push('  if (joystick.active && e.pointerId === joystick.pointerId) {');
    L.push('    var L = state.ui.layout.joyBase;');
    L.push('    var dx = p.x-L.x, dy = p.y-L.y;');
    L.push('    var dist = Math.sqrt(dx*dx+dy*dy);');
    L.push('    if (dist > L.r) { dx = dx/dist*L.r; dy = dy/dist*L.r; }');
    L.push('    state.keys["_joy_x"] = dx/L.r; state.keys["_joy_y"] = dy/L.r;');
    L.push('    return;');
    L.push('  }');
    L.push('  if (!pointerToBtn.has(e.pointerId)) return;');
    L.push('  var key = pointerToBtn.get(e.pointerId);');
    L.push('  var ok = RT.hitUIButton(p, state.ui) === key;');
    L.push('  state.keys[key] = ok;');
    L.push('});');

    L.push('function up(e){');
    L.push('  if (joystick.active && e.pointerId === joystick.pointerId) {');
    L.push('    joystick.active = false; joystick.pointerId = null;');
    L.push('    state.keys["_joy_active"]=false; state.keys["_joy_x"]=0; state.keys["_joy_y"]=0;');
    L.push('    return;');
    L.push('  }');
    L.push('  var key = pointerToBtn.get(e.pointerId);');
    L.push('  if (key) { state.keys[key]=false; pointerToBtn.delete(e.pointerId); }');
    L.push('}');
    L.push('canvas.addEventListener("pointerup", up);');
    L.push('canvas.addEventListener("pointercancel", up);');
    L.push('canvas.addEventListener("contextmenu", function(e){e.preventDefault();});');

    L.push('window.addEventListener("keydown", function(e){');
    L.push('  state.keys[e.key]=true;');
    L.push('  if ([" ","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.key)>=0) e.preventDefault();');
    L.push('});');
    L.push('window.addEventListener("keyup", function(e){ state.keys[e.key]=false; });');

    L.push('var lastT = 0;');
    L.push('function loop(t){ try {');
    L.push('  if (!lastT) lastT = t;');
    L.push('  var dt = (t-lastT)/1000; lastT = t;');
    L.push('  if (dt > 0.05) dt = 0.05; if (dt < 0) dt = 0;');
    L.push('  if (!state.showMenu) {');
    L.push('    state.time += dt;');
    L.push('    RT.updateTechAnims(state, dt);');
    L.push('    if (customControl) { try { customControl(state, state.keys, dt, RT, VW, VH); } catch(e){} }');
    L.push('    for (var i=0;i<state.items.length;i++){');
    L.push('      var it = state.items[i];');
    L.push('      if (it.kind === "sprite") RT.updateItem(state, it, dt, state.keys);');
    L.push('      else if (it.kind === "block") RT.updateBlock(it, dt);');
    L.push('    }');
    L.push('    RT.updateProjectiles(state, dt);');
    L.push('    RT.updateParticles(state, dt);');
    L.push('    RT.updateFloatingTexts(state, dt);');
    L.push('    RT.updateShake(state, dt);');
    L.push('    RT.updateCamera(state, dt);');
    L.push('  } else {');
    L.push('    for (var i2=0;i2<state.items.length;i2++){');
    L.push('      var it2 = state.items[i2];');
    L.push('      if (it2.kind === "sprite") RT.updateItem(state, it2, dt, {});');
    L.push('      else if (it2.kind === "block") RT.updateBlock(it2, dt);');
    L.push('    }');
    L.push('    RT.updateParticles(state, dt);');
    L.push('    RT.updateFloatingTexts(state, dt);');
    L.push('    RT.updateShake(state, dt);');
    L.push('  }');
    L.push('  RT.updateBGM(state, dt);');
    L.push('  ctx.setTransform(RES,0,0,RES,0,0); ctx.imageSmoothingEnabled = !(data.res && data.res.pixel);');
    L.push('  RT.render(ctx, state, { editor: false });');
    L.push('  } catch(e){ if(!loop.err){ loop.err=1; console.error(e); } }');
    L.push('  requestAnimationFrame(loop);');
    L.push('}');

    L.push('loadAll(function(){ state.bgmCtl.trigger(state.showMenu?"menu":"start"); requestAnimationFrame(loop); });');
    L.push('})();');
    L.push('<\/script>');
    L.push('</body></html>');
    return L.join('\n');
  }

  const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/bmp': 'bmp',
    'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/webm': 'webm', 'audio/aac': 'aac', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/flac': 'flac' };
  function dataUrlToBytes(url) {
    const m = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(url);
    if (!m) return null;
    let bytes;
    if (m[2]) {
      const bin = atob(m[3]); bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else bytes = new TextEncoder().encode(decodeURIComponent(m[3]));
    return { mime: m[1] || '', bytes };
  }
  /* Tách mọi data-URL ra file riêng trong assets/ và thay url bằng đường dẫn tương đối */
  function extractAssets(data) {
    const out = JSON.parse(JSON.stringify(data));
    const files = {}, seen = new Map();
    let n = 0, na = 0;
    const conv = (o) => {
      if (!o || typeof o.url !== 'string' || o.url.indexOf('data:') !== 0) return;
      if (!seen.has(o.url)) {
        const d = dataUrlToBytes(o.url);
        if (!d) return;
        const isA = /^(audio|video)/.test(d.mime);
        const path = isA ? 'assets/audio/bgm_' + String(++na).padStart(3, '0') + '.' + (MIME_EXT[d.mime] || 'mp3')
                         : 'assets/images/img_' + String(++n).padStart(3, '0') + '.' + (MIME_EXT[d.mime] || 'png');
        files[path] = d.bytes; seen.set(o.url, path);
      }
      o.url = seen.get(o.url);
    };
    for (const it of out.items || []) {
      for (const k in (it.animations || {})) { const a = it.animations[k]; if (a) (a.frames || []).forEach(conv); }
      for (const k in (it.tex || {})) conv(it.tex[k]);
      if (it.shoot) conv(it.shoot);
    }
    ((out.music && out.music.tracks) || []).forEach(conv);
    return { data: out, files };
  }
  function buildPackage(data, customCode) {
    const ex = extractAssets(data);
    const html = buildHTML(ex.data, customCode);
    const previewHtml = buildHTML(data, customCode);   // bản 1 file (nhúng ảnh) để preview / copy
    const zipFiles = { 'index.html': html };
    for (const p in ex.files) zipFiles[p] = ex.files[p];
    zipFiles['README.txt'] = 'MNHR-engine game\r\n================\r\nMở index.html bằng trình duyệt để chơi.\r\nGiữ nguyên thư mục assets/ nằm cạnh index.html.\r\n';
    return { html, previewHtml, zipBytes: makeZip(zipFiles), assetCount: Object.keys(ex.files).length };
  }
  function downloadBlob(bytes, filename) {
    try {
      const blob = new Blob([bytes], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
      return true;
    } catch (e) { console.error(e); return false; }
  }
  function openInNewTab(html) {
    try {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (!w) throw new Error('Popup blocked');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return true;
    } catch (e) { console.error(e); return false; }
  }

  let _lastExport = null;
  function showResult(result, filename, dlOk) {
    _lastExport = result;
    const modal = document.getElementById('exportResultModal');
    const title = document.getElementById('exportResTitle');
    const info = document.getElementById('exportResInfo');
    const wrap = document.getElementById('resCodeWrap');
    const ta = document.getElementById('resCode');
    if (dlOk) { title.textContent = 'Xuất thành công'; title.style.color = '#7cffb0'; }
    else { title.textContent = 'Không thể tải ZIP'; title.style.color = '#ff8fa3'; }
    const sizeKB = (result.zipBytes.length / 1024).toFixed(1);
    info.innerHTML =
      '<div><b>Tên file:</b> ' + filename + '</div>' +
      '<div><b>Kích thước ZIP:</b> ' + sizeKB + ' KB</div>' +
      '<div><b>Cấu trúc:</b> index.html + assets/ (' + result.assetCount + ' file)</div>' +
      '<div><b>Trạng thái:</b> ' + (dlOk ? 'Đã gửi lệnh tải' : 'Thất bại') + '</div>';
    ta.value = result.previewHtml;
    if (!dlOk) wrap.classList.add('show'); else wrap.classList.remove('show');
    modal.classList.add('show');
  }

  let _pendingData = null;
  function showExportDialog(data) {
    _pendingData = data;
    document.getElementById('customPanel').classList.remove('show');
    document.getElementById('customCode').value = '';
    document.getElementById('exportModal').classList.add('show');
  }
  function doExport(data, customCode) {
    try {
      const result = buildPackage(data, customCode);
      const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      const filename = 'mnhr-game-' + stamp + '.zip';
      const ok = downloadBlob(result.zipBytes, filename);
      showResult(result, filename, ok);
      if (ok) toast('Đã xuất: ' + filename, 'ok', 3000);
    } catch (e) { console.error(e); alert('Lỗi: ' + e.message); }
  }
  function bind() {
    document.getElementById('btnNoCustom').onclick = () => {
      document.getElementById('exportModal').classList.remove('show');
      doExport(_pendingData, '');
    };
    document.getElementById('btnYesCustom').onclick = () => {
      document.getElementById('customPanel').classList.add('show');
      setTimeout(() => document.getElementById('customCode').focus(), 50);
    };
    document.getElementById('btnCancelExport').onclick = () => {
      document.getElementById('exportModal').classList.remove('show');
    };
    document.getElementById('btnDoExport').onclick = () => {
      document.getElementById('exportModal').classList.remove('show');
      doExport(_pendingData, document.getElementById('customCode').value || '');
    };
    document.getElementById('btnImportJs').onclick = async () => {
      const files = await pickFiles({ accept: '.js,.txt,text/javascript' });
      if (!files.length) return;
      document.getElementById('customCode').value = await files[0].text();
    };
    document.getElementById('btnResClose').onclick = () => document.getElementById('exportResultModal').classList.remove('show');
    document.getElementById('btnResDownload').onclick = () => {
      if (!_lastExport) return;
      const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      const fn = 'mnhr-game-' + stamp + '.zip';
      const ok = downloadBlob(_lastExport.zipBytes, fn);
      if (ok) toast('Đã gửi lệnh tải lại', 'ok');
      else toast('Tải lại thất bại', 'err');
    };
    document.getElementById('btnResPreview').onclick = () => {
      if (!_lastExport) return;
      const ok = openInNewTab(_lastExport.previewHtml);
      if (!ok) toast('Popup bị chặn', 'err');
      else toast('Đã mở tab preview', 'ok');
    };
    document.getElementById('btnResShowHtml').onclick = () => document.getElementById('resCodeWrap').classList.toggle('show');
    document.getElementById('btnResCopy').onclick = async () => {
      try { await navigator.clipboard.writeText(_lastExport.previewHtml); toast('Đã copy HTML', 'ok'); }
      catch (e) { const ta = document.getElementById('resCode'); ta.select(); document.execCommand('copy'); toast('Đã copy HTML', 'ok'); }
      document.getElementById('resCodeWrap').classList.add('show');
    };
    document.getElementById('btnResSelectAll').onclick = () => {
      const ta = document.getElementById('resCode'); ta.focus(); ta.select();
    };
    document.querySelectorAll('.modal').forEach(m => {
      m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('show'); });
    });
  }
  return { showExportDialog, buildHTML, buildPackage, makeZip, crc32, bind };
})();

/* ============================================================
   INIT
   ============================================================ */
async function init() {
  canvas = document.getElementById('stage');
  ctx = canvas.getContext('2d');
  imgCache = document.getElementById('imgCache');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 250));

  document.getElementById('btnAddSprite').onclick  = addSprite;
  document.getElementById('btnAddBot').onclick     = addBot;
  document.getElementById('btnAddBlock').onclick   = addBlock;
  document.getElementById('btnQuickBlock').onclick = addBlock;
  document.getElementById('btnPlay').onclick       = play;
  document.getElementById('btnStop').onclick       = stop;

  document.getElementById('btnUI').onclick = () => {
    State.tab = State.tab === 'ui' ? 'scene' : 'ui';
    State.uiSelected = null;
    document.getElementById('btnUI').classList.toggle('on', State.tab === 'ui');
    if (State.tab === 'ui') { State.selectedId = null; document.getElementById('inspector').classList.remove('hidden'); }
    renderInspector();
  };
  document.getElementById('btnPan').onclick = () => {
    State.panMode = !State.panMode;
    document.getElementById('btnPan').classList.toggle('on', State.panMode);
    document.getElementById('stageWrap').classList.toggle('panmode', State.panMode);
    document.getElementById('camInfo').style.display = State.panMode ? 'block' : 'none';
  };
  document.getElementById('btnResetCam').onclick = () => {
    State.editCam = { x: VW/2, y: VH/2 }; updateCamInfo();
    toast('Đã reset camera', 'ok');
  };

  const wrap = document.getElementById('stageWrap');
  document.getElementById('btnFullscreen').onclick = async () => {
    try {
      if (!document.fullscreenElement) {
        if (wrap.requestFullscreen) await wrap.requestFullscreen();
        else if (wrap.webkitRequestFullscreen) wrap.webkitRequestFullscreen();
      } else if (document.exitFullscreen) await document.exitFullscreen();
    } catch (e) { toast('Không hỗ trợ fullscreen', 'err'); }
  };
  document.getElementById('fsExit').onclick = async () => {
    try { if (document.exitFullscreen) await document.exitFullscreen(); } catch (e) {}
  };
  const onFSChange = () => {
    State.fullscreen = !!document.fullscreenElement;
    setTimeout(resizeCanvas, 150);
  };
  document.addEventListener('fullscreenchange', onFSChange);
  document.addEventListener('webkitfullscreenchange', onFSChange);

  document.getElementById('btnExport').onclick = () => Exporter.showExportDialog(serialize());
  Exporter.bind();
  document.getElementById('btnInspector').onclick = () => {
    document.getElementById('inspector').classList.toggle('hidden');
    setTimeout(resizeCanvas, 220);
  };

  bindSettings();
  bindLayerDrag();
  document.getElementById('btnProjects').onclick = openProjectsModal;
  document.getElementById('btnCloseProjects').onclick = () => document.getElementById('projectModal').classList.remove('show');
  document.getElementById('btnNewProject').onclick = async () => {
    const name = prompt('Tên dự án:', 'Dự án ' + (Projects.list().length + 1));
    if (name == null) return;
    if (!(await guardDirty())) return;
    try {
      const p = await Projects.create((name || '').trim() || 'Dự án mới');
      await loadProject(p); openProjectsModal(); toast('Đã tạo dự án mới', 'ok');
    } catch (e) { toast('Tạo dự án thất bại: ' + ((e && e.message) || e), 'err'); }
  };
  document.getElementById('btnSave').onclick = () => saveProject();
  document.getElementById('btnUndo').onclick = () => histGo(-1);
  document.getElementById('btnRedo').onclick = () => histGo(1);
  document.getElementById('btnAddFolder').onclick = () => importAnimBulk('dir');
  document.getElementById('btnAddZip').onclick = () => importAnimBulk('zip');
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const t = e.target && e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    const k = (e.key || '').toLowerCase();
    if (k === 'z') { e.preventDefault(); histGo(e.shiftKey ? 1 : -1); }
    else if (k === 'y') { e.preventDefault(); histGo(1); }
  });
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveProject(); }
  });
  window.addEventListener('beforeunload', (e) => { if (State.dirty && Settings.get().warn !== false) { e.preventDefault(); e.returnValue = ''; } });

  /* HITBOX MODAL */
  document.getElementById('btnHitboxAuto').onclick = hbAutoDetect;
  document.getElementById('btnHitboxFull').onclick = () => {
    hbReplace([{ x: 0, y: 0, w: hitboxState.W, h: hitboxState.H }]);
    redrawHitboxCanvas(); renderHitboxList(); updateHitboxInfo();
  };
  document.getElementById('btnHitboxClear').onclick = () => {
    hbReplace([]);
    redrawHitboxCanvas(); renderHitboxList(); updateHitboxInfo();
  };
  document.getElementById('btnHitboxCancel').onclick = closeHitboxModal;
  document.getElementById('btnHitboxDone').onclick = saveHitbox;

  const hc = document.getElementById('hitboxCanvas');
  hc.addEventListener('pointerdown', hbPointerDown);
  hc.addEventListener('pointermove', hbPointerMove);
  hc.addEventListener('pointerup', hbPointerUp);
  hc.addEventListener('pointercancel', hbPointerUp);
  hc.addEventListener('contextmenu', e => e.preventDefault());

  /* ANIMATION MODAL */
  document.getElementById('btnAddFrames').onclick = () => {
    if (animCtx) importAnimFrames(animCtx);
  };
  document.getElementById('btnImportSheet').onclick = () => {
    if (animCtx) importSpritesheetFile();
  };
  document.getElementById('btnCancelSheet').onclick = () => {
    document.getElementById('sheetPanel').style.display = 'none';
    sheetCtx = { file: null, url: null, img: null };
  };
  document.getElementById('btnDoSlice').onclick = doSliceSheet;
  document.getElementById('btnClearFrames').onclick = () => {
    if (!animCtx) return;
    const item = State.items.find(i => i.id === animCtx.itemId);
    if (!item) return;
    item.animations[animCtx.key].frames = [];
    renderAnimFrames(); renderInspector(); renderLayers(); scheduleSave();
  };
  document.getElementById('btnReverseFrames').onclick = () => {
    if (!animCtx) return;
    const item = State.items.find(i => i.id === animCtx.itemId);
    if (!item) return;
    item.animations[animCtx.key].frames.reverse();
    renderAnimFrames(); renderInspector(); renderLayers(); scheduleSave();
  };
  document.getElementById('btnAnimDone').onclick = () => {
    document.getElementById('animModal').classList.remove('show');
    animCtx = null; sheetCtx = { file: null, url: null, img: null };
    renderInspector();
  };
  document.getElementById('animFps').oninput = (e) => {
    if (!animCtx) return;
    const item = State.items.find(i => i.id === animCtx.itemId);
    if (!item) return;
    item.animations[animCtx.key].fps = Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 8));
    renderInspector(); scheduleSave();
  };
  document.getElementById('animLoop').onchange = (e) => {
    if (!animCtx) return;
    const item = State.items.find(i => i.id === animCtx.itemId);
    if (!item) return;
    item.animations[animCtx.key].loop = e.target.checked;
    scheduleSave();
  };

  canvas.addEventListener('pointerdown',   onPointerDown);
  canvas.addEventListener('pointermove',   onPointerMove);
  canvas.addEventListener('pointerup',     onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('contextmenu',   e => e.preventDefault());

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup',   onKeyUp);

  await Store.init();
  await Projects.init();
  let meta = Projects.meta(Projects.currentId()) || Projects.list()[0];
  if (!meta) meta = await Projects.create('Dự án đầu tiên');
  await loadProject(meta);
  updateCamInfo();
  requestAnimationFrame(loop);
  toast('MNHR-engine Alpha 9.0.0 · lưu trữ: ' + Store.name(), 'ok', 2800);
}

return {
  Editor: { init },
  Runtime: RT,
  State,
  Projects,
  Store,
  Exporter,
  serialize,
  deserialize,
  MiniRuntime,
  toast
};
})();