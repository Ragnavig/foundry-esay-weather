# Changelog

All notable changes to this module are documented here.

## 0.0.3

- **The date now comes from Foundry's own world calendar.** Months, weekdays, seasons, leap years and the length of a
  day are read from `game.time.calendar`, and every conversion is handed to it, so the module shows the date the
  world is actually set to. A world can still switch to a calendar of its own in the editor or the settings.
- The canvas overlay no longer draws tiled rain, snow or wind patterns, which looked like scan lines over the map.
  It is now soft tint, drifting cloud shadows, haze and a vignette; precipitation comes from Foundry's particle
  layer, which does it properly.
- The overlay is mounted directly above the canvas, so it can never cover a window.
- Scene darkness following the time of day is on by default, and works on scenes that still use the old
  `darkness` field.
- Buttons in the weather and calendar windows no longer collapse or overlap: Foundry's fixed button height is
  undone where this module stacks an icon above a label.
- Weather tables work with any season names a calendar uses, not only the four shipped ones.

## 0.0.2

- Switching a weather layer off on your own screen and then back on in the weather window shows it again instead of
  leaving it hidden.

## 0.0.1 — first preview

- Floating control panel with date, clock and current weather; draggable, collapsible, and visible to players when
  the GM allows it.
- Time steps of 1 minute, 10 minutes, 1 hour, 8 hours and 1 day, forwards and backwards, plus jumps to sunrise,
  noon, sunset and midnight.
- World calendar with a month view, season colouring, moon phases and notes per day, and a full editor for months,
  weekdays, seasons, moons and the length of a day.
- Calendar presets: Earth (Gregorian), Harptos, Golarion and a plain 12 × 30 calendar.
- 15 weather types, rolled from the season and one of six climates, automatically at the start of a new day or on
  demand.
- Visible weather in three layers that can each be switched off at any time: Foundry's particle effects, a canvas
  overlay (tint, clouds, rain, snow, fog, heat shimmer) and lightning flashes.
- Optional scene darkness that follows the time of day and the cloud cover, and an optional chat announcement.
- English and German.
