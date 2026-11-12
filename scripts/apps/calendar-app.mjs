import { MODULE_ID, SETTINGS, formDataClass, loc, setSetting, setting } from "../const.mjs";
import {
  activeCalendar, componentsOf, currentMoment, dateFromDayIndex, dayIndexFromDate, daysInMonth, isLeapYear,
  moonPhases, noteKey, seasonForDate
} from "../calendar.mjs";
import { setDate } from "../time.mjs";
import { CalendarEditor } from "./calendar-editor.mjs";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The calendar window: a month at a glance, with its seasons, its moons and the notes the table keeps.
 */
export class CalendarApp extends HandlebarsApplicationMixin(ApplicationV2) {

  /** Marks this window as one of the module's. */
  static EASY_WEATHER = true;

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: "easy-weather-calendar",
    classes: ["easy-weather", "ew-app"],
    tag: "div",
    window: {
      title: "EASYWEATHER.CalendarApp.Title",
      icon: "fa-solid fa-calendar-days",
      resizable: true
    },
    position: { width: 640, height: "auto" },
    actions: {
      prevMonth: CalendarApp.#onPrevMonth,
      nextMonth: CalendarApp.#onNextMonth,
      prevYear: CalendarApp.#onPrevYear,
      nextYear: CalendarApp.#onNextYear,
      today: CalendarApp.#onToday,
      selectDay: CalendarApp.#onSelectDay,
      travel: CalendarApp.#onTravel,
      addNote: CalendarApp.#onAddNote,
      deleteNote: CalendarApp.#onDeleteNote,
      edit: CalendarApp.#onEdit
    }
  };

  /** @inheritdoc */
  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/calendar-app.hbs` }
  };

  /* -------------------------------------------- */

  /** The month the window is showing; `null` means the current one. */
  #view = null;

  /** The day the user has picked, as an absolute day index. */
  #selected = null;

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _prepareContext(options) {
    const calendar = activeCalendar();
    const moment = currentMoment();
    const view = this.#view ?? { year: moment.components.year, month: moment.components.month };
    const selected = this.#selected ?? moment.components.dayIndex;
    const notes = setting(SETTINGS.notes, {}) ?? {};

    const monthLength = daysInMonth(calendar, view.year, view.month);
    const firstIndex = dayIndexFromDate(view.year, view.month, 0, calendar);
    const weekLength = Math.max(1, calendar.weekdays.length);
    const leading = calendar.weekdays.length
      ? (((firstIndex + (calendar.firstWeekday ?? 0)) % weekLength) + weekLength) % weekLength : 0;

    const days = [];
    for ( let index = 0; index < leading; index++ ) days.push({ blank: true });
    for ( let day = 0; day < monthLength; day++ ) {
      const dayIndex = firstIndex + day;
      const season = seasonForDate(view.year, view.month, day, calendar);
      days.push({
        blank: false,
        day: day + 1,
        dayIndex,
        season,
        seasonColor: season?.color ?? "#888",
        isToday: dayIndex === moment.components.dayIndex,
        isSelected: dayIndex === selected,
        notes: notes[noteKey(dayIndex)] ?? [],
        moon: (moonPhases(dayIndex, calendar)[0] ?? null)
      });
    }

    const selectedDate = dateFromDayIndex(selected, calendar);
    const selectedSeason = seasonForDate(selectedDate.year, selectedDate.month, selectedDate.day, calendar);

    return {
      calendar,
      moment,
      isGM: game.user.isGM,
      view,
      monthName: calendar.months[view.month]?.name ?? "",
      leapYear: isLeapYear(calendar, view.year),
      weekdays: calendar.weekdays,
      days,
      today: moment.date,
      selected: {
        dayIndex: selected,
        ...selectedDate,
        label: `${calendar.months[selectedDate.month]?.name ?? ""} ${selectedDate.day + 1}, ${selectedDate.year}`,
        seasonName: loc(selectedSeason?.name ?? ""),
        seasonColor: selectedSeason?.color ?? "#888",
        moons: moonPhases(selected, calendar).map(moon => ({ ...moon, phaseName: loc(moon.phase.name) })),
        notes: notes[noteKey(selected)] ?? []
      }
    };
  }

  /* -------------------------------------------- */

  /**
   * Move the shown month by a number of months.
   * @param {number} delta  Months to move.
   */
  #shiftMonth(delta) {
    const calendar = activeCalendar();
    const moment = currentMoment();
    const view = this.#view ?? { year: moment.components.year, month: moment.components.month };
    const count = calendar.months.length;
    const total = (view.year * count) + view.month + delta;
    this.#view = { year: Math.floor(total / count), month: ((total % count) + count) % count };
    this.render(false);
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  /** @this {CalendarApp} */
  static #onPrevMonth() { this.#shiftMonth(-1); }

  /** @this {CalendarApp} */
  static #onNextMonth() { this.#shiftMonth(1); }

  /** @this {CalendarApp} */
  static #onPrevYear() { this.#shiftMonth(-activeCalendar().months.length); }

  /** @this {CalendarApp} */
  static #onNextYear() { this.#shiftMonth(activeCalendar().months.length); }

  /** @this {CalendarApp} */
  static #onToday() {
    this.#view = null;
    this.#selected = currentMoment().components.dayIndex;
    this.render(false);
  }

  /**
   * Pick a day.
   * @this {CalendarApp}
   * @param {PointerEvent} event  Click event.
   * @param {HTMLElement} target  The day that was clicked.
   */
  static #onSelectDay(event, target) {
    this.#selected = Number(target.dataset.dayIndex);
    this.render(false);
  }

  /**
   * Move the world clock to the selected day, keeping the time of day.
   * @this {CalendarApp}
   */
  static async #onTravel() {
    if ( !game.user.isGM ) return;
    const calendar = activeCalendar();
    const selected = this.#selected ?? currentMoment().components.dayIndex;
    const date = dateFromDayIndex(selected, calendar);
    await setDate(date);
    this.render(false);
  }

  /**
   * Add a note to the selected day.
   * @this {CalendarApp}
   */
  static async #onAddNote() {
    if ( !game.user.isGM ) return;
    const selected = this.#selected ?? currentMoment().components.dayIndex;
    const data = await DialogV2.prompt({
      window: { title: loc("EASYWEATHER.Note.Add"), icon: "fa-solid fa-bookmark" },
      classes: ["easy-weather", "ew-app"],
      content: `
        <div class="ew-form">
          <label>${loc("EASYWEATHER.Note.TitleField")}
            <input type="text" name="title" autofocus>
          </label>
          <label>${loc("EASYWEATHER.Note.TextField")}
            <textarea name="text" rows="4"></textarea>
          </label>
        </div>`,
      ok: {
        label: loc("EASYWEATHER.Note.Save"),
        callback: (event, button) => new (formDataClass())(button.form).object
      },
      rejectClose: false
    });
    if ( !data?.title?.trim() ) return;

    const notes = foundry.utils.deepClone(setting(SETTINGS.notes, {}) ?? {});
    const key = noteKey(selected);
    notes[key] = [...(notes[key] ?? []), {
      id: foundry.utils.randomID(), title: data.title.trim(), text: (data.text ?? "").trim()
    }];
    await setSetting(SETTINGS.notes, notes);
    this.render(false);
  }

  /**
   * Remove a note from the selected day.
   * @this {CalendarApp}
   * @param {PointerEvent} event  Click event.
   * @param {HTMLElement} target  The button that was clicked.
   */
  static async #onDeleteNote(event, target) {
    if ( !game.user.isGM ) return;
    const selected = this.#selected ?? currentMoment().components.dayIndex;
    const key = noteKey(selected);
    const notes = foundry.utils.deepClone(setting(SETTINGS.notes, {}) ?? {});
    notes[key] = (notes[key] ?? []).filter(note => note.id !== target.dataset.noteId);
    if ( !notes[key].length ) delete notes[key];
    await setSetting(SETTINGS.notes, notes);
    this.render(false);
  }

  /**
   * Open the calendar editor.
   * @this {CalendarApp}
   */
  static #onEdit() {
    if ( !game.user.isGM ) return;
    new CalendarEditor().render({ force: true });
  }
}
