# Infrastructure

Bicep templates for the Azure environment. One template, two postures:

| Posture   | Cost (rough)  | Network                                                | Use case                |
| :-------- | :------------ | :----------------------------------------------------- | :---------------------- |
| `free`    | ~$40–80/mo    | Public ingress, Entra-enforced auth, IP allowlist      | MVP, free-credit window |
| `private` | ~$150–400/mo  | VNet integration, private endpoints, public off, VPN   | Production              |

## Provisioning a fresh environment

```sh
az group create -n ai-champions-dev-rg -l eastus

az deployment group create \
  --resource-group ai-champions-dev-rg \
  --template-file main.bicep \
  --parameters \
      environmentName=dev \
      networkPosture=free \
      entraClientId=$ENTRA_CLIENT_ID \
      ingressAllowedCidr=$CORP_CIDR \
      dbAdminPassword=$DB_PASSWORD
```

After deploy, run migrations from the GitHub Actions pipeline (or once
manually): `npm run db:migrate`.

## Promoting to private posture

Re-run the same template with `networkPosture=private` plus the VNet
parameters wired in. The SKUs upgrade and the public ingress is disabled.
Plan a maintenance window — App Service swaps in-place.
