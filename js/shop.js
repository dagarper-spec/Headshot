// Economía y tienda: recompensa por tiempo y mejoras permanentes (guardadas en localStorage).
import { CFG, LEVELS } from './config.js';
import { setGlove } from './view-fps.js';

const BASE = { mag: CFG.weapon.mag, reload: CFG.weapon.reload, hp: CFG.player.hp };

// Catálogo. 'up' = mejora permanente por niveles (prices[i] = precio del nivel i+1); 'glove' = cosmético; 'cons' = consumible de un nivel.
export const ITEMS = [
  { id: 'mag',  kind: 'up', name: 'Cargador ampliado', desc: ['Cargador de 7 balas', 'Cargador de 8 balas'], prices: [150, 300] },
  { id: 'fast', kind: 'up', name: 'Recarga rápida',    desc: ['Recarga un 15 % más rápida', 'Recarga un 30 % más rápida'], prices: [120, 240] },
  { id: 'stab', kind: 'up', name: 'Estabilidad',       desc: ['Un 20 % menos de dispersión', 'Un 35 % menos de dispersión'], prices: [140, 260] },
  { id: 'vest', kind: 'up', name: 'Chaleco',           desc: ['+1 vida (3 en total)'], prices: [400], needBoss: true },
  { id: 'cMed',  kind: 'cons', name: 'Botiquín',         desc: ['+1 vida en el próximo nivel'], price: 60 },
  { id: 'cVest', kind: 'cons', name: 'Chaleco temporal', desc: ['Absorbe 1 tiro al cuerpo'], price: 80 },
  { id: 'gRed',   kind: 'glove', name: 'Guantes rojos',   desc: ['Cosmético'], price: 80, color: 0x8e1b1b },
  { id: 'gCamo',  kind: 'glove', name: 'Guantes camuflaje', desc: ['Cosmético'], price: 120, color: 0x4b5a35 },
  { id: 'gGold',  kind: 'glove', name: 'Guantes dorados', desc: ['Cosmético'], price: 200, color: 0xb8902a },
];

// Recompensa: completa si terminas dentro del tiempo par; baja en línea recta hasta 0 a 4x el par.
export function reward(level, t) {
  const L = LEVELS[level % LEVELS.length], k = Math.min(1, Math.max(0, (4 * L.par - t) / (3 * L.par)));
  return Math.round((L.pay * k) / 5) * 5;
}

// Aplica las mejoras compradas a la configuración del juego.
export function applyUpgrades(d) {
  const lv = (id) => +d.items[id] || 0;
  CFG.weapon.mag = BASE.mag + lv('mag');
  CFG.weapon.reload = BASE.reload * (1 - 0.15 * lv('fast'));
  CFG.weapon.stab = 1 - [0, 0.2, 0.35][lv('stab')];
  CFG.player.hp = BASE.hp + (lv('vest') ? 1 : 0);
  const g = ITEMS.find((i) => i.id === d.glove); setGlove(g ? g.color : 0);
}

// Pinta la tienda. save() guarda los cambios.
export function renderShop(d, save) {
  d.cons = d.cons || {};
  document.getElementById('coins').textContent = '$ ' + d.coins;
  const box = document.getElementById('items'); box.innerHTML = '';
  const bossDone = !!(d.stars && d.stars[3]);
  for (const it of ITEMS) {
    const el = document.createElement('button'); let sw = '', title = it.name, desc, st, canBuy = false, buy = null;
    if (it.kind === 'up') {
      const lv = +d.items[it.id] || 0, max = it.prices.length, price = it.prices[lv];
      title += max > 1 ? ' ' + Math.min(lv + 1, max) + '/' + max : '';
      desc = it.desc[Math.min(lv, max - 1)];
      if (lv >= max) st = 'Comprado'; else if (it.needBoss && !bossDone) st = 'Vence al jefe'; else { st = '$ ' + price; canBuy = d.coins >= price; buy = () => { d.coins -= price; d.items[it.id] = lv + 1; }; }
      el.className = 'item' + (lv >= max ? ' own' : canBuy ? '' : ' no');
    } else if (it.kind === 'cons') {
      const n = d.cons[it.id] || 0; desc = it.desc[0] + (n ? ' · tienes ' + n : '');
      st = n >= 3 ? 'Máximo' : '$ ' + it.price; canBuy = d.coins >= it.price && n < 3; buy = () => { d.coins -= it.price; d.cons[it.id] = n + 1; };
      el.className = 'item' + (canBuy ? '' : ' no');
    } else {
      const own = !!d.items[it.id], eq = d.glove === it.id; desc = it.desc[0];
      sw = `<i style="background:#${it.color.toString(16).padStart(6, '0')}"></i>`;
      if (own) { st = eq ? 'Equipado' : 'Equipar'; el.className = 'item own'; buy = () => { d.glove = eq ? '' : it.id; }; canBuy = true; }
      else { st = '$ ' + it.price; canBuy = d.coins >= it.price; el.className = 'item' + (canBuy ? '' : ' no'); buy = () => { d.coins -= it.price; d.items[it.id] = 1; d.glove = it.id; }; }
    }
    el.innerHTML = `${sw}<b>${title}</b><span>${desc}</span><em>${st}</em>`;
    el.onclick = () => { if (!canBuy || !buy) return; buy(); save(); applyUpgrades(d); renderShop(d, save); };
    box.appendChild(el);
  }
}
