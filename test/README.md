# Checks

Two plain Node scripts, no dependencies. They stub the handful of globals the calendar touches and then check the
maths the module cannot get wrong without the whole calendar being wrong.

```bash
node test/own-calendar.test.mjs
node test/foundry-calendar.test.mjs
```

`own-calendar.test.mjs` covers this module's own calendars: round trips over several centuries and negative world
times, month lengths, leap years, seasons, daylight and the moon cycle.

`foundry-calendar.test.mjs` covers the adapter for Foundry's world calendar. Its stub mirrors two things that were
**measured against a running Foundry 14 world**, both of which cost this module a release when they were assumed
instead:

- `componentsToTime` reads the day of the **year** and ignores `dayOfMonth`.
- the core `timestamp` formatter prints the **raw** year, without `yearZero`, while the year a world names is
  `components.year + yearZero`.

If either stub is ever changed to something more convenient, the tests stop being worth anything. Check against a
live world instead.
