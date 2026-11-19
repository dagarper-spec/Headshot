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
  const ls = loadout(d), cur = renderEquip.last && (renderEquip.last === ls[0] || renderEquip.last === ls[1]) ? renderEquip.last : ls[0];
  const owned = ['pistol', 'rev', 'smg', 'sniper'].filter((id) => id === 'pistol' || d.items[id]);
  const r1 = sec('ARMA PRINCIPAL');
  for (const id of owned) r1.appendChild(card(itemImg(id), WEAPONS[id].name, INFO[id], id === ls[0], () => { // si ya era la secundaria, se intercambian
    if (id === ls[1]) d.weapon2 = ls[0] === 'pistol' ? 'pistol' : ls[0]; d.weapon = id === 'pistol' ? '' : id; renderEquip.last = id; change('weapon'); renderEquip(d, change); }));
  const r2 = sec('ARMA SECUNDARIA (opcional · botón CAMBIAR ARMA)');
  r2.appendChild(card('<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="18" fill="none" stroke="#778" stroke-width="3" stroke-dasharray="5 4"/></svg>', 'Ninguna', 'Solo llevas una arma', !ls[1], () => { d.weapon2 = ''; change('weapon'); renderEquip(d, change); }));
  for (const id of owned) if (id !== ls[0]) r2.appendChild(card(itemImg(id), WEAPONS[id].name, INFO[id], id === ls[1], () => { d.weapon2 = id; renderEquip.last = id; change('weapon'); renderEquip(d, change); }));
  const W = WEAPONS[cur], st = document.createElement('div'); st.className = 'stats';
  st.innerHTML = '<div class="stn">' + W.name + '</div>' + bar('Cargador', W.mag / 20) + bar('Cadencia', 1 / W.rate / 12) + bar('Recarga', 1.5 / W.reload * 0.75) + bar('Precisión', 1 / W.spreadK * (cur === 'sniper' ? 1 : 0.7)) + bar('Perforación', W.pierce ? 1 : 0.15);
  box.appendChild(st);
  const rh = sec('CASCO');
  rh.appendChild(card('<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="18" fill="none" stroke="#778" stroke-width="3" stroke-dasharray="5 4"/></svg>', 'Sin casco', HINFO[''], !d.helmet, () => { d.helmet = ''; change('helmet'); renderEquip(d, change); }));
  for (const id of Object.keys(HELMETS)) if (d.items[id]) rh.appendChild(card(itemImg(id), HELMETS[id].name, HINFO[id], d.helmet === id, () => { d.helmet = id; change('helmet'); renderEquip(d, change); }));
  d.cons = d.cons || {}; d.use = d.use || {};
  const rc = sec('CONSUMIBLES'), cons = [['cMed', 'Botiquín', '+1 vida'], ['cVest', 'Chaleco temporal', 'Absorbe 1 tiro al cuerpo']];
  let any = false;
  for (const [id, n, s] of cons) { const have = d.cons[id] || 0; if (!have) continue; any = true; const on = d.use[id] !== false; rc.appendChild(card(`<b class="big-n">×${have}</b>`, n, on ? s + ' · SE USARÁ' : 'No se usará', on, () => { d.use[id] = !on; change('use'); renderEquip(d, change); })); }
  if (!any) { const p = document.createElement('p'); p.className = 'eqnone'; p.textContent = 'No tienes consumibles. Cómpralos en la tienda.'; rc.appendChild(p); }
}
