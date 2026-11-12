globalThis.Array.fromRange = n => Array.from({length: n}, (_, i) => i);
globalThis.foundry = { utils: { deepClone: v => structuredClone(v) } };

// A stand-in for Foundry's own Gregorian world calendar, with year zero at 0 and world time 0 = 0001-01-01 00:00.
const YEAR_ZERO = 1501;
const MONTHS = [31,28,31,30,31,30,31,31,30,31,30,31];
const leap = y => (y % 4 === 0) && ((y % 100 !== 0) || (y % 400 === 0));
const mlen = (y, m) => (m === 1 && leap(y)) ? 29 : MONTHS[m];
const daysInYear = y => leap(y) ? 366 : 365;

const fakeCalendar = {
  isLeapYear: leap,
  timeToComponents(time = 0) {
    const SPD = 86400;
    let dayIndex = Math.floor(time / SPD);
    let rest = time - dayIndex * SPD;
    let year = 0;
    while (dayIndex < 0) { year -= 1; dayIndex += daysInYear(year); }
    while (dayIndex >= daysInYear(year)) { dayIndex -= daysInYear(year); year += 1; }
    const day = dayIndex;
    let month = 0;
    while (dayIndex >= mlen(year, month)) { dayIndex -= mlen(year, month); month += 1; }
    const abs = Math.floor(time / SPD);
    return {
      year, day, month, dayOfMonth: dayIndex,
      dayOfWeek: ((abs % 7) + 7) % 7,
      hour: Math.floor(rest / 3600), minute: Math.floor(rest / 60) % 60, second: Math.floor(rest) % 60,
      season: Math.floor((day / daysInYear(year)) * 4) % 4,
      leapYear: leap(year)
    };
  },
  componentsToTime(c) {
    // Measured against a live Foundry 14 world: the day of the YEAR is read, `dayOfMonth` is ignored.
    if (c.dayOfMonth !== undefined && c.day === undefined) throw new Error("dayOfMonth is not read by Foundry");
    let days = 0;
    const y = c.year ?? 0;
    if (y >= 0) for (let i = 0; i < y; i++) days += daysInYear(i);
    else for (let i = y; i < 0; i++) days -= daysInYear(i);
    days += c.day ?? 0;
    return days * 86400 + (c.hour ?? 0) * 3600 + (c.minute ?? 0) * 60 + (c.second ?? 0);
  },
  format(time) {
    // Foundry's own "timestamp" formatter prints the RAW year, without yearZero. Measured live on Foundry 14.
    const c = this.timeToComponents(time);
    return `${c.year}-${c.month + 1}-${c.dayOfMonth + 1} ${c.hour}:${c.minute}`;
  },
  toObject() {
    return {
      name: "Gregorian",
      years: { yearZero: YEAR_ZERO, firstWeekday: 0, leapYear: { leapStart: 8, leapInterval: 4 } },
      months: { values: MONTHS.map((d, i) => ({ name: `M${i + 1}`, abbreviation: `M${i + 1}`, ordinal: i + 1, days: d, leapDays: i === 1 ? 29 : undefined })) },
      days: { values: ["Mo","Tu","We","Th","Fr","Sa","Su"].map((n, i) => ({ name: n, abbreviation: n, ordinal: i + 1 })), daysPerYear: 365, hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
      seasons: { values: [{ name: "Spring" }, { name: "Summer" }, { name: "Autumn" }, { name: "Winter" }] }
    };
  }
};

const settings = { calendarSource: "foundry", calendar: null, timeFormat: "24" };
globalThis.game = {
  settings: { get: (m, k) => { if (!(k in settings)) throw new Error("none"); return settings[k]; } },
  i18n: { localize: k => k, format: (k, d) => `${d.weekday}, ${d.day}. ${d.month} ${d.year}` },
  time: { calendar: fakeCalendar, worldTime: 0 }
};

const C = await import("../scripts/calendar.mjs");
let fails = 0;
const check = (n, c, e) => { if (!c) { fails++; console.log("FAIL", n, e ?? ""); } };

const cal = C.activeCalendar();
check("source", cal.source === "foundry", cal.source);
check("months", cal.months.length === 12 && cal.months[1].leapDays === 29);
check("weekdays", cal.weekdays.length === 7);
check("seasons", cal.seasons.length === 4 && cal.seasons[0].id === "spring", JSON.stringify(cal.seasons.map(s => s.id)));
check("moons kept", cal.moons.length === 1, JSON.stringify(cal.moons));
check("hoursPerDay", cal.time.hoursPerDay === 24);

// Our components must equal Foundry's, and every conversion must round trip.
for (let i = 0; i < 3000; i++) {
  const t = Math.floor((Math.random() - 0.25) * 3000 * 86400) + Math.floor(Math.random() * 86400);
  const ours = C.componentsOf(t, cal);
  const theirs = fakeCalendar.timeToComponents(t);
  check("year", ours.year === theirs.year + YEAR_ZERO, `${t}: ${ours.year} vs ${theirs.year + YEAR_ZERO}`);
  check("month", ours.month === theirs.month, `${t}: ${ours.month} vs ${theirs.month}`);
  check("day", ours.day === theirs.dayOfMonth, `${t}: ${ours.day} vs ${theirs.dayOfMonth}`);
  check("hour", ours.hour === theirs.hour, `${t}`);
  check("weekday", ours.weekdayIndex === theirs.dayOfWeek, `${t}`);
  check("roundtrip", C.worldTimeFromDate(ours, cal) === Math.floor(t / 86400) * 86400 + ours.secondOfDay, `${t}`);
  check("dayIndexFromDate", C.dayIndexFromDate(ours.year, ours.month, ours.day, cal) === ours.dayIndex, `${t}`);
  check("daysInMonth", ours.day < C.daysInMonth(cal, ours.year, ours.month), `${t}`);
  if (fails > 4) break;
}

check("yearOffset", cal.yearOffset === YEAR_ZERO, cal.yearOffset);
check("leap via fc", C.isLeapYear(cal, 2024 + YEAR_ZERO) && !C.isLeapYear(cal, 1900 + YEAR_ZERO) && C.isLeapYear(cal, 2000 + YEAR_ZERO));
{
  // The module names the year the world names, which is the raw year plus yearZero — deliberately NOT what the
  // core "timestamp" formatter prints, since that one skips yearZero.
  const t = 123456789;
  const raw = fakeCalendar.timeToComponents(t).year;
  check("adds yearZero", C.componentsOf(t, cal).year === raw + YEAR_ZERO, `${C.componentsOf(t, cal).year} vs ${raw + YEAR_ZERO}`);
  check("timestamp stays raw", fakeCalendar.format(t).startsWith(String(raw)), fakeCalendar.format(t));
}
const season = C.seasonForDate(2024 + YEAR_ZERO, 6, 10, cal);
check("seasonForDate", ["spring","summer","autumn","winter"].includes(season.id), season.id);
const moment = C.currentMoment(C.worldTimeFromDate({ year: 2024 + YEAR_ZERO, month: 9, day: 11, hour: 18, minute: 42 }, cal));
check("date line", moment.date.includes(String(2024 + YEAR_ZERO)) && moment.date.includes("12"), moment.date);
check("weatherSeason", ["spring","summer","autumn","winter"].includes(C.weatherSeasonOf(moment.components)), C.weatherSeasonOf(moment.components));
console.log("foundry-mode date:", moment.date, moment.clock.time, "| season", moment.seasonName);

// Switching to the module's own calendar must still work.
settings.calendarSource = "custom";
C.resetCalendarCache();
const own = C.activeCalendar();
check("custom source", own.source === "custom", own.source);
check("custom zero", C.componentsOf(0, own).year === own.startYear);

console.log(fails === 0 ? "ALL FOUNDRY-CALENDAR TESTS PASSED" : `${fails} FAILURES`);
