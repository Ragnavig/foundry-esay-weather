# Contributing

Bug reports and pull requests are welcome.

## Layout

| Path | Contents |
| --- | --- |
| `scripts/easy-weather.mjs` | entry point: settings, hooks, scene controls and the public API |
| `scripts/const.mjs` | module id, setting keys and the small shared helpers |
| `scripts/calendar.mjs` | all calendar maths — world time in, date, season, daylight and moons out |
| `scripts/presets.mjs` | the shipped calendars |
| `scripts/time.mjs` | moving the world clock, and spotting the start of a new day |
| `scripts/weather-data.mjs` | weather types, climates, season tables and intensities |
| `scripts/weather.mjs` | rolling and storing the weather |
| `scripts/effects.mjs` | everything you can see: particles, overlay, lightning, darkness |
| `scripts/apps/` | the control panel, the calendar, the editor and the weather window |
| `templates/`, `styles/`, `lang/` | markup, stylesheet and translations |

## Rules of thumb

- **World time is the single source of truth.** The date, the season, sunrise and the moons are all derived from
  `game.time.worldTime` and the calendar; nothing about the current moment is stored a second time.
- **Only one client writes.** The weather roll and every write to a scene happen on the primary GM, so two GMs
  logged in never roll the same day twice.
- **Every visible layer can be silenced on its own.** A new effect belongs behind its own toggle in the weather
  window, not behind the master switch alone.
- **Never block on an effect.** Anything that draws is wrapped so a failure cannot break a render or a time step.
- Keep new strings in `lang/en.json` and `lang/de.json`; both files must hold the same keys.

## Releases

Pushing a tag of the form `v1.2.3` builds `module.zip`, stamps the version and the download URL into `module.json`
and publishes the GitHub release the manifest URL points at.
