import { MODULE_ID, SETTINGS } from "./const.mjs";
import { CLIMATES, DEFAULT_WEATHER } from "./weather-data.mjs";
import { resetCalendarCache } from "./calendar.mjs";
import { clonePreset } from "./presets.mjs";

/**
 * Every setting this module stores.
 */

/* -------------------------------------------- */

/**
 * Re-render the module's own windows after a setting changed.
 */
function refreshInterface() {
  for ( const app of Object.values(ui.windows ?? {}) ) {
    if ( app.constructor?.EASY_WEATHER ) app.render(false);
  }
  for ( const app of foundry.applications.instances?.values() ?? [] ) {
    if ( app.constructor?.EASY_WEATHER ) app.render(false);
  }
}

/**
 * Register everything. Called during `init`.
 */
export function registerSettings() {
  const register = (key, data) => game.settings.register(MODULE_ID, key, { config: false, ...data });

  /* -------------------------------------------- */
  /*  Stored state                                */
  /* -------------------------------------------- */

  register(SETTINGS.calendar, {
    scope: "world",
    type: Object,
    default: clonePreset("gregorian"),
    onChange: () => {
      resetCalendarCache();
      refreshInterface();
      Hooks.callAll("easyWeather.calendarChanged");
    }
  });

  register(SETTINGS.calendarSource, {
    scope: "world",
    config: true,
    name: "EASYWEATHER.Settings.CalendarSource.Name",
    hint: "EASYWEATHER.Settings.CalendarSource.Hint",
    type: String,
    default: "foundry",
    choices: {
      foundry: "EASYWEATHER.Settings.CalendarSource.Foundry",
      custom: "EASYWEATHER.Settings.CalendarSource.Custom"
    },
    onChange: () => {
      resetCalendarCache();
      refreshInterface();
      Hooks.callAll("easyWeather.calendarChanged");
    }
  });

  register(SETTINGS.weather, {
    scope: "world",
    type: Object,
    default: foundry.utils.deepClone(DEFAULT_WEATHER),
    onChange: weather => {
      Hooks.callAll("easyWeather.weatherChanged", weather);
      refreshInterface();
    }
  });

  register(SETTINGS.notes, {
    scope: "world",
    type: Object,
    default: {},
    onChange: refreshInterface
  });

  register(SETTINGS.panelPosition, { scope: "client", type: Object, default: {} });
  register(SETTINGS.panelCollapsed, { scope: "client", type: Boolean, default: false });

  /* -------------------------------------------- */
  /*  World options                               */
  /* -------------------------------------------- */

  const world = (key, data) => register(key, { scope: "world", config: true, requiresReload: false, ...data });

  world(SETTINGS.climate, {
    name: "EASYWEATHER.Settings.Climate.Name",
    hint: "EASYWEATHER.Settings.Climate.Hint",
    type: String,
    default: "temperate",
    choices: Object.fromEntries(Object.values(CLIMATES).map(climate => [climate.id, climate.label])),
    onChange: refreshInterface
  });

  world(SETTINGS.autoRoll, {
    name: "EASYWEATHER.Settings.AutoRoll.Name",
    hint: "EASYWEATHER.Settings.AutoRoll.Hint",
    type: Boolean,
    default: true
  });

  world(SETTINGS.announce, {
    name: "EASYWEATHER.Settings.Announce.Name",
    hint: "EASYWEATHER.Settings.Announce.Hint",
    type: Boolean,
    default: true
  });

  world(SETTINGS.sceneEffects, {
    name: "EASYWEATHER.Settings.SceneEffects.Name",
    hint: "EASYWEATHER.Settings.SceneEffects.Hint",
    type: String,
    default: "current",
    choices: {
      current: "EASYWEATHER.Settings.SceneEffects.Current",
      all: "EASYWEATHER.Settings.SceneEffects.All",
      off: "EASYWEATHER.Settings.SceneEffects.Off"
    },
    onChange: () => Hooks.callAll("easyWeather.weatherChanged")
  });

  world(SETTINGS.darkness, {
    name: "EASYWEATHER.Settings.Darkness.Name",
    hint: "EASYWEATHER.Settings.Darkness.Hint",
    type: Boolean,
    default: true,
    onChange: () => Hooks.callAll("easyWeather.weatherChanged")
  });

  world(SETTINGS.dungeonMode, {
    name: "EASYWEATHER.Settings.DungeonMode.Name",
    hint: "EASYWEATHER.Settings.DungeonMode.Hint",
    type: Boolean,
    default: false,
    onChange: () => Hooks.callAll("easyWeather.weatherChanged")
  });

  world(SETTINGS.playerPanel, {
    name: "EASYWEATHER.Settings.PlayerPanel.Name",
    hint: "EASYWEATHER.Settings.PlayerPanel.Hint",
    type: Boolean,
    default: true,
    onChange: () => Hooks.callAll("easyWeather.panelVisibilityChanged")
  });

  /* -------------------------------------------- */
  /*  Client options                              */
  /* -------------------------------------------- */

  const client = (key, data) => register(key, { scope: "client", config: true, ...data });

  client(SETTINGS.overlay, {
    name: "EASYWEATHER.Settings.Overlay.Name",
    hint: "EASYWEATHER.Settings.Overlay.Hint",
    type: Boolean,
    default: true,
    onChange: () => Hooks.callAll("easyWeather.weatherChanged")
  });

  client(SETTINGS.cloudRenderer, {
    name: "EASYWEATHER.Settings.CloudRenderer.Name",
    hint: "EASYWEATHER.Settings.CloudRenderer.Hint",
    type: String,
    default: "canvas",
    choices: {
      canvas: "EASYWEATHER.Settings.CloudRenderer.Canvas",
      css: "EASYWEATHER.Settings.CloudRenderer.Screen",
      off: "EASYWEATHER.Settings.CloudRenderer.Off"
    },
    onChange: () => Hooks.callAll("easyWeather.weatherChanged")
  });

  client(SETTINGS.overlayStrength, {
    name: "EASYWEATHER.Settings.OverlayStrength.Name",
    hint: "EASYWEATHER.Settings.OverlayStrength.Hint",
    type: new foundry.data.fields.NumberField({ min: 0, max: 100, step: 5, initial: 70, nullable: false }),
    default: 70,
    onChange: () => Hooks.callAll("easyWeather.weatherChanged")
  });

  client(SETTINGS.lightning, {
    name: "EASYWEATHER.Settings.Lightning.Name",
    hint: "EASYWEATHER.Settings.Lightning.Hint",
    type: Boolean,
    default: true,
    onChange: () => Hooks.callAll("easyWeather.weatherChanged")
  });

  client(SETTINGS.sound, {
    name: "EASYWEATHER.Settings.Sound.Name",
    hint: "EASYWEATHER.Settings.Sound.Hint",
    type: Boolean,
    default: false,
    onChange: () => Hooks.callAll("easyWeather.weatherChanged")
  });

  client(SETTINGS.panelFade, {
    name: "EASYWEATHER.Settings.PanelFade.Name",
    hint: "EASYWEATHER.Settings.PanelFade.Hint",
    type: Boolean,
    default: true,
    onChange: () => Hooks.callAll("easyWeather.panelVisibilityChanged")
  });

  client(SETTINGS.temperatureUnit, {
    name: "EASYWEATHER.Settings.TemperatureUnit.Name",
    hint: "EASYWEATHER.Settings.TemperatureUnit.Hint",
    type: String,
    default: "c",
    choices: { c: "EASYWEATHER.Settings.TemperatureUnit.Celsius", f: "EASYWEATHER.Settings.TemperatureUnit.Fahrenheit" },
    onChange: refreshInterface
  });

  client(SETTINGS.timeFormat, {
    name: "EASYWEATHER.Settings.TimeFormat.Name",
    hint: "EASYWEATHER.Settings.TimeFormat.Hint",
    type: String,
    default: "24",
    choices: { 24: "EASYWEATHER.Settings.TimeFormat.TwentyFour", 12: "EASYWEATHER.Settings.TimeFormat.Twelve" },
    onChange: refreshInterface
  });
}
