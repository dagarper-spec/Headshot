// Audio 100% procedural con WebAudio (sin archivos externos).
let ac, master, nbuf, rev, revIn;

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.6;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2; // permite sonidos fuertes sin saturar
    master.connect(comp); comp.connect(ac.destination);
    nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = nbuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Reverb de almacén: respuesta al impulso generada (ruido que decae)
    rev = ac.createConvolver(); const n = Math.floor(ac.sampleRate * 1.3), ir = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    rev.buffer = ir; revIn = ac.createGain(); revIn.gain.value = 0.28; revIn.connect(rev); rev.connect(master);
    drone(); hookMusic();
  } catch { ac = null; }
}

// Zumbido grave de ambiente (almacén industrial).
function drone() {
  const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
  o.type = 'sawtooth'; o.frequency.value = 48; o2.type = 'sine'; o2.frequency.value = 50.5;
  g.gain.value = 0.035;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180;
  o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(); o2.start();
}

function tone(f0, f1, dur, type, vol, wet = 0, delay = 0) {
  if (!ac) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); if (wet) g.connect(revIn); o.start(t); o.stop(t + dur);
}

// Ruido filtrado. type: lowpass | highpass | bandpass. Frecuencia barre de f0 a f1.
function noise(dur, vol, f0, f1, type = 'lowpass', wet = 0, delay = 0) {
  if (!ac) return;
  const t = ac.currentTime + delay, s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
  s.buffer = nbuf; f.type = type; f.Q.value = type === 'bandpass' ? 2 : 0.7;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); if (wet) g.connect(revIn); s.start(t, Math.random() * 0.5, dur);
}

// Sonido metálico: varios parciales inarmónicos que se apagan (casco, casquillo, impacto en metal).
function ring(freqs, dur, vol, delay = 0) { freqs.forEach((f, i) => tone(f * (1 + Math.random() * 0.02), f * 0.97, dur / (1 + i * 0.5), 'sine', vol / (1 + i * 0.6), 0, delay)); }

