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

// Iconos vectoriales (viewBox 64) de cada objeto; "c" = color del guante.
const ICON = {
  mag: () => '<rect x="22" y="8" width="20" height="40" rx="3" fill="#59616b" stroke="#aab4c0" stroke-width="2"/><rect x="24" y="48" width="16" height="8" rx="2" fill="#2d3238"/><g fill="#e6b84a"><rect x="26" y="12" width="12" height="6" rx="2"/><rect x="26" y="21" width="12" height="6" rx="2"/><rect x="26" y="30" width="12" height="6" rx="2"/><rect x="26" y="39" width="12" height="6" rx="2"/></g><path d="M46 16v10M41 21h10" stroke="#8be28b" stroke-width="3" stroke-linecap="round"/>',
  fast: () => '<circle cx="32" cy="36" r="20" fill="#232a33" stroke="#aab4c0" stroke-width="3"/><rect x="28" y="6" width="8" height="6" fill="#aab4c0"/><path d="M32 36V22" stroke="#ffb347" stroke-width="3" stroke-linecap="round"/><path d="M32 36l10 6" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M14 18l-8 6 8 4z M50 18l8 6-8 4z" fill="#8be28b"/>',
  stab: () => '<circle cx="32" cy="32" r="20" fill="none" stroke="#7fd0ff" stroke-width="3"/><circle cx="32" cy="32" r="4" fill="#ff6a5a"/><path d="M32 4v14M32 46v14M4 32h14M46 32h14" stroke="#e8eef5" stroke-width="3" stroke-linecap="round"/>',
  vest: () => '<path d="M18 8l8 4h12l8-4 10 10-6 8v28H14V26l-6-8z" fill="#3a4350" stroke="#aab4c0" stroke-width="2.5" stroke-linejoin="round"/><path d="M24 22h16v14H24z" fill="#2a313a" stroke="#6a7686" stroke-width="2"/><path d="M32 14v40" stroke="#6a7686" stroke-width="2"/><path d="M26 44h12" stroke="#ffb347" stroke-width="3"/>',
  cMed: () => '<rect x="8" y="16" width="48" height="36" rx="6" fill="#e9eef2" stroke="#9aa6b2" stroke-width="2.5"/><rect x="24" y="10" width="16" height="8" rx="3" fill="#9aa6b2"/><path d="M32 24v20M22 34h20" stroke="#d6322a" stroke-width="7" stroke-linecap="round"/>',
  cVest: () => '<path d="M18 8l8 4h12l8-4 10 10-6 8v28H14V26l-6-8z" fill="#46516a" stroke="#8fb4ff" stroke-width="2.5" stroke-linejoin="round" stroke-dasharray="5 3"/><text x="32" y="44" text-anchor="middle" font-size="22" font-family="Impact,sans-serif" fill="#cfe0ff">x1</text>',
  glove: (c) => `<path d="M20 58V36l-8-10c-2-3 2-7 5-4l5 5V12c0-3 5-3 5 0v14V9c0-3 5-3 5 0v17V11c0-3 5-3 5 0v18V16c0-3 5-3 5 0v26c0 8-4 16-10 16z" fill="${c}" stroke="#0007" stroke-width="2" stroke-linejoin="round"/><path d="M20 50h22" stroke="#0006" stroke-width="3"/>`,
};
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const TABS = [['up', 'Mejoras'], ['cons', 'Consumibles'], ['glove', 'Guantes']];
let tab = 'up';

// Pinta la tienda como cuadrícula de tarjetas con imagen. save() guarda los cambios.
export function renderShop(d, save) {
  d.cons = d.cons || {};
  document.getElementById('coins').textContent = '$ ' + d.coins;
  const tabs = document.getElementById('shopTabs'); tabs.innerHTML = '';
  for (const [k, n] of TABS) { const b = document.createElement('button'); b.className = 'tab' + (k === tab ? ' on' : ''); b.textContent = n; b.onclick = () => { tab = k; renderShop(d, save); }; tabs.appendChild(b); }
  const box = document.getElementById('items'); box.innerHTML = '';
  const bossDone = !!(d.stars && d.stars[3]);
  for (const it of ITEMS.filter((i) => i.kind === tab)) {
    const el = document.createElement('button'); let title = it.name, desc, st, canBuy = false, buy = null, pips = '', cls = 'item';
    if (it.kind === 'up') {
      const lv = +d.items[it.id] || 0, max = it.prices.length, price = it.prices[lv];
      pips = '<div class="pips">' + Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('') + '</div>';
      desc = it.desc[Math.min(lv, max - 1)];
      if (lv >= max) { st = 'Comprado'; cls += ' own'; } else if (it.needBoss && !bossDone) { st = 'Vence al jefe'; cls += ' no'; } else { st = '$ ' + price; canBuy = d.coins >= price; if (!canBuy) cls += ' no'; buy = () => { d.coins -= price; d.items[it.id] = lv + 1; }; }
    } else if (it.kind === 'cons') {
      const n = d.cons[it.id] || 0; desc = it.desc[0]; pips = n ? `<div class="have">Tienes ${n}</div>` : '';
      st = n >= 3 ? 'Máximo' : '$ ' + it.price; canBuy = d.coins >= it.price && n < 3; if (!canBuy) cls += ' no'; buy = () => { d.coins -= it.price; d.cons[it.id] = n + 1; };
    } else {
      const own = !!d.items[it.id], eq = d.glove === it.id; desc = it.desc[0];
      if (own) { st = eq ? 'Equipado' : 'Equipar'; cls += eq ? ' own eq' : ' own'; canBuy = true; buy = () => { d.glove = eq ? '' : it.id; }; }
      else { st = '$ ' + it.price; canBuy = d.coins >= it.price; if (!canBuy) cls += ' no'; buy = () => { d.coins -= it.price; d.items[it.id] = 1; d.glove = it.id; }; }
    }
    const ic = it.kind === 'glove' ? ICON.glove(hex(it.color)) : ICON[it.id]();
    el.className = cls;
    el.innerHTML = `<div class="pic"><svg viewBox="0 0 64 64">${ic}</svg></div><b>${title}</b><span>${desc}</span>${pips}<em>${st}</em>`;
    el.onclick = () => { if (!canBuy || !buy) return; buy(); save(); applyUpgrades(d); renderShop(d, save); };
    box.appendChild(el);
  }
}
