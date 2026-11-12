# Changelog

All notable changes to this module are documented here.

## 0.0.6

- **Hide the system's own clock.** A new per-client setting takes the clock a game system keeps at the top of the
  screen out of view — the D&D 5e calendar bar, for one — so this panel is the only one. Nothing is written to the
  system's settings; the bar is only hidden on your screen.
- The panel's starting position is measured from the controls down the left-hand side instead of being a fixed
  guess, so it no longer lands under them.

## 0.0.5

- **Every date in the calendar was wrong.** `CalendarData#componentsToTime` reads the day of the *year* and ignores
  `dayOfMonth`, which this module was passing. The month is now folded into the day count first, the way the D&D 5e
  system does it in `jumpToDate`. This fixes the month grid, travelling to a day, the season colouring, the notes
  and the moon phases — all of which hung off the wrong day.
- **The year is the year the world shows.** Confirmed against the system's own source: every formatted date is
  built from `components.year + calendar.years.yearZero`. A Harptos world set to 4883 no longer reads 3382. The
  guess-from-the-timestamp heuristic of 0.0.4 is gone — Foundry's `timestamp` formatter does not add `yearZero`,
  so it was the one string that could not answer the question.
- Festival days of a calendar that declares them (Midwinter, Greengrass, Shieldmeet and the rest on Harptos) are
  named on the panel and marked in the month grid.

## 0.0.4

- **The year is the year the world shows.** Foundry's components count years from the calendar's year zero, while
  the world names the year itself. The offset is now read back out of Foundry's own formatted timestamp, so the
  panel can no longer print a different year than the world does.
- **Clouds belong to the map.** The cloud shadows and the haze now carry the canvas transform: they pan and zoom
  with the terrain instead of sitting still in front of the screen. They are drawn at a quarter size and magnified,
  so the blur stays cheap on large maps.
- **Dungeon mode**: one button on the panel holds back the visible weather, stops the scene darkness from following
  the day and skips the weather roll at the start of a new day. The world keeps its weather for when the party comes
  back up.
- The panel rests at low opacity and comes back to full as soon as the mouse is over it. Can be switched off.
- The button reset no longer reaches the window frame, so the close and control icons look like Foundry's again.

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
