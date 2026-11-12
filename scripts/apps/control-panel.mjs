import { MODULE_ID, SETTINGS, clamp, loc, logError, setSetting, setting } from "../const.mjs";
import { currentMoment } from "../calendar.mjs";
import { advance, canControlTime, jumpTo, quickSteps } from "../time.mjs";
import { currentWeather, describeWeather, rollAndSetWeather } from "../weather.mjs";
import { CalendarApp } from "./calendar-app.mjs";
import { WeatherApp } from "./weather-app.mjs";

/**
 * The floating panel that shows the date, the clock and the weather, and lets a GM move time with one click.
 *
 * It is a plain element rather than an application window so it can be small, frameless and always in the same
 * corner of the screen without fighting Foundry's window chrome.
 */
export class ControlPanel {

  /** @type {ControlPanel|null} */
  static #instance = null;

  /** @type {HTMLElement|null} */
  #element = null;

  /** Direction the step buttons move time in. */
  #reverse = false;

  /** @type {boolean} */
  #rendering = false;

  /* -------------------------------------------- */

  /**
   * Hide or restore the clock the game system keeps at the top of the screen, so the two do not sit on top of each
   * other. Nothing is written to the system's own settings; the bar is only taken out of view on this client.
   */
  static applySystemClockVisibility() {
    document.body?.classList.toggle("ew-hide-system-clock", Boolean(setting(SETTINGS.hideSystemClock, false)));
  }

  /**
   * The panel of this client, created on first use.
   * @returns {ControlPanel}
   */
  static get instance() {
    return ControlPanel.#instance ??= new ControlPanel();
  }

  /* -------------------------------------------- */

  /**
   * Should this user see the panel at all?
   * @returns {boolean}
   */
  static get visible() {
    return game.user.isGM || setting(SETTINGS.playerPanel, true);
  }

  /* -------------------------------------------- */

