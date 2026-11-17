// Economía y tienda: recompensa por tiempo y mejoras permanentes (guardadas en localStorage).
import { CFG, LEVELS } from './config.js';
import { setGlove, setSkin } from './view-fps.js';
import { COS } from './cosmetics.js';

const BASE = { mag: CFG.weapon.mag, reload: CFG.weapon.reload, hp: CFG.player.hp, rate: CFG.weapon.rate };

// Catálogo. 'up' = mejora permanente por niveles (prices[i] = precio del nivel i+1); 'glove' = cosmético; 'cons' = consumible de un nivel.
export const ITEMS = [
  { id: 'mag',  kind: 'up', name: 'Cargador ampliado', desc: ['Cargador de 7 balas', 'Cargador de 8 balas'], prices: [450, 900] },
  { id: 'fast', kind: 'up', name: 'Recarga rápida',    desc: ['Recarga un 15 % más rápida', 'Recarga un 30 % más rápida'], prices: [360, 720] },
  { id: 'stab', kind: 'up', name: 'Estabilidad',       desc: ['Un 20 % menos de dispersión', 'Un 35 % menos de dispersión'], prices: [420, 800] },
  { id: 'vest', kind: 'up', name: 'Chaleco',           desc: ['+1 vida (3 en total)'], prices: [1200], needBoss: true },
  { id: 'cMed',  kind: 'cons', name: 'Botiquín',         desc: ['+1 vida en el próximo nivel'], price: 150 },
  { id: 'cVest', kind: 'cons', name: 'Chaleco temporal', desc: ['Absorbe 1 tiro al cuerpo'], price: 200 },
  { id: 'gRed',   kind: 'glove', name: 'Guantes rojos',   desc: ['Cosmético'], price: 250, color: 0x8e1b1b },
  { id: 'gCamo',  kind: 'glove', name: 'Guantes camuflaje', desc: ['Cosmético'], price: 400, color: 0x4b5a35 },
  { id: 'gGold',  kind: 'glove', name: 'Guantes dorados', desc: ['Cosmético'], price: 700, color: 0xb8902a },
  // Pistola: acabados (mat = color, metal, rugosidad) y color del fogonazo (rgb HDR + luz)
  { id: 'rev', kind: 'weapon', name: 'Revólver .357', desc: ['5 balas · perfora casco y placas'], price: 600, needPlan: true },
  { id: 'sMatte',  kind: 'skin', name: 'Negra mate',      desc: ['Acabado sin brillo'], price: 300, color: 0x15171a, metal: 0.25, rough: 0.85 },
  { id: 'sBronze', kind: 'skin', name: 'Bronce envejecido', desc: ['Metal viejo y gastado'], price: 450, color: 0x9a7440, metal: 0.85, rough: 0.5 },
  { id: 'sChrome', kind: 'skin', name: 'Cromada',         desc: ['Brillo de espejo'], price: 650, color: 0xe6ebf0, metal: 1, rough: 0.1 },
  { id: 'fBlue',   kind: 'flash', name: 'Fogonazo azul',  desc: ['Cosmético'], price: 300, color: 0x6aa8ff, rgb: [1.8, 2.8, 4.5] },
  { id: 'fGreen',  kind: 'flash', name: 'Fogonazo verde', desc: ['Cosmético'], price: 300, color: 0x7dff9a, rgb: [1.5, 4.2, 1.8] },
  { id: 'fRed',    kind: 'flash', name: 'Fogonazo rojo',  desc: ['Cosmético'], price: 300, color: 0xff4a3a, rgb: [4.5, 1.2, 0.9] },
];

// Recompensa: completa si terminas dentro del tiempo par; baja en línea recta hasta 0 a 4x el par.
export function reward(level, t) {
  const L = LEVELS[level % LEVELS.length], k = Math.min(1, Math.max(0, (4 * L.par - t) / (3 * L.par)));
  return Math.round((L.pay * k) / 5) * 5;
}

