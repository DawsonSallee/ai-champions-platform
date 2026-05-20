import { describe, expect, it } from "vitest";
import { addBusinessDays } from "../../apps/web/src/lib/dates";

describe("addBusinessDays", () => {
  it("skips weekends — Friday + 1 = Monday", () => {
    const friday = new Date(Date.UTC(2026, 4, 22)); // Fri 2026-05-22
    const result = addBusinessDays(friday, 1);
    // Monday May 25
    expect(result.toISOString().slice(0, 10)).toBe("2026-05-25");
  });

  it("five business days from a Monday lands on the next Monday", () => {
    const monday = new Date(Date.UTC(2026, 4, 18)); // Mon 2026-05-18
    expect(addBusinessDays(monday, 5).toISOString().slice(0, 10)).toBe(
      "2026-05-25",
    );
  });

  it("0 days is a no-op", () => {
    const d = new Date(Date.UTC(2026, 0, 5));
    expect(addBusinessDays(d, 0).toISOString()).toBe(d.toISOString());
  });
});
