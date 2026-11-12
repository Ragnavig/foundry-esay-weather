globalThis.Array.fromRange = n => Array.from({length: n}, (_, i) => i);
globalThis.foundry = { utils: { deepClone: v => structuredClone(v) } };
globalThis.game = { settings: { get: () => { throw new Error("none"); } }, i18n: { localize: k => k, format: (k, d) => `${k} ${JSON.stringify(d)}` } };

const C = await import("../scripts/calendar.mjs");
const { CALENDAR_PRESETS } = await import("../scripts/presets.mjs");

let fails = 0;
const check = (name, cond, extra) => { if (!cond) { fails++; console.log("FAIL", name, extra ?? ""); } };

for ( const cal of Object.values(CALENDAR_PRESETS) ) {
  const spd = C.secondsPerDay(cal);
  check(`${cal.id} spd`, spd === 86400, spd);

  // worldTime 0 is the first day of the start year
  const zero = C.componentsOf(0, cal);
  check(`${cal.id} zero`, zero.year === cal.startYear && zero.month === 0 && zero.day === 0 && zero.hour === 0, JSON.stringify(zero));

  // round trip over a wide range, including negative times
  for ( let i = 0; i < 4000; i++ ) {
    const t = Math.floor((Math.random() - 0.3) * 4000 * 86400) + Math.floor(Math.random() * 86400);
    const c = C.componentsOf(t, cal);
    const back = C.worldTimeFromDate(c, cal);
    const expected = t - (t % 1);
    check(`${cal.id} roundtrip`, back === Math.floor(t / 86400) * 86400 + c.secondOfDay, `${t} -> ${JSON.stringify(c)} -> ${back}`);
    check(`${cal.id} day bounds`, c.day >= 0 && c.day < C.daysInMonth(cal, c.year, c.month), JSON.stringify(c));
    check(`${cal.id} dayIndex`, C.dayIndexFromDate(c.year, c.month, c.day, cal) === c.dayIndex, JSON.stringify(c));
    if ( fails > 5 ) break;
  }
  if ( fails > 5 ) break;

  // leap years
  const g = CALENDAR_PRESETS.gregorian;
  check("leap 2024", C.isLeapYear(g, 2024) === true);
  check("leap 1900", C.isLeapYear(g, 1900) === false);
  check("leap 2000", C.isLeapYear(g, 2000) === true);
  check("leap 2023", C.isLeapYear(g, 2023) === false);
  check("days 2024", C.daysInYear(g, 2024) === 366, C.daysInYear(g, 2024));
  check("days 2023", C.daysInYear(g, 2023) === 365, C.daysInYear(g, 2023));
}

// seasons across a Gregorian year
const g = CALENDAR_PRESETS.gregorian;
check("season jan", C.seasonForDate(2024, 0, 4, g).id === "winter", C.seasonForDate(2024, 0, 4, g).id);
check("season apr", C.seasonForDate(2024, 3, 4, g).id === "spring", C.seasonForDate(2024, 3, 4, g).id);
check("season jul", C.seasonForDate(2024, 6, 4, g).id === "summer", C.seasonForDate(2024, 6, 4, g).id);
check("season oct", C.seasonForDate(2024, 9, 4, g).id === "autumn", C.seasonForDate(2024, 9, 4, g).id);
check("season dec25", C.seasonForDate(2024, 11, 24, g).id === "winter", C.seasonForDate(2024, 11, 24, g).id);

// daylight: longer in summer than in winter
const sum = C.daylightOf(C.componentsOf(C.worldTimeFromDate({year: 2024, month: 5, day: 20}, g), g), g);
const win = C.daylightOf(C.componentsOf(C.worldTimeFromDate({year: 2024, month: 11, day: 20}, g), g), g);
check("daylight", sum.daylight > win.daylight, `${sum.daylight} vs ${win.daylight}`);

// moons cycle through every phase
const phases = new Set(Array.from({length: 40}, (_, d) => C.moonPhases(d, g)[0].phase.id));
check("moon phases", phases.size === 8, [...phases].join(","));

console.log(fails === 0 ? "ALL CALENDAR TESTS PASSED" : `${fails} FAILURES`);
