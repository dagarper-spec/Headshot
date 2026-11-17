// Progreso: estrellas por nivel, desbloqueos y pago final. Lógica pura + pintado de la pantalla de niveles.
import { LEVELS } from './config.js';
import { reward } from './shop.js';

export const BOSS_STARS = 5; // estrellas de los niveles normales de la zona que hacen falta para el jefe
const stars = (d, i) => d.stars[i] || [false, false, false];
export const starCount = (d, i) => stars(d, i).filter(Boolean).length;
export const cleared = (d, i) => !!d.stars[i];
export const zoneOf = (i) => LEVELS[i].zone || 0;
const zoneIdx = (z) => LEVELS.map((L, i) => i).filter((i) => zoneOf(i) === z);
// Estrellas de los niveles normales (sin jefe) de una zona, y máximo posible.
export const zoneStars = (d, z = 0) => zoneIdx(z).filter((i) => !LEVELS[i].boss).reduce((n, i) => n + starCount(d, i), 0);
export const zoneMax = (z = 0) => zoneIdx(z).filter((i) => !LEVELS[i].boss).length * 3;

// Un nivel se abre al superar el anterior; el jefe además pide BOSS_STARS; la primera fase de una zona pide el jefe de la anterior.
export function unlocked(d, i) {
  if (i === 0) return true;
  const z = zoneOf(i), first = zoneIdx(z)[0] === i;
  if (first) return cleared(d, i - 1);
  if (!cleared(d, i - 1)) return false;
  return !LEVELS[i].boss || zoneStars(d, z) >= BOSS_STARS;
}

// Estrellas conseguidas en el intento: superar, tiempo <= par y reto propio del nivel.
export function evalStars(S) {
  const L = LEVELS[S.level], g = L.goal;
  return [true, S.t <= L.par, g === 'norel' ? S.st.reloads === 0 : g === 'drone' ? S.st.droneT > 0 && S.st.droneT <= 12 : g === 'head' ? S.st.headHits > 0 : S.st.dmg === 0];
}

// Aplica el resultado a la partida guardada y devuelve el desglose del pago.
export function applyResult(d, level, got, t, chestCoins) {
  const prev = stars(d, level), first = !cleared(d, level);
  const base = Math.round(reward(level, t) * (first ? 1 : 0.4)), newStars = got.filter((g, k) => g && !prev[k]).length, bonus = 50 * newStars;
  d.stars[level] = got.map((g, k) => g || prev[k]);
  const total = base + bonus + chestCoins; d.coins += total;
  return { base, bonus, chest: chestCoins, total, first, newStars };
}

const mark = (a) => a.map((g) => (g ? '★' : '☆')).join('');
const ZN = ['Almacén', 'Azotea'];
// Etiqueta corta del nivel: «ALMACÉN 2 · Casco de acero».
export const levelLabel = (i) => `${(ZN[zoneOf(i)] || '').toUpperCase()} ${zoneIdx(zoneOf(i)).indexOf(i) + 1} \u00B7 ${LEVELS[i].name}`;
// Pantalla de niveles: tarjetas con estrellas, reto y bloqueo, agrupadas por zona.
export function renderLevels(d, play) {
  const box = document.getElementById('lvlList'); box.innerHTML = ''; let zs = -1;
  LEVELS.forEach((L, i) => {
    const z = zoneOf(i);
    if (z !== zs) { zs = z; const h = document.createElement('h3'); h.className = 'zhead'; h.textContent = `ZONA ${z + 1} · ${ZN[z] || ''}  ★ ${zoneStars(d, z)}/${zoneMax(z)}`; box.appendChild(h); }
    const n = zoneIdx(z).indexOf(i) + 1, ok = unlocked(d, i), el = document.createElement('button'); el.className = 'item lvl' + (ok ? '' : ' no');
    const need = !ok && L.boss && cleared(d, i - 1) ? `Necesitas ${BOSS_STARS} ★ (llevas ${zoneStars(d, z)})` : !ok ? 'Bloqueado' : `Par ${L.par} s · ${L.goalText}`;
    el.innerHTML = `<b>${n} · ${L.name}</b><em>${mark(stars(d, i))}</em><span>${need}</span>`;
    if (ok) el.onclick = () => play(i);
    box.appendChild(el);
  });
  document.getElementById('lvlInfo').textContent = 'Consigue ' + BOSS_STARS + ' ★ en cada zona para enfrentarte a su jefe';
}
