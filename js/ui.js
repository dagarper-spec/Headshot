// Interfaz (DOM): HUD, menús y avisos. Solo muestra datos, no contiene lógica de juego.
const $ = (id) => document.getElementById(id);
const last = {};

// Actualiza un texto solo si cambió (evita trabajo inútil en cada frame).
function txt(id, v) { if (last[id] !== v) { last[id] = v; $(id).textContent = v; } }
const mmss = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return String(m).padStart(2, '0') + ':' + s.toFixed(1).padStart(4, '0'); };

export const ui = {
  hud(S, st, name) {
    txt('hpt', '\u25CF'.repeat(S.hp) + '\u25CB'.repeat(S.maxHp - S.hp));
    $('hpf').style.width = (S.hp / S.maxHp) * 100 + '%';
    $('shf').style.width = (S.vest > 0 ? 100 : 0) + '%';
    txt('wv', name); $('dalert').classList.toggle('on', !!S.droneSeen);
    txt('score', mmss(S.t));
    txt('combo', S.points > 0 || S.endless ? (S.endless ? 'OLEADA ' + S.endless.wave + ' \u00b7 ' : '') + S.points + ' pts' : '');
    const sk = $('streak'), hot = S.combo >= 2 && S.comboT > 0;
    sk.classList.toggle('on', hot);
    if (!hot) sk._c = 0; else { if (sk._c !== S.combo) { sk._c = S.combo; sk.classList.remove('bump'); void sk.offsetWidth; sk.classList.add('bump'); } sk.firstElementChild.textContent = 'RACHA x' + Math.min(S.combo, 5); sk.querySelector('u').style.width = (S.comboT / 7) * 100 + '%'; }
    txt('mag', S.reloading ? '--' : S.mag);
    const cb = $('chestbar'), ch = S.gold && !S.gold.open && S.gold.prog > 0.02 ? S.gold : S.chest, on = ch && !ch.open && ch.prog > 0.02;
    if (cb.style.display !== (on ? 'block' : 'none')) cb.style.display = on ? 'block' : 'none';
    if (on) cb.firstElementChild.style.width = Math.min(100, (ch.prog / (ch.need || 1.5)) * 100) + '%';
    txt('rl', S.reloading ? 'RECARGANDO' : '/ ' + st.mag);
  },
  // Indicador de amenaza: flechas rojas alrededor de la mira que apuntan hacia quien te apunta y se intensifican al cargar el disparo.
  warn(list) {
    const els = $('warn').children; let kmax = 0;
    for (let i = 0; i < els.length; i++) {
      const w = list[i], el = els[i];
      if (!w) { if (el.style.opacity !== '0') el.style.opacity = '0'; continue; }
      kmax = Math.max(kmax, w.k);
      el.style.opacity = (0.35 + 0.65 * w.k).toFixed(2); el.style.transform = `rotate(${w.a}rad) translateY(calc(var(--wr) * -1)) scale(${(0.8 + 0.7 * w.k).toFixed(2)})`;
    }
    $('warn').style.setProperty('--w', kmax.toFixed(2));
    return kmax;
  },
  show(id) { $(id).classList.remove('hide'); },
  hide(id) { $(id).classList.add('hide'); },
  flashClass(id, cls, ms) {
    const el = $(id); el.classList.add(cls);
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove(cls), ms);
  },
  hitmarker(kill, head) {
    const el = $('hm'); el.className = (kill ? 'kill ' : '') + (head ? 'head ' : '') + 'on';
    clearTimeout(el._t); el._t = setTimeout(() => { el.className = ''; }, kill ? 260 : 120);
  },
  hurt() { ui.flashClass('vig', 'on', 320); },
  banner(text, ms = 1800) { $('ban').textContent = text; ui.flashClass('ban', 'on', ms); },
  menu(title, btn, note, paused) {
    $('restart').classList[paused ? 'remove' : 'add']('hide');
    $('mtitle').textContent = title; $('start').textContent = btn; $('start').disabled = false;
    $('best').textContent = note || '';
    ui.show('menu');
  },
  // Pantalla de fin de nivel: victoria o derrota.
  end(win, title, stats, btn) {
    $('ot').textContent = title; $('ot').className = win ? 'win' : '';
    $('ostats').innerHTML = stats; $('again').textContent = btn;
    ui.show('over');
  },
  // Pantalla de victoria visual: estrellas que aparecen una a una, barras animadas y dinero que sube (estilo "fin de fase").
  result(r, btn) {
    const row = (i, lab, val, pct, ok) => `<div class="rrow ${ok ? 'ok' : 'ko'}" style="--d:${0.9 + i * 0.35}s"><span class="rl">${lab}</span><span class="rbar"><i style="--w:${Math.round(pct * 100)}%"></i></span><span class="rv">${val}</span></div>`;
    const star = (g, i) => `<b class="rs ${g ? 'on' : ''}" style="--d:${0.25 + i * 0.3}s">\u2605</b>`;
    const sparks = Array.from({ length: 14 }, (_, i) => `<u style="--a:${i * 25.7}deg;--s:${0.9 + (i % 4) * 0.2}s"></u>`).join('');
    $('ot').textContent = r.title; $('ot').className = 'win';
    $('ostats').innerHTML = `<div class="res"><div class="rstars">${r.got.map(star).join('')}<div class="sparks">${sparks}</div></div>
      <div class="rrows">${row(0, 'Nivel superado', '\u2713', 1, true)}${row(1, 'Tiempo', r.time.toFixed(1) + ' s / ' + r.par + ' s', Math.min(1, r.par / Math.max(r.time, 0.1)), r.got[1])}${row(2, r.goal, r.got[2] ? '\u2713' : '\u2717', r.got[2] ? 1 : 0.12, r.got[2])}</div>
      <div class="rmoney"><div class="rcoin">$<b id="rcount">0</b></div><div class="rdet">${r.bonus ? 'Estrellas +$' + r.bonus + ' ' : ''}${r.chest ? 'Baúl +$' + r.chest + ' ' : ''}${r.first ? '' : '· repetición al 40 %'}</div><div class="rtot">Total $${r.coins}</div></div>
      ${r.note ? '<div class="rnote">' + r.note + '</div>' : ''}</div>`;
    $('again').textContent = btn; ui.show('over');
    const el = $('rcount'), t0 = performance.now(), T = 1100;
    const tick = (n) => { const k = Math.min(1, (n - t0 - 900) / T); el.textContent = Math.round(r.total * Math.max(0, 1 - Math.pow(1 - Math.max(0, k), 3))); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  },
  // Texto flotante de puntos al matar (reinicia la animación CSS).
  pop(text, head) { const el = $('pop'); el.textContent = text; el.className = head ? 'head' : ''; void el.offsetWidth; el.classList.add('on'); },
  toast(t) { $('toast').textContent = t; ui.flashClass('toast', 'on', 2200); },
};
