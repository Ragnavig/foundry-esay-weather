# Contributing

Bug reports and pull requests are welcome.

## Layout

| Path | Contents |
| --- | --- |
| `scripts/easy-weather.mjs` | entry point: settings, hooks, scene controls and the public API |
| `scripts/const.mjs` | module id, setting keys and the small shared helpers |
| `scripts/calendar.mjs` | the calendar: reads Foundry's own world calendar, or this module's, and derives date, season, daylight and moons from the world time |
| `scripts/presets.mjs` | the shipped calendars |
| `scripts/time.mjs` | moving the world clock, and spotting the start of a new day |
| `scripts/weather-data.mjs` | weather types, climates, season tables and intensities |
| `scripts/weather.mjs` | rolling and storing the weather |
| `scripts/effects.mjs` | everything you can see: particles, overlay, lightning, darkness |
| `scripts/cloud-shadows.mjs` | the cloud shadows drawn into Foundry's weather layer |
| `scripts/apps/` | the control panel, the calendar, the editor and the weather window |
| `templates/`, `styles/`, `lang/` | markup, stylesheet and translations |
| `test/` | two dependency-free Node scripts that check the calendar maths |

## Rules of thumb

- **World time is the single source of truth.** The date, the season, sunrise and the moons are all derived from
  `game.time.worldTime` and the calendar; nothing about the current moment is stored a second time.
- **Foundry's calendar comes first.** Unless the world opted out, every conversion between a date and a world time
  goes through `game.time.calendar`, so this module can never disagree with the date the world is set to. Only
  moons and daylight, which Foundry's calendar does not describe, belong to this module in that mode.
- **Nothing tiled over the canvas.** A repeating gradient reads as scan lines, not as weather. The overlay uses soft,
  blurred shapes only; particles are Foundry's job.
- **Only one client writes.** The weather roll and every write to a scene happen on the primary GM, so two GMs
  logged in never roll the same day twice.
- **Every visible layer can be silenced on its own.** A new effect belongs behind its own toggle in the weather
  window, not behind the master switch alone.
- **Never block on an effect.** Anything that draws is wrapped so a failure cannot break a render or a time step.
- Keep new strings in `lang/en.json` and `lang/de.json`; both files must hold the same keys.

## Checks

```bash
node test/own-calendar.test.mjs
node test/foundry-calendar.test.mjs
```

The stubs in `test/foundry-calendar.test.mjs` mirror behaviour measured against a running world, not what the API
documentation implies. See `test/README.md` before changing them.

## Releases

Pushing a tag of the form `v1.2.3` builds `module.zip`, stamps the version and the download URL into `module.json`
and publishes the GitHub release the manifest URL points at.
