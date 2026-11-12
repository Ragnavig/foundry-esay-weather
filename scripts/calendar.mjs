import { SETTINGS, loc, mod, setting } from "./const.mjs";
import { clonePreset } from "./presets.mjs";

/**
 * All calendar maths.
 *
 * Since Foundry 13 a world has a calendar of its own at `game.time.calendar`, and the GM sets the world's date
 * through it. That calendar is the default source here: months, weekdays, seasons, leap years and the length of a
 * day are read from it, and every conversion between a date and a world time is handed to it, so this module shows
 * exactly the date the world is set to.
 *
 * A world that wants something Foundry's calendar cannot express can switch to this module's own calendar, which is
 * stored in a setting and edited in the calendar editor. Moons and the length of daylight are this module's own in
 * both cases, because Foundry's calendar does not describe them.
 */

/* -------------------------------------------- */
/*  Building the active calendar                */
/* -------------------------------------------- */

/** The calendar built for this client, rebuilt whenever something it depends on changes. */
let cached = null;

/**
 * Forget the built calendar, so the next read puts it together again.
 */
export function resetCalendarCache() {
  cached = null;
}

/**
 * Is the world using Foundry's own calendar?
 * @returns {boolean}
 */
export function usesFoundryCalendar() {
  if ( setting(SETTINGS.calendarSource, "foundry") !== "foundry" ) return false;
  return Boolean(game.time?.calendar?.timeToComponents);
}

/**
 * The parts of a calendar that Foundry's own calendar does not describe.
 * @returns {{moons: object[], daylight: object}}
 */
function extras() {
  const stored = setting(SETTINGS.calendar) ?? {};
  return {
    moons: Array.isArray(stored.moons) ? stored.moons : clonePreset("gregorian").moons,
    daylight: stored.daylight ?? { base: 12, variation: 4 }
  };
}

/**
 * Season colours and icons, matched to a season's name so Foundry's own seasons look like the shipped ones.
 * @param {string} name  Season name.
 * @param {number} index  Position of the season in the year.
 * @returns {{icon: string, color: string, id: string}}
 */
function seasonLook(name, index) {
  const looks = [
    { id: "spring", icon: "fa-seedling", color: "#7bc96f", match: /spring|frühling|fruehling|blüte/i },
    { id: "summer", icon: "fa-sun", color: "#f2b134", match: /summer|sommer|hitze/i },
    { id: "autumn", icon: "fa-leaf", color: "#d4722c", match: /autumn|fall|herbst|ernte/i },
    { id: "winter", icon: "fa-snowflake", color: "#78b7e0", match: /winter|frost|kälte|kaelte/i }
  ];
  const found = looks.find(look => look.match.test(name ?? ""));
  if ( found ) return { id: found.id, icon: found.icon, color: found.color };
  const fallback = looks[index % looks.length];
  return { id: `season${index}`, icon: fallback.icon, color: fallback.color };
}

/**
 * Turn Foundry's world calendar into the shape the rest of this module works with.
 * @returns {object|null}  The calendar, or `null` if Foundry's calendar cannot be read.
 */
function fromFoundryCalendar() {
  const fc = game.time?.calendar;
  if ( !fc?.timeToComponents ) return null;

  let config;
  try {
    config = fc.toObject();
  } catch(err) {
    config = fc;
  }

  const localize = value => (typeof value === "string") ? game.i18n.localize(value) : value;
  const days = config.days ?? {};
  const months = (config.months?.values ?? []).map(month => ({
    name: localize(month.name),
    abbr: localize(month.abbreviation) || localize(month.name)?.slice(0, 3),
    days: month.days,
    leapDays: month.leapDays,
    intercalary: month.intercalary
  }));

  const weekdays = (days.values ?? []).map(day => ({
    name: localize(day.name),
    abbr: localize(day.abbreviation) || localize(day.name)?.slice(0, 2)
  }));

  const seasons = (config.seasons?.values ?? []).map((season, index) => ({
    ...seasonLook(localize(season.name), index),
    name: localize(season.name)
  }));

  return {
    source: "foundry",
    fc,
    name: localize(config.name) || loc("EASYWEATHER.Calendar.Foundry"),
    time: {
      secondsPerMinute: days.secondsPerMinute ?? 60,
      minutesPerHour: days.minutesPerHour ?? 60,
      hoursPerDay: days.hoursPerDay ?? 24
    },
    months: months.length ? months : clonePreset("gregorian").months,
    weekdays,
    seasons,
    firstWeekday: config.years?.firstWeekday ?? 0,
    startYear: config.years?.yearZero ?? 0,
    ...extras()
  };
}

