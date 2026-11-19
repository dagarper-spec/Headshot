// Guardado local (récord y ajustes). Tolerante a fallos si localStorage no está disponible.
const K = 'headshot_v1';
const DEF = { level: 0, quality: 'auto', music: true, musicVol: 50, blood: 'normal', coins: 0, items: {}, weapon: '', glove: '', skin: '', flash: '', stars: {}, endless: {}, helmet: '', weapon2: '', expl: '' };

export const freshSave = () => ({ ...DEF, items: {}, stars: {}, cons: {}, endless: {}, helmet: '', weapon2: '', expl: '' });
export function loadSave() {
  try { return { ...DEF, ...JSON.parse(localStorage.getItem(K) || '{}') }; } catch { return { ...DEF }; }
}
export function writeSave(d) {
  try { localStorage.setItem(K, JSON.stringify(d)); } catch { /* sin almacenamiento */ }
}
