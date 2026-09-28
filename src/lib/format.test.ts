import { describe, expect, it } from "vitest";
import { fmtHours, localInputToUtc, utcToLocalInput, zonedMidnightUtc } from "./format";

describe("time zones (stored UTC, displayed local, DST-safe)", () => {
  it("Riga summer (UTC+3) and winter (UTC+2)", () => {
    expect(localInputToUtc("2026-07-01T07:00", "Europe/Riga")).toBe("2026-07-01T04:00:00.000Z");
    expect(localInputToUtc("2026-01-15T07:00", "Europe/Riga")).toBe("2026-01-15T05:00:00.000Z");
  });
  it("Stockholm and Reykjavik", () => {
    expect(localInputToUtc("2026-07-01T07:00", "Europe/Stockholm")).toBe("2026-07-01T05:00:00.000Z");
    expect(localInputToUtc("2026-07-01T07:00", "Atlantic/Reykjavik")).toBe("2026-07-01T07:00:00.000Z");
  });
  it("DST switch day in Riga (2026-10-25)", () => {
    expect(zonedMidnightUtc("2026-10-25", "Europe/Riga").toISOString()).toBe("2026-10-24T21:00:00.000Z");
    expect(zonedMidnightUtc("2026-10-26", "Europe/Riga").toISOString()).toBe("2026-10-25T22:00:00.000Z");
  });
  it("round-trips for datetime-local inputs", () => {
    const iso = localInputToUtc("2026-03-29T12:30", "Europe/Riga");
    expect(utcToLocalInput(iso, "Europe/Riga")).toBe("2026-03-29T12:30");
  });
});

describe("fmtHours", () => {
  it("formats decimal hours", () => {
    expect(fmtHours(9.25)).toBe("9h 15m");
    expect(fmtHours(0)).toBe("0h 00m");
    expect(fmtHours(null)).toBe("—");
  });
});
