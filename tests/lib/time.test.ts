import { describe, expect, it } from "vitest";
import { addDays, dateRange, daysAgo, isoDate, parseIsoDate } from "../../src/lib/time";

describe("time helpers", () => {
  it("isoDate strips time", () => {
    expect(isoDate(new Date("2026-05-27T13:24:00Z"))).toBe("2026-05-27");
  });
  it("parseIsoDate returns UTC midnight", () => {
    const d = parseIsoDate("2026-05-27");
    expect(d.toISOString()).toBe("2026-05-27T00:00:00.000Z");
  });
  it("addDays handles negative and positive", () => {
    const d = parseIsoDate("2026-05-27");
    expect(isoDate(addDays(d, 1))).toBe("2026-05-28");
    expect(isoDate(addDays(d, -7))).toBe("2026-05-20");
  });
  it("dateRange is inclusive of both ends", () => {
    expect(dateRange("2026-05-27", "2026-05-29")).toEqual(["2026-05-27", "2026-05-28", "2026-05-29"]);
  });
  it("daysAgo subtracts days from base", () => {
    expect(daysAgo(2, new Date("2026-05-27T00:00:00Z"))).toBe("2026-05-25");
  });
});
