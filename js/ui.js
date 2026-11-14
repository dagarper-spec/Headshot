// Interfaz (DOM): HUD, menús, mejoras y avisos. Solo muestra datos, no contiene lógica de juego.
const $ = (id) => document.getElementById(id);
const last = {};

// Actualiza un texto solo si cambió (evita trabajo inútil en cada frame).
function txt(id, v) { if (last[id] !== v) { last[id] = v; $(id).textContent = v; } }

export const ui = {
  hud(S, st) {
    txt('hpt', Math.ceil(S.hp));
    $('hpf').style.width = (S.hp / S.maxHp) * 100 + '%';
    txt('wv', 'OLEADA ' + S.wave);
    txt('score', S.score.toLocaleString('es-ES'));
    txt('combo', S.combo > 1 ? 'x' + S.combo : '');
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
    clearTimeout(el._t); el._t = setTimeout(() => { el.className = ''; }, kill ? 220 : 110);
  },
  hurt() { ui.flashClass('vig', 'on', 280); },
  banner(text, ms = 1800) { $('ban').textContent = text; ui.flashClass('ban', 'on', ms); },
  menu(title, btn, best) {
    $('mtitle').textContent = title; $('start').textContent = btn; $('start').disabled = false;
    $('best').textContent = best ? 'Récord: ' + best.score.toLocaleString('es-ES') + ' pts · oleada ' + best.wave : '';
    ui.show('menu');
  },
  upgrades(list, onPick) { // tarjetas de mejora entre oleadas
    const box = $('cards'); box.innerHTML = '';
    list.forEach((u) => {
      const b = document.createElement('button');
      b.className = 'card'; b.innerHTML = `<b>${u.name}</b><span>${u.desc}</span>`;
      b.onclick = () => { ui.hide('upg'); onPick(u.id); };
      box.appendChild(b);
    });
    ui.show('upg');
  },
  over(S, best, isNew) {
    $('ostats').innerHTML = `Puntos <b>${S.score.toLocaleString('es-ES')}</b> · Oleada <b>${S.wave}</b> · Bajas <b>${S.kills}</b>` +
      (isNew ? '<br><em>¡NUEVO RÉCORD!</em>' : '');
    ui.show('over');
  },
  toast(t) { $('toast').textContent = t; ui.flashClass('toast', 'on', 2200); },
};
