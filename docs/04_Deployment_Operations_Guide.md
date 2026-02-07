# Deployment & Operations Guide

**ASPR Photo Repository Application**

| Field | Value |
|---|---|
| System Name | ASPR Photo Repository |
| Document Version | 1.1 |
| Last Updated | 2026-02-07 |
| Owner | HHS ASPR / Leidos |

---

## 1. Overview

### 1.1 System Summary

The ASPR Photo Repository is a Next.js 16 web application deployed on Azure App Service. It provides secure photo upload and management capabilities for ASPR incident response field teams. The system uses Azure SQL Database for metadata storage and Azure Blob Storage for photo files.

### 1.2 Deployment Model

```
GitHub (main branch)
       │
       ▼ (push trigger)
GitHub Actions CI/CD
       │
       ├── npm ci
       ├── npm run build (standalone)
       ├── Upload artifact (.next/standalone + static + public)
       │
       ▼
Azure App Service (Linux, Node.js 22)
       │
       ├── Azure SQL Database (Entra ID managed identity)
       └── Azure Blob Storage (connection string)
```

### 1.3 Architecture Overview

| Component | Azure Resource | Purpose |
|---|---|---|
| Web Application | Azure App Service (Linux) | Hosts Next.js standalone server |
| Database | Azure SQL Database | upload_sessions, photos tables |
| File Storage | Azure Blob Storage | aspr-photos container (originals + thumbnails) |
| Secrets | Azure Key Vault | JWT_SECRET, ADMIN_TOKEN, connection strings |
| Identity | Managed Identity | Passwordless SQL and Key Vault access |

---

## 2. Prerequisites

### 2.1 Azure Resources

| Resource | Required | Notes |
|---|---|---|
| Azure Subscription | Yes | OCIO-OPS-APPServices or equivalent |
| Resource Group | Yes | e.g., rg-aspr-photos-eus2-01 |
| App Service Plan | Yes | Linux, Node.js 22 |
| Azure SQL Server | Yes | With Entra ID admin configured |
| Azure SQL Database | Yes | Single database |
| Storage Account | Yes | General purpose v2, with aspr-photos container |
| Key Vault | Recommended | For secrets management |

### 2.2 Local Development Requirements

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 22.x LTS | Runtime |
| npm | 10.x+ | Package manager |
| Git | Latest | Version control |
| Azure CLI | Latest | Azure resource management |
| GitHub CLI (gh) | Latest | CI/CD and repository management |

---

## 3. Environment Configuration

### 3.1 Required Environment Variables

| Variable | Description | Example | Required |
|---|---|---|---|
| `JWT_SECRET` | Secret key for JWT signing | (32+ random chars) | Yes |
| `ADMIN_TOKEN` | Admin authentication token | (32+ random chars) | Yes |
| `SQL_SERVER` | Azure SQL server hostname | `server.database.windows.net` | Yes |
| `SQL_DATABASE` | Database name | `aspr-photos-db` | Yes |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob Storage connection string | `DefaultEndpointsProtocol=https;...` | Yes |

### 3.2 OIDC Identity Provider Variables

| Variable | Description | Required |
|---|---|---|
| `AUTH_SECRET` | Auth.js session encryption secret (32+ random chars) | Yes (for SSO) |
| `AZURE_AD_CLIENT_ID` | Entra ID app registration client ID | Yes (for SSO) |
| `AZURE_AD_CLIENT_SECRET` | Entra ID app registration client secret | Yes (for SSO) |
| `AZURE_AD_TENANT_ID` | HHS Entra ID tenant ID | Yes (for SSO) |
| `LOGINGOV_CLIENT_ID` | Login.gov OIDC client ID | For Login.gov |
| `LOGINGOV_PRIVATE_KEY` | Login.gov `private_key_jwt` PEM key | For Login.gov |
| `IDME_CLIENT_ID` | ID.me OIDC client ID | For ID.me |
| `IDME_CLIENT_SECRET` | ID.me OIDC client secret | For ID.me |

### 3.3 Optional Environment Variables

| Variable | Description | Default |
|---|---|---|
| `SQL_USERNAME` | SQL username (dev only) | N/A (uses Entra ID in production) |
| `SQL_PASSWORD` | SQL password (dev only) | N/A (uses Entra ID in production) |
| `IMAGE_SIGNING_KEY` | HMAC key for signed URLs | Falls back to JWT_SECRET |
| `NODE_ENV` | Runtime environment | `production` on App Service |

### 3.3 Setting Environment Variables in Azure

