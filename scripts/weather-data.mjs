/**
 * The weather model: what kinds of weather exist, how they look, and how likely each one is in a given climate and
 * season. Everything here is plain data so a world can override it through the module API.
 */

/* -------------------------------------------- */

/**
 * Every weather type.
 *
 * - `scene` names the particle effect Foundry should play, in order of preference. Only keys that the running
 *   version actually provides in `CONFIG.weatherEffects` are used.
 * - `overlay` is the class the canvas overlay uses for tint, clouds and the like.
 * - `cloud` is how much the sky is covered, which feeds the darkness cycle.
 *
 * @type {Record<string, object>}
 */
export const WEATHER_TYPES = {
  clear: {
    id: "clear", label: "EASYWEATHER.Weather.Clear", icon: "fa-sun", color: "#f5c14b",
    scene: [], overlay: "clear", cloud: 0, temperature: 3, wind: 0
  },
  partlyCloudy: {
    id: "partlyCloudy", label: "EASYWEATHER.Weather.PartlyCloudy", icon: "fa-cloud-sun", color: "#cfd8e3",
    scene: [], overlay: "partly-cloudy", cloud: 0.3, temperature: 1, wind: 1
  },
  cloudy: {
    id: "cloudy", label: "EASYWEATHER.Weather.Cloudy", icon: "fa-cloud", color: "#aebacb",
    scene: [], overlay: "cloudy", cloud: 0.6, temperature: 0, wind: 1
  },
  overcast: {
    id: "overcast", label: "EASYWEATHER.Weather.Overcast", icon: "fa-cloud", color: "#8d99ab",
    scene: [], overlay: "overcast", cloud: 0.85, temperature: -1, wind: 1
  },
  fog: {
    id: "fog", label: "EASYWEATHER.Weather.Fog", icon: "fa-smog", color: "#c3c9d1",
    scene: ["fog"], overlay: "fog", cloud: 0.7, temperature: -1, wind: 0
  },
  drizzle: {
    id: "drizzle", label: "EASYWEATHER.Weather.Drizzle", icon: "fa-cloud-rain", color: "#8fb8d8",
    scene: ["rain"], overlay: "rain-light", cloud: 0.8, temperature: -1, wind: 1, precipitation: 0.3
  },
  rain: {
    id: "rain", label: "EASYWEATHER.Weather.Rain", icon: "fa-cloud-showers-heavy", color: "#5b9bd5",
    scene: ["rain"], overlay: "rain", cloud: 0.9, temperature: -2, wind: 2, precipitation: 0.6
  },
  storm: {
    id: "storm", label: "EASYWEATHER.Weather.Storm", icon: "fa-cloud-bolt", color: "#4a6fa5",
    scene: ["rainStorm", "rain"], overlay: "storm", cloud: 1, temperature: -3, wind: 4,
    precipitation: 1, lightning: true
  },
  windy: {
    id: "windy", label: "EASYWEATHER.Weather.Windy", icon: "fa-wind", color: "#b8c6d6",
    scene: ["leaves"], overlay: "windy", cloud: 0.4, temperature: -1, wind: 4
  },
  leaves: {
    id: "leaves", label: "EASYWEATHER.Weather.Leaves", icon: "fa-leaf", color: "#d4883c",
    scene: ["leaves"], overlay: "leaves", cloud: 0.3, temperature: 0, wind: 2
  },
  snow: {
    id: "snow", label: "EASYWEATHER.Weather.Snow", icon: "fa-snowflake", color: "#d7e7f5",
    scene: ["snow"], overlay: "snow", cloud: 0.9, temperature: -3, wind: 1, precipitation: 0.5
  },
  blizzard: {
    id: "blizzard", label: "EASYWEATHER.Weather.Blizzard", icon: "fa-icicles", color: "#aecde5",
    scene: ["blizzard", "snow"], overlay: "blizzard", cloud: 1, temperature: -6, wind: 5,
    precipitation: 0.9, lightning: false
  },
  hail: {
    id: "hail", label: "EASYWEATHER.Weather.Hail", icon: "fa-cloud-meatball", color: "#9fc6e0",
    scene: ["snow"], overlay: "hail", cloud: 1, temperature: -4, wind: 3, precipitation: 0.7
  },
  heat: {
    id: "heat", label: "EASYWEATHER.Weather.Heat", icon: "fa-temperature-high", color: "#f0903c",
    scene: [], overlay: "heat", cloud: 0, temperature: 8, wind: 0
  },
  sandstorm: {
    id: "sandstorm", label: "EASYWEATHER.Weather.Sandstorm", icon: "fa-tornado", color: "#d9ae6a",
    scene: ["fog"], overlay: "sandstorm", cloud: 0.8, temperature: 2, wind: 5
  }
};

/* -------------------------------------------- */

/**
 * The climate of the region the party is in. `base` is the average temperature of the year in degrees Celsius,
 * `swing` how far the seasons pull it, and `table` the weights per season.
 * @type {Record<string, object>}
 */
