import { MODULE_ID, SETTINGS, clamp, isPrimaryGM, logError, setting } from "./const.mjs";
import { INTENSITIES, WEATHER_TYPES } from "./weather-data.mjs";
import { currentMoment } from "./calendar.mjs";
import { applyClouds, tearDownClouds, updateForView } from "./clouds.mjs";
import { sceneWeatherView } from "./scene-kind.mjs";

/**
 * Turns a weather state into something you can see.
 *
 * Four things draw, and what each of them is worth comes from the scene itself — see {@link sceneWeatherView}:
 * - Foundry's own particle effects, which only a GM can set because they live on the scene document,
 * - the cloud deck and its ground shadows, drawn on the canvas (see `clouds.mjs`),
 * - an overlay this client draws over the view for colour, haze and lightning,
 * - the darkness level of the scene, which follows the time of day and the cloud cover.
 *
 * Underground none of it applies; above the cloud deck the rain is hidden underneath and the colour wash eases off.
 */

/* -------------------------------------------- */

/** @type {HTMLElement|null} */
let overlay = null;

/** @type {number|null} */
let lightningTimer = null;

/** @type {Sound|null} */
let ambientSound = null;

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
    <div class="ew-map"><div class="ew-layer ew-haze"></div></div>
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
 * Put the haze layer over the scene and give it the canvas's own transform, so it moves with the terrain.
 */
export function alignToMap() {
  const layer = overlay?.querySelector(".ew-map");
  if ( !layer ) return;

  const rect = canvas?.dimensions?.sceneRect ?? canvas?.dimensions?.rect;
  const matrix = canvas?.stage?.worldTransform;
  if ( !rect || !matrix ) {
    layer.style.width = "100%";
    layer.style.height = "100%";
    layer.style.transform = "none";
    return;
  }

  // Drawn at a quarter size and magnified, because a blur costs the square of its radius.
  const shrink = 4;
  layer.style.width = `${rect.width / shrink}px`;
  layer.style.height = `${rect.height / shrink}px`;
  layer.style.transform = `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.tx}, ${matrix.ty})`
    + ` translate(${rect.x}px, ${rect.y}px) scale(${shrink})`;
}

/* -------------------------------------------- */

/**
 * Apply a weather state on this client.
 * @param {object} weather  Weather state to apply.
 */
export function applyWeather(weather) {
  const view = sceneWeatherView();
  applyOverlay(weather, view);
  applyClouds(weather, currentMoment());
  applyLightning(weather, view);
  applyAmbientSound(weather, view);
  applyParticleStrength(view);
  if ( isPrimaryGM() ) {
    applySceneParticles(weather, view);
    applyDarkness(weather, view);
  }
}

/* -------------------------------------------- */
/*  Overlay                                     */
/* -------------------------------------------- */

/**
 * Draw the overlay for a weather state.
 * @param {object} weather  Weather state to draw.
 * @param {object} [view]   What the scene makes of it.
 */
export function applyOverlay(weather, view=sceneWeatherView()) {
  const element = overlayElement();
  if ( !element ) return;
  alignToMap();

  const on = (weather.enabled !== false) && setting(SETTINGS.overlay, true) && !weather.muted?.overlay
    && (view.overlay > 0);
  element.className = on ? `ew-${WEATHER_TYPES[weather.type]?.overlay ?? "clear"}` : "ew-off";

  const factor = INTENSITIES[weather.intensity]?.factor ?? 1;
  const strength = clamp(Number(setting(SETTINGS.overlayStrength, 70)) / 100, 0, 1);
  element.style.setProperty("--ew-strength", String(on ? factor * strength * view.overlay : 0));
  element.style.setProperty("--ew-wind", String(clamp(weather.wind ?? 0, 0, 5)));
  element.style.setProperty("--ew-speed", `${Math.max(2, 14 - ((weather.wind ?? 0) * 2))}s`);
}

/* -------------------------------------------- */
/*  Lightning                                   */
/* -------------------------------------------- */

/**
 * Start or stop the lightning flashes of a weather state.
 * @param {object} weather  Weather state to read.
 * @param {object} [view]   What the scene makes of it.
 */
