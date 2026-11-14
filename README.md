# HEADSHOT — FPS de arena por oleadas (Three.js)

Sobrevive a oleadas de enemigos en un almacén industrial. Apunta a la cabeza (x2.5 de daño), encadena bajas para subir el combo (hasta x5) y elige una mejora entre oleadas.

**Controles:** PC: WASD, ratón, clic, R, Esc · Móvil: joystick izquierdo, arrastrar a la derecha para apuntar, botón FUEGO.

## Estructura
- `js/game-core.js` y `js/game-combat.js`: lógica pura (sin render). Delta Time, Object Pool de enemigos.
- `js/view-scene.js`, `view-textures.js`, `view-fx.js`: render PBR, EffectComposer (Bloom, MSAA, FXAA, ACES) y efectos con pooling.
- `js/loader.js`: GLTFLoader (+Draco). Coloca `assets/models/enemy.glb` para usar un modelo externo.
- `js/config.js`: mapa, enemigos, mejoras y niveles de calidad (baja/media/alta, ajuste automático por FPS).

## Ejecutar
Necesita servidor (módulos ES): `npx serve` o GitHub Pages. Three.js se carga desde jsDelivr.
