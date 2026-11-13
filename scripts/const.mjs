/**
 * Shared constants and small helpers for Easy Weather & Time.
 */

/** @type {string} */
export const MODULE_ID = "easy-weather";

/** Path prefix for this module's templates. */
export const TEMPLATES = `modules/${MODULE_ID}/templates`;

/** Keys of every setting this module stores. */
export const SETTINGS = {
  calendar: "calendar",
  calendarSource: "calendarSource",
  weather: "weather",
  notes: "notes",
  climate: "climate",
  autoRoll: "autoRoll",
  announce: "announce",
  sceneEffects: "sceneEffects",
  overlay: "overlay",
  cloudMode: "cloudMode",
  cloudBreakthrough: "cloudBreakthrough",
  overlayStrength: "overlayStrength",
  lightning: "lightning",
  sound: "sound",
  darkness: "darkness",
  dungeonMode: "dungeonMode",
  temperatureUnit: "temperatureUnit",
  timeFormat: "timeFormat",
  playerPanel: "playerPanel",
  panelFade: "panelFade",
  panelPosition: "panelPosition",
  panelCollapsed: "panelCollapsed"
};

/**
 * Shorthand for localisation.
 * @param {string} key     Localisation key.
 * @param {object} [data]  Data used for string formatting.
 * @returns {string}
 */
export function loc(key, data) {
  return data ? game.i18n.format(key, data) : game.i18n.localize(key);
}

/**
 * Read one of this module's settings, falling back gracefully if it cannot be read yet.
 * @param {string} key      Setting key.
 * @param {any} [fallback]  Value to use if the setting cannot be read.
 * @returns {any}
 */
export function setting(key, fallback) {
  try {
    return game.settings.get(MODULE_ID, key);
  } catch(err) {
    return fallback;
  }
}

/**
 * Write one of this module's settings. Only a GM may write world-scoped settings.
 * @param {string} key  Setting key.
 * @param {any} value   New value.
 * @returns {Promise<any>}
 */
export function setSetting(key, value) {
  return game.settings.set(MODULE_ID, key, value);
}

/**
 * Log an error without breaking the surrounding render.
 * @param {string} message  Context for the error.
 * @param {Error} [err]     The error that was caught.
 */
export function logError(message, err) {
  console.error(`${MODULE_ID} | ${message}`, err);
}

/**
 * Is this client the one GM that should carry out world-wide changes? With two GMs logged in, only one of them may
 * roll the weather or write to a scene, or the same day would be rolled twice.
 * @returns {boolean}
 */
export function isPrimaryGM() {
  if ( !game.user.isGM ) return false;
  const active = game.users?.activeGM;
  return active ? (active === game.user) : true;
}

/**
 * `FormDataExtended`, from wherever this Foundry version keeps it.
 * @returns {typeof FormDataExtended}
 */
export function formDataClass() {
  return foundry.applications?.ux?.FormDataExtended ?? globalThis.FormDataExtended;
}

/**
 * Clamp a number into a range.
 * @param {number} value  Value to clamp.
 * @param {number} min    Lower bound.
 * @param {number} max    Upper bound.
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * A modulo that always returns a non-negative result.
 * @param {number} value    Dividend.
 * @param {number} modulus  Divisor.
 * @returns {number}
 */
export function mod(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

/**
 * Pick one entry from a list of `{ weight }` objects.
 * @param {{weight: number}[]} entries  Weighted entries.
 * @returns {any}                       The chosen entry, or `null` for an empty list.
 */
export function weightedPick(entries) {
  const pool = entries.filter(entry => (entry?.weight ?? 0) > 0);
  if ( !pool.length ) return null;
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for ( const entry of pool ) {
    roll -= entry.weight;
    if ( roll <= 0 ) return entry;
  }
  return pool.at(-1);
}
