// Audio 100% procedural con WebAudio (sin archivos externos).
let ac, master, nbuf;

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
    nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = nbuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
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

function tone(f0, f1, dur, type, vol) {
  if (!ac) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
}

function noise(dur, vol, f0, f1) {
  if (!ac) return;
  const t = ac.currentTime, s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
  s.buffer = nbuf; f.type = 'lowpass';
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5, dur);
}

export const sfx = {
  shot() { noise(0.14, 0.9, 4000, 250); tone(150, 45, 0.12, 'sine', 0.8); },
  eshot() { noise(0.12, 0.55, 3000, 300); tone(110, 50, 0.1, 'sine', 0.5); },
  hit() { tone(700, 300, 0.05, 'square', 0.12); },
  head() { tone(1700, 800, 0.09, 'triangle', 0.3); tone(500, 200, 0.1, 'square', 0.1); },
  kill() { noise(0.28, 0.45, 1100, 90); tone(220, 60, 0.28, 'sawtooth', 0.2); },
  hurt() { tone(120, 55, 0.3, 'sawtooth', 0.5); noise(0.2, 0.3, 700, 100); },
  reload() { tone(1200, 800, 0.04, 'square', 0.12); setTimeout(() => tone(900, 600, 0.05, 'square', 0.14), 700); },
  empty() { tone(300, 200, 0.04, 'square', 0.1); },
  wave() { tone(90, 70, 0.8, 'sawtooth', 0.35); tone(135, 105, 0.8, 'sawtooth', 0.2); },
  up() { tone(500, 900, 0.15, 'triangle', 0.25); setTimeout(() => tone(750, 1200, 0.2, 'triangle', 0.25), 110); },
};

// ---- Música de fondo (MP3 en bucle, en streaming). Se baja un momento con cada disparo (ducking). ----
const song = typeof Audio !== 'undefined' ? new Audio('assets/audio/musica.mp3') : null;
let musicOn = true, duck = 0;
const MUSIC_VOL = 0.35;
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
