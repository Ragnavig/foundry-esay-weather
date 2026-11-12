import { MODULE_ID, SETTINGS, loc, mod, setting } from "./const.mjs";
import { clonePreset } from "./presets.mjs";

/**
 * All calendar maths. World time is a plain number of seconds, and everything else in the module is derived from it
 * through the world's calendar, so nothing has to be stored twice.
 */

/* -------------------------------------------- */
/*  Access                                      */
/* -------------------------------------------- */

/**
 * The calendar the world is currently using.
 * @returns {object}
 */
export function activeCalendar() {
  const stored = setting(SETTINGS.calendar);
  if ( stored?.months?.length ) return stored;
  return clonePreset("gregorian");
}

/**
 * Seconds in one day of a calendar.
 * @param {object} calendar  Calendar to measure.
 * @returns {number}
 */
export function secondsPerDay(calendar) {
  const { secondsPerMinute, minutesPerHour, hoursPerDay } = calendar.time;
  return secondsPerMinute * minutesPerHour * hoursPerDay;
}

/* -------------------------------------------- */
/*  Years, months and days                      */
/* -------------------------------------------- */

/**
 * Is this a leap year in the given calendar?
 * @param {object} calendar  Calendar to ask.
 * @param {number} year      Year number.
 * @returns {boolean}
 */
export function isLeapYear(calendar, year) {
  const leap = calendar.leap ?? {};
  if ( !leap.interval ) return false;
  if ( mod(year, leap.interval) !== 0 ) return false;
  if ( leap.skip && (mod(year, leap.skip) === 0) ) {
    return Boolean(leap.skipException) && (mod(year, leap.skipException) === 0);
  }
  return true;
}

/**
 * Number of days in one month.
 * @param {object} calendar    Calendar to ask.
 * @param {number} year        Year the month sits in.
 * @param {number} monthIndex  Zero-based month index.
 * @returns {number}
 */
export function daysInMonth(calendar, year, monthIndex) {
  const month = calendar.months[monthIndex];
  if ( !month ) return 0;
  return (isLeapYear(calendar, year) && month.leapDays) ? month.leapDays : month.days;
}

/**
 * Number of days in one year.
 * @param {object} calendar  Calendar to ask.
 * @param {number} year      Year number.
 * @returns {number}
 */
export function daysInYear(calendar, year) {
  return calendar.months.reduce((sum, month, index) => sum + daysInMonth(calendar, year, index), 0);
}

/* -------------------------------------------- */
/*  Conversion                                  */
/* -------------------------------------------- */

/**
 * The absolute day index of a world time, where `0` is the first day of the calendar's start year.
 * @param {number} worldTime  World time in seconds.
 * @param {object} calendar   Calendar to use.
 * @returns {number}
 */
export function dayIndexOf(worldTime, calendar) {
  return Math.floor(worldTime / secondsPerDay(calendar));
}

/**
 * Break a world time down into the components of a calendar.
 * @param {number} worldTime   World time in seconds.
 * @param {object} [calendar]  Calendar to use; defaults to the world's.
 * @returns {object}           Year, month, day, weekday, time of day and the season.
 */
export function componentsOf(worldTime, calendar=activeCalendar()) {
  const spd = secondsPerDay(calendar);
  const dayIndex = Math.floor(worldTime / spd);
  const secondOfDay = mod(worldTime, spd);
  const { secondsPerMinute, minutesPerHour } = calendar.time;

  const date = dateFromDayIndex(dayIndex, calendar);
  const hour = Math.floor(secondOfDay / (secondsPerMinute * minutesPerHour));
  const minute = Math.floor(secondOfDay / secondsPerMinute) % minutesPerHour;
  const second = Math.floor(secondOfDay) % secondsPerMinute;
  const weekdayIndex = calendar.weekdays.length
    ? mod(dayIndex + (calendar.firstWeekday ?? 0), calendar.weekdays.length) : 0;

  return {
    ...date,
    dayIndex,
    secondOfDay,
    hour,
    minute,
    second,
    weekdayIndex,
    weekday: calendar.weekdays[weekdayIndex] ?? { name: "", abbr: "" },
    season: seasonOf(date.month, date.day, calendar),
    dayOfYear: dayOfYear(date.year, date.month, date.day, calendar)
  };
}

