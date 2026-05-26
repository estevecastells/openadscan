import { describe, expect, it } from "vitest";
import { toCsv } from "../../src/lib/csv";

describe("toCsv", () => {
  it("returns empty string on empty input", () => {
    expect(toCsv([])).toBe("");
  });
  it("uses keys of first row as default header", () => {
    expect(toCsv([{ a: 1, b: 2 }])).toBe("a,b\n1,2\n");
  });
  it("escapes commas and quotes", () => {
    const csv = toCsv([{ name: 'comma, "quoted"', n: 10 }]);
    expect(csv).toContain('"comma, ""quoted"""');
  });
  it("renders nulls and undefineds as empty", () => {
    expect(toCsv([{ a: null, b: undefined, c: 0 }])).toBe("a,b,c\n,,0\n");
  });
  it("respects custom column order", () => {
    expect(toCsv([{ a: 1, b: 2, c: 3 }], ["c", "a"])).toBe("c,a\n3,1\n");
  });
});
