import { MODULE_ID, SETTINGS, loc, setSetting, setting } from "../const.mjs";
import { CLIMATES, INTENSITIES, WEATHER_TYPES } from "../weather-data.mjs";
import { currentMoment, weatherSeasonOf } from "../calendar.mjs";
import {
  activeClimate, announceWeather, currentWeather, describeWeather, isMuted, muteEffect, rollAndSetWeather, setWeather
} from "../weather.mjs";
import { availableSceneEffects, flash, sceneEffectFor } from "../effects.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The weather window: what the sky is doing, which parts of it are visible, and how to change either.
 */
export class WeatherApp extends HandlebarsApplicationMixin(ApplicationV2) {

  /** Marks this window as one of the module's, so a changed setting can re-render it. */
  static EASY_WEATHER = true;

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: "easy-weather-weather",
    classes: ["easy-weather", "ew-app"],
    tag: "div",
    window: {
      title: "EASYWEATHER.WeatherApp.Title",
      icon: "fa-solid fa-cloud-sun-rain",
      resizable: true
    },
    position: { width: 520, height: "auto" },
    actions: {
      setType: WeatherApp.#onSetType,
      setIntensity: WeatherApp.#onSetIntensity,
      toggleEffect: WeatherApp.#onToggleEffect,
      toggleAll: WeatherApp.#onToggleAll,
      roll: WeatherApp.#onRoll,
      announce: WeatherApp.#onAnnounce,
      testFlash: WeatherApp.#onTestFlash
    }
  };

  /** @inheritdoc */
  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/weather-app.hbs` }
  };

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _prepareContext(options) {
    const weather = describeWeather(currentWeather());
    const moment = currentMoment();
    const available = availableSceneEffects();
    const particles = sceneEffectFor(currentWeather());

    return {
      weather,
      moment,
      isGM: game.user.isGM,
      seasonName: moment.seasonName,
      types: Object.values(WEATHER_TYPES).map(type => ({
        ...type,
        name: loc(type.label),
        active: type.id === weather.type.id,
        supported: !type.scene.length || type.scene.some(key => available.includes(key))
      })),
      intensities: Object.values(INTENSITIES).map(intensity => ({
        ...intensity,
        name: loc(intensity.label),
        active: intensity.id === weather.intensity.id
      })),
      toggles: [
        {
          key: "particles", icon: "fa-snowflake", label: loc("EASYWEATHER.Toggle.Particles"),
          on: !weather.muted?.particles, hint: particles ? `CONFIG.weatherEffects.${particles}` : loc("EASYWEATHER.Toggle.NoParticles"),
          disabled: !game.user.isGM || (setting(SETTINGS.sceneEffects, "current") === "off")
        },
        {
          key: "clouds", icon: "fa-cloud", label: loc("EASYWEATHER.Toggle.Clouds"),
          on: !weather.muted?.clouds && (setting(SETTINGS.cloudRenderer, "canvas") !== "off"),
          hint: loc("EASYWEATHER.Toggle.CloudsHint"), disabled: !weather.type.cloud
        },
        {
          key: "overlay", icon: "fa-brush", label: loc("EASYWEATHER.Toggle.Overlay"),
          on: !weather.muted?.overlay && setting(SETTINGS.overlay, true), hint: loc("EASYWEATHER.Toggle.OverlayHint")
        },
        {
          key: "lightning", icon: "fa-bolt", label: loc("EASYWEATHER.Toggle.Lightning"),
          on: !weather.muted?.lightning && setting(SETTINGS.lightning, true),
          hint: loc("EASYWEATHER.Toggle.LightningHint"), disabled: !weather.type.lightning
        },
        {
          key: "sound", icon: "fa-volume-high", label: loc("EASYWEATHER.Toggle.Sound"),
          on: !weather.muted?.sound && setting(SETTINGS.sound, false), hint: loc("EASYWEATHER.Toggle.SoundHint"),
          disabled: !weather.sound
        }
      ],
      climates: Object.values(CLIMATES).map(climate => ({
        ...climate, name: loc(climate.label), active: climate.id === activeClimate().id
      })),
      strength: Number(setting(SETTINGS.overlayStrength, 70)),
      outlook: this.#outlook(moment)
    };
  }

  /* -------------------------------------------- */

  /**
   * What this season tends to bring, as a share of all rolls.
   * @param {object} moment  Moment to look at.
   * @returns {object[]}
   */
  #outlook(moment) {
    const table = activeClimate().table[weatherSeasonOf(moment.components)] ?? {};
    const total = Object.values(table).reduce((sum, weight) => sum + weight, 0) || 1;
    return Object.entries(table)
      .map(([id, weight]) => ({
        id,
        name: loc(WEATHER_TYPES[id]?.label ?? id),
        icon: WEATHER_TYPES[id]?.icon ?? "fa-circle",
        color: WEATHER_TYPES[id]?.color ?? "#888",
        percent: Math.round((weight / total) * 100)
      }))
      .filter(entry => entry.percent > 0)
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 6);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onRender(context, options) {
    super._onRender?.(context, options);
    if ( !game.user.isGM ) return;

    this.element.querySelector("[name=climate]")?.addEventListener("change", async event => {
      await setSetting(SETTINGS.climate, event.target.value);
      this.render(false);
    });

    this.element.querySelector("[name=strength]")?.addEventListener("change", async event => {
      await setSetting(SETTINGS.overlayStrength, Number(event.target.value));
    });

    this.element.querySelector("[name=temperature]")?.addEventListener("change", async event => {
      await setWeather({ temperature: Number(event.target.value) }, { announce: false });
    });

    this.element.querySelector("[name=wind]")?.addEventListener("change", async event => {
      await setWeather({ wind: Number(event.target.value) }, { announce: false });
    });
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  /**
   * Set the weather to a type.
   * @this {WeatherApp}
   * @param {PointerEvent} event  Click event.
   * @param {HTMLElement} target  The button that was clicked.
   */
  static async #onSetType(event, target) {
    const type = WEATHER_TYPES[target.dataset.type];
    if ( !type ) return;
    await setWeather({ type: type.id, wind: type.wind ?? 0, enabled: true }, { announce: false });
    this.render(false);
  }

  /**
   * Set how strongly the weather plays.
   * @this {WeatherApp}
   * @param {PointerEvent} event  Click event.
   * @param {HTMLElement} target  The button that was clicked.
   */
  static async #onSetIntensity(event, target) {
    await setWeather({ intensity: target.dataset.intensity }, { announce: false });
    this.render(false);
  }

  /**
   * Silence or restore one of the visual layers.
   * @this {WeatherApp}
   * @param {PointerEvent} event  Click event.
   * @param {HTMLElement} target  The button that was clicked.
   */
  static async #onToggleEffect(event, target) {
    const key = target.dataset.key;
    // The overlay, the flashes and the ambience are per-client comfort settings as well as part of the weather,
    // so a GM turning one off here turns it off for the world while a player only silences their own screen.
    const clientKey = { overlay: SETTINGS.overlay, lightning: SETTINGS.lightning, sound: SETTINGS.sound }[key];

    // The cloud shadows are drawn by a renderer this client picks, so their own switch is a string rather than a
    // flag. Turning them off here leaves a chosen renderer alone, so turning them on again restores it.
    const cloudsOff = () => setting(SETTINGS.cloudRenderer, "canvas") === "off";

    if ( !game.user.isGM ) {
      if ( key === "clouds" ) await setSetting(SETTINGS.cloudRenderer, cloudsOff() ? "canvas" : "off");
      else if ( clientKey ) await setSetting(clientKey, !setting(clientKey, key !== "sound"));
      this.render(false);
      return;
    }

    const muted = isMuted(key);
    // Turning a layer back on should actually show it, even when this screen had switched it off earlier.
    if ( muted && clientKey ) await setSetting(clientKey, true);
    if ( muted && (key === "clouds") && cloudsOff() ) await setSetting(SETTINGS.cloudRenderer, "canvas");
    await muteEffect(key, !muted);
    this.render(false);
  }

  /**
   * Turn every effect of the current weather on or off at once.
   * @this {WeatherApp}
   */
  static async #onToggleAll() {
    const weather = currentWeather();
    await setWeather({ enabled: !weather.enabled }, { announce: false });
    this.render(false);
  }

  /**
   * Roll the weather for today.
   * @this {WeatherApp}
   */
  static async #onRoll() {
    await rollAndSetWeather();
    this.render(false);
  }

  /**
   * Post the current weather to chat.
   * @this {WeatherApp}
   */
  static async #onAnnounce() {
    await announceWeather(currentWeather());
  }

  /**
   * Show a single lightning flash on this screen.
   * @this {WeatherApp}
   */
  static #onTestFlash() {
    flash();
  }
}
