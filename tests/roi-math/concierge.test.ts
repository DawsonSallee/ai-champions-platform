import { describe, expect, it } from "vitest";
import { answerQuestion } from "../../apps/web/src/domains/concierge/faq";

describe("concierge keyword search", () => {
  it("finds the right tier for a Python-related question", () => {
    const a = answerQuestion("Can I write a Python script that calls an external API?");
    expect(a.citations.map((c) => c.id)).toContain("tier-2");
  });

  it("matches Power Apps to Tier 1C", () => {
    const a = answerQuestion("We want to build a Power App for the team.");
    expect(a.citations.map((c) => c.id)).toContain("tier-1c");
  });

  it("ROI calculator question lands on the ROI snippet", () => {
    const a = answerQuestion("How does the ROI calculator handle savings hours?");
    expect(a.citations.map((c) => c.id)).toContain("roi-calculator");
  });

  it("returns a guidance message when no snippet matches", () => {
    const a = answerQuestion("zzqq pancake telescope");
    expect(a.citations).toHaveLength(0);
    expect(a.text).toMatch(/tier|approval|ROI/i);
  });
});
