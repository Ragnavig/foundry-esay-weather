import { SETTINGS, isPrimaryGM, loc, logError, setting } from "./const.mjs";
import { activeCalendar, componentsOf, currentMoment, daylightOf, secondsPerDay, worldTimeFromDate } from "./calendar.mjs";
import { rollAndSetWeather } from "./weather.mjs";

/**
 * Moving the world clock, and everything that should happen when a new day begins.
 */

/* -------------------------------------------- */

/**
 * May this user move the world clock?
 * @returns {boolean}
 */
export function canControlTime() {
  return game.user.isGM;
}

/**
 * Move the world clock by a number of seconds.
 * @param {number} seconds  Seconds to add; may be negative.
 * @returns {Promise<number|void>}
 */
export async function advanceSeconds(seconds) {
  if ( !canControlTime() ) {
    ui.notifications?.warn(loc("EASYWEATHER.Notify.GMOnly"));
    return;
  }
  if ( !seconds ) return;
  try {
    return await game.time.advance(Math.round(seconds));
  } catch(err) {
    logError("Failed to advance the world time", err);
  }
}

/**
 * Move the world clock by calendar units.
 * @param {object} units            Any of `seconds`, `minutes`, `hours`, `days`, `months` or `years`.
 * @returns {Promise<number|void>}
 */
export async function advance(units={}) {
  const calendar = activeCalendar();
  const { secondsPerMinute, minutesPerHour, hoursPerDay } = calendar.time;
  const spd = secondsPerDay(calendar);

  let seconds = (units.seconds ?? 0)
    + ((units.minutes ?? 0) * secondsPerMinute)
    + ((units.hours ?? 0) * secondsPerMinute * minutesPerHour)
    + ((units.days ?? 0) * spd);

  // Months and years are not a fixed number of days, so they move the date itself.
  if ( units.months || units.years ) {
    const now = componentsOf(game.time.worldTime + seconds, calendar);
    const monthCount = calendar.months.length;
    const total = (now.year * monthCount) + now.month + (units.months ?? 0) + ((units.years ?? 0) * monthCount);
    const year = Math.floor(total / monthCount);
    const month = ((total % monthCount) + monthCount) % monthCount;
    const target = worldTimeFromDate({ ...now, year, month }, calendar);
    seconds = target - game.time.worldTime;
  }

  return advanceSeconds(seconds);
}

/**
 * Jump to an exact date and time.
 * @param {object} date  `{ year, month, day, hour, minute, second }`.
 * @returns {Promise<number|void>}
 */
export async function setDate(date) {
  const calendar = activeCalendar();
  const now = componentsOf(game.time.worldTime, calendar);
  const target = worldTimeFromDate({ ...now, ...date }, calendar);
  return advanceSeconds(target - game.time.worldTime);
}

/**
 * Jump to the next sunrise, noon, sunset or midnight.
 * @param {"sunrise"|"noon"|"sunset"|"midnight"} which  Moment to jump to.
 * @returns {Promise<number|void>}
 */
export async function jumpTo(which) {
  const calendar = activeCalendar();
  const spd = secondsPerDay(calendar);
  const components = componentsOf(game.time.worldTime, calendar);
  const { sunrise, sunset } = daylightOf(components, calendar);

  const fractions = { sunrise, noon: 0.5, sunset, midnight: 0 };
  const fraction = fractions[which] ?? 0.5;
  let delta = Math.round((fraction * spd) - components.secondOfDay);
  if ( delta <= 0 ) delta += spd;
  return advanceSeconds(delta);
}

/* -------------------------------------------- */
/*  A new day                                   */
/* -------------------------------------------- */

/** The day the last update was on, so a rollover can be spotted. */
let lastDayIndex = null;

/**
 * Remember which day the world is on without reacting to it.
 */
export function primeDayTracking() {
  lastDayIndex = currentMoment().components.dayIndex;
}

/**
 * React to the world clock moving.
 * @param {number} worldTime  The new world time.
 * @returns {Promise<void>}
 */
export async function onWorldTimeUpdate(worldTime) {
  const moment = currentMoment(worldTime);
  const dayIndex = moment.components.dayIndex;
  const previous = lastDayIndex;
  lastDayIndex = dayIndex;

  Hooks.callAll("easyWeather.timeChanged", moment);

  if ( (previous === null) || (dayIndex === previous) ) return;
  Hooks.callAll("easyWeather.dayChanged", moment, previous);

  // Only one client may roll, and only when the day actually moved forward.
  if ( !isPrimaryGM() ) return;
  if ( !setting(SETTINGS.autoRoll, true) ) return;
  if ( dayIndex < previous ) return;
  await rollAndSetWeather({ moment });
}

/* -------------------------------------------- */
/*  Quick steps                                 */
/* -------------------------------------------- */

/**
 * The buttons the control panel offers for moving time.
 * @returns {object[]}
 */
export function quickSteps() {
  return [
    { id: "m1", label: "EASYWEATHER.Step.Minute1", units: { minutes: 1 } },
    { id: "m10", label: "EASYWEATHER.Step.Minute10", units: { minutes: 10 } },
    { id: "h1", label: "EASYWEATHER.Step.Hour1", units: { hours: 1 } },
    { id: "h8", label: "EASYWEATHER.Step.Hour8", units: { hours: 8 } },
    { id: "d1", label: "EASYWEATHER.Step.Day1", units: { days: 1 } }
  ];
}
