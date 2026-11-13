import { MODULE_ID, SETTINGS, clamp, isPrimaryGM, logError, setting } from "./const.mjs";
import { INTENSITIES, WEATHER_TYPES } from "./weather-data.mjs";
import { currentMoment } from "./calendar.mjs";
import { applyCloudShadows, tearDownCloudShadows, usesCanvasClouds } from "./cloud-shadows.mjs";

/**
 * Turns a weather state into something you can see.
 *
 * Three layers do the work, and each one can be silenced on its own:
 * - the scene's own particle effect, which only a GM can set because it lives on the scene document,
 * - a canvas overlay this client draws for tint, cloud cover and haze,
 * - the darkness level of the scene, which follows the time of day and the cloud cover.
 *
 * The clouds and the haze belong to the map, not to the screen: they sit in a layer that carries the canvas's own
 * transform, so they pan and zoom with the terrain and a cloud stays over the same hill. Tint, vignette and
 * lightning stay in screen space, because a wash of colour over the whole view is what they are.
 */

/* -------------------------------------------- */

/** @type {HTMLElement|null} */
let overlay = null;

/** @type {number|null} */
let lightningTimer = null;

/** @type {Sound|null} */
let ambientSound = null;

/**
 * The cloud layer is drawn at a fraction of the map's size and scaled back up. A blur costs the square of its
 * radius, so blurring a quarter-sized layer and magnifying it is far cheaper than blurring the whole map.
 * @type {number}
 */
const MAP_LAYER_SCALE = 4;

/* -------------------------------------------- */

/**
 * The overlay element, created on first use.
 * @returns {HTMLElement|null}
 */
function overlayElement() {
  if ( overlay?.isConnected ) return overlay;

  overlay = document.createElement("div");
  overlay.id = "easy-weather-overlay";
  overlay.innerHTML = `
    <div class="ew-layer ew-tint"></div>
    <div class="ew-map">
      <div class="ew-layer ew-clouds"></div>
      <div class="ew-layer ew-haze"></div>
    </div>
    <div class="ew-layer ew-vignette"></div>
    <div class="ew-layer ew-flash"></div>`;

  // Sitting directly after the canvas keeps the overlay above the map and below every piece of interface, whatever
  // a given Foundry version calls its containers.
  const board = document.getElementById("board");
  if ( board?.parentElement ) board.after(overlay);
  else (document.getElementById("interface") ?? document.body).appendChild(overlay);

  alignToMap();
  return overlay;
}

/* -------------------------------------------- */

/**
 * Put the map layer over the scene and give it the canvas's own transform, so it moves with the terrain.
 */
export function alignToMap() {
  const layer = overlay?.querySelector(".ew-map");
  if ( !layer ) return;

  const rect = canvas?.dimensions?.sceneRect ?? canvas?.dimensions?.rect;
  const matrix = canvas?.stage?.worldTransform;
  if ( !rect || !matrix ) {
    // Without a canvas there is no map to follow; the layer then simply covers the view.
    layer.style.width = "100%";
    layer.style.height = "100%";
    layer.style.transform = "none";
    return;
  }

  layer.style.width = `${rect.width / MAP_LAYER_SCALE}px`;
  layer.style.height = `${rect.height / MAP_LAYER_SCALE}px`;
  layer.style.transform = `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.tx}, ${matrix.ty})`
    + ` translate(${rect.x}px, ${rect.y}px) scale(${MAP_LAYER_SCALE})`;
}

/* -------------------------------------------- */

/**
 * Apply a weather state on this client.
 * @param {object} weather  Weather state to apply.
 */
export function applyWeather(weather) {
  // Underground there is no sky: the whole visible side of the weather is held back, and the world keeps its state
  // so that stepping back outside picks it up again.
  if ( setting(SETTINGS.dungeonMode, false) ) weather = { ...weather, enabled: false };

  applyOverlay(weather);
  applyCloudShadows(weather, currentMoment());
  applyLightning(weather);
  applyAmbientSound(weather);
  if ( isPrimaryGM() ) {
    applySceneParticles(weather);
    applyDarkness(weather);
  }
}

