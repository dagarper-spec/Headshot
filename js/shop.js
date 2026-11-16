// Economía y tienda: recompensa por tiempo y mejoras permanentes (guardadas en localStorage).
import { CFG, LEVELS } from './config.js';
import { setGlove } from './view-fps.js';

const BASE = { mag: CFG.weapon.mag, reload: CFG.weapon.reload, hp: CFG.player.hp };

// Catálogo. kind 'up' = mejora permanente; 'glove' = cosmético (se equipa al comprarlo).
export const ITEMS = [
  { id: 'mag',    kind: 'up', name: 'Cargador ampliado', desc: 'Cargador de 6 a 8 balas', price: 150 },
  { id: 'fast',   kind: 'up', name: 'Recarga rápida',    desc: 'Recargas un 30 % más rápido', price: 120 },
  { id: 'vest',   kind: 'up', name: 'Chaleco',           desc: '+1 vida (3 en total)', price: 250 },
  { id: 'gRed',   kind: 'glove', name: 'Guantes rojos',  desc: 'Cosmético', price: 80, color: 0x8e1b1b },
  { id: 'gGold',  kind: 'glove', name: 'Guantes dorados', desc: 'Cosmético', price: 200, color: 0xb8902a },
];

// Recompensa: completa si terminas dentro del tiempo par; baja en línea recta hasta 0 a 4x el par.
export function reward(level, t) {
  const L = LEVELS[level % LEVELS.length], k = Math.min(1, Math.max(0, (4 * L.par - t) / (3 * L.par)));
  return Math.round((L.pay * k) / 5) * 5;
}

// Aplica las mejoras compradas a la configuración del juego.
export function applyUpgrades(d) {
  CFG.weapon.mag = BASE.mag + (d.items.mag ? 2 : 0);
  CFG.weapon.reload = BASE.reload * (d.items.fast ? 0.7 : 1);
  CFG.player.hp = BASE.hp + (d.items.vest ? 1 : 0);
  const g = ITEMS.find((i) => i.id === d.glove); setGlove(g ? g.color : 0);
}

// Pinta la tienda. save() guarda; onChange() refresca otras partes (p. ej. el contador).
export function renderShop(d, save) {
  document.getElementById('coins').textContent = '$ ' + d.coins;
  const box = document.getElementById('items'); box.innerHTML = '';
  for (const it of ITEMS) {
    const own = !!d.items[it.id], eq = d.glove === it.id, el = document.createElement('button');
    el.className = 'item' + (own ? ' own' : d.coins < it.price ? ' no' : '');
    const sw = it.color ? `<i style="background:#${it.color.toString(16).padStart(6, '0')}"></i>` : '';
    const st = own ? (it.kind === 'glove' ? (eq ? 'Equipado' : 'Equipar') : 'Comprado') : '$ ' + it.price;
    el.innerHTML = `${sw}<b>${it.name}</b><span>${it.desc}</span><em>${st}</em>`;
    el.onclick = () => {
      if (!own) { if (d.coins < it.price) return; d.coins -= it.price; d.items[it.id] = 1; if (it.kind === 'glove') d.glove = it.id; }
      else if (it.kind === 'glove') d.glove = eq ? '' : it.id;
      else return;
      save(); applyUpgrades(d); renderShop(d, save);
    };
    box.appendChild(el);
  }
}
