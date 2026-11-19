// Pantalla de equipamiento previa a cada misión: arma, casco y consumibles (lo comprado en la tienda).
import { WEAPONS, HELMETS } from './config.js';
import { loadout } from './shop.js';
import { itemImg } from './shop.js';

const INFO = { pistol: 'Equilibrada y precisa', rev: 'Lenta, perfora casco y placa', smg: 'Automática, imprecisa a la cadera', sniper: 'Zoom ×4, silenciada, perfora' };
const HINFO = { hLight: 'Absorbe 1 tiro a la cabeza', hHeavy: 'Absorbe 2 tiros a la cabeza', '': 'Sin protección' };
const bar = (n, v) => `<div class="st"><span>${n}</span><i><u style="width:${Math.round(Math.max(0.06, Math.min(1, v)) * 100)}%"></u></i></div>`;

// d = datos guardados; change(kind) avisa de cambios (para guardar y cargar el modelo del arma).
export function renderEquip(d, change) {
  const box = document.getElementById('equipBody'); box.innerHTML = '';
  const card = (img, name, sub, on, fn) => { const b = document.createElement('button'); b.className = 'eqc' + (on ? ' on' : ''); b.innerHTML = `<div class="pic img">${img}</div><b>${name}</b><span>${sub}</span>`; b.onclick = fn; return b; };
  const sec = (t) => { const h = document.createElement('h3'); h.textContent = t; box.appendChild(h); const r = document.createElement('div'); r.className = 'eqrow'; box.appendChild(r); return r; };
  if (renderEquip.step === undefined) renderEquip.step = 0;
  const ls = loadout(d), cur = renderEquip.last && (renderEquip.last === ls[0] || renderEquip.last === ls[1]) ? renderEquip.last : ls[0];
  const owned = ['pistol', 'rev', 'smg', 'sniper'].filter((id) => id === 'pistol' || d.items[id]);
  const rw = sec('ARMAS · 1ª pulsación = principal, 2ª = secundaria');
  const hint = document.createElement('p'); hint.className = 'eqnone'; hint.textContent = 'Elige tu arma principal' + (renderEquip.step === 1 ? ' → ahora toca otra para la secundaria' : '');
  const tap = (id) => { // paso 0: elige la principal (y quita la secundaria); paso 1: elige la secundaria
    if (renderEquip.step === 1 && id !== ls[0]) { d.weapon2 = id; renderEquip.step = 0; }
    else { d.weapon = id === 'pistol' ? '' : id; d.weapon2 = ''; renderEquip.step = 1; }
    renderEquip.last = id; change('weapon'); renderEquip(d, change); };
  for (const id of owned) { const c = card(itemImg(id), WEAPONS[id].name, INFO[id], id === ls[0] || id === ls[1], () => tap(id)); const bd = document.createElement('i'); bd.className = 'bdg'; bd.textContent = id === ls[0] ? '1' : id === ls[1] ? '2' : ''; if (bd.textContent) c.appendChild(bd); rw.appendChild(c); }
  box.appendChild(hint);
  const W = WEAPONS[cur], st = document.createElement('div'); st.className = 'stats';
  st.innerHTML = '<div class="stn">' + W.name + '</div>' + bar('Cargador', W.mag / 20) + bar('Cadencia', 1 / W.rate / 12) + bar('Recarga', 1.5 / W.reload * 0.75) + bar('Precisión', 1 / W.spreadK * (cur === 'sniper' ? 1 : 0.7)) + bar('Perforación', W.pierce ? 1 : 0.15);
  box.appendChild(st);
  const rh = sec('CASCO');
  rh.appendChild(card('<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="18" fill="none" stroke="#778" stroke-width="3" stroke-dasharray="5 4"/></svg>', 'Sin casco', HINFO[''], !d.helmet, () => { d.helmet = ''; change('helmet'); renderEquip(d, change); }));
  for (const id of Object.keys(HELMETS)) if (d.items[id]) rh.appendChild(card(itemImg(id), HELMETS[id].name, HINFO[id], d.helmet === id, () => { d.helmet = id; change('helmet'); renderEquip(d, change); }));
  d.cons = d.cons || {}; d.use = d.use || {};
  const rx = sec('EXPLOSIVO (botón EXPLOSIVO · solo uno de los dos)');
  const exI = { gren: '<svg viewBox="0 0 64 64"><ellipse cx="32" cy="38" rx="16" ry="19" fill="#4a5a3a" stroke="#222" stroke-width="2.5"/><rect x="27" y="12" width="10" height="8" fill="#9aa"/></svg>', mine: '<svg viewBox="0 0 64 64"><ellipse cx="32" cy="42" rx="24" ry="9" fill="#2d3128" stroke="#111" stroke-width="2.5"/><ellipse cx="32" cy="38" rx="22" ry="8" fill="#3d4436"/><circle cx="32" cy="36" r="4" fill="#e22"/></svg>' };
  rx.appendChild(card('<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="18" fill="none" stroke="#778" stroke-width="3" stroke-dasharray="5 4"/></svg>', 'Ninguno', 'Sin explosivo', !d.expl, () => { d.expl = ''; change('expl'); renderEquip(d, change); }));
  for (const [id, n, s] of [['gren', 'Granada', 'Mata en 3 m · hasta 3 por misión'], ['mine', 'Mina', 'Se coloca delante · hasta 2 por misión']]) {
    const have = d.cons[id] || 0; rx.appendChild(card(exI[id], n + ' ×' + have, have ? s : 'Sin existencias · cómprala en la tienda', d.expl === id && have > 0, () => { if (!have) return; d.expl = id; change('expl'); renderEquip(d, change); }));
  }
  const rc = sec('CONSUMIBLES'), cons = [['cMed', 'Botiquín', '+1 vida'], ['cVest', 'Chaleco temporal', 'Absorbe 1 tiro al cuerpo']];
  let any = false;
  for (const [id, n, s] of cons) { const have = d.cons[id] || 0; if (!have) continue; any = true; const on = d.use[id] !== false; rc.appendChild(card(`<b class="big-n">×${have}</b>`, n, on ? s + ' · SE USARÁ' : 'No se usará', on, () => { d.use[id] = !on; change('use'); renderEquip(d, change); })); }
  if (!any) { const p = document.createElement('p'); p.className = 'eqnone'; p.textContent = 'No tienes consumibles. Cómpralos en la tienda.'; rc.appendChild(p); }
}
