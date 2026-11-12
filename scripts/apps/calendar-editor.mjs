import { MODULE_ID, SETTINGS, formDataClass, loc, logError, setSetting, setting } from "../const.mjs";
import { activeCalendar, resetCalendarCache, usesFoundryCalendar } from "../calendar.mjs";
import { CALENDAR_PRESETS, clonePreset } from "../presets.mjs";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The calendar editor: months, weekdays, seasons and moons of the world, all in one form.
 *
 * Edits are kept in the editor until they are saved, so a half-finished calendar never reaches the world and the
 * world clock never jumps around while months are being re-typed.
 */
export class CalendarEditor extends HandlebarsApplicationMixin(ApplicationV2) {

  /** Marks this window as one of the module's. */
  static EASY_WEATHER = true;

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: "easy-weather-calendar-editor",
    classes: ["easy-weather", "ew-app", "ew-editor"],
    tag: "form",
    window: {
      title: "EASYWEATHER.Editor.Title",
      icon: "fa-solid fa-pen-ruler",
      resizable: true
    },
    position: { width: 700, height: 680 },
    form: {
      handler: CalendarEditor.#onSubmit,
      closeOnSubmit: true,
      submitOnChange: false
    },
    actions: {
      addRow: CalendarEditor.#onAddRow,
      removeRow: CalendarEditor.#onRemoveRow,
      loadPreset: CalendarEditor.#onLoadPreset,
      reset: CalendarEditor.#onReset,
      useOwn: CalendarEditor.#onUseOwn,
      useFoundry: CalendarEditor.#onUseFoundry
    }
  };

  /** @inheritdoc */
  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/calendar-editor.hbs`, scrollable: [".ew-editor-body"] }
  };

  /* -------------------------------------------- */

  /** The calendar being edited. */
  #draft = null;

  /**
   * The working copy, taken from the world calendar on first use.
   * @returns {object}
   */
  get draft() {
    return this.#draft ??= foundry.utils.deepClone(activeCalendar());
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _prepareContext(options) {
    const calendar = this.draft;
    return {
      calendar,
      foundryMode: usesFoundryCalendar(),
      presets: Object.values(CALENDAR_PRESETS).map(preset => ({ id: preset.id, name: loc(preset.name) })),
      seasonIcons: ["fa-seedling", "fa-sun", "fa-leaf", "fa-snowflake", "fa-cloud", "fa-fire"],
      buttons: [
        { type: "submit", icon: "fa-solid fa-floppy-disk", label: "EASYWEATHER.Editor.Save" }
      ]
    };
  }

  /* -------------------------------------------- */

  /**
   * Read the form back into the working copy, so rows that were just typed survive adding another one.
   */
  #captureForm() {
    const form = this.element instanceof HTMLFormElement ? this.element : this.element?.querySelector("form");
    if ( !form ) return;
    try {
      const data = foundry.utils.expandObject(new (formDataClass())(form).object);
      this.#draft = CalendarEditor.#normalise(data, this.draft);
    } catch(err) {
      logError("Failed to read the calendar form", err);
    }
  }

  /* -------------------------------------------- */

  /**
   * Turn the raw form data into a calendar, keeping anything the form does not cover.
   * @param {object} data      Expanded form data.
   * @param {object} previous  The calendar the form was built from.
   * @returns {object}
   */
  static #normalise(data, previous) {
    const list = value => {
      if ( !value ) return [];
      return Array.isArray(value) ? value : Object.entries(value)
        .sort((a, b) => Number(a[0]) - Number(b[0])).map(entry => entry[1]);
    };

    const months = list(data.months)
      .filter(month => month && (month.name ?? "").toString().trim().length)
      .map(month => {
        const entry = {
          name: month.name.toString().trim(),
          abbr: (month.abbr ?? "").toString().trim() || month.name.toString().slice(0, 3),
          days: Math.max(1, Math.round(Number(month.days) || 1))
        };
        const leapDays = Math.round(Number(month.leapDays) || 0);
        if ( leapDays > 0 ) entry.leapDays = leapDays;
        return entry;
      });

    const weekdays = list(data.weekdays)
      .filter(day => day && (day.name ?? "").toString().trim().length)
      .map(day => ({
        name: day.name.toString().trim(),
        abbr: (day.abbr ?? "").toString().trim() || day.name.toString().slice(0, 2)
      }));

    const seasons = list(data.seasons)
      .filter(season => season && (season.name ?? "").toString().trim().length)
      .map((season, index) => ({
        id: season.id || `season${index}`,
        name: season.name.toString().trim(),
        icon: season.icon || "fa-circle",
        color: season.color || "#888888",
        month: Math.max(0, Math.round(Number(season.month) || 0)),
        day: Math.max(0, Math.round(Number(season.day) || 0))
      }));

    const moons = list(data.moons)
      .filter(moon => moon && (moon.name ?? "").toString().trim().length)
      .map(moon => ({
        name: moon.name.toString().trim(),
        cycle: Math.max(1, Number(moon.cycle) || 30),
        offset: Math.round(Number(moon.offset) || 0),
        color: moon.color || "#e8e6df"
      }));

    return {
      ...previous,
      name: (data.name ?? previous.name ?? "").toString().trim() || previous.name,
      time: {
        secondsPerMinute: Math.max(1, Math.round(Number(data.time?.secondsPerMinute) || 60)),
        minutesPerHour: Math.max(1, Math.round(Number(data.time?.minutesPerHour) || 60)),
        hoursPerDay: Math.max(1, Math.round(Number(data.time?.hoursPerDay) || 24))
      },
      startYear: Math.round(Number(data.startYear) || 1),
      firstWeekday: Math.max(0, Math.round(Number(data.firstWeekday) || 0)),
      leap: {
        interval: Math.max(0, Math.round(Number(data.leap?.interval) || 0)),
        skip: Math.max(0, Math.round(Number(data.leap?.skip) || 0)),
        skipException: Math.max(0, Math.round(Number(data.leap?.skipException) || 0))
      },
      daylight: {
        base: Number(data.daylight?.base) || 12,
        variation: Number(data.daylight?.variation) || 0
      },
      months: months.length ? months : previous.months,
      weekdays,
      seasons,
      moons
    };
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  /**
   * Add a month, weekday, season or moon.
   * @this {CalendarEditor}
   * @param {PointerEvent} event  Click event.
   * @param {HTMLElement} target  The button that was clicked.
   */
  static #onAddRow(event, target) {
    this.#captureForm();
    const blanks = {
      months: { name: loc("EASYWEATHER.Editor.NewMonth"), abbr: "", days: 30 },
      weekdays: { name: loc("EASYWEATHER.Editor.NewWeekday"), abbr: "" },
      seasons: { id: `season${foundry.utils.randomID(4)}`, name: loc("EASYWEATHER.Editor.NewSeason"), icon: "fa-circle", color: "#7bc96f", month: 0, day: 0 },
      moons: { name: loc("EASYWEATHER.Editor.NewMoon"), cycle: 30, offset: 0, color: "#e8e6df" }
    };
    const key = target.dataset.list;
    if ( !blanks[key] ) return;
    this.#draft[key] = [...(this.#draft[key] ?? []), blanks[key]];
    this.render(false);
  }

  /**
   * Remove one row.
   * @this {CalendarEditor}
   * @param {PointerEvent} event  Click event.
   * @param {HTMLElement} target  The button that was clicked.
   */
  static #onRemoveRow(event, target) {
    this.#captureForm();
    const key = target.dataset.list;
    const index = Number(target.dataset.index);
    if ( !Array.isArray(this.#draft[key]) ) return;
    this.#draft[key] = this.#draft[key].filter((entry, position) => position !== index);
    this.render(false);
  }

  /**
   * Replace the working copy with one of the shipped calendars.
   * @this {CalendarEditor}
   * @param {PointerEvent} event  Click event.
   * @param {HTMLElement} target  The button that was clicked.
   */
  static async #onLoadPreset(event, target) {
    const id = this.element.querySelector("[name=preset]")?.value ?? target.dataset.preset;
    if ( !id ) return;
    const confirmed = await DialogV2.confirm({
      window: { title: loc("EASYWEATHER.Editor.LoadPreset") },
      content: `<p>${loc("EASYWEATHER.Editor.LoadPresetHint")}</p>`,
      rejectClose: false
    });
    if ( !confirmed ) return;
    this.#draft = clonePreset(id);
    this.render(false);
  }

  /**
   * Throw the edits away and start from the world calendar again.
   * @this {CalendarEditor}
   */
  static #onReset() {
    this.#draft = null;
    this.render(false);
  }

  /**
   * Take Foundry's calendar over into this module's own, and switch to it.
   * @this {CalendarEditor}
   */
  static async #onUseOwn() {
    if ( !game.user.isGM ) return;
    const copy = foundry.utils.deepClone(activeCalendar());
    delete copy.fc;
    copy.source = "custom";
    await setSetting(SETTINGS.calendar, copy);
    await setSetting(SETTINGS.calendarSource, "custom");
    resetCalendarCache();
    this.#draft = null;
    this.render(false);
  }

  /**
   * Hand the calendar back to Foundry.
   * @this {CalendarEditor}
   */
  static async #onUseFoundry() {
    if ( !game.user.isGM ) return;
    await setSetting(SETTINGS.calendarSource, "foundry");
    resetCalendarCache();
    this.#draft = null;
    this.render(false);
  }

  /* -------------------------------------------- */

  /**
   * Store the edited calendar.
   * @this {CalendarEditor}
   * @param {SubmitEvent} event           Submit event.
   * @param {HTMLFormElement} form        The form.
   * @param {FormDataExtended} formData   The submitted data.
   */
  static async #onSubmit(event, form, formData) {
    if ( !game.user.isGM ) return;
    const data = foundry.utils.expandObject(formData.object);
    const calendar = CalendarEditor.#normalise(data, this.draft);

    // While the world follows Foundry's calendar, only the parts Foundry does not describe are this module's to keep.
    if ( usesFoundryCalendar() ) {
      const stored = foundry.utils.deepClone(setting(SETTINGS.calendar) ?? {});
      stored.moons = calendar.moons;
      stored.daylight = calendar.daylight;
      await setSetting(SETTINGS.calendar, stored);
    } else {
      await setSetting(SETTINGS.calendar, calendar);
    }
    ui.notifications?.info(loc("EASYWEATHER.Notify.CalendarSaved"));
  }
}
