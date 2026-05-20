---
title: "AI Champions Platform — IT Proposal"
author: "Dawson Sallee · AI Champions Program"
date: "May 2026"
---

# AI Champions Platform — IT Proposal

> **TL;DR.** A working web application that replaces the SharePoint list + Excel ROI calculators + Power BI dashboard + manual Freshservice routing currently used to run the AI Champions Program. Deployed and live on Azure today (on a personal subscription, for demo only). We're asking IT to (1) approve a move to a corporate Azure subscription, (2) approve a corresponding Microsoft Entra app registration in the Enercon tenant, and (3) sign off on the network posture for the production rollout. Steady-state operating cost is **~$25–60/month** at our scale, scaling linearly with usage.

---

## 1. Live demo

**https://aichamp-dev-app.orangeglacier-5bb9312f.eastus2.azurecontainerapps.io**

- Open from any work machine — standard HTTPS on `*.azurecontainerapps.io`, no VPN or proxy adjustments required.
- Demo is populated with 18 fake projects across all 5 governance tiers.
- Source code: <https://github.com/DawsonSallee/ai-champions-platform>
- Architecture diagrams (sharper than what's in this doc): [`docs/architecture.svg`](./architecture.svg) (overview) and [`docs/architecture-technical.svg`](./architecture-technical.svg) (detailed).

---

## 2. What it replaces

| Today | Tomorrow |
| :--- | :--- |
| SharePoint Project Backlog list (manual columns, fragile schema) | Postgres-backed backlog, full audit trail, CSV/XLSX export |
| Per-project Excel ROI Calculator (file-based, "duplicate the tab" rule) | In-app ROI calculator with sequential time-bounded versions and review-date notifications |
| Power BI Realized Value Dashboard (frequent broken refreshes, manual "SharePoint Handshake") | Server-computed dashboards (same math, no manual paste step) |
| IT Governance & Security Assessment as a .docx form | Structured form, server-validated, audit-logged |
| Freshservice ticket routing done by hand for Tier 1C/2/3 reviews | Approval engine that auto-routes to Security / Dev Governance / Licensing / AI Team based on a tier-review matrix |
| Solution Showcase docx + manual SharePoint "App Store" gallery | Auto-published gallery the moment a project's status is set to Completed; PDF showcase generator from live data |

The new system implements the **existing AI Champions Governance Framework** (Tiers 1A → 3, IT Approval gate, AI Team Review gate, RACI, code escrow policy) without changing the program's rules.

---

## 3. Architecture (one paragraph)

A Next.js web app runs as a single Azure Container App, talking to a Postgres Flexible Server, Blob Storage, and Key Vault — all in one resource group. Microsoft Entra ID handles sign-in. GitHub Actions builds the container image, pushes to GitHub Container Registry, and deploys via Bicep (infra-as-code) using OIDC federation — there are no long-lived Azure secrets stored in GitHub. App telemetry flows into a single Log Analytics workspace via Application Insights.

See `docs/architecture-technical.svg` for the technical-review version.

---

## 4. Azure resources we're proposing

All resources live in **one resource group** (`ai-champions-rg`) so IT can apply tags, policies, RBAC, and budgets uniformly. Recommended region pair: **East US 2** (compute) + **Central US** (Postgres — the only region in our subscription where Postgres Flexible Server is currently allowed; see §11).

| # | Resource type | Purpose | SKU |
| :- | :--- | :--- | :--- |
| 1 | Azure Container Apps Environment | Hosts the web app (serverless, consumption-based) | Consumption profile |
| 2 | Container App (`aichamp-dev-app`) | The Next.js application | 0.5 vCPU, 1 GiB, scale 1–3 replicas |
| 3 | Postgres Flexible Server | Application database | B1ms (1 vCPU, 2 GiB), 32 GiB storage, Postgres 16 |
| 4 | Storage Account (Blob) | Project artifacts (PDDs, TSS, UAT logs, Showcase PDFs) | Standard LRS, container `artifacts` |
| 5 | Key Vault | Secrets (DB password, AUTH_SECRET, Entra client secret) | Standard, RBAC-auth, 7-day soft-delete |
| 6 | Log Analytics workspace | Logs + queries | PerGB2018, 30-day retention |
| 7 | Application Insights | Request traces, errors, metrics | Workspace-backed |
| 8 | Microsoft Entra app registration | SSO for users + federated credential for CI | Sign-in audience: AzureADMyOrg (Enercon tenant only) |

The exact configuration is captured in `infra/main.bicep` (Bicep / ARM source-of-truth) and is fully recreatable from `git clone` + `az deployment group create`.

**No PaaS services we're not already using elsewhere.** Container Apps, Postgres Flexible, Blob, Key Vault, Log Analytics, App Insights are all standard Microsoft-managed services covered by existing Microsoft enterprise support.

---

## 5. Identity & access

- **Sign-in:** Microsoft Entra ID via the standard OAuth 2.0 / OIDC code-grant flow. We use [NextAuth.js](https://next-auth.js.org/) as the client library; it's the de-facto standard for Next.js apps.
- **App roles** (assigned in Entra): `Champion`, `AITeam`, `ITSecurity`, `DevGovernance`, `Licensing`, `ITSupport`, `Admin`. Mirrors the existing Governance Framework RACI matrix (Appendix A).
- **Reviewer-role mapping:** which individuals fill `Security review`, `Development governance`, `Licensing review`, `AI team review` is configured in the platform's admin UI by an `Admin` user, not in code. Changing a reviewer = a couple of clicks, no deployment.
- **CI ↔ Azure:** OIDC federated credential (no client secret in GitHub). The credential is restricted to the exact GitHub branch (`repo:DawsonSallee/ai-champions-platform:ref:refs/heads/main`).

---

## 6. Data & security

| Concern | Position |
| :--- | :--- |
| Data classification | Internal (per the Governance Framework's data classification). The platform itself is designed to **never** hold higher-than-Internal data; restricted/PII content is stored by reference (file link, ID) only. |
| Encryption in transit | TLS 1.2+ everywhere (HTTPS ingress, `sslmode=require` on Postgres, HTTPS on Blob and Key Vault) |
| Encryption at rest | Azure-default Microsoft-managed keys for Postgres, Blob, and Key Vault |
| Secrets storage | Key Vault for non-Entra-issued secrets; `secretRef` in Container Apps for runtime resolution |
| Audit trail | Append-only `audit_events` table records every mutation, with actor + before/after JSON. Visible at `/admin/audit` |
| Soft delete | Projects, artifacts, and ROI versions are soft-deleted (`deleted_at`); restorable from `/admin/trash` |
| Backups | Postgres point-in-time-restore enabled, 14-day retention. Blob soft-delete 30 days |
| External dependencies | None at runtime (no third-party SaaS calls). The platform pulls its container image from GitHub Container Registry (public package, Microsoft-friendly registry). |

---

## 7. Network posture

**Current (demo) posture — dev-grade:**

- Public ingress on the Container App (Entra sign-in required, but anyone on the internet can reach the URL).
- Postgres firewall open to `0.0.0.0/0` (still requires DB credentials + TLS).
- No private endpoints, no VNet.

This is intentional for the demo and **must be hardened before real rollout**. The Bicep template has a second posture (`networkPosture=private`) that:

- Disables public Container App ingress.
- Puts Postgres / Blob / Key Vault behind private endpoints in a VNet.
- Restricts access to corporate VPN ingress only (matches our existing internal-site pattern).

**Proposed production posture:** `private`. Estimated incremental cost in §8.

---

## 8. Cost

Pay-as-you-go, no upfront commitment. Numbers are monthly USD.

### Demo (current)

| Item | Monthly |
| :--- | ---: |
| Container App (1 replica × 0.5 vCPU, always on) | **~$39** |
| Postgres B1ms + 32 GiB storage | **~$17** |
| Blob, Key Vault, Log Analytics, App Insights | **~$2** |
| GitHub Container Registry, GitHub Actions, Bicep | $0 (free tiers) |
| **Total demo** | **~$58/mo** |

### Light production (recommended starting point)

| Item | Monthly |
| :--- | ---: |
| Container App with **scale-to-zero** (cold start ~10s after idle) | **~$5** |
| Postgres B2s upsize for headroom | **~$30** |
| Storage growth, App Insights ingestion at expected volume | **~$10** |
| **Total light prod** | **~$45/mo** |

### Hardened production (when ready)

| Item | Monthly |
| :--- | ---: |
| Container App, 2-replica baseline during business hours | **~$60** |
| Postgres with zone-redundant HA | **~$60** |
| Private endpoints (5 endpoints) | **~$40** |
| Log retention bump, second environment (staging) | **~$50** |
| **Total hardened prod** | **~$210/mo** |

For comparison: the historical cost of running the program on SharePoint + Excel + Power BI + manual routing is **not zero** — it's hidden in the time the AI Team spends on routing, manual handshakes, and broken Power BI refreshes. The platform is roughly break-even at **8 active champions saving 1 hour/week each**.

---

## 9. CI/CD & operations

- **Source:** <https://github.com/DawsonSallee/ai-champions-platform> (public repository, no Enercon source in it).
- **Deploy trigger:** push to `main` → GitHub Actions builds the Docker image, pushes to `ghcr.io`, authenticates to Azure via OIDC, runs the Bicep template (incremental), runs DB migrations + reference-data bootstrap, then Container Apps swaps revisions with zero downtime.
- **Rollback:** `az containerapp revision activate` flips traffic back to a prior revision in seconds; no rebuild required.
- **Observability:** all container logs and Next.js telemetry flow into one Log Analytics workspace; queryable in the Azure portal under "Logs" on the resource group.
- **On-call:** the AI Team (Dawson, Melissa) is first contact. Anything that escalates to "service down" or "data issue" goes to IT support via Freshservice, who can grant emergency access via Azure RBAC.
- **Disaster recovery:** Postgres PITR + nightly logical dump to Blob (Phase 7 add). Recreating the entire environment from scratch takes ~10 minutes (`az deployment group create`).

---

## 10. Open items needing IT decisions

| # | Decision | Why it matters |
| :- | :--- | :--- |
| **A** | Approve creation of a corporate Azure subscription (or assignment to an existing one) for the production deployment | Today's demo lives on a personal subscription paid for personally. We need an Enercon-owned subscription before any real data goes in. |
| **B** | Approve a new Entra app registration in the Enercon tenant for SSO | Today's app is registered in a personal tenant; Enercon work accounts cannot sign in. Required for real users. |
| **C** | Approve `networkPosture=private` deployment (VPN-only) | Matches the existing internal-site pattern. Incremental cost ~+$40/mo (see §8). |
| **D** | Confirm Champions Microsoft 365 Group should be linked from `/admin` | Already wired — just needs the group URL pasted into a settings env var. |
| **E** | Approve `aichamp-prod` or similar naming convention for production resources | We currently use `aichamp-dev-*`. |
| **F** | Approve the IT Governance & Security Assessment for the platform itself | The platform stores ROI data; per the framework, it warrants its own assessment. We'll fill it out — request a reviewer. |

---

## 11. Risks & honest caveats

- **Postgres region restriction.** Our current subscription is restricted from provisioning Postgres Flexible Server in `eastus` and `eastus2` — the deployed instance is in `centralus`. Cross-region latency adds ~10–20 ms per query, immaterial at this scale. On a corporate subscription with broader regional offer access this restriction goes away.
- **GitHub Container Registry.** The container image is pushed to a **public** package on `ghcr.io` so Container Apps can pull anonymously. The image contains no secrets and no proprietary code (the repo is public). If IT objects to public registry use, we can switch to an Azure Container Registry (Basic, ~$5/mo) and use managed-identity pull instead — small Bicep change.
- **No background jobs scheduled.** The Weekly Champion Nudge and SLA-breach checker scripts exist in the repo but aren't yet scheduled in Azure. They're a couple of `Microsoft.App/jobs` resources away.
- **One environment.** We have a single dev/demo environment. For real rollout we'd want staging + prod (parameter flip in Bicep; no new code).

---

## 12. Concrete asks

1. **Sponsor a corporate Azure subscription** (or point us at an existing one) — Decision A above.
2. **Stand up the Entra app registration in the Enercon tenant** with the redirect URI we provide post-deploy — Decision B.
3. **Sign off on the network posture** for the production deployment — Decision C.
4. **Assign an IT Security reviewer** to formally close out the platform-level IT Governance & Security Assessment — Decision F.
5. **Add the AI Champions Microsoft 365 Group URL** so it appears on `/admin` — Decision D.

Once those are in hand, the production deployment is **one Bicep parameter file + one `git push`** away — and an existing CI run on the same workflow will provision the lot end-to-end. No additional engineering time required.

---

*Prepared by Dawson Sallee · AI Champions Program Lead · May 2026.*
*Questions or follow-up: respond on this thread or open an issue at the repository above.*
