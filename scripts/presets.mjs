/**
 * Ready-made calendars. A preset is just a plain calendar object, so anything in here can be edited in the
 * calendar editor afterwards and stored as the world's own calendar.
 */

/* -------------------------------------------- */

const WEEK_EARTH = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Build the four temperate seasons from their start dates.
 * @param {[number, number][]} starts  `[monthIndex, dayIndex]` for spring, summer, autumn and winter.
 * @returns {object[]}
 */
function temperateSeasons(starts) {
  const meta = [
    { id: "spring", name: "EASYWEATHER.Season.Spring", icon: "fa-seedling", color: "#7bc96f" },
    { id: "summer", name: "EASYWEATHER.Season.Summer", icon: "fa-sun", color: "#f2b134" },
    { id: "autumn", name: "EASYWEATHER.Season.Autumn", icon: "fa-leaf", color: "#d4722c" },
    { id: "winter", name: "EASYWEATHER.Season.Winter", icon: "fa-snowflake", color: "#78b7e0" }
  ];
  return meta.map((season, index) => ({ ...season, month: starts[index][0], day: starts[index][1] }));
}

/* -------------------------------------------- */

/**
 * Every calendar shipped with the module, keyed by id.
 * @type {Record<string, object>}
 */
export const CALENDAR_PRESETS = {
  gregorian: {
    id: "gregorian",
    name: "EASYWEATHER.Preset.Gregorian",
    time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
    months: [
      { name: "January", abbr: "Jan", days: 31 }, { name: "February", abbr: "Feb", days: 28, leapDays: 29 },
      { name: "March", abbr: "Mar", days: 31 }, { name: "April", abbr: "Apr", days: 30 },
      { name: "May", abbr: "May", days: 31 }, { name: "June", abbr: "Jun", days: 30 },
      { name: "July", abbr: "Jul", days: 31 }, { name: "August", abbr: "Aug", days: 31 },
      { name: "September", abbr: "Sep", days: 30 }, { name: "October", abbr: "Oct", days: 31 },
      { name: "November", abbr: "Nov", days: 30 }, { name: "December", abbr: "Dec", days: 31 }
    ],
    weekdays: WEEK_EARTH.map(name => ({ name, abbr: name.slice(0, 2) })),
    leap: { interval: 4, skip: 100, skipException: 400 },
    startYear: 2024,
    firstWeekday: 0,
    seasons: temperateSeasons([[2, 19], [5, 20], [8, 21], [11, 20]]),
    moons: [{ name: "Luna", cycle: 29.53059, offset: 0, color: "#e8e6df" }],
    daylight: { base: 12, variation: 4 }
  },

  harptos: {
    id: "harptos",
    name: "EASYWEATHER.Preset.Harptos",
    time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
    months: [
      { name: "Hammer", abbr: "Ham", days: 30 }, { name: "Midwinter", abbr: "Mid", days: 1 },
      { name: "Alturiak", abbr: "Alt", days: 30 }, { name: "Ches", abbr: "Che", days: 30 },
      { name: "Tarsakh", abbr: "Tar", days: 30 }, { name: "Greengrass", abbr: "Gre", days: 1 },
      { name: "Mirtul", abbr: "Mir", days: 30 }, { name: "Kythorn", abbr: "Kyt", days: 30 },
      { name: "Flamerule", abbr: "Fla", days: 30 }, { name: "Midsummer", abbr: "Mis", days: 1, leapDays: 2 },
      { name: "Eleasis", abbr: "Ele", days: 30 }, { name: "Eleint", abbr: "Elt", days: 30 },
      { name: "Highharvestide", abbr: "Hig", days: 1 }, { name: "Marpenoth", abbr: "Mar", days: 30 },
      { name: "Uktar", abbr: "Ukt", days: 30 }, { name: "Feast of the Moon", abbr: "Fea", days: 1 },
      { name: "Nightal", abbr: "Nig", days: 30 }
    ],
    weekdays: Array.fromRange(10).map(index => ({ name: `First-day ${index + 1}`, abbr: `${index + 1}` })),
    leap: { interval: 4 },
    startYear: 1495,
    firstWeekday: 0,
    seasons: temperateSeasons([[3, 0], [7, 0], [11, 0], [15, 0]]),
    moons: [{ name: "Selûne", cycle: 30.4, offset: 0, color: "#dfe7f2" }],
    daylight: { base: 12, variation: 4 }
  },

  golarion: {
    id: "golarion",
    name: "EASYWEATHER.Preset.Golarion",
    time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
    months: [
      { name: "Abadius", abbr: "Aba", days: 31 }, { name: "Calistril", abbr: "Cal", days: 28, leapDays: 29 },
      { name: "Pharast", abbr: "Pha", days: 31 }, { name: "Gozran", abbr: "Goz", days: 30 },
      { name: "Desnus", abbr: "Des", days: 31 }, { name: "Sarenith", abbr: "Sar", days: 30 },
      { name: "Erastus", abbr: "Era", days: 31 }, { name: "Arodus", abbr: "Aro", days: 31 },
      { name: "Rova", abbr: "Rov", days: 30 }, { name: "Lamashan", abbr: "Lam", days: 31 },
      { name: "Neth", abbr: "Net", days: 30 }, { name: "Kuthona", abbr: "Kut", days: 31 }
    ],
    weekdays: ["Moonday", "Toilday", "Wealday", "Oathday", "Fireday", "Starday", "Sunday"]
      .map(name => ({ name, abbr: name.slice(0, 2) })),
    leap: { interval: 8 },
    startYear: 4724,
    firstWeekday: 0,
    seasons: temperateSeasons([[2, 20], [5, 20], [8, 21], [11, 20]]),
    moons: [{ name: "Somal", cycle: 29.5, offset: 0, color: "#e8e6df" }],
    daylight: { base: 12, variation: 4 }
  },

  simple: {
    id: "simple",
    name: "EASYWEATHER.Preset.Simple",
    time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
    months: Array.fromRange(12).map(index => ({ name: `Month ${index + 1}`, abbr: `M${index + 1}`, days: 30 })),
    weekdays: Array.fromRange(6).map(index => ({ name: `Day ${index + 1}`, abbr: `D${index + 1}` })),
    leap: { interval: 0 },
    startYear: 1,
    firstWeekday: 0,
    seasons: temperateSeasons([[2, 0], [5, 0], [8, 0], [11, 0]]),
    moons: [{ name: "Moon", cycle: 30, offset: 0, color: "#e8e6df" }],
    daylight: { base: 12, variation: 3 }
  }
};

/**
 * A deep copy of a preset, ready to be stored as the world calendar.
 * @param {string} id  Preset id.
 * @returns {object}
 */
export function clonePreset(id) {
  const preset = CALENDAR_PRESETS[id] ?? CALENDAR_PRESETS.gregorian;
  return foundry.utils.deepClone(preset);
}
