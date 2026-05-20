---
title: "AI Champions Platform"
subtitle: "IT Proposal"
author: "Dawson Sallee · AI Champions Program"
date: "May 2026"
---

# AI Champions Platform — IT Proposal

A working web app that replaces the SharePoint list, Excel ROI calculators, Power BI dashboard, and manual Freshservice routing currently running the AI Champions Program. **Already live for demo on Azure.** Looking for IT sign-off to move it to a corporate subscription.

**Live demo:** <https://aichamp-dev-app.orangeglacier-5bb9312f.eastus2.azurecontainerapps.io>
**Source:** <https://github.com/DawsonSallee/ai-champions-platform>

---

## Architecture

![Architecture overview](architecture.png){width=100%}

---

## What gets deployed (one Azure resource group)

| # | Resource | Purpose | SKU |
| :- | :--- | :--- | :--- |
| 1 | Container App | Web app (Next.js) | 0.5 vCPU · 1 GiB · scale 1–3 |
| 2 | Container Apps Environment | Hosts the app | Consumption |
| 3 | PostgreSQL Flexible Server | App database | B1ms · 32 GiB · Postgres 16 |
| 4 | Blob Storage | Project artifacts | Standard LRS, private container |
| 5 | Key Vault | Secrets | Standard, RBAC-auth |
| 6 | Log Analytics + App Insights | Logs · traces · errors | 30-day retention |
| 7 | Entra app registration | SSO + CI/CD federated identity | AzureADMyOrg |

All Microsoft-managed PaaS. Bicep source-of-truth at `infra/main.bicep` — recreatable from scratch in ~10 min.

---

## Cost (USD/month)

| Posture | Compute | Database | Other | **Total** |
| :--- | --: | --: | --: | --: |
| Demo (current — always-on) | $39 | $17 | $2 | **$58** |
| Light prod (scale-to-zero idle) | $5 | $30 | $10 | **$45** |
| Hardened prod (HA + private endpoints + staging) | $60 | $60 | $90 | **$210** |

Pay-as-you-go; no commitment. Break-even at ~8 champions saving 1 hour/week.

---

## Security posture

| | Current (demo) | Proposed (prod) |
| :--- | :--- | :--- |
| Ingress | Public HTTPS + Entra sign-in | VPN-only via private endpoints |
| Postgres | Firewall `0.0.0.0/0` + TLS | Private endpoint, no public access |
| Encryption | TLS 1.2+ in transit, Microsoft-managed keys at rest | Same |
| Data classification | Internal max | Internal max (PII stored by reference only) |
| Audit | Append-only `audit_events` table; admin viewer | Same + Sentinel/Defender hook if needed |
| Secrets | Key Vault + Container Apps `secretRef` | Same |
| CI/CD auth | OIDC federated identity (no long-lived secret) | Same |

Network posture is a single Bicep parameter flip (`networkPosture=private`). Incremental cost reflected in the table above.

---

## CI/CD & ops

- **Deploy:** `git push origin main` → GitHub Actions builds image, pushes to `ghcr.io`, deploys Bicep, runs migrations. ~5 minutes end-to-end.
- **Rollback:** `az containerapp revision activate <prior>` in seconds, no rebuild.
- **Observability:** All logs/traces flow into one Log Analytics workspace. Standard portal queries.
- **Backups:** Postgres PITR 14-day; Blob soft-delete 30-day.
- **On-call:** AI Team (Dawson, Melissa) first contact. Escalates to IT support via Freshservice.

---

## Asks from IT

| # | Decision | Effort |
| :- | :--- | :--- |
| 1 | Assign a corporate Azure subscription for production | One-time |
| 2 | Approve an Entra app registration in the Enercon tenant for SSO + federated CI | One-time, ~10 min |
| 3 | Approve `networkPosture=private` for prod (VPN-only, private endpoints) | Bicep flip, no code change |
| 4 | Assign an IT Security reviewer for the platform's own IT Governance & Security Assessment | Per existing framework |
| 5 | Provide the AI Champions M365 Group URL for the Admin page link | One env-var update |

Once 1–3 are done, production is **one CI run** away. No additional engineering required.

---

## Caveats (honest)

- Demo lives on a **personal** Azure subscription today. No real data should go in until #1 above is done.
- Container image is on **public** `ghcr.io` for anonymous pull. Switching to a private Azure Container Registry is a 1-line Bicep + managed-identity change.
- Weekly nudge job and SLA-breach checker are written but **not scheduled yet** (need a Container Apps Job resource added).
- One environment exists today (dev). Staging + prod requires deploying the Bicep template twice with different parameter files — no new code.

---

*Prepared by Dawson Sallee · AI Champions Program Lead · May 2026.*