/* -------------------------------------------- */
/*  Overlay                                     */
/* -------------------------------------------- */

/**
 * Draw the canvas overlay for a weather state.
 * @param {object} weather  Weather state to draw.
 */
export function applyOverlay(weather) {
  const element = overlayElement();
  if ( !element ) return;
  alignToMap();

  const on = (weather.enabled !== false) && setting(SETTINGS.overlay, true) && !weather.muted?.overlay;
  element.className = on ? `ew-${WEATHER_TYPES[weather.type]?.overlay ?? "clear"}` : "ew-off";

  // The cloud shadows may be drawn on the canvas instead, in which case the overlay leaves them alone.
  element.dataset.clouds = usesCanvasClouds() ? "canvas" : "off";

  const factor = INTENSITIES[weather.intensity]?.factor ?? 1;
  const strength = clamp(Number(setting(SETTINGS.overlayStrength, 70)) / 100, 0, 1);
  element.style.setProperty("--ew-strength", String(on ? factor * strength : 0));
  element.style.setProperty("--ew-wind", String(clamp(weather.wind ?? 0, 0, 5)));
  element.style.setProperty("--ew-speed", `${Math.max(2, 14 - ((weather.wind ?? 0) * 2))}s`);
}

/* -------------------------------------------- */
/*  Lightning                                   */
/* -------------------------------------------- */

/**
 * Start or stop the lightning flashes of a weather state.
 * @param {object} weather  Weather state to read.
 */
export function applyLightning(weather) {
  if ( lightningTimer ) {
    window.clearTimeout(lightningTimer);
    lightningTimer = null;
  }
  const type = WEATHER_TYPES[weather.type];
  const on = type?.lightning && (weather.enabled !== false) && setting(SETTINGS.lightning, true)
    && !weather.muted?.lightning && !weather.muted?.overlay;
  if ( !on ) return;

  const schedule = () => {
    const delay = 6000 + (Math.random() * 18000);
    lightningTimer = window.setTimeout(() => {
      flash();
      schedule();
    }, delay);
  };
  schedule();
}

/**
 * A single lightning flash on this client.
 */
export function flash() {
  const element = overlayElement();
  if ( !element ) return;
  const layer = element.querySelector(".ew-flash");
  if ( !layer ) return;
  layer.classList.remove("ew-flashing");
  // Forcing a reflow restarts the animation even when two flashes land close together.
  void layer.offsetWidth;
  layer.classList.add("ew-flashing");
}

/* -------------------------------------------- */
/*  Ambient sound                               */
/* -------------------------------------------- */

/**
 * Play, swap or stop the ambient loop a weather state names.
 * @param {object} weather  Weather state to read.
 */
function applyAmbientSound(weather) {
  const path = weather.sound;
  const on = path && (weather.enabled !== false) && setting(SETTINGS.sound, false) && !weather.muted?.sound;
  if ( !on ) {
    ambientSound?.stop();
    ambientSound = null;
    return;
  }
  if ( ambientSound?.src === path ) return;
  ambientSound?.stop();
  try {
    ambientSound = foundry.audio.AudioHelper.play({ src: path, volume: 0.4, loop: true }, false);
  } catch(err) {
    logError("Failed to start the weather ambience", err);
  }
}

/* -------------------------------------------- */
/*  Scene particles                             */
/* -------------------------------------------- */

/**
 * The particle effect keys this Foundry build actually provides.
 * @returns {string[]}
 */
export function availableSceneEffects() {
  return Object.keys(CONFIG.weatherEffects ?? {});
}

/**
 * The particle effect key a weather type should use on this build, or `""` for none.
 * @param {object} weather  Weather state to read.
 * @returns {string}
 */
