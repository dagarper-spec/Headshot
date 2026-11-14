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
    txt('wv', 'NIVEL ' + (S.level + 1) + ' \u00B7 ' + name);
    txt('score', mmss(S.t));
    txt('mag', S.reloading ? '--' : S.mag);
    txt('rl', S.reloading ? 'RECARGANDO' : '/ ' + st.mag);
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
  menu(title, btn, note) {
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
  toast(t) { $('toast').textContent = t; ui.flashClass('toast', 'on', 2200); },
};