// Aplica las mejoras compradas a la configuración del juego.
export function applyUpgrades(d) {
  const lv = (id) => +d.items[id] || 0;
  const rev = d.weapon === 'rev' && d.items.rev; // revólver .357: 5 balas, cadencia lenta, recarga lenta; perfora casco y placas
  CFG.weapon.kind = rev ? 'rev' : 'pistol'; COS.rev = !!rev;
  CFG.weapon.mag = (rev ? 5 : BASE.mag) + lv('mag');
  CFG.weapon.rate = rev ? 0.55 : BASE.rate;
  CFG.weapon.reload = (rev ? 2.4 : BASE.reload) * (1 - 0.15 * lv('fast'));
  window.headshot && window.headshot.view && window.headshot.view.setWeapon(CFG.weapon.kind);
  CFG.weapon.stab = 1 - [0, 0.2, 0.35][lv('stab')];
  CFG.player.hp = BASE.hp + (lv('vest') ? 1 : 0);
  const g = ITEMS.find((i) => i.id === d.glove); setGlove(g ? g.color : 0);
  const sk = ITEMS.find((i) => i.id === d.skin); setSkin(sk || null);
  const fl = ITEMS.find((i) => i.id === d.flash); COS.flash = fl ? fl.rgb : [4, 2.8, 1.2]; COS.light = fl ? fl.color : 0xffa860;
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
ICON.skin = (c) => `<path d="M6 24h38l4-6h10v10h-8l-3 4H34l-2 14H20l2-14H6z" fill="${c}" stroke="#0009" stroke-width="2.5" stroke-linejoin="round"/><path d="M12 28h28" stroke="#fff6" stroke-width="2"/>`;
ICON.rev = () => '<circle cx="30" cy="26" r="10" fill="#3a4048" stroke="#aab4c0" stroke-width="2.5"/><path d="M38 22h20v8H38z" fill="#23272d" stroke="#aab4c0" stroke-width="2"/><path d="M24 34l-8 22h12l4-18z" fill="#6a4426" stroke="#0009" stroke-width="2"/><circle cx="30" cy="26" r="3" fill="#111"/>';
ICON.flash = (c) => `<g fill="${c}"><path d="M32 6l5 17 17-5-12 13 14 10-18 1 3 18-9-15-11 14 2-18-17-3 14-10-10-14 16 6z"/></g><circle cx="32" cy="32" r="6" fill="#fff"/>`;
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const TABS = [['up', 'Mejoras'], ['cons', 'Consumibles'], ['glove', 'Guantes'], ['gun', 'Arma']];
let tab = 'up';

// Pinta la tienda como cuadrícula de tarjetas con imagen. save() guarda los cambios.
export function renderShop(d, save) {
  d.cons = d.cons || {};
  document.getElementById('coins').textContent = '$ ' + d.coins;
  const tabs = document.getElementById('shopTabs'); tabs.innerHTML = '';
  for (const [k, n] of TABS) { const b = document.createElement('button'); b.className = 'tab' + (k === tab ? ' on' : ''); b.textContent = n; b.onclick = () => { tab = k; renderShop(d, save); }; tabs.appendChild(b); }
  const box = document.getElementById('items'); box.innerHTML = '';
  const bossDone = !!(d.stars && d.stars[3]);
  for (const it of ITEMS.filter((i) => (tab === 'gun' ? i.kind === 'skin' || i.kind === 'flash' || i.kind === 'weapon' : i.kind === tab))) {
    const el = document.createElement('button'); let title = it.name, desc, st, canBuy = false, buy = null, pips = '', cls = 'item';
    if (it.kind === 'up') {
      const lv = +d.items[it.id] || 0, max = it.prices.length, price = it.prices[lv];
      pips = '<div class="pips">' + Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('') + '</div>';
      desc = it.desc[Math.min(lv, max - 1)];
      if (lv >= max) { st = 'Comprado'; cls += ' own'; } else if (it.needBoss && !bossDone) { st = 'Vence al jefe'; cls += ' no'; } else { st = '$ ' + price; canBuy = d.coins >= price; if (!canBuy) cls += ' no'; buy = () => { d.coins -= price; d.items[it.id] = lv + 1; }; }
    } else if (it.kind === 'cons') {
      const n = d.cons[it.id] || 0; desc = it.desc[0]; pips = n ? `<div class="have">Tienes ${n}</div>` : '';
      st = n >= 3 ? 'Máximo' : '$ ' + it.price; canBuy = d.coins >= it.price && n < 3; if (!canBuy) cls += ' no'; buy = () => { d.coins -= it.price; d.cons[it.id] = n + 1; };
    } else if (it.kind === 'weapon') { // el revólver necesita el plano del baúl dorado; se alterna con la pistola
      const own = !!d.items[it.id], eq = d.weapon === it.id; desc = it.desc[0];
      if (!d.items.plano && !own) { st = 'Falta el plano'; cls += ' no'; desc = 'Busca el baúl dorado oculto en el almacén'; }
      else if (own) { st = eq ? 'Equipado' : 'Equipar'; cls += eq ? ' own eq' : ' own'; canBuy = true; buy = () => { d.weapon = eq ? '' : it.id; }; }
      else { st = '$ ' + it.price; canBuy = d.coins >= it.price; if (!canBuy) cls += ' no'; buy = () => { d.coins -= it.price; d.items[it.id] = 1; d.weapon = it.id; }; }
    } else {
      const slot = it.kind === 'glove' ? 'glove' : it.kind, own = !!d.items[it.id], eq = d[slot] === it.id; desc = it.desc[0];
      if (own) { st = eq ? 'Equipado' : 'Equipar'; cls += eq ? ' own eq' : ' own'; canBuy = true; buy = () => { d[slot] = eq ? '' : it.id; }; }
      else { st = '$ ' + it.price; canBuy = d.coins >= it.price; if (!canBuy) cls += ' no'; buy = () => { d.coins -= it.price; d.items[it.id] = 1; d[slot] = it.id; }; }
    }
    const ic = it.kind === 'glove' ? ICON.glove(hex(it.color)) : it.kind === 'weapon' ? ICON.rev() : it.kind === 'skin' ? ICON.skin(hex(it.color)) : it.kind === 'flash' ? ICON.flash(hex(it.color)) : ICON[it.id]();
    el.className = cls;
    el.innerHTML = `<div class="pic"><svg viewBox="0 0 64 64">${ic}</svg></div><b>${title}</b><span>${desc}</span>${pips}<em>${st}</em>`;
    el.onclick = () => { if (!canBuy || !buy) return; buy(); save(); applyUpgrades(d); renderShop(d, save); };
    box.appendChild(el);
  }
}
