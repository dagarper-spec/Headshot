// Configuración global: constantes de juego, mapa y niveles de calidad.
export const CFG = {
  half: 14,          // la arena mide 28x28 m
  height: 7.5,
  eye: 1.7,
  maxAlive: 22,      // enemigos simultáneos máximos
  pool: 36,          // tamaño del Object Pool de enemigos
  player: { speed: 6, radius: 0.45, hp: 100, sens: 0.0022 },
  weapon: { dmg: 22, rate: 0.11, mag: 30, reload: 1.7, range: 60, headMul: 2.5 },
  types: {
    walker: { hp: 60,  speed: 2.4, dmg: 10, r: 0.45, h: 1.8,  sw: 1.0,  score: 100, tint: 0x5a6b3a },
    runner: { hp: 36,  speed: 4.8, dmg: 7,  r: 0.38, h: 1.65, sw: 0.92, score: 150, tint: 0x8a2f2a },
    brute:  { hp: 260, speed: 1.7, dmg: 28, r: 0.75, h: 2.5,  sw: 1.4,  score: 400, tint: 0x2c3a5c },
  },
  // Obstáculos [x, z, ancho, fondo, alto]. Alto == height -> pilar de hormigón.
  crates: [
    [-7, -6, 2, 2, 1.6], [-4.5, -6.5, 1.4, 1.4, 1.4], [7, 5, 2.4, 2, 2],
    [6, -7, 1.6, 1.6, 1.6], [-8, 6, 2, 3, 1.8], [0, -1, 2.4, 2.4, 2.2],
    [10, -2, 1.4, 3, 1.4], [-11, 0, 1.4, 3, 2], [3, 8, 1.4, 1.4, 1.4],
    [-9, -9, 1, 1, 7.5], [9, -9, 1, 1, 7.5], [-9, 9, 1, 1, 7.5], [9, 9, 1, 1, 7.5],
  ],
  // Modelos .glb opcionales. Si el archivo no existe se usa el enemigo procedural.
  models: { enemy: 'assets/models/enemy.glb' },
};

// msaa = muestras del antialiasing por hardware en el EffectComposer.
export const QUALITY = {
  low:    { scale: 0.65, maxDpr: 1,   shadow: 0,    bloom: false, fxaa: false, msaa: 0, lights: 2, spots: 0, tex: 256 },
  medium: { scale: 0.85, maxDpr: 1.5, shadow: 1024, bloom: true,  fxaa: true,  msaa: 0, lights: 3, spots: 1, tex: 256 },
  high:   { scale: 1,    maxDpr: 2,   shadow: 2048, bloom: true,  fxaa: true,  msaa: 4, lights: 4, spots: 2, tex: 512 },
};
export const TIERS = ['low', 'medium', 'high'];

export const UPGRADES = [
  { id: 'dmg',  name: 'Munición perforante', desc: '+25% de daño' },
  { id: 'rate', name: 'Gatillo ligero',      desc: '+20% de cadencia' },
  { id: 'mag',  name: 'Cargador ampliado',   desc: '+10 balas por cargador' },
  { id: 'rel',  name: 'Recarga rápida',      desc: '-15% tiempo de recarga' },
  { id: 'hp',   name: 'Chaleco blindado',    desc: '+25 vida máxima y curación total' },
  { id: 'spd',  name: 'Botas ligeras',       desc: '+10% de velocidad' },
];
