// AI Champions Platform — Azure infrastructure (Container Apps edition)
//
// Container Apps is used instead of App Service because new Azure subs
// often have 0 VM quota for App Service plans, whereas Container Apps
// uses its own consumption-based pool.

@description('Short environment name: dev | stage | prod')
param environmentName string = 'dev'

@description('Azure region for most resources.')
param location string = resourceGroup().location

@description('Region for Postgres (sometimes a different region is required due to per-region quotas).')
param dbLocation string = resourceGroup().location

@description('Postgres administrator login.')
param dbAdminLogin string = 'pgadmin'

@secure()
@description('Postgres administrator password.')
param dbAdminPassword string

@description('Entra tenant ID for the auth flow.')
param entraTenantId string = subscription().tenantId

@description('Entra app client ID for the web app.')
param entraClientId string

@secure()
@description('Entra app client secret (for NextAuth).')
param entraClientSecret string = ''

@description('Container image reference. Updated by CI after each build.')
param containerImage string = 'mcr.microsoft.com/k8se/quickstart:latest'

@description('Auth.js secret (openssl rand -base64 32).')
@secure()
param authSecret string

var namePrefix = 'aichamp-${environmentName}'

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

// (Container image is pulled from ghcr.io as a public package — no ACR.)

// ─── Storage (Blob) ────────────────────────────────────────────────────────
resource storage 'Microsoft.Storage/storageAccounts@2023-04-01' = {
  name: replace('${namePrefix}sa', '-', '')
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
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

// ─── Key Vault ─────────────────────────────────────────────────────────────
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${namePrefix}-kv'
  location: location
  properties: {
    tenantId: entraTenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

// ─── PostgreSQL Flexible Server (Burstable) ────────────────────────────────
resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: '${namePrefix}-db-cu'
  location: dbLocation
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    administratorLogin: dbAdminLogin
    administratorLoginPassword: dbAdminPassword
    version: '16'
    storage: { storageSizeGB: 32 }
    backup: { backupRetentionDays: 14, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    network: { publicNetworkAccess: 'Enabled' }
  }
}

resource pgDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: pg
  name: 'ai_champions'
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

resource pgFirewallAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: pg
  name: 'AllowAllAzureServices'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

resource pgFirewallAll 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: pg
  name: 'AllowAll'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '255.255.255.255' }
}

// ─── Container Apps Environment ────────────────────────────────────────────
resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${namePrefix}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: law.properties.customerId
        sharedKey: law.listKeys().primarySharedKey
      }
    }
  }
}

// ─── Container App ─────────────────────────────────────────────────────────
resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${namePrefix}-app'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        traffic: [
          { latestRevision: true, weight: 100 }
        ]
      }
      // Container image is pulled from public ghcr.io — no registry auth.
      secrets: [
        {
          name: 'database-url'
          value: 'postgres://${dbAdminLogin}:${dbAdminPassword}@${pg.properties.fullyQualifiedDomainName}:5432/ai_champions?sslmode=require'
        }
        { name: 'auth-secret', value: authSecret }
        { name: 'entra-client-secret', value: entraClientSecret }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: containerImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3000' }
            { name: 'AUTH_ENTRA_TENANT_ID', value: entraTenantId }
            { name: 'AUTH_ENTRA_CLIENT_ID', value: entraClientId }
            { name: 'AUTH_ENTRA_CLIENT_SECRET', secretRef: 'entra-client-secret' }
            { name: 'AUTH_SECRET', secretRef: 'auth-secret' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
            { name: 'STORAGE_BACKEND', value: 'azure' }
            { name: 'AZURE_STORAGE_ACCOUNT', value: storage.name }
            { name: 'AZURE_STORAGE_CONTAINER', value: 'artifacts' }
            { name: 'EMAIL_BACKEND', value: 'log' }
            { name: 'DEV_AUTH_BYPASS', value: 'false' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/api/health', port: 3000 }
              initialDelaySeconds: 30
              periodSeconds: 30
            }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 3 }
    }
  }
}

// ─── Outputs ───────────────────────────────────────────────────────────────
output appUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
output databaseFqdn string = pg.properties.fullyQualifiedDomainName
output keyVaultName string = kv.name
output storageAccountName string = storage.name
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output containerAppName string = app.name
