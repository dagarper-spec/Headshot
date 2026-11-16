// Audio 100% procedural con WebAudio (sin archivos externos).
let ac, master, nbuf, rev, revIn;

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
    nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = nbuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Reverb de almacén: respuesta al impulso generada (ruido que decae)
    rev = ac.createConvolver(); const n = Math.floor(ac.sampleRate * 1.3), ir = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    rev.buffer = ir; revIn = ac.createGain(); revIn.gain.value = 0.28; revIn.connect(rev); rev.connect(master);
    drone();
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
  shot() { noise(0.05, 0.8, 9000, 2500, 'highpass', 0.6); noise(0.16, 0.9, 5000, 220, 'lowpass', 0.5); tone(170, 42, 0.16, 'sine', 0.9, 0.3); tone(90, 35, 0.22, 'triangle', 0.5); },
  eshot() { noise(0.14, 0.5, 2600, 260, 'lowpass', 0.8); tone(120, 48, 0.12, 'sine', 0.4, 0.5); },
  // Impactos en el enemigo: cuerpo (golpe sordo), cabeza (crujido seco + golpe), casco (metal)
  hit() { noise(0.12, 0.6, 900, 120, 'lowpass'); tone(130, 55, 0.12, 'sine', 0.55); tone(520, 260, 0.04, 'square', 0.07); },
  head() { noise(0.05, 0.7, 6000, 1500, 'bandpass'); noise(0.14, 0.7, 1400, 150, 'lowpass'); tone(190, 60, 0.14, 'sine', 0.6); tone(2300, 1500, 0.07, 'triangle', 0.15); },
  helmet() { ring([1250, 2060, 3350, 4700], 0.45, 0.28); noise(0.04, 0.6, 7000, 2000, 'highpass'); tone(220, 100, 0.08, 'square', 0.2); },
  kill() { noise(0.35, 0.5, 800, 80, 'lowpass', 0.3, 0.25); tone(80, 40, 0.3, 'sine', 0.6, 0, 0.25); }, // caída del cuerpo
  killHead() { noise(0.4, 0.6, 1300, 90, 'lowpass', 0.3); tone(70, 30, 0.35, 'sine', 0.7); noise(0.3, 0.45, 700, 80, 'lowpass', 0.3, 0.3); },
  hurt() { noise(0.25, 0.55, 600, 90, 'lowpass'); tone(110, 50, 0.35, 'sawtooth', 0.45); tone(60, 40, 0.5, 'sine', 0.6); },
  // Recarga: cargador fuera, cargador dentro, corredera
  magOut(d = 0) { noise(0.05, 0.35, 5000, 1500, 'bandpass', 0, d); tone(300, 160, 0.07, 'square', 0.1, 0, d); },
  magIn(d = 0) { noise(0.04, 0.45, 4000, 900, 'bandpass', 0, d); tone(210, 90, 0.09, 'square', 0.18, 0, d); tone(1700, 1100, 0.03, 'triangle', 0.1, 0, d); },
  slide(d = 0) { noise(0.09, 0.4, 6000, 1200, 'highpass', 0, d); tone(900, 450, 0.06, 'square', 0.12, 0, d + 0.06); },
  tink(v = 1) { ring([4200, 6100], 0.18, 0.1 * v); },
  empty() { tone(300, 160, 0.04, 'square', 0.12); noise(0.03, 0.3, 4000, 1500, 'bandpass'); },
  // Impactos de bala en el entorno
  imp(kind) {
    if (kind === 'metal') { ring([1800, 2900], 0.2, 0.12); noise(0.05, 0.3, 6000, 2000, 'highpass'); }
    else if (kind === 'wood') { tone(320, 140, 0.07, 'triangle', 0.25); noise(0.08, 0.35, 1800, 300, 'lowpass'); }
    else { noise(0.07, 0.35, 3500, 600, 'bandpass'); tone(180, 90, 0.05, 'sine', 0.15); }
  },
  wave() { tone(90, 70, 0.8, 'sawtooth', 0.35); tone(135, 105, 0.8, 'sawtooth', 0.2); },
  up() { tone(500, 900, 0.15, 'triangle', 0.25); setTimeout(() => tone(750, 1200, 0.2, 'triangle', 0.25), 110); },
};

// ---- Música de fondo (MP3 en bucle, en streaming). Se baja un momento con cada disparo (ducking). ----
const song = typeof Audio !== 'undefined' ? new Audio('assets/audio/musica.mp3') : null;
let musicOn = true, duck = 0;
const MUSIC_VOL = 0.2;
if (song) { song.loop = true; song.preload = 'auto'; song.volume = 0; }
export const music = {
  // Debe llamarse desde un gesto del usuario (móvil): empieza o reanuda la canción.
  play() { if (song && musicOn) song.play().catch(() => {}); },
  pause() { if (song) song.pause(); },
  setOn(v) { musicOn = v; if (!song) return; if (v) this.play(); else song.pause(); },
  duck() { duck = 1; },
  // dt en segundos: suaviza el volumen y recupera tras el ducking
  update(dt) { if (!song) return; duck = Math.max(0, duck - dt * 1.6); song.volume = MUSIC_VOL * (1 - 0.55 * duck); },
};
