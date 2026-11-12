# Easy Weather & Time

A small, modern control panel for Foundry VTT that keeps the three things a session actually needs in one place:
the **world clock**, the **world calendar**, and the **weather** — including the effects your players can see.

Built for **Foundry VTT v13 and v14**, system-agnostic.

![Foundry v14](https://img.shields.io/badge/Foundry-v13%20%7C%20v14-informational)
![License](https://img.shields.io/badge/license-MIT-green)

---

## What it does

### Time
- A floating panel with the date, the clock and the current weather, draggable and collapsible.
- One-click steps of **1 minute, 10 minutes, 1 hour, 8 hours and 1 day**. Press the ↺ button (or hold **Shift**)
  to move the same steps backwards.
- Jump straight to **sunrise, noon, sunset or midnight** — sunrise and sunset are derived from the calendar, so they
  move with the seasons.
- Everything runs on Foundry's own `game.time.worldTime`, so other modules keep working.

### Calendar
- **Uses Foundry's own world calendar** (`game.time.calendar`) by default, so the date shown is the date the world is
  set to — months, weekdays, seasons, leap years and the length of a day all come from there. A world that needs
  something it cannot express switches to this module's own calendar in one click.
- **Festival days** of calendars that declare them — Midwinter, Greengrass, Shieldmeet and the rest on Harptos —
  are named instead of numbered, and marked in the grid.
- A month at a glance, with the season colouring every day, the day's moon phase and a marker on days that carry a note.
- **Travel to this day** moves the world clock to the day you picked, keeping the time of day.
- **Notes per day** for festivals, deadlines and whatever the table needs to remember.
- A full **calendar editor** for worlds using their own calendar: months (with leap-year lengths), weekdays, seasons,
  moons, how many hours a day has and how long the days are in summer. Four presets are included — Earth, Harptos
  (Forgotten Realms), Golarion (Pathfinder) and a plain 12 × 30 calendar. While the world follows Foundry's calendar
  the editor only holds the two things Foundry does not describe: moons and daylight.

### Weather
- **15 weather types** from clear skies to thunderstorms, blizzards and sandstorms.
- Weather is rolled from the **season and the climate** (temperate, arid, tropical, arctic, coastal, mountains), and
  a roll leans towards yesterday's sky so the weather does not flip from sunshine to a blizzard overnight.
- **Rolls itself when a new day begins**, or on demand with one click.
- Every visible part can be switched off on its own, at any time: **particles, overlay, lightning, ambience** — or all
  of them at once.
- The scene's **darkness level follows the time of day** and the cloud cover — move the clock and the map gets
  brighter or darker with it. Can be switched off in the settings.
- Optional: a small **chat card** announces each change of weather.

### Dungeon mode
One button on the panel, for when the party goes underground: no visible weather, the scene darkness stops following
the day, and no weather is rolled at the start of a new day. The world keeps its weather, so stepping back outside
picks it up where it left off.

### What you see
- Foundry's own particle effects (rain, snow, fog, leaves …) on the current scene or on every scene.
- A canvas overlay this module draws on top. The **cloud shadows and the haze belong to the map**: they carry the
  canvas's own transform, so a cloud stays over the same hill while you pan and zoom. Tint, vignette and lightning
  stay in screen space. Only soft, blurred shapes — nothing tiled, so it never reads as a pattern over the map.
  Strength slider per client.
- Lightning flashes during a thunderstorm.

---

## Installation

In Foundry: **Add-on Modules → Install Module**, and paste this manifest URL:

```
https://github.com/Ragnavig/foundry-esay-weather/releases/latest/download/module.json
```

Or download `module.zip` from the [latest release](https://github.com/Ragnavig/foundry-esay-weather/releases/latest)
and unpack it into `Data/modules/easy-weather`.

---

## Using it

The panel appears for the GM as soon as the world is ready, and for players when
*Show the panel to players* is on (they see it, they cannot change it).

The calendar and the weather window are also in the scene controls, under the notes tools.

| I want to … | Do this |
| --- | --- |
| Move time forward | Click a step on the panel |
| Move time back | Click ↺ first, or hold **Shift** while clicking a step |
| Jump to the next morning | The sunrise button on the panel |
| Change the weather by hand | Panel → weather chip → pick a type |
| Turn the rain off, keep the day | Weather window → *Particles* / *Overlay* off |
| Turn everything off | Weather window → *Effects on/off* |
| Roll new weather now | The die button on the panel |
| Edit the calendar | Calendar → ✎ |
| Go underground | The dungeon button on the panel |

---

## Settings

**World** — calendar source (Foundry's or this module's own), climate, roll on a new day, announce in chat, where
particle effects are applied, scene darkness follows the day, dungeon mode, show the panel to players.

**Per client** — overlay on/off, overlay strength, lightning, ambience, fade the panel when the mouse is elsewhere,
hide the system's own clock, temperature unit (°C/°F), 12- or 24-hour clock.

If your system brings its own clock — the D&D 5e calendar bar at the top of the screen, for example — turn on
*Hide the system's own clock* and this panel takes over. The system's own setting is left untouched.

---

## For macros and other modules

```js
const ew = game.modules.get("easy-weather").api;

await ew.time.advance({ hours: 8 });            // move the clock
await ew.time.jumpTo("sunrise");                 // next sunrise
await ew.time.setDate({ year: 1495, month: 3, day: 0, hour: 6 });

ew.calendar.currentMoment();                     // date, clock, season, moons, daylight
await ew.weather.setWeather({ type: "storm", intensity: "heavy" });
await ew.weather.rollAndSetWeather();            // roll for the current day
await ew.weather.muteEffect("particles");        // toggle one layer

ew.openCalendar(); ew.openWeather(); ew.openEditor();
```

Hooks: `easyWeather.timeChanged`, `easyWeather.dayChanged`, `easyWeather.weatherChanged`,
`easyWeather.calendarChanged`.

An ambient loop can be attached to the current weather with
`ew.weather.setWeather({ sound: "sounds/rain.ogg" })`; no audio ships with the module.

---

## Ideas for later

Forecasts the party can be told, weather per region rather than per world, travel and rest helpers that advance time
by themselves, temperature effects handed to a system's rules, and a bridge for worlds that already keep their
calendar in another module.

---

## License

[MIT](LICENSE).