export const sfx = {
  // Disparo del jugador: chasquido agudo + estampido grave + eco del almacén
  shot() { const j = 1 + Math.random() * 0.12; noise(0.02, 1, 10000, 4000, 'highpass', 0.5); noise(0.05, 0.8, 7000, 1800, 'highpass', 0.6); noise(0.2, 0.9, 4500 * j, 180, 'lowpass', 0.6); tone(190 * j, 40, 0.18, 'sine', 1, 0.3); tone(95, 33, 0.26, 'triangle', 0.55); noise(0.5, 0.18, 1500, 200, 'lowpass', 1, 0.04); }, // chasquido + estampido + cola de eco del almacén
  shotSmg() { const j = 1 + Math.random() * 0.15; noise(0.015, 0.9, 10000, 4000, 'highpass', 0.3); noise(0.05, 0.8, 6000, 2200, 'highpass', 0.3); noise(0.11, 0.85, 4500 * j, 300, 'lowpass', 0.35); tone(230 * j, 60, 0.1, 'sine', 0.8); },
  shotSniper() { noise(0.14, 0.55, 2600, 240, 'lowpass', 0.5); noise(0.03, 0.4, 8000, 3500, 'highpass', 0.3); tone(120, 38, 0.24, 'sine', 0.9, 0.3); sfx.slide(0.55); }, // fusil con silenciador: seco y grave + cerrojo
  shotRev() { const j = 1 + Math.random() * 0.08; noise(0.025, 1, 9000, 3000, 'highpass', 0.7); noise(0.07, 1, 7000, 1500, 'highpass', 0.7); noise(0.34, 1, 4000 * j, 120, 'lowpass', 0.7); tone(125 * j, 28, 0.34, 'sine', 1.2, 0.5); tone(65, 26, 0.4, 'triangle', 0.7); noise(0.7, 0.22, 1200, 150, 'lowpass', 1, 0.05); },
  eshot() { noise(0.14, 0.5, 2600, 260, 'lowpass', 0.8); tone(120, 48, 0.12, 'sine', 0.4, 0.5); },
  // Impactos en el enemigo: cuerpo (golpe sordo), cabeza (crujido seco + golpe), casco (metal)
  hit() { noise(0.12, 0.6, 900, 120, 'lowpass'); tone(130, 55, 0.12, 'sine', 0.55); tone(520, 260, 0.04, 'square', 0.07); },
  head() { noise(0.05, 0.7, 6000, 1500, 'bandpass'); noise(0.14, 0.7, 1400, 150, 'lowpass'); tone(190, 60, 0.14, 'sine', 0.6); tone(2300, 1500, 0.07, 'triangle', 0.15); },
  helmet() { ring([1250, 2060, 3350, 4700], 0.45, 0.28); noise(0.04, 0.6, 7000, 2000, 'highpass'); tone(220, 100, 0.08, 'square', 0.2); },
  kill() { noise(0.35, 0.5, 800, 80, 'lowpass', 0.3, 0.25); tone(80, 40, 0.3, 'sine', 0.6, 0, 0.25); }, // caída del cuerpo
  killHead() { noise(0.4, 0.6, 1300, 90, 'lowpass', 0.3); tone(70, 30, 0.35, 'sine', 0.7); noise(0.3, 0.45, 700, 80, 'lowpass', 0.3, 0.3); },
  combo(n = 2) { tone(520 + n * 110, 900 + n * 160, 0.14, 'triangle', 0.22); ring([1900 + n * 300], 0.22, 0.1); }, // sube de tono con la racha
  hurt() { noise(0.18, 0.7, 500, 80, 'lowpass'); tone(95, 45, 0.25, 'sine', 0.8); noise(0.12, 0.35, 2500, 600, 'bandpass', 0, 0.02); noise(0.45, 0.2, 700, 250, 'bandpass', 0, 0.1); }, // golpe sordo + quejido
  // Recarga: cargador fuera, cargador dentro, corredera
  magOut(d = 0) { noise(0.03, 0.5, 5000, 1800, 'bandpass', 0, d); tone(180, 90, 0.06, 'square', 0.12, 0, d); noise(0.08, 0.25, 900, 300, 'lowpass', 0, d + 0.03); },
  magIn(d = 0) { noise(0.03, 0.6, 4500, 1200, 'bandpass', 0, d); tone(150, 70, 0.1, 'square', 0.22, 0, d); noise(0.06, 0.4, 700, 200, 'lowpass', 0, d + 0.02); ring([2600], 0.08, 0.06, d + 0.03); },
  slide(d = 0) { noise(0.07, 0.5, 5500, 1500, 'bandpass', 0, d); noise(0.03, 0.6, 7000, 2500, 'highpass', 0, d + 0.07); tone(160, 80, 0.05, 'square', 0.2, 0, d + 0.07); ring([2200], 0.07, 0.07, d + 0.08); },
  tink(v = 1) { ring([4200, 6100], 0.18, 0.03 * v); },
  empty() { tone(300, 160, 0.04, 'square', 0.12); noise(0.03, 0.3, 4000, 1500, 'bandpass'); },
  // Impactos de bala en el entorno
  imp(kind) {
    if (kind === 'metal') { ring([1800, 2900], 0.2, 0.12); noise(0.05, 0.3, 6000, 2000, 'highpass'); }
    else if (kind === 'wood') { tone(320, 140, 0.07, 'triangle', 0.25); noise(0.08, 0.35, 1800, 300, 'lowpass'); }
    else { noise(0.07, 0.35, 3500, 600, 'bandpass'); tone(180, 90, 0.05, 'sine', 0.15); }
  },
  // Explosión (graves + ruido + eco), pitido de granada, cofre, blindaje del jefe y cambio de fase
  boom() { noise(0.03, 1, 9000, 3000, 'highpass', 0.4); noise(0.12, 1, 6000, 800, 'lowpass', 0.6); tone(70, 22, 1.0, 'sine', 1.6, 0.5); tone(45, 20, 1.2, 'sine', 1, 0.4); noise(1.5, 0.7, 1800, 50, 'lowpass', 1); for (let i = 0; i < 7; i++) { const d = 0.25 + Math.random() * 1.1; noise(0.05, 0.22 * (1.3 - d * 0.6), 4000 + Math.random() * 3000, 800, 'bandpass', 0.4, d); } tone(3600, 3400, 0.9, 'sine', 0.04, 0, 0.1); }, // estampido seco + retumbar + escombros cayendo + pitido de oído
  warn(k = 0) { tone(190 + 80 * k, 100, 0.14, 'sine', 1.6 + 0.8 * k); noise(0.05, 0.9 + 0.5 * k, 2500, 600, 'bandpass'); tone(900 + 500 * k, 400, 0.05, 'triangle', 0.35 + 0.2 * k); },
  clunk(v = 1) { ring([620, 1450, 2700], 0.22, 0.4 * v); noise(0.05, 0.5 * v, 3000, 500, 'bandpass'); tone(110, 60, 0.08, 'sine', 0.5 * v); }, // granada metálica rebotando en el suelo
  beep() { sfx.clunk(0.5); },
  pin() { ring([3100, 4300], 0.09, 0.16); noise(0.025, 0.4, 7000, 3000, 'highpass'); ring([2300, 3700], 0.35, 0.22, 0.22); noise(0.12, 0.3, 1500, 400, 'bandpass', 0, 0.3); }, // anilla, palanca que salta y lanzamiento
  chest() { tone(660, 990, 0.12, 'triangle', 0.25); tone(990, 1320, 0.18, 'triangle', 0.25, 0, 0.1); noise(0.12, 0.25, 3000, 800, 'bandpass'); },
  armor() { ring([900, 1500, 2300], 0.3, 0.25); noise(0.05, 0.5, 5000, 1500, 'highpass'); tone(120, 60, 0.1, 'sine', 0.4); },
  phase() { tone(160, 60, 0.7, 'sawtooth', 0.5, 0.4); tone(120, 50, 0.9, 'square', 0.3, 0.4, 0.1); },
  wave() { noise(1.3, 1.3, 300, 2400, 'bandpass', 0.5); tone(130, 55, 1.0, 'sine', 1.8, 0.3); tone(260, 120, 0.7, 'triangle', 0.5, 0.3, 0.05); noise(0.35, 1.4, 2500, 350, 'lowpass', 0.4, 0.05); },
  up() { tone(500, 900, 0.15, 'triangle', 0.25); setTimeout(() => tone(750, 1200, 0.2, 'triangle', 0.25), 110); },
};

