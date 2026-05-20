# Deployment

## What's deployed

| Resource | Name | Purpose |
| :--- | :--- | :--- |
| Resource group | `ai-champions-rg` | container for everything |
| Container App | `aichamp-dev-app` | Next.js web app (serverless, scale 1–3) |
| Container Apps Env | `aichamp-dev-env` | shared compute environment |
| Postgres Flexible Server | `aichamp-dev-pg` | Postgres 16, B1ms Burstable |
| Storage account | `aichampdevsa` | Blob storage for artifacts |
| Key Vault | `aichamp-dev-kv` | secrets (DB password, AUTH_SECRET, …) |
| Log Analytics | `aichamp-dev-law` | logs for Container Apps |
| App Insights | `aichamp-dev-appi` | request traces, metrics |
| Entra app reg | `AI Champions Platform` | SSO + auth |

The container image lives at `ghcr.io/dawsonsallee/ai-champions-platform:latest` and is built by GitHub Actions on every push to `main`.

## How a deploy happens

```
git push origin main
  ↓
GitHub Actions (.github/workflows/deploy.yml)
  ├── docker build → push to ghcr.io
  ├── make package public (first run only — Container Apps anonymous pull)
  ├── az login via OIDC (federated identity — no secret stored)
  ├── az deployment group create (Bicep)
  │     ├── Postgres / Blob / KV / Log Analytics / App Insights
  │     ├── Container Apps Environment
  │     └── Container App pointed at the new image SHA
  ├── npm run db:migrate
  └── npm run db:bootstrap (reference data only)
```

No long-lived secrets in GitHub. The federated identity binds the Entra app to `repo:DawsonSallee/ai-champions-platform:ref:refs/heads/main` so only pushes from main can deploy.

## One-time setup that's already done

If you ever re-bootstrap on a fresh Azure subscription, here's the order:

1. `az login` (the only manual step)
2. Register providers: `Microsoft.App Microsoft.ContainerRegistry Microsoft.Web Microsoft.DBforPostgreSQL Microsoft.Storage Microsoft.KeyVault Microsoft.Insights Microsoft.OperationalInsights Microsoft.Authorization`
3. Create the resource group
4. Create the Entra app registration + service principal:
   ```bash
   az ad app create --display-name "AI Champions Platform" --sign-in-audience AzureADMyOrg --enable-id-token-issuance true
   ```
5. Set Entra redirect URIs (production + localhost):
   ```bash
   az ad app update --id <appObjectId> \
     --web-redirect-uris "https://<fqdn>/api/auth/callback/microsoft-entra-id" "http://localhost:3000/api/auth/callback/microsoft-entra-id"
   ```
6. Generate a client secret: `az ad app credential reset --id <appId> --years 2`
7. Create a federated credential for GitHub:
   ```bash
   az ad app federated-credential create --id <appId> --parameters '{
     "name": "github-main-branch",
     "issuer": "https://token.actions.githubusercontent.com",
     "subject": "repo:DawsonSallee/ai-champions-platform:ref:refs/heads/main",
     "audiences": ["api://AzureADTokenExchange"]
   }'
   ```
8. Grant the SP `Contributor` on the resource group (via REST API if `az role assignment` is flaky):
   ```bash
   az rest --method PUT --url "https://management.azure.com/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Authorization/roleAssignments/<newGUID>?api-version=2022-04-01" \
     --body '{"properties":{"roleDefinitionId":"/subscriptions/<sub>/providers/Microsoft.Authorization/roleDefinitions/b24988ac-6180-42a0-ab88-20f7382dd24c","principalId":"<spObjectId>","principalType":"ServicePrincipal"}}'
   ```
9. Set GitHub Actions secrets:
   ```bash
   gh secret set AZURE_CLIENT_ID --body <appId>
   gh secret set AZURE_TENANT_ID --body <tenantId>
   gh secret set AZURE_SUBSCRIPTION_ID --body <subId>
   gh secret set AZURE_RESOURCE_GROUP --body ai-champions-rg
   gh secret set DB_PASSWORD --body <generatedPwd>
   gh secret set AUTH_SECRET --body $(openssl rand -base64 32)
   gh secret set ENTRA_CLIENT_SECRET --body <secretFromStep6>
   ```
10. Push to main — the Action does the rest.

## Operating it

| Task | How |
| :--- | :--- |
| Trigger a deploy | `git push origin main` (or `gh workflow run deploy.yml`) |
| Check status | `gh run watch` |
| Read live logs | `az containerapp logs show -g ai-champions-rg -n aichamp-dev-app --follow` |
| Restart the app | `az containerapp revision restart -g ai-champions-rg -n aichamp-dev-app --revision $(az containerapp revision list ... --query "[0].name" -o tsv)` |
| Run migrations manually | `DATABASE_URL='...' npm run db:migrate` from your local machine |
| Rotate Entra secret | `az ad app credential reset --id <appId> --years 2` → update `ENTRA_CLIENT_SECRET` secret in GH |

## Cost (rough monthly, idle)

| Item | Cost |
| :--- | :--- |
| Container App (1 replica, 0.5 vCPU, 1 GiB, mostly idle) | ~$15–25 |
| Postgres Flexible B1ms + 32 GiB storage | ~$15 |
| Storage / KV / App Insights / Log Analytics | ~$5–10 |
| ghcr.io | $0 (public) |
| **Total** | **~$35–50/mo** |

Scales up automatically with traffic; max 3 replicas in current Bicep.

## Common issues

**Container App can't pull image.** The package must be public on ghcr.io. The deploy workflow tries to set this on the first run; verify at `https://github.com/users/DawsonSallee/packages/container/ai-champions-platform/settings` — "Change visibility" → Public.

**`az role assignment` returns MissingSubscription.** Use the REST API fallback in step 8 of one-time setup.

**Quota errors on App Service.** This deployment uses Container Apps specifically because new Azure subs have 0 VM quota for App Service. If you ever switch to App Service, file a quota increase request first.

**ACR Tasks blocked.** `az acr build` fails with `TasksOperationsNotAllowed` on new subs. We bypass this by building in GitHub Actions and pushing to ghcr.io.
