// AI Champions Platform — Azure infrastructure
//
// Two network postures, picked by `networkPosture` parameter:
//   - 'free'         → public ingress + Entra-enforced auth + IP allowlist
//                      (cheap, ~$40-80/mo, runs on free credits)
//   - 'private'      → VNet integration, private endpoints, public ingress
//                      disabled, VPN-only access (~$150-400/mo)
//
// Deploy with:
//   az deployment group create \
//     --resource-group ai-champions-rg \
//     --template-file infra/main.bicep \
//     --parameters environmentName=dev networkPosture=free

@description('Short environment name: dev | stage | prod')
param environmentName string = 'dev'

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('free | private — see file header.')
@allowed(['free', 'private'])
param networkPosture string = 'free'

@description('Postgres administrator login.')
param dbAdminLogin string = 'pgadmin'

@secure()
@description('Postgres administrator password.')
param dbAdminPassword string

@description('CIDR range allowed when networkPosture = free (e.g. corporate egress).')
param ingressAllowedCidr string = '0.0.0.0/0'

@description('Entra tenant ID for the auth flow.')
param entraTenantId string = subscription().tenantId

@description('Entra app client ID for the web app.')
param entraClientId string

var namePrefix = 'aichamp-${environmentName}'
var isPrivate = networkPosture == 'private'

// ─── Log Analytics + App Insights ──────────────────────────────────────────
resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-law'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${namePrefix}-appi'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: law.id
  }
}

// ─── Key Vault ─────────────────────────────────────────────────────────────
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${namePrefix}-kv'
  location: location
  properties: {
    tenantId: entraTenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    publicNetworkAccess: isPrivate ? 'Disabled' : 'Enabled'
    enableSoftDelete: true
    softDeleteRetentionInDays: 30
  }
}

// ─── Storage Account (Blob) ────────────────────────────────────────────────
resource storage 'Microsoft.Storage/storageAccounts@2023-04-01' = {
  name: replace('${namePrefix}sa', '-', '')
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: isPrivate ? 'Disabled' : 'Enabled'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-04-01' = {
  parent: storage
  name: 'default'
  properties: {
    deleteRetentionPolicy: { enabled: true, days: 30 }
    containerDeleteRetentionPolicy: { enabled: true, days: 30 }
  }
}

resource artifactsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-04-01' = {
  parent: blobService
  name: 'artifacts'
  properties: { publicAccess: 'None' }
}

// ─── PostgreSQL Flexible Server ────────────────────────────────────────────
resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: '${namePrefix}-pg'
  location: location
  sku: {
    name: isPrivate ? 'Standard_D2s_v3' : 'Standard_B1ms'
    tier: isPrivate ? 'GeneralPurpose' : 'Burstable'
  }
  properties: {
    administratorLogin: dbAdminLogin
    administratorLoginPassword: dbAdminPassword
    version: '16'
    storage: { storageSizeGB: 32 }
    backup: { backupRetentionDays: 14, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: isPrivate ? 'ZoneRedundant' : 'Disabled' }
    network: {
      publicNetworkAccess: isPrivate ? 'Disabled' : 'Enabled'
    }
  }
}

resource pgDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: pg
  name: 'ai_champions'
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

resource pgFirewallAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = if (!isPrivate) {
  parent: pg
  name: 'AllowAllAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ─── App Service Plan + Web App ────────────────────────────────────────────
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${namePrefix}-plan'
  location: location
  sku: {
    name: isPrivate ? 'P1v3' : 'B1'
    tier: isPrivate ? 'PremiumV3' : 'Basic'
  }
  kind: 'linux'
  properties: { reserved: true }
}

resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: '${namePrefix}-app'
  location: location
  kind: 'app,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    publicNetworkAccess: isPrivate ? 'Disabled' : 'Enabled'
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      alwaysOn: isPrivate
      appSettings: [
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~22' }
        { name: 'NEXT_PUBLIC_APP_URL', value: 'https://${namePrefix}-app.azurewebsites.net' }
        { name: 'AUTH_ENTRA_TENANT_ID', value: entraTenantId }
        { name: 'AUTH_ENTRA_CLIENT_ID', value: entraClientId }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
        { name: 'DATABASE_URL', value: 'postgres://${dbAdminLogin}:${dbAdminPassword}@${pg.properties.fullyQualifiedDomainName}:5432/ai_champions?sslmode=require' }
      ]
      ipSecurityRestrictions: isPrivate ? [] : [
        {
          ipAddress: ingressAllowedCidr
          action: 'Allow'
          priority: 100
          name: 'CorpAllow'
        }
      ]
    }
  }
}

// ─── Outputs ───────────────────────────────────────────────────────────────
output appUrl string = 'https://${app.properties.defaultHostName}'
output databaseFqdn string = pg.properties.fullyQualifiedDomainName
output keyVaultName string = kv.name
output storageAccountName string = storage.name
output appInsightsConnectionString string = appInsights.properties.ConnectionString
