import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDisplayTime,
  getCampusHourAndMinute,
  layoutDayEvents,
} from "./calendar.js";

const event = (start, end) => ({
  start_time: `2026-11-01T${start}:00+05:30`,
  end_time: `2026-11-01T${end}:00+05:30`,
});

test("midnight and noon use the correct display clock", () => {
  assert.equal(formatDisplayTime(0, 0), "12:00 AM");
  assert.equal(formatDisplayTime(12, 30), "12:30 PM");
  assert.equal(formatDisplayTime(24, 0), "12:00 AM");
  assert.deepEqual(getCampusHourAndMinute("2026-11-01T03:30:00Z"), {
    hour: 9,
    minute: 0,
  });
});

test("overlapping events stay in separate visual columns even when durations differ", () => {
  const placed = layoutDayEvents([
    event("08:00", "18:00"),
    event("08:00", "11:00"),
    event("09:00", "17:00"),
    event("12:00", "18:00"),
    event("13:00", "16:00"),
  ]);
  for (const a of placed)
    for (const b of placed) {
      if (a === b || a.sEpoch >= b.eEpoch || b.sEpoch >= a.eEpoch) continue;
      assert.ok(
        a.left + a.width <= b.left || b.left + b.width <= a.left,
        "Concurrent events must not cover each other",
      );
    }
});

test("non-overlapping events reuse the full calendar column", () => {
  const placed = layoutDayEvents([
    event("08:00", "09:00"),
    event("09:00", "10:00"),
  ]);
  assert.deepEqual(
    placed.map((e) => e.width),
    [100, 100],
  );
  assert.deepEqual(layoutDayEvents([]), []);
});

test("a booking ending at midnight has a one-hour height", () => {
  const [placed] = layoutDayEvents([
    {
      start_time: "2026-11-01T23:00:00+05:30",
      end_time: "2026-11-02T00:00:00+05:30",
    },
  ]);
  assert.equal(placed.top, 23 * 60);
  assert.equal(placed.height, 58);
});
