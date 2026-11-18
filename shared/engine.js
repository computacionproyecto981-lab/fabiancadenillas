/* DOCE · motor común: progreso, menús, niveles, música, efectos, bucle y utilidades */
(function () {
  'use strict';
  const STORE = 'doce.progress.v1';
  const read = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } };
  const write = d => { try { localStorage.setItem(STORE, JSON.stringify(d)); } catch (e) { } };
  function progress(id) { const p = read()[id] || {}; return { unlocked: p.unlocked || 1, stars: p.stars || {}, best: p.best || {} }; }
  function record(id, level, stars, score) {
    const d = read(), p = d[id] || {};
    p.stars = p.stars || {}; p.best = p.best || {};
    p.stars[level] = Math.max(p.stars[level] || 0, stars);
    if (score != null) p.best[level] = Math.max(p.best[level] || 0, score);
    p.unlocked = Math.max(p.unlocked || 1, level + 1);
    d[id] = p; write(d);
  }
  const totalStars = id => Object.values(progress(id).stars).reduce((a, b) => a + b, 0);
  const A = window.Audio2;

  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k === 'style') e.style.cssText = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(c => c != null && e.append(c));
    return e;
  }
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  class Particles {
    constructor() { this.list = []; }
    burst(x, y, n, o = {}) {
      const cols = [].concat(o.color || '#fff');
      for (let i = 0; i < n; i++) {
        const a = o.angle != null ? o.angle + (Math.random() - .5) * (o.spread != null ? o.spread : 6.28) : Math.random() * 6.28;
        const s = (o.speed || 200) * (.3 + Math.random() * .7);
        this.list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: (o.life || .7) * (.6 + Math.random() * .4), t: 0,
          size: (o.size || 4) * (.5 + Math.random() * .7), color: cols[(Math.random() * cols.length) | 0], g: o.gravity || 0, drag: o.drag != null ? o.drag : 2, shape: o.shape || 'circle', rot: Math.random() * 6, vr: (Math.random() - .5) * 10 });
      }
    }
    text(x, y, txt, o = {}) { this.list.push({ x, y, vx: 0, vy: -(o.rise || 50), life: o.life || .9, t: 0, txt, size: o.size || 20, color: o.color || '#fff', g: 0, drag: 1 }); }
    update(dt) {
      for (const p of this.list) { p.t += dt; p.vy += p.g * dt; const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += (p.vr || 0) * dt; }
      this.list = this.list.filter(p => p.t < p.life);
    }
    draw(ctx) {
      ctx.save();
      for (const p of this.list) {
        const a = Math.max(0, 1 - p.t / p.life);
        ctx.globalAlpha = a; ctx.fillStyle = p.color;
        if (p.txt) { ctx.font = `700 ${p.size}px Inter, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(p.txt, p.x, p.y); }
        else if (p.shape === 'square') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore(); }
        else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (.35 + a * .65), 0, 6.283); ctx.fill(); }
      }
      ctx.restore();
    }
    clear() { this.list = []; }
  }

  const I = {
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 21h5v-4.5h4.5V12h4.5V7.5h5"/><path d="M18.5 7.5V2.5"/><path d="M18.5 2.6l3.6 1.5-3.6 1.5z" fill="currentColor"/></svg>',
    restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3 3.8v4.6h4.6"/><path d="M10.2 9.3v5.4l4.5-2.7z" fill="currentColor"/></svg>',
    music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
  };

  function create(cfg) {
    const G = { cfg, id: cfg.id, level: 1, paused: true, playing: false, started: false, scale: 1, keys: {}, A, music: A.Music };
    document.title = cfg.title + ' — Espacio del Gamer';
    const root = document.documentElement;
    root.style.setProperty('--accent', cfg.accent || '#111');
    if (cfg.bg) root.style.setProperty('--gamebg', cfg.bg);
    if (cfg.dark) document.body.classList.add('dark');
    const app = document.getElementById('app');
    const hud = h('div', { class: 'hud' });
    /* control de audio flotante: barra vertical en el borde izquierdo, visible también sobre las pantallas */
    const EQ = '<span class="eq"><i></i><i></i><i></i><i></i></span>';
    const WAVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z" fill="currentColor"/><path class="w1" d="M15.5 9a4 4 0 0 1 0 6"/><path class="w2" d="M18.5 6.5a8 8 0 0 1 0 11"/></svg>';
    const audioBtn = (kind, html, label, key, isOn, toggle) => {
      const b = h('button', { class: 'ab ' + kind, 'aria-label': label, html: html + '<span class="slash"></span>' },
        h('span', { class: 'tip' }, h('b', {}, label), h('em', {}), h('kbd', {}, key)));
      const sync = () => { const on = isOn(); b.classList.toggle('off', !on); b.setAttribute('aria-pressed', on); b.querySelector('em').textContent = on ? 'Activada' : 'Apagada'; };
      b.onclick = () => { A.init(); toggle(); sync(); G.toast(`${label}: ${isOn() ? 'activada' : 'apagada'}`, 900); };
      b.sync = sync; sync(); return b;
    };
    const mBtn = audioBtn('music', EQ, 'Música', 'M', () => A.musicOn, () => A.setMusic(!A.musicOn));
    const sBtn = audioBtn('sfx', WAVE, 'Efectos', 'N', () => A.sfxOn, () => { A.setSfx(!A.sfxOn); A.play('click'); });
    const dock = h('aside', { class: 'adock', 'aria-label': 'Audio' }, mBtn, sBtn);
    G.toggleMusic = () => mBtn.onclick();
    G.toggleSfx = () => sBtn.onclick();
    const top = h('header', { class: 'top' },
      h('div', { class: 'name' }, h('i', {}), cfg.title));
    /* barra inferior flotante: marcador + acciones */
    const act = (icon, label, fn) => h('button', { class: 'hb', 'aria-label': label, html: I[icon] }, h('span', { class: 'tip' }, label));
    const rBtn = act('restart', 'Reiniciar · R'), lBtn = act('grid', 'Niveles');
    rBtn.onclick = () => restart(); lBtn.onclick = () => { A.play('click'); showLevels(); };
    const bar = h('nav', { class: 'hudbar', 'aria-label': 'Marcador' }, hud, h('div', { class: 'acts' }, rBtn, lBtn));
    const stage = h('main', { class: 'stage' });
    const ov = h('div', { class: 'overlay' }, h('div', { class: 'loading' }, '·  ·  ·'));
    const toastEl = h('div', { class: 'toast' });
    app.append(top, stage, ov, toastEl, bar, dock);
    G.stage = stage;

    function setPaused(p) { if (G.paused === p) return; G.paused = p; A.Music.duck(p); cfg.onPause && cfg.onPause(p, G); }
    /* ---- pantallas a sangre: inicio, niveles, victoria y derrota ---- */
    const PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>';
    const RETRY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4.5h4.5"/></svg>';
    const STAR = '<svg viewBox="0 0 24 24"><path d="M12 2.8l2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 16.83l-5.5 2.89 1.05-6.12L3.1 9.27l6.15-.9z" fill="currentColor"/></svg>';
    function showPanel(children, cls) {
      ov.innerHTML = '';
      ov.append(h('section', { class: 'sheet ' + (cls || '') }, h('div', { class: 'deco', html: cfg.glyph || '' }), ...children));
      ov.classList.remove('hidden'); document.body.classList.add('panel-open'); setPaused(true);
    }
    function hidePanel() { ov.classList.add('hidden'); document.body.classList.remove('panel-open'); setPaused(false); }
    const panelOpen = () => !ov.classList.contains('hidden');
    const steps = () => h('ol', { class: 'steps' }, ...(cfg.help || []).map((t, i) => h('li', {}, h('span', { class: 'n' }, String(i + 1).padStart(2, '0')), h('p', { html: t }))));
    const figures = s => h('div', { class: 'figures' }, ...(s || []).map(([k, v]) => h('div', {}, h('b', {}, String(v)), h('span', {}, k))));
    const eyebrow = (...parts) => h('p', { class: 'eyebrow' }, parts.filter(Boolean).join('  /  '));
    const btn = (label, fn, kind) => h('button', { class: 'pill ' + (kind || ''), onclick: fn }, label);
    const bigBtn = (icon, title, sub, fn) => [h('button', { class: 'play', title, html: icon, onclick: fn }), h('div', { class: 'playtxt' }, h('b', {}, title), h('span', {}, sub))];
    const startMusic = () => { if (cfg.song) A.Music.play(cfg.song, cfg.intensity ? cfg.intensity(G.level) : 1); };

    function showTitle() {
      G.playing = false;
      const tot = totalStars(cfg.id), max = cfg.levels * 3;
      showPanel([
        h('header', { class: 'head' },
          eyebrow(cfg.genre, `${cfg.levels} niveles`),
          h('h1', { class: 'mega' }, cfg.title),
          h('p', { class: 'tag' }, cfg.tagline || '')),
        h('div', { class: 'side' }, h('p', { class: 'label' }, 'Cómo se juega'), steps()),
        h('footer', { class: 'foot' },
          ...bigBtn(PLAY, 'Jugar', `${tot} de ${max} estrellas`, () => { A.init(); A.play('select'); startMusicMenu(); showLevels(); }),
          h('div', { class: 'meter' }, h('i', { style: `width:${tot / max * 100}%` })))
      ], 'title');
    }
    function startMusicMenu() { if (cfg.song && !A.Music.song) A.Music.play(cfg.song, 0); }
    /* selección de niveles: carrusel horizontal de cartas */
    const STAR_S = '<svg viewBox="0 0 24 24"><path d="M12 2.8l2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 16.83l-5.5 2.89 1.05-6.12L3.1 9.27l6.15-.9z" fill="currentColor"/></svg>';
    function showLevels() {
      G.playing = false;
      const p = progress(cfg.id), deck = h('div', { class: 'deck', tabindex: '0' });
      const next = Math.min(cfg.levels, p.unlocked);
      let curCard = null;
      for (let i = 1; i <= cfg.levels; i++) {
        const locked = i > p.unlocked, s = p.stars[i] || 0, cur = i === next && !locked;
        const status = locked ? 'Bloqueado' : cur ? (s ? 'Mejorar' : 'Siguiente') : 'Superado';
        const card = h('button', { class: 'lcard' + (locked ? ' locked' : s ? ' done' : '') + (cur ? ' cur' : ''), disabled: locked, 'aria-label': `Nivel ${i}: ${status}`, onclick: () => { A.init(); A.play('select'); start(i); } },
          h('span', { class: 'lc-top' }, h('span', {}, 'Nivel'), locked ? h('span', { class: 'lc-lock', html: I.lock }) : null),
          h('span', { class: 'lc-num' }, String(i).padStart(2, '0')),
          h('span', { class: 'lc-stars' }, ...[0, 1, 2].map(k => h('i', { class: k < s ? 'on' : '', html: STAR_S }))),
          h('span', { class: 'lc-status' }, status, cur ? h('span', { class: 'lc-go', html: PLAY }) : null));
        if (cur) curCard = card;
        deck.append(card);
      }
      const scrollBy = d => { const c = deck.querySelector('.lcard'); if (c) deck.scrollBy({ left: d * (c.offsetWidth + 14), behavior: 'smooth' }); A.play('slide'); };
      deck.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { scrollBy(1); e.preventDefault(); } if (e.key === 'ArrowLeft') { scrollBy(-1); e.preventDefault(); } });
      deck.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { deck.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
      const doneCount = Math.min(cfg.levels, p.unlocked - 1);
      showPanel([
        h('header', { class: 'head' }, eyebrow(cfg.title, `${doneCount} de ${cfg.levels} superados  ·  ${totalStars(cfg.id)} de ${cfg.levels * 3} estrellas`), h('h1', { class: 'mega' }, 'Elige nivel')),
        h('div', { class: 'side' }, deck),
        h('footer', { class: 'foot' },
          h('button', { class: 'dn back', 'aria-label': 'Volver a cómo se juega', title: 'Cómo se juega', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>', onclick: () => { A.play('back'); showTitle(); } }),
          h('div', { class: 'deck-nav' },
            h('button', { class: 'dn', 'aria-label': 'Anteriores', onclick: () => scrollBy(-3) }, '‹'),
            h('button', { class: 'dn', 'aria-label': 'Siguientes', onclick: () => scrollBy(3) }, '›')))
      ], 'levels-screen');
      requestAnimationFrame(() => { if (curCard && curCard.offsetLeft + curCard.offsetWidth > deck.clientWidth * .8) deck.scrollLeft = curCard.offsetLeft - deck.clientWidth * .3; deck.focus({ preventScroll: true }); });
    }
    function start(n) {
      G.level = n; G.playing = true; G.started = true;
      hud.innerHTML = ''; hud._keys = null;
      A.init(); startMusic();
      cfg.onLevel(n, G);
      hidePanel();
    }
    function restart() { if (G.started) { A.play('back'); start(G.level); } }
    G.win = function (stars, stats, score) {
      if (!G.playing) return;
      G.playing = false; stars = clamp(stars | 0, 1, 3);
      record(cfg.id, G.level, stars, score);
      A.Music.stop(true); A.play('win');
      const last = G.level >= cfg.levels;
      const st = h('div', { class: 'bigstars' });
      for (let i = 0; i < 3; i++) {
        const s = h('span', { class: i < stars ? 'on' : '', html: STAR });
        s.style.animationDelay = (.25 + i * .18) + 's'; st.append(s);
        if (i < stars) setTimeout(() => A.play('star', { pitch: 1 + i * .12 }), 550 + i * 180);
      }
      showPanel([
        h('header', { class: 'head' }, eyebrow(cfg.title, last ? 'juego completado' : 'nivel superado'), h('h1', { class: 'mega' }, last ? '¡Completo!' : `Nivel ${G.level}`), st),
        h('div', { class: 'side' }, figures(stats)),
        h('footer', { class: 'foot' },
          ...(last ? bigBtn(RETRY, 'Repetir', `nivel ${G.level}`, () => start(G.level)) : bigBtn(PLAY, 'Siguiente', `nivel ${G.level + 1}`, () => start(G.level + 1))),
          h('div', { class: 'pills' }, last ? null : btn('Repetir', () => start(G.level), 'ghost'), btn('Niveles', () => { startMusicMenu(); showLevels(); }, 'ghost')))
      ], 'win');
    };
    G.lose = function (msg, stats) {
      if (!G.playing) return;
      G.playing = false; A.Music.stop(true); A.play('lose');
      showPanel([
        h('header', { class: 'head' }, eyebrow(cfg.title, `nivel ${G.level}`, 'inténtalo otra vez'), h('h1', { class: 'mega' }, msg || 'Casi')),
        h('div', { class: 'side' }, figures(stats)),
        h('footer', { class: 'foot' },
          ...bigBtn(RETRY, 'Reintentar', `nivel ${G.level}`, () => start(G.level)),
          h('div', { class: 'pills' }, btn('Niveles', () => { startMusicMenu(); showLevels(); }, 'ghost')))
      ], 'lose');
    };
    G.hud = function (obj) {
      const keys = Object.keys(obj), sig = keys.join('|');
      if (hud._keys !== sig) { hud.innerHTML = ''; hud._els = {}; keys.forEach(k => { const b = h('b'); hud.append(h('div', { class: 'stat' }, h('span', {}, k), b)); hud._els[k] = b; }); hud._keys = sig; hud._init = true; }
      keys.forEach(k => { const v = String(obj[k]), el = hud._els[k]; if (el.textContent !== v) { const first = el.textContent === ''; el.textContent = v; if (!first) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } } });
    };
    let tt;
    G.toast = (msg, ms = 1500) => { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove('show'), ms); };
    G.sfx = (n, o) => A.play(n, o);
    G.pan = x => G.cv ? clamp((x / G.cv.width) * 2 - 1, -1, 1) * .7 : 0;
    G.canvas = function (w, hh) {
      if (!G.cv) { G.cv = document.createElement('canvas'); stage.prepend(G.cv); }
      if (G.cv.width !== w || G.cv.height !== hh) { G.cv.width = w; G.cv.height = hh; }
      G.ctx = G.cv.getContext('2d'); fit(); return G.ctx;
    };
    function fit() {
      const cv = G.cv; if (!cv) return;
      const r0 = stage.getBoundingClientRect(), cs = getComputedStyle(stage);
      const r = { width: r0.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 24, height: r0.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) + 24 }; let other = 0;
      for (const ch of stage.children) if (ch !== cv && ch.offsetParent !== null && getComputedStyle(ch).position !== 'absolute') other += ch.offsetHeight + 12;
      const s = Math.max(.1, Math.min((r.width - 24) / cv.width, (r.height - 24 - other) / cv.height, cfg.maxScale || 1.5));
      cv.style.width = Math.floor(cv.width * s) + 'px'; cv.style.height = Math.floor(cv.height * s) + 'px'; G.scale = s;
    }
    G.fit = fit; addEventListener('resize', fit);
    G.pos = e => { const r = G.cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * G.cv.width / r.width, y: (e.clientY - r.top) * G.cv.height / r.height }; };
    G.loop = function (update, render) {
      let last = performance.now();
      const f = t => { const dt = Math.min(.04, (t - last) / 1000); last = t; if (!G.paused && G.playing) update(dt); render(dt); requestAnimationFrame(f); };
      requestAnimationFrame(f);
    };
    addEventListener('keydown', e => {
      A.init(); G.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if ((e.key === 'r' || e.key === 'R') && G.started && !panelOpen() && !cfg.noR) restart();
      if (e.code === 'KeyM' && !e.repeat) G.toggleMusic();
      if (e.code === 'KeyN' && !e.repeat) G.toggleSfx();
    });
    addEventListener('keyup', e => { G.keys[e.code] = false; });
    addEventListener('blur', () => { G.keys = {}; });
    addEventListener('pointerdown', () => A.init(), { capture: true });
    G.touch = function (left, right) {
      const mk = list => h('div', { class: 'grp' }, ...list.map(b => {
        const el = h('button', { html: b.label });
        const on = e => { e.preventDefault(); G.keys[b.code] = true; el.classList.add('on'); b.down && b.down(); };
        const off = e => { e.preventDefault(); G.keys[b.code] = false; el.classList.remove('on'); };
        el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off);
        return el;
      }));
      document.body.append(h('div', { class: 'touch' }, mk(left || []), mk(right || []))); document.body.classList.add('has-touch');
    };
    G.swipe = function (el, cb) {
      let sx, sy, id = null;
      el.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; id = e.pointerId; });
      el.addEventListener('pointerup', e => { if (id !== e.pointerId) return; id = null; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; if (Math.abs(dx) > Math.abs(dy)) cb(dx > 0 ? 1 : -1, 0); else cb(0, dy > 0 ? 1 : -1); });
    };
    setTimeout(() => { cfg.onReady && cfg.onReady(G); showTitle(); }, 0);
    return G;
  }
  window.Engine = { create, rng, clamp, lerp, Particles, progress, totalStars };
})();