export function applyLightning(weather, view=sceneWeatherView()) {
  if ( lightningTimer ) {
    window.clearTimeout(lightningTimer);
    lightningTimer = null;
  }
  const type = WEATHER_TYPES[weather.type];
  const on = type?.lightning && (weather.enabled !== false) && setting(SETTINGS.lightning, true)
    && !weather.muted?.lightning && (view.lightning > 0);
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
  const layer = element?.querySelector(".ew-flash");
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
 * @param {object} [view]   What the scene makes of it.
 */
function applyAmbientSound(weather, view=sceneWeatherView()) {
  const path = weather.sound;
  const on = path && (weather.enabled !== false) && setting(SETTINGS.sound, false) && !weather.muted?.sound
    && !view.indoors;
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
/*  Precipitation                               */
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
 * @param {object} [view]   What the scene makes of it.
 * @returns {string}
 */
export function sceneEffectFor(weather, view=sceneWeatherView()) {
  if ( weather.enabled === false ) return "";
  if ( weather.muted?.particles ) return "";
  if ( view.particles <= 0 ) return "";
  if ( Number(setting(SETTINGS.precipitation, 100)) <= 0 ) return "";
  const available = availableSceneEffects();
  for ( const key of WEATHER_TYPES[weather.type]?.scene ?? [] ) {
    if ( available.includes(key) ) return key;
  }
  return "";
}

/**
 * Write the particle effect of a weather state onto the scenes the GM chose. GM only.
 * @param {object} weather  Weather state to apply.
 * @param {object} [view]   What the scene makes of it.
 * @returns {Promise<void>}
 */
export async function applySceneParticles(weather, view=sceneWeatherView()) {
  const mode = setting(SETTINGS.sceneEffects, "current");
  if ( mode === "off" ) return;

  const target = sceneEffectFor(weather, view);
  // Other scenes are judged on their own terms, since a dungeon should stay dry while it rains outside.
  const scenes = (mode === "all") ? game.scenes.contents : [canvas.scene].filter(Boolean);
  const updates = scenes
    .map(scene => ({ scene, want: (mode === "all") ? sceneEffectFor(weather, sceneWeatherView(scene)) : target }))
    .filter(({ scene, want }) => (scene.weather ?? "") !== want)
    .map(({ scene, want }) => ({ _id: scene.id, weather: want }));
  if ( !updates.length ) return;

  try {
    await Scene.implementation.updateDocuments(updates);
  } catch(err) {
    logError("Failed to update the scene weather", err);
  }
}

/**
 * Dim Foundry's own particles to the amount the table asked for, and to how far above them the camera is.
 * @param {object} [view]  What the scene makes of the weather.
 */
export function applyParticleStrength(view=sceneWeatherView()) {
  const layer = canvas?.weather;
  if ( !layer ) return;
  const amount = clamp(Number(setting(SETTINGS.precipitation, 100)) / 100, 0, 1);
  const alpha = amount * view.particles;

  try {
    // `weatherEffects` is the container Foundry parents its particle effects to. Dimming that one container
    // leaves the layer's mask, and the cloud sprites added beside it, untouched.
    if ( layer.weatherEffects ) layer.weatherEffects.alpha = alpha;
    else for ( const effect of layer.effects?.values?.() ?? [] ) effect.alpha = alpha;
  } catch(err) {
    logError("Failed to set the strength of the precipitation", err);
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
 * Follow the day with the scene's darkness level. GM only, and not underground.
 * @param {object} weather  Weather state to read.
 * @param {object} [view]   What the scene makes of it.
 */
export function applyDarkness(weather, view=sceneWeatherView()) {
  if ( !view.darkness ) return;
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

export { updateForView };

/**
 * Remove everything this module draws.
 */
export function tearDownEffects() {
  if ( lightningTimer ) window.clearTimeout(lightningTimer);
  lightningTimer = null;
  ambientSound?.stop();
  ambientSound = null;
  overlay?.remove();
  overlay = null;
  tearDownClouds();
}

/** @type {string} */
export const EFFECTS_MODULE = MODULE_ID;
