/**
 * AI Concierge knowledge base.
 *
 * The current implementation is a deterministic keyword search across a
 * curated set of FAQ snippets. When you wire up a real LLM (Azure
 * OpenAI), swap `answerQuestion` for a retrieval call but keep the same
 * snippet shape so citations continue to work.
 */
export type FaqSnippet = {
  id: string;
  topic: string;
  body: string;
  keywords: string[];
};

export const FAQ: FaqSnippet[] = [
  {
    id: "tier-1a",
    topic: "Tier 1A — Self-service",
    body: "Tier 1A covers standard M365 use with no custom automation: Copilot, Excel formulas, Forms, SharePoint pages, Teams, OneNote, Whiteboard. No intake submission required. No review.",
    keywords: ["tier 1a", "self service", "copilot", "no review", "no automation"],
  },
  {
    id: "tier-1b",
    topic: "Tier 1B — M365 Automation",
    body: "Tier 1B is M365 automation using standard connectors only — Power Automate with M365 connectors, Excel macros writing to SharePoint, Copilot Studio (internal only), Office Scripts. Submit intake, build, then AI Team reviews before go-live.",
    keywords: ["tier 1b", "power automate", "standard connectors", "ai team review", "office scripts"],
  },
  {
    id: "tier-1c",
    topic: "Tier 1C — Advanced M365",
    body: "Tier 1C is advanced M365: Power Apps, premium connectors, Dataverse, Power Pages, AI Builder, SPFx, Copilot Studio with external skills, Power BI with external sources. Requires IT review (security + dev governance) BEFORE building. SLA: 3 business days.",
    keywords: ["tier 1c", "power apps", "premium connectors", "dataverse", "spfx", "power pages", "ai builder"],
  },
  {
    id: "tier-2",
    topic: "Tier 2 — External tools",
    body: "Tier 2 is anything outside the M365 tenant: Python scripts, n8n/Zapier, external LLM APIs, Nuclearn, third-party SaaS, custom web apps, browser automation, PowerShell, read-only ERP. IT review BEFORE building. SLA: 5 business days. Mandatory IT Governance & Security Assessment.",
    keywords: ["tier 2", "python", "external api", "openai", "anthropic", "n8n", "zapier", "selenium", "playwright", "powershell"],
  },
  {
    id: "tier-3",
    topic: "Tier 3 — Enterprise",
    body: "Tier 3 is mission-critical, multi-system, or restricted data: custom Azure deployments, ERP writes, HR system integrations, custom AI training, full custom web apps, 24/7 uptime tools, company-wide rollouts. IT review (security + dev gov + licensing) BEFORE building. SLA: 5 business days.",
    keywords: ["tier 3", "enterprise", "azure", "restricted data", "erp write", "hr", "company wide", "custom model"],
  },
  {
    id: "approvals-flow",
    topic: "Approval flow",
    body: "Submit intake → answer the wizard → tier is auto-assigned. For Tier 1A/1B you build immediately. For Tier 1C/2/3 the IT approval gate opens and the configured reviewer roles get an inbox entry. Decide approve / request changes / reject in-app — no email-only approvals.",
    keywords: ["approvals", "workflow", "approve", "reject", "changes requested", "inbox"],
  },
  {
    id: "roi-calculator",
    topic: "ROI calculator",
    body: "Inside each project, the ROI tab is the live calculator. Each step has a baseline hours / new hours / quality hours / frequency. Hourly rate is auto-resolved from the role catalog by review date — never typed in by hand. Save creates a versioned snapshot; the prior version is preserved.",
    keywords: ["roi", "calculator", "savings", "hours", "rate", "version", "snapshot"],
  },
  {
    id: "code-storage",
    topic: "Where to store solution code",
    body: "Use the Solution Storage tab on each project. Python / Excel macros / JavaScript / SPFx / browser automation / PowerShell go in a GitHub repo; link it. Low-code (Power Automate / Apps / Copilot / BI) live in the M365 portals; paste the URL.",
    keywords: ["github", "storage", "code", "repository", "low code"],
  },
  {
    id: "champion-offboarding",
    topic: "Champion offboarding",
    body: "When a champion leaves, admin reassigns their active projects to a new champion (or marks them Decommissioned). The artifacts and audit log remain intact — nothing is lost.",
    keywords: ["offboarding", "leaving", "transfer", "reassign", "decommission"],
  },
  {
    id: "data-classifications",
    topic: "Data classifications",
    body: "Public, Internal, Confidential, Restricted. The IT Governance & Security Assessment captures classification + data flow + LLM source. The platform itself should never hold higher than Internal — restricted data stays out and lives by reference.",
    keywords: ["pii", "restricted", "confidential", "data classification", "security"],
  },
];

export type ConciergeAnswer = {
  citations: FaqSnippet[];
  text: string;
};

export function answerQuestion(q: string): ConciergeAnswer {
  const norm = q.toLowerCase();
  const scored = FAQ.map((s) => {
    const score =
      s.keywords.reduce((acc, k) => (norm.includes(k) ? acc + 2 : acc), 0) +
      tokens(norm).filter((t) =>
        s.body.toLowerCase().includes(t) || s.topic.toLowerCase().includes(t),
      ).length;
    return { s, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scored.length === 0) {
    return {
      citations: [],
      text:
        "I couldn't find a direct match. Try asking about a tier, an approval step, the ROI calculator, where to store code, or data classifications.",
    };
  }

  const citations = scored.map((s) => s.s);
  const body = citations.map((c) => `• ${c.topic}: ${c.body}`).join("\n\n");
  return {
    citations,
    text: body,
  };
}

function tokens(s: string): string[] {
  return s
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3);
}