  /**
   * Build the panel and put it on screen.
   * @returns {Promise<void>}
   */
  async render() {
    ControlPanel.applySystemClockVisibility();
    if ( !ControlPanel.visible ) return this.close();
    if ( this.#rendering ) return;
    this.#rendering = true;
    try {
      const html = await foundry.applications.handlebars.renderTemplate(
        `modules/${MODULE_ID}/templates/control-panel.hbs`, this.#context());
      const element = this.#ensureElement();
      element.innerHTML = html;
      element.classList.toggle("ew-collapsed", Boolean(setting(SETTINGS.panelCollapsed, false)));
      element.classList.toggle("ew-fade", Boolean(setting(SETTINGS.panelFade, true)));
      element.classList.toggle("ew-dungeon", Boolean(setting(SETTINGS.dungeonMode, false)));
      this.#activateListeners(element);
      this.#applyPosition(element);
    } catch(err) {
      logError("Failed to render the control panel", err);
    } finally {
      this.#rendering = false;
    }
  }

  /* -------------------------------------------- */

  /**
   * Remove the panel from the screen.
   */
  close() {
    this.#element?.remove();
    this.#element = null;
  }

  /* -------------------------------------------- */

  /**
   * Everything the template needs.
   * @returns {object}
   */
  #context() {
    const moment = currentMoment();
    const weather = describeWeather(currentWeather());
    return {
      moment,
      weather,
      date: moment.date,
      clock: moment.clock,
      season: moment.components.season,
      seasonName: moment.seasonName,
      moon: moment.moons[0] ?? null,
      isGM: canControlTime(),
      reverse: this.#reverse,
      dungeon: Boolean(setting(SETTINGS.dungeonMode, false)),
      steps: quickSteps().map(step => ({ ...step, label: loc(step.label) })),
      jumps: [
        { id: "sunrise", icon: "fa-mountain-sun", label: loc("EASYWEATHER.Jump.Sunrise") },
        { id: "noon", icon: "fa-sun", label: loc("EASYWEATHER.Jump.Noon") },
        { id: "sunset", icon: "fa-cloud-moon", label: loc("EASYWEATHER.Jump.Sunset") },
        { id: "midnight", icon: "fa-moon", label: loc("EASYWEATHER.Jump.Midnight") }
      ]
    };
  }

  /* -------------------------------------------- */

  /**
   * The panel element, created and attached on first use.
   * @returns {HTMLElement}
   */
  #ensureElement() {
    if ( this.#element?.isConnected ) return this.#element;
    const element = document.createElement("div");
    element.id = "easy-weather-panel";
    element.classList.add("easy-weather");
    (document.getElementById("interface") ?? document.body).appendChild(element);
    this.#element = element;
    return element;
  }

  /* -------------------------------------------- */

  /**
   * Put the panel where this client last left it. Without a stored position it starts clear of whatever the system
   * keeps at the top of the screen.
   * @param {HTMLElement} element  Panel element.
   */
  #applyPosition(element) {
    const stored = setting(SETTINGS.panelPosition, {}) ?? {};
    const top = clamp(Number(stored.top ?? 12), 0, Math.max(0, window.innerHeight - 60));
    const left = clamp(Number(stored.left ?? ControlPanel.#defaultLeft()), 0, Math.max(0, window.innerWidth - 120));
    element.style.top = `${top}px`;
    element.style.left = `${left}px`;
  }

  /* -------------------------------------------- */

  /**
   * Where the panel starts out: clear of the bars the interface keeps down the left-hand side. The containers at
   * the top of the screen are full-height flex columns, so only the controls themselves can be measured.
   * @returns {number}
   */
  static #defaultLeft() {
    let right = 90;
    for ( const id of ["scene-controls", "scene-navigation"] ) {
      const rect = document.getElementById(id)?.getBoundingClientRect();
      if ( rect?.width ) right = Math.max(right, rect.right);
    }
    return Math.round(right + 12);
  }

  /* -------------------------------------------- */

  /**
   * Wire up every control of the panel.
   * @param {HTMLElement} element  Panel element.
   */
  #activateListeners(element) {
    element.querySelectorAll("[data-action]").forEach(button => {
      button.addEventListener("click", event => this.#onAction(event, button));
    });

    const handle = element.querySelector(".ew-drag");
    handle?.addEventListener("pointerdown", event => this.#onDragStart(event, element));
  }

  /* -------------------------------------------- */

  /**
   * Handle a click on one of the panel's buttons.
   * @param {PointerEvent} event    Click event.
   * @param {HTMLElement} target    The button that was clicked.
   * @returns {Promise<void>}
   */
  async #onAction(event, target) {
    event.preventDefault();
    const action = target.dataset.action;
    const sign = (this.#reverse || event.shiftKey) ? -1 : 1;

    switch ( action ) {
      case "step": {
        const step = quickSteps().find(entry => entry.id === target.dataset.step);
        if ( !step ) return;
        const units = Object.fromEntries(Object.entries(step.units).map(([key, value]) => [key, value * sign]));
        await advance(units);
        break;
      }
      case "reverse":
        this.#reverse = !this.#reverse;
        await this.render();
        break;
      case "jump":
        await jumpTo(target.dataset.jump);
        break;
      case "calendar":
        new CalendarApp().render({ force: true });
        break;
      case "weather":
        new WeatherApp().render({ force: true });
        break;
      case "roll":
        await rollAndSetWeather();
        break;
      case "dungeon":
        if ( !game.user.isGM ) return;
        await setSetting(SETTINGS.dungeonMode, !setting(SETTINGS.dungeonMode, false));
        await this.render();
        break;
      case "collapse":
        await setSetting(SETTINGS.panelCollapsed, !setting(SETTINGS.panelCollapsed, false));
        await this.render();
        break;
      default:
        break;
    }
  }

  /* -------------------------------------------- */

  /**
   * Start dragging the panel around.
   * @param {PointerEvent} event    Pointer event.
   * @param {HTMLElement} element   Panel element.
   */
  #onDragStart(event, element) {
    if ( event.button !== 0 ) return;
    if ( event.target.closest("[data-action]") ) return;
    event.preventDefault();

    const start = { x: event.clientX, y: event.clientY };
    const origin = { top: element.offsetTop, left: element.offsetLeft };
    element.classList.add("ew-dragging");

    const onMove = move => {
      const top = clamp(origin.top + (move.clientY - start.y), 0, window.innerHeight - 40);
      const left = clamp(origin.left + (move.clientX - start.x), 0, window.innerWidth - 80);
      element.style.top = `${top}px`;
      element.style.left = `${left}px`;
    };

    const onUp = async () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      element.classList.remove("ew-dragging");
      await setSetting(SETTINGS.panelPosition, { top: element.offsetTop, left: element.offsetLeft });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
}