// ---- Música: MP3 de menú y MP3 de combate (muy bajito durante la partida). ----
const song = typeof Audio !== 'undefined' ? new Audio('assets/audio/musica.mp3') : null;
let musicOn = true, duck = 0, mode = 'menu', mvol = 1;
const fight = typeof Audio !== 'undefined' ? new Audio('assets/audio/combate.mp3') : null;
const MUSIC_VOL = 0.09, FIGHT_VOL = 0.05;
for (const a of [song, fight]) if (a) { a.loop = true; a.preload = 'auto'; a.volume = 0; }

// Volumen de música por WebAudio (en iPhone, audio.volume no se puede cambiar): cada MP3 pasa por su GainNode.
const mg = [];
function hookMusic() {
  if (!/^https?:/.test(location.protocol) || mg.length) return;
  try { for (const a of [song, fight]) if (a) { const g = ac.createGain(); ac.createMediaElementSource(a).connect(g); g.connect(ac.destination); g.gain.value = a.volume; a.volume = 1; mg.push([a, g]); } } catch { mg.length = 0; }
}
const setVolOf = (a, v) => { const m = mg.find((x) => x[0] === a); if (m) m[1].gain.value = v; else a.volume = Math.min(1, v); };
function apply() {
  const menu = mode === 'menu';
  if (song) { if (menu && musicOn) song.play().catch(() => {}); else song.pause(); }
  if (fight) { if (!menu && musicOn) fight.play().catch(() => {}); else fight.pause(); }
}
// Zumbido del dron: rotores con tremolo; vol 0..1 según cercanía (0 = apagado).
let dh = null;
sfx.droneHum = (vol) => {
  if (!ac) return;
  if (!dh) {
    if (vol <= 0) return;
    const o = ac.createOscillator(), o2 = ac.createOscillator(), l = ac.createOscillator(), lg = ac.createGain(), tr = ac.createGain(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = 160; o2.type = 'square'; o2.frequency.value = 163; l.frequency.value = 22; lg.gain.value = 0.4; tr.gain.value = 0.6; f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 0.8; g.gain.value = 0;
    l.connect(lg); lg.connect(tr.gain); o.connect(f); o2.connect(f); f.connect(tr); tr.connect(g); g.connect(master); o.start(); o2.start(); l.start(); dh = g;
  }
  dh.gain.setTargetAtTime(vol * 0.06, ac.currentTime, 0.1);
};
export const music = {
  // m = 'menu' (MP3) | 'game' (pista calmada). Llamar desde un gesto del usuario en móvil.
  mode(m) { mode = m; apply(); },
  play() { apply(); },
  pause() { if (song) song.pause(); if (fight) fight.pause(); },
  setOn(v) { musicOn = v; apply(); },
  setVol(k) { mvol = k; music.update(0); }, // 0..3 (1 = nivel por defecto)
  duck() { duck = 1; },
  update(dt) { duck = Math.max(0, duck - dt * 1.6); if (song) setVolOf(song, MUSIC_VOL * mvol * (1 - 0.55 * duck)); if (fight) setVolOf(fight, FIGHT_VOL * mvol * (1 - 0.55 * duck)); },
};
