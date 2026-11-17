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
  // Explosión (graves + ruido + eco), pitido de granada, cofre, blindaje del jefe y cambio de fase
  boom() { noise(0.7, 1, 2500, 60, 'lowpass', 0.7); tone(90, 28, 0.6, 'sine', 1, 0.4); noise(0.1, 0.8, 8000, 1500, 'highpass', 0.3); },
  warn(k = 0) { tone(700 + 500 * k, 640 + 460 * k, 0.07, 'sine', 0.1 + 0.08 * k); },
  beep() { tone(1500, 1500, 0.05, 'square', 0.12); },
  pin() { noise(0.04, 0.3, 6000, 3000, 'highpass'); tone(2400, 1800, 0.05, 'triangle', 0.15, 0, 0.05); },
  chest() { tone(660, 990, 0.12, 'triangle', 0.25); tone(990, 1320, 0.18, 'triangle', 0.25, 0, 0.1); noise(0.12, 0.25, 3000, 800, 'bandpass'); },
  armor() { ring([900, 1500], 0.25, 0.2); noise(0.04, 0.4, 5000, 1500, 'highpass'); },
  phase() { tone(160, 60, 0.7, 'sawtooth', 0.5, 0.4); tone(120, 50, 0.9, 'square', 0.3, 0.4, 0.1); },
  wave() { tone(90, 70, 0.8, 'sawtooth', 0.35); tone(135, 105, 0.8, 'sawtooth', 0.2); },
  up() { tone(500, 900, 0.15, 'triangle', 0.25); setTimeout(() => tone(750, 1200, 0.2, 'triangle', 0.25), 110); },
};

// ---- Música: MP3 solo en menús/resultados; durante la partida suena una pista procedural calmada (WebAudio). ----
const song = typeof Audio !== 'undefined' ? new Audio('assets/audio/musica.mp3') : null;
let musicOn = true, duck = 0, mode = 'menu';
const MUSIC_VOL = 0.2;
if (song) { song.loop = true; song.preload = 'auto'; song.volume = 0; }

// Pista calmada: pad suave + arpegio + bajo, en bucle de 4 acordes (Am F C G), 74 bpm.
const CALM = { bpm: 74, ch: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bs: [45, 41, 36, 43], arp: [0, 1, 2, 1, 2, 1, 0, 1] };
let cg, cTimer = 0, cNext = 0, cStep = 0;
const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
function cnote(m, t, d, type, v, att) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = mf(m);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(cg); g.connect(revIn); o.start(t); o.stop(t + d + 0.05);
}
function calmTick() {
  if (!ac) return;
  const beat = 60 / CALM.bpm, eighth = beat / 2;
  while (cNext < ac.currentTime + 0.45) {
    const bar = Math.floor(cStep / 8) % 4, k = cStep % 8, ch = CALM.ch[bar];
    if (k === 0) { ch.forEach((n) => cnote(n, cNext, beat * 4.2, 'sine', 0.05, 0.9)); cnote(CALM.bs[bar], cNext, beat * 2, 'sine', 0.12, 0.05); }
    if (k === 4) cnote(CALM.bs[bar], cNext, beat * 1.6, 'sine', 0.08, 0.05);
    cnote(ch[CALM.arp[k] % 3] + 12, cNext, beat * 1.5, 'triangle', 0.035, 0.02);
    cNext += eighth; cStep++;
  }
}
function calmSet(on) {
  if (!ac) return;
  if (!cg) { cg = ac.createGain(); cg.gain.value = 0; cg.connect(master); }
  const t = ac.currentTime;
  cg.gain.cancelScheduledValues(t); cg.gain.setTargetAtTime(on ? 0.55 : 0, t, 0.6);
  if (on && !cTimer) { cNext = t + 0.1; cStep = 0; cTimer = setInterval(calmTick, 120); }
  if (!on && cTimer) { const id = cTimer; cTimer = 0; setTimeout(() => clearInterval(id), 2500); }
}
function apply() {
  const menu = mode === 'menu';
  if (song) { if (menu && musicOn) song.play().catch(() => {}); else song.pause(); }
  calmSet(!menu && musicOn);
}
export const music = {
  // m = 'menu' (MP3) | 'game' (pista calmada). Llamar desde un gesto del usuario en móvil.
  mode(m) { mode = m; apply(); },
  play() { apply(); },
  pause() { if (song) song.pause(); calmSet(false); },
  setOn(v) { musicOn = v; apply(); },
  duck() { duck = 1; },
  update(dt) { if (!song) return; duck = Math.max(0, duck - dt * 1.6); song.volume = MUSIC_VOL * (1 - 0.55 * duck); },
};
