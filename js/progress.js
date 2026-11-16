// Progreso: estrellas por nivel, desbloqueos y pago final. Lógica pura + pintado de la pantalla de niveles.
import { LEVELS } from './config.js';
import { reward } from './shop.js';

export const BOSS_STARS = 5; // estrellas de los niveles 1-3 que hacen falta para el jefe
const stars = (d, i) => d.stars[i] || [false, false, false];
export const starCount = (d, i) => stars(d, i).filter(Boolean).length;
export const zoneStars = (d) => [0, 1, 2].reduce((n, i) => n + starCount(d, i), 0);
export const cleared = (d, i) => !!d.stars[i];

// Un nivel se abre al superar el anterior; el jefe además pide BOSS_STARS estrellas.
export function unlocked(d, i) {
  if (i === 0) return true;
  if (!cleared(d, i - 1)) return false;
  return !LEVELS[i].boss || zoneStars(d) >= BOSS_STARS;
}

// Estrellas conseguidas en el intento: superar, tiempo <= par y reto propio del nivel.
export function evalStars(S) {
  const L = LEVELS[S.level], g = L.goal;
  return [true, S.t <= L.par, g === 'norel' ? S.st.reloads === 0 : g === 'head' ? S.st.headHits > 0 : S.st.dmg === 0];
}

// Aplica el resultado a la partida guardada y devuelve el desglose del pago.
export function applyResult(d, level, got, t, chestCoins) {
  const prev = stars(d, level), first = !cleared(d, level);
  const base = Math.round(reward(level, t) * (first ? 1 : 0.5)), newStars = got.filter((g, k) => g && !prev[k]).length, bonus = 50 * newStars;
  d.stars[level] = got.map((g, k) => g || prev[k]);
  const total = base + bonus + chestCoins; d.coins += total;
  return { base, bonus, chest: chestCoins, total, first, newStars };
}

const mark = (a) => a.map((g) => (g ? '★' : '☆')).join('');
// Pantalla de niveles: tarjetas con estrellas, reto y bloqueo.
export function renderLevels(d, play) {
  const box = document.getElementById('lvlList'); box.innerHTML = '';
  LEVELS.forEach((L, i) => {
    const ok = unlocked(d, i), el = document.createElement('button'); el.className = 'item lvl' + (ok ? '' : ' no');
    const need = !ok && L.boss && cleared(d, i - 1) ? `Necesitas ${BOSS_STARS} ★ (llevas ${zoneStars(d)})` : !ok ? 'Bloqueado' : `Par ${L.par} s · ${L.goalText}`;
    el.innerHTML = `<b>${i + 1} · ${L.name}</b><em>${mark(stars(d, i))}</em><span>${need}</span>`;
    if (ok) el.onclick = () => play(i);
    box.appendChild(el);
  });
  document.getElementById('lvlInfo').textContent = '★ ' + zoneStars(d) + ' / 9 en los niveles 1-3';
}
