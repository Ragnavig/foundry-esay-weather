import { MODULE_ID, SETTINGS, clamp, loc, logError, setSetting, setting, weightedPick } from "./const.mjs";
import { CLIMATES, DEFAULT_WEATHER, INTENSITIES, WEATHER_TYPES, WIND_LEVELS } from "./weather-data.mjs";
import { currentMoment, weatherSeasonOf } from "./calendar.mjs";
import { applyWeather } from "./effects.mjs";

/**
 * Decides what the weather is, and keeps that decision in a world setting so every client sees the same sky.
 */

/* -------------------------------------------- */

/**
 * The weather the world is currently having.
 * @returns {object}
 */
export function currentWeather() {
  return foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULT_WEATHER), setting(SETTINGS.weather) ?? {},
    { inplace: false });
}

/**
 * The descriptor of a weather type, falling back to clear skies.
 * @param {string} id  Weather type id.
 * @returns {object}
 */
export function weatherType(id) {
  return WEATHER_TYPES[id] ?? WEATHER_TYPES.clear;
}

/**
 * The climate the world is set to.
 * @returns {object}
 */
export function activeClimate() {
  return CLIMATES[setting(SETTINGS.climate, "temperate")] ?? CLIMATES.temperate;
}

/* -------------------------------------------- */

/**
 * Everything the interface needs to show the current weather.
 * @param {object} [weather]  Weather state; defaults to the current one.
 * @returns {object}
 */
export function describeWeather(weather=currentWeather()) {
  const type = weatherType(weather.type);
  const intensity = INTENSITIES[weather.intensity] ?? INTENSITIES.moderate;
  const wind = clamp(Math.round(weather.wind ?? type.wind ?? 0), 0, WIND_LEVELS.length - 1);
  return {
    ...weather,
    type,
    intensity,
    wind,
    windLabel: loc(WIND_LEVELS[wind]),
    label: loc(type.label),
    intensityLabel: loc(intensity.label),
    temperatureLabel: formatTemperature(weather.temperature)
  };
}

/**
 * Format a temperature in the unit the user picked.
 * @param {number} celsius  Temperature in degrees Celsius.
 * @returns {string}
 */
export function formatTemperature(celsius) {
  const value = Math.round(celsius ?? 0);
  if ( setting(SETTINGS.temperatureUnit, "c") === "f" ) return `${Math.round((value * 9 / 5) + 32)} °F`;
  return `${value} °C`;
}

/* -------------------------------------------- */
/*  Rolling                                     */
/* -------------------------------------------- */

/**
 * Roll a fresh weather state for a moment in the world.
 * @param {object} [options]
 * @param {object} [options.moment]    Moment to roll for; defaults to now.
 * @param {string} [options.climate]   Climate to roll in; defaults to the world's.
 * @param {object} [options.previous]  Yesterday's weather, which nudges the result towards continuity.
 * @returns {object}                   The rolled weather state, not yet stored.
 */
export function rollWeather({ moment=currentMoment(), climate=activeClimate().id, previous=currentWeather() }={}) {
  const table = (CLIMATES[climate] ?? CLIMATES.temperate).table;
  const weights = table[weatherSeasonOf(moment.components)] ?? table.spring ?? {};

  // Weather rarely flips from a clear sky to a blizzard overnight, so yesterday's type and anything close to it on
  // the cloud scale get a little more weight.
  const yesterday = weatherType(previous?.type);
  const entries = Object.entries(weights).map(([id, weight]) => {
    const type = weatherType(id);
    const distance = Math.abs((type.cloud ?? 0) - (yesterday.cloud ?? 0));
    const continuity = 1 + Math.max(0, 0.6 - distance) + ((id === yesterday.id) ? 0.4 : 0);
    return { id, weight: weight * continuity };
  });

  const picked = weightedPick(entries);
  const type = weatherType(picked?.id ?? "clear");
  const intensity = rollIntensity(type);

  return {
    ...previous,
    type: type.id,
    intensity: intensity.id,
    temperature: rollTemperature(moment, climate, type),
    wind: clamp(Math.round((type.wind ?? 0) + (Math.random() < 0.3 ? 1 : 0)), 0, WIND_LEVELS.length - 1),
    dayIndex: moment.components.dayIndex,
    enabled: true
  };
}

/**
 * Pick how strong a weather type plays out.
 * @param {object} type  Weather type descriptor.
 * @returns {object}
 */