export const CLIMATES = {
  temperate: {
    id: "temperate", label: "EASYWEATHER.Climate.Temperate", base: 11, swing: 12,
    table: {
      spring: { clear: 18, partlyCloudy: 22, cloudy: 16, overcast: 8, fog: 6, drizzle: 12, rain: 12, storm: 4, windy: 6, leaves: 0, snow: 1 },
      summer: { clear: 30, partlyCloudy: 24, cloudy: 12, overcast: 5, fog: 2, drizzle: 6, rain: 8, storm: 7, windy: 4, heat: 6 },
      autumn: { clear: 12, partlyCloudy: 18, cloudy: 18, overcast: 12, fog: 10, drizzle: 10, rain: 12, storm: 4, windy: 8, leaves: 12 },
      winter: { clear: 10, partlyCloudy: 12, cloudy: 18, overcast: 18, fog: 10, drizzle: 4, rain: 6, storm: 2, windy: 8, snow: 18, blizzard: 3, hail: 2 }
    }
  },
  arid: {
    id: "arid", label: "EASYWEATHER.Climate.Arid", base: 24, swing: 10,
    table: {
      spring: { clear: 45, partlyCloudy: 20, cloudy: 8, windy: 12, sandstorm: 8, rain: 4, storm: 3 },
      summer: { clear: 40, partlyCloudy: 12, heat: 24, windy: 8, sandstorm: 12, storm: 4 },
      autumn: { clear: 42, partlyCloudy: 20, cloudy: 10, windy: 12, sandstorm: 8, rain: 6, storm: 2 },
      winter: { clear: 38, partlyCloudy: 22, cloudy: 14, fog: 6, windy: 10, rain: 8, storm: 2 }
    }
  },
  tropical: {
    id: "tropical", label: "EASYWEATHER.Climate.Tropical", base: 27, swing: 4,
    table: {
      spring: { clear: 18, partlyCloudy: 22, cloudy: 16, overcast: 8, rain: 20, storm: 12, heat: 4 },
      summer: { clear: 12, partlyCloudy: 16, cloudy: 16, overcast: 10, rain: 26, storm: 16, heat: 4 },
      autumn: { clear: 14, partlyCloudy: 18, cloudy: 16, overcast: 10, rain: 24, storm: 14, heat: 4 },
      winter: { clear: 24, partlyCloudy: 24, cloudy: 14, overcast: 6, rain: 16, storm: 8, heat: 8 }
    }
  },
  arctic: {
    id: "arctic", label: "EASYWEATHER.Climate.Arctic", base: -9, swing: 14,
    table: {
      spring: { clear: 16, partlyCloudy: 16, cloudy: 18, overcast: 14, fog: 8, snow: 22, blizzard: 6, windy: 10 },
      summer: { clear: 24, partlyCloudy: 22, cloudy: 18, overcast: 10, fog: 8, drizzle: 6, rain: 6, snow: 6, windy: 8 },
      autumn: { clear: 14, partlyCloudy: 14, cloudy: 18, overcast: 14, fog: 8, snow: 24, blizzard: 8, windy: 12 },
      winter: { clear: 10, partlyCloudy: 10, cloudy: 16, overcast: 16, fog: 6, snow: 28, blizzard: 16, windy: 14 }
    }
  },
  coastal: {
    id: "coastal", label: "EASYWEATHER.Climate.Coastal", base: 14, swing: 8,
    table: {
      spring: { clear: 16, partlyCloudy: 22, cloudy: 18, overcast: 10, fog: 12, drizzle: 12, rain: 12, storm: 6, windy: 14 },
      summer: { clear: 26, partlyCloudy: 24, cloudy: 14, fog: 8, drizzle: 6, rain: 8, storm: 8, windy: 12 },
      autumn: { clear: 12, partlyCloudy: 18, cloudy: 18, overcast: 12, fog: 12, drizzle: 10, rain: 16, storm: 10, windy: 16, leaves: 8 },
      winter: { clear: 8, partlyCloudy: 12, cloudy: 18, overcast: 18, fog: 10, drizzle: 8, rain: 18, storm: 12, snow: 8, windy: 18 }
    }
  },
  mountain: {
    id: "mountain", label: "EASYWEATHER.Climate.Mountain", base: 5, swing: 12,
    table: {
      spring: { clear: 18, partlyCloudy: 20, cloudy: 16, overcast: 10, fog: 10, rain: 10, storm: 6, snow: 10, windy: 12 },
      summer: { clear: 28, partlyCloudy: 22, cloudy: 14, fog: 6, rain: 10, storm: 10, windy: 10 },
      autumn: { clear: 16, partlyCloudy: 18, cloudy: 16, overcast: 12, fog: 12, rain: 10, storm: 6, snow: 12, windy: 14, leaves: 6 },
      winter: { clear: 10, partlyCloudy: 12, cloudy: 16, overcast: 16, fog: 8, snow: 28, blizzard: 12, windy: 16 }
    }
  }
};

/* -------------------------------------------- */

/**
 * How strongly a weather type is playing, which drives particle density and overlay opacity.
 * @type {Record<string, object>}
 */
export const INTENSITIES = {
  light: { id: "light", label: "EASYWEATHER.Intensity.Light", factor: 0.5 },
  moderate: { id: "moderate", label: "EASYWEATHER.Intensity.Moderate", factor: 1 },
  heavy: { id: "heavy", label: "EASYWEATHER.Intensity.Heavy", factor: 1.6 }
};

/** Wind force descriptions, indexed by the `wind` value of a weather type. */
export const WIND_LEVELS = [
  "EASYWEATHER.Wind.Calm", "EASYWEATHER.Wind.Light", "EASYWEATHER.Wind.Moderate",
  "EASYWEATHER.Wind.Fresh", "EASYWEATHER.Wind.Strong", "EASYWEATHER.Wind.Gale"
];

/** The weather state a fresh world starts with. */
export const DEFAULT_WEATHER = {
  type: "clear",
  intensity: "moderate",
  temperature: 14,
  wind: 0,
  dayIndex: null,
  enabled: true,
  muted: {}
};