/**
 * The calendar the world is currently using.
 * @returns {object}
 */
export function activeCalendar() {
  if ( cached ) return cached;

  if ( usesFoundryCalendar() ) {
    const built = fromFoundryCalendar();
    if ( built?.months?.length ) return cached = built;
  }

  const stored = setting(SETTINGS.calendar);
  const own = stored?.months?.length ? stored : clonePreset("gregorian");
  return cached = { ...foundry.utils.deepClone(own), source: "custom", fc: null };
}

/* -------------------------------------------- */
/*  Basics                                      */
/* -------------------------------------------- */

/**
 * Seconds in one day of a calendar.
 * @param {object} calendar  Calendar to measure.
 * @returns {number}
 */
export function secondsPerDay(calendar) {
  const { secondsPerMinute, minutesPerHour, hoursPerDay } = calendar.time;
  return secondsPerMinute * minutesPerHour * hoursPerDay;
}

/**
 * Is this a leap year in the given calendar?
 * @param {object} calendar  Calendar to ask.
 * @param {number} year      Year number.
 * @returns {boolean}
 */
export function isLeapYear(calendar, year) {
  if ( calendar.fc ) {
    try {
      return Boolean(calendar.fc.isLeapYear(year));
    } catch(err) {
      return false;
    }
  }
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
 * Break a world time down into the components of a calendar.
 * @param {number} worldTime   World time in seconds.
 * @param {object} [calendar]  Calendar to use; defaults to the world's.
 * @returns {object}           Year, month, day, weekday, time of day and the season.
 */
export function componentsOf(worldTime, calendar=activeCalendar()) {
  const spd = secondsPerDay(calendar);
  const dayIndex = Math.floor(worldTime / spd);
  const secondOfDay = mod(worldTime, spd);

  if ( calendar.fc ) {
    const c = calendar.fc.timeToComponents(worldTime);
    const weekdayIndex = c.dayOfWeek ?? 0;
    return {
      year: c.year,
      month: c.month ?? 0,
      day: c.dayOfMonth ?? 0,
      hour: c.hour ?? 0,
      minute: c.minute ?? 0,
      second: c.second ?? 0,
      dayIndex,
      secondOfDay,
      weekdayIndex,
      weekday: calendar.weekdays[weekdayIndex] ?? { name: "", abbr: "" },
      season: calendar.seasons[c.season] ?? noSeason(),
      seasonIndex: c.season ?? 0,
      seasonCount: calendar.seasons.length,
      dayOfYear: (c.day ?? 0) + 1,
      leapYear: Boolean(c.leapYear)
    };
  }

  const { secondsPerMinute, minutesPerHour } = calendar.time;
  const date = dateFromDayIndex(dayIndex, calendar);
  const weekdayIndex = calendar.weekdays.length
    ? mod(dayIndex + (calendar.firstWeekday ?? 0), calendar.weekdays.length) : 0;

  const season = seasonForDate(date.year, date.month, date.day, calendar);
  return {
    ...date,
    dayIndex,
    secondOfDay,
    hour: Math.floor(secondOfDay / (secondsPerMinute * minutesPerHour)),
    minute: Math.floor(secondOfDay / secondsPerMinute) % minutesPerHour,
    second: Math.floor(secondOfDay) % secondsPerMinute,
    weekdayIndex,
    weekday: calendar.weekdays[weekdayIndex] ?? { name: "", abbr: "" },
    season,
    seasonIndex: Math.max(0, (calendar.seasons ?? []).indexOf(season)),
    seasonCount: (calendar.seasons ?? []).length,
    dayOfYear: dayOfYear(date.year, date.month, date.day, calendar),
    leapYear: isLeapYear(calendar, date.year)
  };
}

/**
 * Turn an absolute day index into a date. Only used by this module's own calendar.
 * @param {number} dayIndex  Absolute day index.
 * @param {object} calendar  Calendar to use.
 * @returns {{year: number, month: number, day: number}}
 */
export function dateFromDayIndex(dayIndex, calendar) {
  if ( calendar.fc ) {
    const c = componentsOf(dayIndex * secondsPerDay(calendar), calendar);
    return { year: c.year, month: c.month, day: c.day };
  }

  let year = calendar.startYear ?? 1;
  let remaining = dayIndex;

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
 * Turn a full date and time into a world time.
 * @param {object} date        `{ year, month, day, hour, minute, second }`; missing parts count as zero.
 * @param {object} [calendar]  Calendar to use.
 * @returns {number}           World time in seconds.
 */
export function worldTimeFromDate(date, calendar=activeCalendar()) {
  if ( calendar.fc ) {
    return calendar.fc.componentsToTime({
      year: date.year,
      month: date.month ?? 0,
      dayOfMonth: date.day ?? 0,
      hour: date.hour ?? 0,
      minute: date.minute ?? 0,
      second: date.second ?? 0
    });
  }

  const { secondsPerMinute, minutesPerHour } = calendar.time;
  const dayIndex = dayIndexFromDate(date.year, date.month ?? 0, date.day ?? 0, calendar);
  const timeOfDay = ((date.hour ?? 0) * minutesPerHour * secondsPerMinute)
    + ((date.minute ?? 0) * secondsPerMinute) + (date.second ?? 0);
  return (dayIndex * secondsPerDay(calendar)) + timeOfDay;
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
  if ( calendar.fc ) {
    return Math.floor(worldTimeFromDate({ year, month, day }, calendar) / secondsPerDay(calendar));
  }

  const startYear = calendar.startYear ?? 1;
  let days = 0;
  if ( year >= startYear ) for ( let y = startYear; y < year; y++ ) days += daysInYear(calendar, y);
  else for ( let y = year; y < startYear; y++ ) days -= daysInYear(calendar, y);
  for ( let m = 0; m < month; m++ ) days += daysInMonth(calendar, year, m);
  return days + day;
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
 * The placeholder used when a calendar has no seasons at all.
 * @returns {object}
 */
function noSeason() {
  return { id: "none", name: "EASYWEATHER.Season.None", icon: "fa-circle", color: "#8a93a0" };
}

/**
 * The season a date falls into.
 * @param {number} year        Year number.
 * @param {number} month       Zero-based month index.
 * @param {number} day         Zero-based day of the month.
 * @param {object} [calendar]  Calendar to use.
 * @returns {object}           The season descriptor.
 */
export function seasonForDate(year, month, day, calendar=activeCalendar()) {
  if ( !calendar.seasons?.length ) return noSeason();

  if ( calendar.fc ) {
    try {
      const time = worldTimeFromDate({ year, month, day, hour: 12 }, calendar);
      const index = calendar.fc.timeToComponents(time).season;
      return calendar.seasons[index] ?? noSeason();
    } catch(err) {
      return noSeason();
    }
  }

  const seasons = calendar.seasons.filter(season => Number.isInteger(season.month));
  if ( !seasons.length ) return noSeason();
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
  const daylight = hours / calendar.time.hoursPerDay;
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
  return { time: `${(components.hour % 12) || 12}:${pad(components.minute)}`, suffix };
}

/**
 * The date of a set of components, formatted for display.
 * @param {object} components  Components to format.
 * @param {object} [calendar]  Calendar to use.
 * @returns {string}
 */
export function formatDate(components, calendar=activeCalendar()) {
  return loc("EASYWEATHER.DateLine", {
    weekday: components.weekday?.name ?? "",
    day: components.day + 1,
    month: calendar.months[components.month]?.name ?? "",
    year: components.year
  }).replace(/^,\s*/, "").trim();
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
    date: formatDate(components, calendar),
    seasonName: loc(components.season?.name ?? "")
  };
}

/**
 * The id of one of the four seasons the weather tables are written for. A calendar may name its seasons anything at
 * all, so an unknown season falls back to the one its position in the year lines up with.
 * @param {object} components  Components to look at.
 * @returns {"spring"|"summer"|"autumn"|"winter"}
 */
export function weatherSeasonOf(components) {
  const four = ["spring", "summer", "autumn", "winter"];
  const id = components.season?.id;
  if ( four.includes(id) ) return id;
  const count = components.seasonCount || 1;
  const index = Math.min(count - 1, Math.max(0, components.seasonIndex ?? 0));
  return four[Math.floor((index / count) * 4)] ?? "spring";
}

/**
 * The key a note is stored under.
 * @param {number} dayIndex  Absolute day index.
 * @returns {string}
 */
export function noteKey(dayIndex) {
  return `d${dayIndex}`;
}
