// Guardado local (récord y ajustes). Tolerante a fallos si localStorage no está disponible.
const K = 'headshot_v1';
const DEF = { best: 0, wave: 0, quality: 'auto', auto: true };

export function loadSave() {
  try { return { ...DEF, ...JSON.parse(localStorage.getItem(K) || '{}') }; } catch { return { ...DEF }; }
}
export function writeSave(d) {
  try { localStorage.setItem(K, JSON.stringify(d)); } catch { /* sin almacenamiento */ }
}