```bash
# Via Azure CLI
az webapp config appsettings set \
  --resource-group rg-aspr-photos-eus2-01 \
  --name app-aspr-photos-lab \
  --settings \
    JWT_SECRET="your-secret-here" \
    ADMIN_TOKEN="your-admin-token" \
    SQL_SERVER="server.database.windows.net" \
    SQL_DATABASE="aspr-photos-db" \
    AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=..."
```

---

## 4. Database Setup

### 4.1 Initial Schema

Connect to Azure SQL and execute the following DDL:

```sql
-- Create upload_sessions table
CREATE TABLE upload_sessions (
    id          NVARCHAR(36)  NOT NULL DEFAULT NEWID() PRIMARY KEY,
    pin         NVARCHAR(72)  NOT NULL,
    team_name   NVARCHAR(255) NOT NULL,
    is_active   BIT           NOT NULL DEFAULT 1,
    created_at  DATETIME      NOT NULL DEFAULT GETDATE(),
    expires_at  DATETIME      NOT NULL
);

-- Create photos table
CREATE TABLE photos (
    id            NVARCHAR(36)   NOT NULL PRIMARY KEY,
    session_id    NVARCHAR(36)   NOT NULL REFERENCES upload_sessions(id),
    file_name     NVARCHAR(255)  NOT NULL,
    blob_url      NVARCHAR(MAX)  NOT NULL,
    file_size     BIGINT         NOT NULL,
    width         INT            NULL,
    height        INT            NULL,
    mime_type     NVARCHAR(50)   NULL,
    latitude      FLOAT          NULL,
    longitude     FLOAT          NULL,
    location_name NVARCHAR(255)  NULL,
    notes         NVARCHAR(1000) NULL,
    incident_id   NVARCHAR(50)   NULL,
    created_at    DATETIME       NOT NULL DEFAULT GETDATE()
);

-- Index for session lookups
CREATE INDEX IX_photos_session_id ON photos(session_id);
CREATE INDEX IX_sessions_expires ON upload_sessions(expires_at);
```

### 4.2 Database Access (VNet Restriction)

Azure SQL is VNet-restricted and cannot be accessed directly from local machines. To run migrations or ad-hoc queries:

1. **Kudu Console:** Use the Azure App Service Advanced Tools (Kudu) to run scripts on the server
2. **Upload script:** `PUT /api/vfs/site/init-db.js` via Kudu API
3. **Execute:** `POST /api/command` with `node /home/site/init-db.js`
4. **Cleanup:** Delete the script after execution

### 4.3 PIN Column Migration

If upgrading from an earlier version where PINs were stored as plaintext (NVARCHAR(6) or NVARCHAR(10)):

```sql
ALTER TABLE upload_sessions ALTER COLUMN pin NVARCHAR(72) NOT NULL;
```

---

## 5. Blob Storage Setup

### 5.1 Container Creation

The application automatically creates the `aspr-photos` container on first upload. To create it manually:

```bash
az storage container create \
  --name aspr-photos \
  --account-name <storage-account-name> \
  --auth-mode login
```

### 5.2 Container Structure

```
aspr-photos/
├── {uuid-lowercase}/original     # Full-resolution image
└── {uuid-lowercase}/thumbnail    # WebP thumbnail (400×300 max)
```

### 5.3 Content Type Fix

If blobs were uploaded without correct content types, use the admin fix endpoint:

```bash
curl -X POST https://app-aspr-photos-lab.azurewebsites.net/api/photos/fix-blobs \
  -H "Authorization: Bearer <jwt-token>"
```

---

## 6. Build & Deploy

### 6.1 Local Development

```bash
# Install dependencies
npm ci

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### 6.2 GitHub Actions CI/CD

The workflow file `.github/workflows/main_app-aspr-photos-lab.yml` deploys automatically on push to `main`:

1. **Build Job:**
   - Checkout code
   - Setup Node.js 22
   - `npm ci` (install dependencies)
   - `npm run build` (standalone output)
   - Upload `.next/standalone`, `.next/static`, and `public` as artifact

2. **Deploy Job:**
   - Download artifact
   - Login to Azure via OIDC (federated identity)
   - Deploy to Azure App Service

### 6.3 Manual Deployment via Azure CLI

```bash
# Build standalone package
npm run build

# Zip the standalone output
cd .next/standalone
zip -r ../../deploy.zip .

# Deploy
az webapp deploy \
  --resource-group rg-aspr-photos-eus2-01 \
  --name app-aspr-photos-lab \
  --src-path deploy.zip \
  --type zip