/**
 * Turn an absolute day index into a date.
 * @param {number} dayIndex  Absolute day index.
 * @param {object} calendar  Calendar to use.
 * @returns {{year: number, month: number, day: number}}
 */
export function dateFromDayIndex(dayIndex, calendar) {
  let year = calendar.startYear ?? 1;
  let remaining = dayIndex;

  // Campaigns rarely move more than a few centuries, but the loop is bounded all the same.
  let guard = 0;
  while ( (remaining < 0) && (guard++ < 100000) ) {
    year -= 1;
    remaining += daysInYear(calendar, year);
  }
  guard = 0;
  while ( guard++ < 100000 ) {
    const length = daysInYear(calendar, year);
    if ( remaining < length ) break;
    remaining -= length;
    year += 1;
  }

  let month = 0;
  while ( (month < calendar.months.length - 1) && (remaining >= daysInMonth(calendar, year, month)) ) {
    remaining -= daysInMonth(calendar, year, month);
    month += 1;
  }

  return { year, month, day: remaining };
}

/**
 * Turn a date into an absolute day index.
 * @param {number} year      Year number.
 * @param {number} month     Zero-based month index.
 * @param {number} day       Zero-based day of the month.
 * @param {object} calendar  Calendar to use.
 * @returns {number}
 */
export function dayIndexFromDate(year, month, day, calendar) {
  const startYear = calendar.startYear ?? 1;
  let days = 0;
  if ( year >= startYear ) for ( let y = startYear; y < year; y++ ) days += daysInYear(calendar, y);
  else for ( let y = year; y < startYear; y++ ) days -= daysInYear(calendar, y);
  for ( let m = 0; m < month; m++ ) days += daysInMonth(calendar, year, m);
  return days + day;
}

/**
 * Turn a full date and time into a world time.
 * @param {object} date        `{ year, month, day, hour, minute, second }`; missing parts count as zero.
 * @param {object} [calendar]  Calendar to use.
 * @returns {number}           World time in seconds.
 */
export function worldTimeFromDate(date, calendar=activeCalendar()) {
  const { secondsPerMinute, minutesPerHour } = calendar.time;
  const dayIndex = dayIndexFromDate(date.year, date.month ?? 0, date.day ?? 0, calendar);
  const timeOfDay = ((date.hour ?? 0) * minutesPerHour * secondsPerMinute)
    + ((date.minute ?? 0) * secondsPerMinute) + (date.second ?? 0);
  return (dayIndex * secondsPerDay(calendar)) + timeOfDay;
}

/**
 * The one-based day of the year.
 * @param {number} year      Year number.
 * @param {number} month     Zero-based month index.
 * @param {number} day       Zero-based day of the month.
 * @param {object} calendar  Calendar to use.
 * @returns {number}
 */
export function dayOfYear(year, month, day, calendar) {
  let days = 0;
  for ( let m = 0; m < month; m++ ) days += daysInMonth(calendar, year, m);
  return days + day + 1;
}

/* -------------------------------------------- */
/*  Seasons                                     */
/* -------------------------------------------- */

/**
 * The season a date falls into.
 * @param {number} month       Zero-based month index.
 * @param {number} day         Zero-based day of the month.
 * @param {object} [calendar]  Calendar to use.
 * @returns {object}           The season descriptor.
 */
export function seasonOf(month, day, calendar=activeCalendar()) {
  const seasons = (calendar.seasons ?? []).filter(season => Number.isInteger(season.month));
  if ( !seasons.length ) return { id: "none", name: "EASYWEATHER.Season.None", icon: "fa-circle", color: "#888888" };

  const ordered = [...seasons].sort((a, b) => (a.month - b.month) || (a.day - b.day));
  let current = ordered.at(-1);
  for ( const season of ordered ) {
    if ( (season.month < month) || ((season.month === month) && (season.day <= day)) ) current = season;
  }
  return current;
}

/* -------------------------------------------- */
/*  Daylight and moons                          */
/* -------------------------------------------- */

/**
 * Sunrise and sunset of a day, as a fraction of the day.
 * @param {object} components  Components of the day, as returned by {@link componentsOf}.
 * @param {object} [calendar]  Calendar to use.
 * @returns {{sunrise: number, sunset: number, daylight: number}}
 */