export function sceneEffectFor(weather) {
  if ( weather.enabled === false ) return "";
  if ( weather.muted?.particles ) return "";
  const available = availableSceneEffects();
  for ( const key of WEATHER_TYPES[weather.type]?.scene ?? [] ) {
    if ( available.includes(key) ) return key;
  }
  return "";
}

/**
 * Write the particle effect of a weather state onto the scenes the GM chose. GM only.
 * @param {object} weather  Weather state to apply.
 * @returns {Promise<void>}
 */
export async function applySceneParticles(weather) {
  const mode = setting(SETTINGS.sceneEffects, "current");
  if ( mode === "off" ) return;

  const target = sceneEffectFor(weather);
  const scenes = (mode === "all") ? game.scenes.contents : [canvas.scene].filter(Boolean);
  const updates = scenes
    .filter(scene => (scene.weather ?? "") !== target)
    .map(scene => ({ _id: scene.id, weather: target }));
  if ( !updates.length ) return;

  try {
    await Scene.implementation.updateDocuments(updates);
  } catch(err) {
    logError("Failed to update the scene weather", err);
  }
}

/* -------------------------------------------- */
/*  Darkness                                    */
/* -------------------------------------------- */

/** @type {number|null} */
let darknessTimer = null;

/**
 * The darkness the sky should have right now, from the time of day and the cloud cover.
 * @param {object} [weather]  Weather state to read.
 * @param {object} [moment]   Moment to read; defaults to now.
 * @returns {number}          A darkness level between 0 and 1.
 */
export function darknessFor(weather, moment=currentMoment()) {
  const { sunrise, sunset } = moment.daylight;
  const spd = moment.calendar.time.secondsPerMinute * moment.calendar.time.minutesPerHour
    * moment.calendar.time.hoursPerDay;
  const fraction = moment.components.secondOfDay / spd;
  const twilight = 0.045;

  let darkness;
  if ( (fraction < sunrise - twilight) || (fraction > sunset + twilight) ) darkness = 1;
  else if ( fraction < sunrise + twilight ) darkness = 1 - ((fraction - (sunrise - twilight)) / (twilight * 2));
  else if ( fraction > sunset - twilight ) darkness = (fraction - (sunset - twilight)) / (twilight * 2);
  else darkness = 0;

  const cloud = WEATHER_TYPES[weather?.type]?.cloud ?? 0;
  return clamp(darkness + ((1 - darkness) * cloud * 0.35), 0, 1);
}

/**
 * Follow the day with the scene's darkness level. GM only, and only when the setting is on.
 * @param {object} weather  Weather state to read.
 */
export function applyDarkness(weather) {
  if ( setting(SETTINGS.dungeonMode, false) ) return;
  if ( !setting(SETTINGS.darkness, true) ) return;
  if ( !canvas?.scene ) return;
  if ( darknessTimer ) window.clearTimeout(darknessTimer);

  // Several changes often land at once — one write at the end of them is enough.
  darknessTimer = window.setTimeout(async () => {
    darknessTimer = null;
    const scene = canvas.scene;
    if ( !scene ) return;
    const target = Math.round(darknessFor(weather) * 100) / 100;
    const current = scene.environment?.darknessLevel ?? scene.darkness ?? 0;
    if ( Math.abs(current - target) < 0.02 ) return;

    const key = ("environment" in scene) ? "environment.darknessLevel" : "darkness";
    try {
      await scene.update({ [key]: target }, { animateDarkness: 1500 });
    } catch(err) {
      logError("Failed to update the scene darkness", err);
    }
  }, 200);
}

/* -------------------------------------------- */

export { usesCanvasClouds };

/**
 * Remove everything this module draws on the screen. The canvas layer has a teardown of its own.
 */
export function tearDownEffects() {
  if ( lightningTimer ) window.clearTimeout(lightningTimer);
  lightningTimer = null;
  ambientSound?.stop();
  ambientSound = null;
  overlay?.remove();
  overlay = null;
  tearDownCloudShadows();
}

/** @type {string} */
export const EFFECTS_MODULE = MODULE_ID;
