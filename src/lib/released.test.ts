import { describe, expect, it } from "vitest";
import { isReleased, todayIso } from "@/lib/released";

describe("isReleased", () => {
  it("is true for a film released before today", () => {
    expect(isReleased("1999-03-31", "2026-06-01")).toBe(true);
    expect(isReleased("2026-05-31", "2026-06-01")).toBe(true);
  });

  it("is true for a film released today", () => {
    expect(isReleased("2026-06-01", "2026-06-01")).toBe(true);
  });

  it("is false for a film that comes out after today, even by a day", () => {
    expect(isReleased("2026-06-02", "2026-06-01")).toBe(false);
    expect(isReleased("2029-12-18", "2026-06-01")).toBe(false);
  });

  it("compares across year and month boundaries by date, not by length", () => {
    expect(isReleased("2025-12-31", "2026-01-01")).toBe(true);
    expect(isReleased("2026-01-01", "2025-12-31")).toBe(false);
    expect(isReleased("2026-09-30", "2026-10-01")).toBe(true);
    expect(isReleased("2026-10-01", "2026-09-30")).toBe(false);
  });

  it("is false when the date is missing or not an ISO date", () => {
    expect(isReleased(null, "2026-06-01")).toBe(false);
    expect(isReleased(undefined, "2026-06-01")).toBe(false);
    expect(isReleased("", "2026-06-01")).toBe(false);
    expect(isReleased("2026", "2026-06-01")).toBe(false);
    expect(isReleased("2025-1-1", "2026-06-01")).toBe(false);
    expect(isReleased("June 2025", "2026-06-01")).toBe(false);
  });
});

describe("todayIso", () => {
  it("is the UTC date of the given moment", () => {
    expect(todayIso(new Date("2026-06-01T00:00:00Z"))).toBe("2026-06-01");
    expect(todayIso(new Date("2026-06-01T23:59:59.999Z"))).toBe("2026-06-01");
  });

  it("does not follow the local time zone", () => {
    // 23:30 on May 31 in New York (UTC-4) is already June 1 in UTC.
    expect(todayIso(new Date("2026-05-31T23:30:00-04:00"))).toBe("2026-06-01");
    // 00:30 on June 1 in Tokyo (UTC+9) is still May 31 in UTC.
    expect(todayIso(new Date("2026-06-01T00:30:00+09:00"))).toBe("2026-05-31");
  });

  it("defaults to now", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isReleased(todayIso(), todayIso())).toBe(true);
  });
});
