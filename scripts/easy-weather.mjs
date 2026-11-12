import { MODULE_ID, SETTINGS, loc, logError, setting } from "./const.mjs";
import { registerSettings } from "./settings.mjs";
import * as Calendar from "./calendar.mjs";
import * as Time from "./time.mjs";
import * as Weather from "./weather.mjs";
import * as Effects from "./effects.mjs";
import { CALENDAR_PRESETS } from "./presets.mjs";
import { CLIMATES, INTENSITIES, WEATHER_TYPES } from "./weather-data.mjs";
import { ControlPanel } from "./apps/control-panel.mjs";
import { CalendarApp } from "./apps/calendar-app.mjs";
import { CalendarEditor } from "./apps/calendar-editor.mjs";
import { WeatherApp } from "./apps/weather-app.mjs";

/**
 * Easy Weather & Time — world time, a world calendar and weather that you can see, in one small panel.
 */

/* -------------------------------------------- */
/*  Templates                                   */
/* -------------------------------------------- */

/**
 * Register the handlebars helpers the templates use.
 */
function registerHelpers() {
  Handlebars.registerHelper("ewEq", (a, b) => a === b);
  Handlebars.registerHelper("ewAdd", (a, b) => Number(a) + Number(b));
  Handlebars.registerHelper("ewPad", value => String(value ?? 0).padStart(2, "0"));
  Handlebars.registerHelper("ewPercent", value => `${Math.round(Number(value) * 100)}%`);
}

/* -------------------------------------------- */
/*  Lifecycle                                   */
/* -------------------------------------------- */

Hooks.once("init", () => {
  registerSettings();
  registerHelpers();

  game.modules.get(MODULE_ID).api = {
    calendar: Calendar,
    time: Time,
    weather: Weather,
    effects: Effects,
    data: { CALENDAR_PRESETS, CLIMATES, WEATHER_TYPES, INTENSITIES },
    apps: { CalendarApp, CalendarEditor, WeatherApp, ControlPanel },
    openCalendar: () => new CalendarApp().render({ force: true }),
    openWeather: () => new WeatherApp().render({ force: true }),
    openEditor: () => new CalendarEditor().render({ force: true })
  };

  console.log(`${MODULE_ID} | Initialised.`);
});

/* -------------------------------------------- */

Hooks.once("ready", async () => {
  // Foundry's own calendar only exists from here on, so anything built during init has to be thrown away.
  Calendar.resetCalendarCache();
  Time.primeDayTracking();
  Weather.refreshWeather();
  await ControlPanel.instance.render();

  // A fresh world has no weather yet; rolling once gives the first session a sky.
  if ( game.user.isGM && (Weather.currentWeather().dayIndex === null) && setting(SETTINGS.autoRoll, true) ) {
    await Weather.rollAndSetWeather({ announce: false });
  }
});

/* -------------------------------------------- */
/*  Reacting to the world                       */
/* -------------------------------------------- */

Hooks.on("updateWorldTime", async worldTime => {
  try {
    await Time.onWorldTimeUpdate(worldTime);
  } catch(err) {
    logError("Failed to react to the world time", err);
  }
  Weather.refreshWeather();
  await ControlPanel.instance.render();
});

Hooks.on("easyWeather.weatherChanged", () => {
  Weather.refreshWeather();
  ControlPanel.instance.render();
});

Hooks.on("easyWeather.calendarChanged", () => {
  Calendar.resetCalendarCache();
  Time.primeDayTracking();
  ControlPanel.instance.render();
});

Hooks.on("easyWeather.panelVisibilityChanged", () => {
  ControlPanel.instance.render();
});

Hooks.on("canvasReady", () => {
  Weather.refreshWeather();
  ControlPanel.instance.render();
});

// The clouds belong to the map, so they have to follow every pan and every zoom.
Hooks.on("canvasPan", () => Effects.alignToMap());
Hooks.on("canvasTearDown", () => Effects.alignToMap());

/* -------------------------------------------- */
/*  Scene controls                              */
/* -------------------------------------------- */

Hooks.on("getSceneControlButtons", controls => {
  const tools = [
    {
      name: "easyWeatherCalendar",
      title: loc("EASYWEATHER.CalendarApp.Title"),
      icon: "fa-solid fa-calendar-days",
      button: true,
      visible: true,
      onClick: () => new CalendarApp().render({ force: true }),
      onChange: () => new CalendarApp().render({ force: true })
    },
    {
      name: "easyWeatherWeather",
      title: loc("EASYWEATHER.WeatherApp.Title"),
      icon: "fa-solid fa-cloud-sun-rain",
      button: true,
      visible: game.user.isGM,
      onClick: () => new WeatherApp().render({ force: true }),
      onChange: () => new WeatherApp().render({ force: true })
    }
  ];

  // Foundry 13 hands over a record of controls, earlier versions an array.
  if ( Array.isArray(controls) ) {
    const group = controls.find(control => control.name === "notes") ?? controls[0];
    if ( group ) group.tools.push(...tools.map((tool, order) => ({ ...tool, order: 100 + order })));
    return;
  }

  const group = controls.notes ?? Object.values(controls)[0];
  if ( !group ) return;
  for ( const [order, tool] of tools.entries() ) {
    group.tools[tool.name] = { ...tool, order: (Object.keys(group.tools).length + order) };
  }
});
