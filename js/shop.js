// Economía y tienda: recompensa por tiempo y mejoras permanentes (guardadas en localStorage).
import { CFG, LEVELS, WEAPONS, HELMETS } from './config.js';
import { setGlove, setSkin } from './view-fps.js';
import { COS } from './cosmetics.js';

const BASE = { mag: CFG.weapon.mag, reload: CFG.weapon.reload, hp: CFG.player.hp, rate: CFG.weapon.rate };

// Catálogo. 'up' = mejora permanente por niveles (prices[i] = precio del nivel i+1); 'glove' = cosmético; 'cons' = consumible de un nivel.
export const ITEMS = [
  { id: 'mag',  kind: 'up', name: 'Cargador ampliado', desc: ['Cargador de 7 balas', 'Cargador de 8 balas'], prices: [450, 900] },
  { id: 'fast', kind: 'up', name: 'Recarga rápida',    desc: ['Recarga un 15 % más rápida', 'Recarga un 30 % más rápida'], prices: [360, 720] },
  { id: 'stab', kind: 'up', name: 'Estabilidad',       desc: ['Un 20 % menos de dispersión', 'Un 35 % menos de dispersión'], prices: [420, 800] },
  { id: 'vest', kind: 'up', name: 'Chaleco blindado',  desc: ['Blindaje 1: absorbe 1 tiro al cuerpo', 'Blindaje 2: absorbe 2 tiros', 'Blindaje 3: absorbe 3 tiros'], prices: [1200, 2000, 3000], needBoss: true },
  { id: 'gren', kind: 'cons', name: 'Granadas ×3', desc: ['Mata en 3 m e ignora casco y placa'], price: 240, pack: 3, max: 9 },
  { id: 'mine', kind: 'cons', name: 'Minas ×2', desc: ['Explotan cuando un enemigo pasa cerca'], price: 300, pack: 2, max: 6 },
  { id: 'cMed',  kind: 'cons', name: 'Botiquín',         desc: ['+1 vida en el próximo nivel'], price: 150 },
  { id: 'cVest', kind: 'cons', name: 'Chaleco temporal', desc: ['Absorbe 1 tiro al cuerpo'], price: 200 },
  { id: 'gRed',   kind: 'glove', name: 'Guantes rojos',   desc: ['Cosmético'], price: 250, color: 0x8e1b1b },
  { id: 'gCamo',  kind: 'glove', name: 'Guantes camuflaje', desc: ['Cosmético'], price: 400, color: 0x4b5a35 },
  { id: 'gGold',  kind: 'glove', name: 'Guantes dorados', desc: ['Cosmético'], price: 700, color: 0xb8902a },
  // Pistola: acabados (mat = color, metal, rugosidad) y color del fogonazo (rgb HDR + luz)
  { id: 'rev', kind: 'weapon', name: 'Revólver .357', desc: ['6 balas · perfora casco y placas'], price: 600, needPlan: true },
  { id: 'smg', kind: 'weapon', name: 'Subfusil SMG-9', desc: ['18 balas · disparo automático'], price: 1500 },
  { id: 'sniper', kind: 'weapon', name: 'Fusil francotirador', desc: ['Zoom ×4 · silenciado · perfora'], price: 2000 },
  { id: 'hLight', kind: 'helmet', name: 'Casco táctico', desc: ['Absorbe 1 tiro a la cabeza por misión'], price: 900 },
  { id: 'hHeavy', kind: 'helmet', name: 'Casco blindado', desc: ['Absorbe 2 tiros a la cabeza por misión'], price: 1900 },
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
// Arma principal y secundaria equipadas (la secundaria puede ser null).
export const loadout = (d) => { const own = (k) => k && WEAPONS[k] && (k === 'pistol' || d.items[k]), p = own(d.weapon) ? d.weapon : 'pistol'; return [p, own(d.weapon2) && d.weapon2 !== p ? d.weapon2 : null]; };

// Pone en CFG las estadísticas del arma wk (con las mejoras de cargador/recarga).
export function applyWeapon(d, wk) {
  const lv = (id) => +d.items[id] || 0, W = WEAPONS[wk];
  Object.assign(CFG.weapon, { kind: wk, mag: W.mag + lv('mag'), rate: W.rate, reload: W.reload * (1 - 0.15 * lv('fast')), pierce: W.pierce, auto: W.auto, spreadK: W.spreadK, zoomK: W.zoomK, sens: W.sens, sil: !!W.sil });
  COS.rev = !W.shell; COS.shk = W.shk;
}

export function applyUpgrades(d) {
  const lv = (id) => +d.items[id] || 0, wk = loadout(d)[0];
  applyWeapon(d, wk);
  window.headshot && window.headshot.view && window.headshot.view.setWeapon(wk);
  const h = HELMETS[d.helmet]; CFG.player.helmet = h && d.items[d.helmet] ? h.hits : 0;
  CFG.weapon.stab = 1 - [0, 0.2, 0.35][lv('stab')];
  CFG.player.hp = BASE.hp; CFG.player.armor = lv('vest'); // el chaleco da puntos de blindaje, no vida
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
  gren: () => '<ellipse cx="32" cy="38" rx="16" ry="19" fill="#4a5a3a" stroke="#222" stroke-width="2.5"/><path d="M20 30h24M19 40h26M22 49h20" stroke="#2c3724" stroke-width="2"/><rect x="27" y="12" width="10" height="8" fill="#9aa" stroke="#222" stroke-width="2"/><path d="M38 14l12-5v6l-10 3" fill="none" stroke="#bcc" stroke-width="3"/><circle cx="22" cy="14" r="5" fill="none" stroke="#bcc" stroke-width="2.5"/>',
  mine: () => '<ellipse cx="32" cy="42" rx="24" ry="9" fill="#2d3128" stroke="#111" stroke-width="2.5"/><ellipse cx="32" cy="38" rx="22" ry="8" fill="#3d4436" stroke="#111" stroke-width="2.5"/><circle cx="32" cy="36" r="4" fill="#e22" stroke="#611" stroke-width="2"/><path d="M14 38l-5-5M50 38l5-5M32 29v-8" stroke="#888" stroke-width="3" stroke-linecap="round"/>',
  cMed: () => '<rect x="8" y="16" width="48" height="36" rx="6" fill="#e9eef2" stroke="#9aa6b2" stroke-width="2.5"/><rect x="24" y="10" width="16" height="8" rx="3" fill="#9aa6b2"/><path d="M32 24v20M22 34h20" stroke="#d6322a" stroke-width="7" stroke-linecap="round"/>',
  cVest: () => '<path d="M18 8l8 4h12l8-4 10 10-6 8v28H14V26l-6-8z" fill="#46516a" stroke="#8fb4ff" stroke-width="2.5" stroke-linejoin="round" stroke-dasharray="5 3"/><text x="32" y="44" text-anchor="middle" font-size="22" font-family="Impact,sans-serif" fill="#cfe0ff">x1</text>',
  glove: (c) => `<path d="M20 58V36l-8-10c-2-3 2-7 5-4l5 5V12c0-3 5-3 5 0v14V9c0-3 5-3 5 0v17V11c0-3 5-3 5 0v18V16c0-3 5-3 5 0v26c0 8-4 16-10 16z" fill="${c}" stroke="#0007" stroke-width="2" stroke-linejoin="round"/><path d="M20 50h22" stroke="#0006" stroke-width="3"/>`,
};
ICON.skin = (c) => `<path d="M6 24h38l4-6h10v10h-8l-3 4H34l-2 14H20l2-14H6z" fill="${c}" stroke="#0009" stroke-width="2.5" stroke-linejoin="round"/><path d="M12 28h28" stroke="#fff6" stroke-width="2"/>`;
ICON.rev = () => '<circle cx="30" cy="26" r="10" fill="#3a4048" stroke="#aab4c0" stroke-width="2.5"/><path d="M38 22h20v8H38z" fill="#23272d" stroke="#aab4c0" stroke-width="2"/><path d="M24 34l-8 22h12l4-18z" fill="#6a4426" stroke="#0009" stroke-width="2"/><circle cx="30" cy="26" r="3" fill="#111"/>';
ICON.flash = (c) => `<g fill="${c}"><path d="M32 6l5 17 17-5-12 13 14 10-18 1 3 18-9-15-11 14 2-18-17-3 14-10-10-14 16 6z"/></g><circle cx="32" cy="32" r="6" fill="#fff"/>`;
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const TABS = [['up', 'Mejoras'], ['cons', 'Consumibles'], ['weapon', 'Armas'], ['helmet', 'Cascos'], ['glove', 'Guantes'], ['gun', 'Aspecto']];
// Imágenes renderizadas de los objetos (assets/img/<id>.png); las que faltan usan el icono vectorial.
export const IMGS = new Set(['pistol', 'rev', 'smg', 'sniper', 'hLight', 'hHeavy', 'sMatte', 'sBronze', 'sChrome', 'fBlue', 'fGreen', 'fRed', 'gRed', 'gCamo', 'gGold', 'mag', 'fast', 'stab', 'vest', 'cVest', 'gren', 'mine', 'cMed']);
export const itemImg = (id) => IMGS.has(id) ? `<img src="assets/img/${id}.png" alt="" draggable="false">` : '';
let tab = 'up';

// Pinta la tienda como cuadrícula de tarjetas con imagen. save() guarda los cambios.
export function renderShop(d, save) {
  d.cons = d.cons || {};
  document.getElementById('coins').textContent = '$ ' + d.coins;
  const tabs = document.getElementById('shopTabs'); tabs.innerHTML = '';
  for (const [k, n] of TABS) { const b = document.createElement('button'); b.className = 'tab' + (k === tab ? ' on' : ''); b.textContent = n; b.onclick = () => { tab = k; renderShop(d, save); }; tabs.appendChild(b); }
  const box = document.getElementById('items'); box.innerHTML = '';
  const bossDone = !!(d.stars && d.stars[3]);
  for (const it of ITEMS.filter((i) => (tab === 'gun' ? i.kind === 'skin' || i.kind === 'flash' : i.kind === tab))) {
    const el = document.createElement('button'); let title = it.name, desc, st, canBuy = false, buy = null, pips = '', cls = 'item';
    if (it.kind === 'up') {
      const lv = +d.items[it.id] || 0, max = it.prices.length, price = it.prices[lv];
      pips = '<div class="pips">' + Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('') + '</div>';
      desc = it.desc[Math.min(lv, max - 1)];
      if (lv >= max) { st = 'Comprado'; cls += ' own'; } else if (it.needBoss && !bossDone) { st = 'Vence al jefe'; cls += ' no'; } else { st = '$ ' + price; canBuy = d.coins >= price; if (!canBuy) cls += ' no'; buy = () => { d.coins -= price; d.items[it.id] = lv + 1; }; }
    } else if (it.kind === 'cons') {
      const n = d.cons[it.id] || 0; desc = it.desc[0]; pips = n ? `<div class="have">Tienes ${n}</div>` : '';
      const mx = it.max || 3; st = n >= mx ? 'Máximo' : '$ ' + it.price; canBuy = d.coins >= it.price && n < mx; if (!canBuy) cls += ' no'; buy = () => { d.coins -= it.price; d.cons[it.id] = Math.min(mx, n + (it.pack || 1)); };
    } else if (it.kind === 'weapon' || it.kind === 'helmet') { // se compran aquí y se equipan en la pantalla de equipamiento
      const own = !!d.items[it.id]; desc = it.desc[0];
      if (it.needPlan && !d.items.plano && !own) { st = 'Falta el plano'; cls += ' no'; desc = 'Busca el baúl dorado oculto en el almacén'; }
      else if (own) { st = 'En tu arsenal'; cls += ' own'; }
      else { st = '$ ' + it.price; canBuy = d.coins >= it.price; if (!canBuy) cls += ' no'; buy = () => { d.coins -= it.price; d.items[it.id] = 1; if (it.kind === 'weapon') d.weapon = it.id; else d.helmet = it.id; }; }
    } else {
      const slot = it.kind === 'glove' ? 'glove' : it.kind, own = !!d.items[it.id], eq = d[slot] === it.id; desc = it.desc[0];
      if (own) { st = eq ? 'Equipado' : 'Equipar'; cls += eq ? ' own eq' : ' own'; canBuy = true; buy = () => { d[slot] = eq ? '' : it.id; }; }
      else { st = '$ ' + it.price; canBuy = d.coins >= it.price; if (!canBuy) cls += ' no'; buy = () => { d.coins -= it.price; d.items[it.id] = 1; d[slot] = it.id; }; }
    }
    const ic = IMGS.has(it.id) ? '' : it.kind === 'glove' ? ICON.glove(hex(it.color)) : it.kind === 'skin' ? ICON.skin(hex(it.color)) : it.kind === 'flash' ? ICON.flash(hex(it.color)) : ICON[it.id]();
    el.className = cls;
    el.innerHTML = `<div class="pic${IMGS.has(it.id) ? ' img' : ''}">${IMGS.has(it.id) ? itemImg(it.id) : `<svg viewBox="0 0 64 64">${ic}</svg>`}</div><b>${title}</b><span>${desc}</span>${pips}<em>${st}</em>`;
    el.onclick = () => { if (!canBuy || !buy) return; buy(); save(); applyUpgrades(d); renderShop(d, save); };
    box.appendChild(el);
  }
}