export function daylightOf(components, calendar=activeCalendar()) {
  const { base = 12, variation = 4 } = calendar.daylight ?? {};
  const yearLength = daysInYear(calendar, components.year) || 1;
  // The longest day sits roughly three quarters through the year's first half, which lines up with a midsummer
  // solstice on an Earth-like calendar and stays sensible on any other.
  const solstice = yearLength * 0.475;
  const phase = ((components.dayOfYear - solstice) / yearLength) * Math.PI * 2;
  const hours = base + (Math.cos(phase) * variation / 2);
  const hoursPerDay = calendar.time.hoursPerDay;
  const daylight = hours / hoursPerDay;
  return { sunrise: 0.5 - (daylight / 2), sunset: 0.5 + (daylight / 2), daylight };
}

/** Names of the eight moon phases, in order. */
export const MOON_PHASES = [
  { id: "new", name: "EASYWEATHER.Moon.New", icon: "🌑" },
  { id: "waxingCrescent", name: "EASYWEATHER.Moon.WaxingCrescent", icon: "🌒" },
  { id: "firstQuarter", name: "EASYWEATHER.Moon.FirstQuarter", icon: "🌓" },
  { id: "waxingGibbous", name: "EASYWEATHER.Moon.WaxingGibbous", icon: "🌔" },
  { id: "full", name: "EASYWEATHER.Moon.Full", icon: "🌕" },
  { id: "waningGibbous", name: "EASYWEATHER.Moon.WaningGibbous", icon: "🌖" },
  { id: "lastQuarter", name: "EASYWEATHER.Moon.LastQuarter", icon: "🌗" },
  { id: "waningCrescent", name: "EASYWEATHER.Moon.WaningCrescent", icon: "🌘" }
];

/**
 * The phase of every moon of the calendar on a given day.
 * @param {number} dayIndex    Absolute day index.
 * @param {object} [calendar]  Calendar to use.
 * @returns {object[]}
 */
export function moonPhases(dayIndex, calendar=activeCalendar()) {
  return (calendar.moons ?? []).map(moon => {
    const cycle = moon.cycle || 30;
    const fraction = mod(dayIndex - (moon.offset ?? 0), cycle) / cycle;
    const index = Math.round(fraction * MOON_PHASES.length) % MOON_PHASES.length;
    return { ...moon, fraction, phase: MOON_PHASES[index] };
  });
}

/* -------------------------------------------- */
/*  Formatting                                  */
/* -------------------------------------------- */

/**
 * The clock of a set of components, formatted for display.
 * @param {object} components  Components to format.
 * @param {object} [calendar]  Calendar to use.
 * @returns {{time: string, suffix: string}}
 */
export function formatTime(components, calendar=activeCalendar()) {
  const pad = value => String(value).padStart(2, "0");
  const twelve = (setting(SETTINGS.timeFormat, "24") === "12") && (calendar.time.hoursPerDay === 24);
  if ( !twelve ) return { time: `${pad(components.hour)}:${pad(components.minute)}`, suffix: "" };
  const suffix = components.hour < 12 ? "AM" : "PM";
  const hour = (components.hour % 12) || 12;
  return { time: `${hour}:${pad(components.minute)}`, suffix };
}

/**
 * The date of a set of components, formatted for display.
 * @param {object} components  Components to format.
 * @param {object} [calendar]  Calendar to use.
 * @returns {string}
 */
export function formatDate(components, calendar=activeCalendar()) {
  const month = calendar.months[components.month];
  return loc("EASYWEATHER.DateLine", {
    weekday: components.weekday?.name ?? "",
    day: components.day + 1,
    month: month?.name ?? "",
    year: components.year
  }).trim();
}

/**
 * Everything the interface needs about the current moment.
 * @param {number} [worldTime]  World time to describe; defaults to the current one.
 * @returns {object}
 */
export function currentMoment(worldTime=game.time.worldTime) {
  const calendar = activeCalendar();
  const components = componentsOf(worldTime, calendar);
  return {
    calendar,
    components,
    daylight: daylightOf(components, calendar),
    moons: moonPhases(components.dayIndex, calendar),
    clock: formatTime(components, calendar),
    date: formatDate(components, calendar)
  };
}

/**
 * The key a note is stored under.
 * @param {number} dayIndex  Absolute day index.
 * @returns {string}
 */
export function noteKey(dayIndex) {
  return `d${dayIndex}`;
}

/** @type {string} */
export const CALENDAR_MODULE = MODULE_ID;