function rollIntensity(type) {
  if ( !type.precipitation && !["windy", "fog", "sandstorm"].includes(type.id) ) return INTENSITIES.moderate;
  return weightedPick([
    { ...INTENSITIES.light, weight: 3 },
    { ...INTENSITIES.moderate, weight: 4 },
    { ...INTENSITIES.heavy, weight: 2 }
  ]);
}

/**
 * Roll the day's temperature from the climate, the season and the weather.
 * @param {object} moment   Moment being rolled for.
 * @param {string} climate  Climate id.
 * @param {object} type     Weather type descriptor.
 * @returns {number}        Temperature in degrees Celsius.
 */
function rollTemperature(moment, climate, type) {
  const { base, swing } = CLIMATES[climate] ?? CLIMATES.temperate;
  const calendar = moment.calendar ?? {};
  const hoursPerDay = calendar.time?.hoursPerDay ?? 24;
  const { base: dayBase = 12, variation = 0 } = calendar.daylight ?? {};

  // Long days are warm days. The daylight fraction already encodes where in the year we are, so normalising it
  // against the calendar's own swing turns it into a value from -1 at midwinter to +1 at midsummer.
  let seasonal = 0;
  if ( variation > 0 ) {
    const amplitude = (variation / 2) / hoursPerDay;
    const deviation = (moment.daylight?.daylight ?? 0.5) - (dayBase / hoursPerDay);
    seasonal = clamp(deviation / amplitude, -1, 1) * (swing / 2);
  }

  const noise = (Math.random() * 6) - 3;
  return Math.round(base + seasonal + (type.temperature ?? 0) + noise);
}

/* -------------------------------------------- */
/*  Changing the weather                        */
/* -------------------------------------------- */

/**
 * Store a new weather state and let every client apply it. GM only.
 * @param {object} changes          Partial weather state.
 * @param {object} [options]
 * @param {boolean} [options.announce]  Post the change to chat.
 * @returns {Promise<object>}       The stored state.
 */
export async function setWeather(changes, { announce }={}) {
  if ( !game.user.isGM ) {
    ui.notifications?.warn(loc("EASYWEATHER.Notify.GMOnly"));
    return currentWeather();
  }
  const next = foundry.utils.mergeObject(currentWeather(), changes, { inplace: false });
  await setSetting(SETTINGS.weather, next);
  if ( announce ?? setting(SETTINGS.announce, true) ) await announceWeather(next);
  return next;
}

/**
 * Roll the weather and store it. GM only.
 * @param {object} [options]  Options forwarded to {@link rollWeather}.
 * @returns {Promise<object>}
 */
export async function rollAndSetWeather(options={}) {
  const rolled = rollWeather(options);
  return setWeather(rolled, options);
}

/**
 * Turn a single visual effect on or off without changing the weather itself.
 * @param {string} key        One of `particles`, `overlay`, `lightning` or `sound`.
 * @param {boolean} [muted]   Force a state; toggles when omitted.
 * @returns {Promise<object>}
 */
export async function muteEffect(key, muted) {
  const weather = currentWeather();
  const next = { ...(weather.muted ?? {}) };
  next[key] = muted ?? !next[key];
  return setWeather({ muted: next }, { announce: false });
}

/**
 * Is a given effect currently silenced?
 * @param {string} key        Effect key.
 * @param {object} [weather]  Weather state to read.
 * @returns {boolean}
 */
export function isMuted(key, weather=currentWeather()) {
  return Boolean(weather.muted?.[key]);
}

/* -------------------------------------------- */

/**
 * Post the current weather to chat.
 * @param {object} weather  Weather state to announce.
 * @returns {Promise<ChatMessage|void>}
 */
export async function announceWeather(weather) {
  try {
    const described = describeWeather(weather);
    const moment = currentMoment();
    const content = await foundry.applications.handlebars.renderTemplate(
      `modules/${MODULE_ID}/templates/weather-card.hbs`,
      { weather: described, moment, date: moment.date }
    );
    return ChatMessage.create({ content, speaker: { alias: loc("EASYWEATHER.Title") } });
  } catch(err) {
    logError("Failed to announce the weather", err);
  }
}

/* -------------------------------------------- */

/**
 * Re-apply the stored weather on this client.
 */
export function refreshWeather() {
  try {
    applyWeather(currentWeather());
  } catch(err) {
    logError("Failed to apply the weather", err);
  }
}