```

### 6.4 Build Configuration

Key settings in `next.config.ts`:

| Setting | Value | Purpose |
|---|---|---|
| `output` | `standalone` | Minimal deployment footprint |
| `reactStrictMode` | `true` | Development warnings |
| `poweredByHeader` | `false` | Hide server technology |
| `productionBrowserSourceMaps` | `false` | No client source maps |
| `compress` | `true` | Gzip response compression |
| `turbopackUseSystemTlsCerts` | `true` | HHS network proxy support |

---

## 7. Managed Identity Configuration

### 7.1 SQL Server Access

The application uses `DefaultAzureCredential` from `@azure/identity` for passwordless SQL authentication:

1. Enable system-assigned managed identity on the App Service
2. Create a contained database user for the managed identity:

```sql
CREATE USER [app-aspr-photos-lab] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [app-aspr-photos-lab];
ALTER ROLE db_datawriter ADD MEMBER [app-aspr-photos-lab];
```

3. The application automatically obtains access tokens via `DefaultAzureCredential`

### 7.2 Key Vault Access (Optional)

If using Key Vault for secrets:

```bash
az keyvault set-policy \
  --name kv-aspr-photos \
  --object-id <managed-identity-object-id> \
  --secret-permissions get list
```

---

## 8. Identity Provider Configuration

### 8.1 Entra ID App Registration (Admin + Upload SSO)

1. Register a new application in the Azure Portal (Entra ID > App registrations)
2. Set **Supported account types** to "Accounts in this organizational directory only" (HHS tenant)
3. Add redirect URI: `https://app-aspr-photos-lab.azurewebsites.net/api/auth/callback/microsoft-entra-id`
4. For local development, add: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
5. Create a client secret under Certificates & secrets
6. Under **Token configuration**, add optional claims: `email`, `preferred_username`
7. Under **API permissions**, ensure `openid`, `profile`, `email` are granted
8. Create a security group (e.g., "ASPR Photo Admins") and assign admin users
9. Under **Token configuration**, add a `groups` claim to include security group IDs in the token

### 8.2 Login.gov (External Responders)

1. Create a team at the Login.gov Partner Dashboard (sandbox first)
2. Register the application with redirect URI: `https://app-aspr-photos-lab.azurewebsites.net/api/auth/callback/logingov`
3. Select `private_key_jwt` as the client authentication method
4. Generate an RSA key pair and upload the public key to Login.gov
5. Store the private key PEM in `LOGINGOV_PRIVATE_KEY` environment variable
6. Select IAL level (IAL1 for self-asserted, IAL2 for identity-proofed)

### 8.3 ID.me (External Responders)

1. Register as a partner at the ID.me Developer Portal
2. Configure OIDC with redirect URI: `https://app-aspr-photos-lab.azurewebsites.net/api/auth/callback/idme`
3. Request `openid`, `profile`, `email` scopes
4. Optionally request first responder group affiliation scope
5. Store client ID and secret in environment variables

---

## 9. Monitoring & Troubleshooting

### 8.1 Application Logs

View real-time logs:

```bash
az webapp log tail \
  --resource-group rg-aspr-photos-eus2-01 \
  --name app-aspr-photos-lab
```

### 8.2 Common Issues

| Issue | Cause | Resolution |
|---|---|---|
| 500 on PIN validation | PIN column too small (NVARCHAR < 72) | Run ALTER TABLE migration (Section 4.3) |
| Images return 404 | UUID case mismatch (SQL uppercase, blob lowercase) | Blob IDs normalized to lowercase in code |
| Database connection timeout | VNet restriction or Entra ID token expiry | Check managed identity configuration |
| CORS errors | Missing CSP or CORS headers | Update `next.config.ts` headers |
| Build fails on Sharp | Missing native dependencies | Ensure `sharp` install completes in CI |

### 8.3 Health Check

Verify application is running:

```bash
curl -I https://app-aspr-photos-lab.azurewebsites.net/
# Should return 200 with security headers
```

### 8.4 Kudu Console Access

For server-side debugging:

```
https://app-aspr-photos-lab.scm.azurewebsites.net/
```

---

## 10. Backup & Recovery

### 9.1 Database Backup

- Azure SQL automatic backups: 7-day retention (configurable)
- Point-in-time restore available via Azure Portal

### 9.2 Blob Storage Backup

- Enable soft delete on the storage account (recommended 30 days)
- Azure Blob Storage versioning for accidental overwrites

### 9.3 Application Recovery

1. All code is in GitHub (source of truth)
2. Redeploy by pushing to `main` or triggering the GitHub Actions workflow manually
3. Database schema can be recreated from migration scripts
4. Application secrets must be re-set in App Service configuration

---

## 11. Document Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Federal Project Sponsor | | | |
| Operations Lead | | | |
| Technical Lead | | | |

### Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-02-07 | HHS ASPR / Leidos | Initial deployment guide |
| 1.1 | 2026-02-07 | HHS ASPR / Leidos | Added OIDC identity provider configuration (Entra ID, Login.gov, ID.me) |
