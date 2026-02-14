# Multi-Tenant SaaS + SharePoint Publishing — Implementation Plan

## Context

The ASPR PhotoHub is currently a single-tenant application deployed for HHS/ASPR. The goal is to evolve it into a SaaS platform where multiple organizations (tenants) can subscribe, each with fully isolated data, users, and configurable SharePoint Online integration. When an admin curates and approves a photo, they can publish it to their tenant's configured M365 SharePoint document library (the system of record). ASPR becomes "tenant 1."

---

## Phase 1: Database Multi-Tenancy Foundation

**Goal:** Add tenant isolation to the data layer without breaking the existing app.

### New Tables

```sql
-- Tenant registry
tenants (
  id              UNIQUEIDENTIFIER PK,
  slug            NVARCHAR(50) UNIQUE,     -- url-safe identifier (e.g. 'aspr', 'fema')
  name            NVARCHAR(200),           -- display name
  entra_tenant_id NVARCHAR(36) UNIQUE,     -- M365 tenant ID (for auth matching)
  admin_group_id  NVARCHAR(36),            -- Entra security group for admin access
  is_active       BIT DEFAULT 1,
  settings        NVARCHAR(MAX),           -- JSON: branding, defaults, policies
  created_at      DATETIME DEFAULT GETUTCDATE()
)

-- SharePoint integration config (per tenant)
tenant_sharepoint_config (
  id              UNIQUEIDENTIFIER PK,
  tenant_id       UNIQUEIDENTIFIER FK → tenants,
  site_url        NVARCHAR(500),           -- SharePoint site URL
  library_id      NVARCHAR(200),           -- document library drive ID
  library_name    NVARCHAR(200),           -- display name
  folder_pattern  NVARCHAR(200),           -- e.g. '{incident_id}/{date}'
  metadata_mapping NVARCHAR(MAX),          -- JSON: photo fields → SP columns
  refresh_token   VARBINARY(MAX),          -- encrypted OAuth refresh token
  token_expires_at DATETIME,
  consented_by    NVARCHAR(255),           -- admin who granted consent
  is_enabled      BIT DEFAULT 0,
  created_at      DATETIME,
  updated_at      DATETIME
)

-- Publish queue (photo → SharePoint)
publish_queue (
  id              UNIQUEIDENTIFIER PK,
  tenant_id       UNIQUEIDENTIFIER FK → tenants,
  photo_id        UNIQUEIDENTIFIER FK → photos,
  status          NVARCHAR(20),            -- queued, publishing, published, failed
  sharepoint_item_id NVARCHAR(200) NULL,   -- SP item ID after success
  sharepoint_url  NVARCHAR(500) NULL,      -- SP web URL after success
  error_message   NVARCHAR(MAX) NULL,
  retry_count     INT DEFAULT 0,
  submitted_by    NVARCHAR(255),           -- admin who clicked publish
  created_at      DATETIME,
  completed_at    DATETIME NULL
)
```

### Existing Table Changes

Add `tenant_id UNIQUEIDENTIFIER` (FK → tenants) to:

- `upload_sessions`
- `photos`
- `tags`
- `upload_batches`
- `admin_audit_log`

Add `publish_status NVARCHAR(20) DEFAULT NULL` to `photos` table (values: null, queued, publishing, published, failed).

### Migration Strategy

1. Add columns as NULLable first
2. Create ASPR tenant row (tenant 1) using existing `AUTH_MICROSOFT_ENTRA_ID_ISSUER` tenant ID
3. Backfill all existing rows with ASPR tenant_id
4. Add NOT NULL constraint + indexes after backfill

---

## Phase 2: Tenant-Scoped Auth & Data Access

**Goal:** Every request resolves to a tenant. All queries filter by tenant_id.

### Auth Changes

- Change Entra ID provider from **single-tenant** issuer to **multi-tenant** (`/common/v2.0`)
- On sign-in: extract `tid` (tenant ID) from the ID token claims
- Look up `tenants` table by `entra_tenant_id = tid`
- If no tenant found → reject (not a subscribed org)
- Look up `admin_group_id` from tenant row → check group membership via Graph API
- Store `tenantId` + `tenantSlug` in JWT token alongside `adminRole`

### AdminContext Changes

```typescript
interface AdminContext {
  isAuthorized: boolean
  adminEmail: string | null
  adminRole: AdminRole
  authMethod: 'entra_id' | null
  tenantId: string        // NEW
  tenantSlug: string      // NEW
  tenantName: string      // NEW
}
```

Every admin API route already calls `guardAdmin()` → tenant context propagates automatically.

### Query Scoping

- All `SELECT`, `UPDATE`, `DELETE` queries add `WHERE tenant_id = @tenantId`
- All `INSERT` queries include `tenant_id` value from AdminContext
- Blob paths prefixed: `{tenantSlug}/{photoId}/original`, `{tenantSlug}/renditions/{photoId}/...`

### PIN Auth Scoping

- PIN creation: `tenant_id` set from admin's context
- PIN validation: only compare against sessions where `tenant_id` matches (resolved from JWT or request context)
- Field team JWT token includes `tenantId` for upload scoping

---

## Phase 3: Admin Settings Page

**Goal:** New "Settings" tab in admin dashboard for tenant configuration.

### UI Components (new)

- `TenantSettings.tsx` — Settings tab container
  - **General section:** Tenant name, branding preferences
  - **SharePoint Integration section:** Connect/disconnect, library picker, folder pattern, test connection
  - **Publish Queue Monitor:** Recent publish activity, retry failed items

### AdminDashboard Changes

- Add third tab: **PINs | Photos | Settings**
- Settings tab renders `TenantSettings` component

### SharePoint Connect Flow (in Settings)

1. Admin clicks "Connect SharePoint"
2. Frontend opens popup → `/api/admin/sharepoint/authorize` (constructs OAuth URL)
3. User consents in Microsoft login → redirected to `/api/admin/sharepoint/callback`
4. Callback exchanges auth code for tokens → stores encrypted refresh token in `tenant_sharepoint_config`
5. Frontend fetches available sites/libraries → admin selects destination
6. Admin configures folder pattern and metadata mapping
7. Admin clicks "Save" → config stored, integration enabled

---

## Phase 4: SharePoint Graph API Integration

**Goal:** Publish approved photos to tenant's SharePoint library via Microsoft Graph.

### Multi-Tenant App Registration (Azure Portal)

- Convert existing app registration to multi-tenant (or create new one)
- Add API permission: `Sites.ReadWrite.All` (application or delegated with admin consent)
- Add redirect URI for SharePoint callback

### Token Management

- `getGraphClient(tenantId)` — gets access token using stored refresh token
- Token refresh logic: if expired, use refresh token → get new access + refresh tokens → update DB
- Encrypt refresh tokens with AES-256 using a key from Key Vault

### Publish Logic

- `publishPhoto(photoId, tenantId)`:
  1. Fetch photo + renditions from DB
  2. Download original blob from Azure Storage
  3. Resolve target folder (apply folder pattern: `{incident_id}/{YYYY-MM-DD}`)
  4. Upload to SharePoint via Graph API
  5. Set metadata columns via Graph API
  6. Update `publish_queue` status → `published`, store SharePoint item ID + URL
  7. Update `photos.publish_status` → `published`

### Error Handling

- 401/403 → token expired or consent revoked → mark config as disconnected, notify admin
- 429 → Graph throttled → requeue with exponential backoff
- 5xx → transient → retry up to 3 times
- All failures logged to audit

---

## Phase 5: Publish Workflow in Admin UI

**Goal:** Admins can publish individual or bulk photos to SharePoint.

### PhotoDetailSidebar Changes

- New "Publish to SharePoint" button (visible when integration is configured + enabled)
- Shows publish status badge: unpublished / queued / publishing / published / failed
- Published photos show SharePoint link (opens in new tab)
- Failed photos show retry button

### BulkActionBar Changes

- New "Publish" bulk action button (alongside existing status/tag/delete/download)
- Queues selected photos for SharePoint publishing
- Shows progress toast

### New API Endpoints

- `POST /api/admin/photos/publish` — queue single or multiple photos for publishing
- `POST /api/admin/photos/publish/retry` — retry failed publishes
- `GET /api/admin/sharepoint/queue` — list publish queue with status
- `POST /api/admin/sharepoint/process` — background worker endpoint (called by timer/cron)

### Background Processing Approach

**Decision: Azure Logic App timer (MVP)**

- Azure Logic App with Recurrence trigger (every 60 seconds) calls `POST /api/admin/sharepoint/process`
- The endpoint processes up to 10 queued items per run across all tenants
- Each item: fetch photo blob → upload to Graph API → update status
- Logic App is low-cost, no-code, and already available in the OCIO subscription
- **Future scale:** migrate to Azure Service Bus + Azure Functions if volume demands it

---

## Phase 6: Tenant Onboarding

**Goal:** New organizations can be provisioned.

- Initially: manual provisioning (insert tenant row, set admin_group_id)
- Future: self-service signup flow with Entra ID admin consent
- Onboarding creates: tenant row, default tags, welcome config

---

## Verification Plan

1. **Migration:** Run `/api/admin/migrate` → verify new tables created, ASPR backfilled as tenant 1
2. **Auth:** Sign in with HHS Entra ID → verify tenant resolved, AdminContext includes tenantId
3. **Data isolation:** Create test tenant 2 → verify tenant 1 data invisible from tenant 2 queries
4. **Settings UI:** Navigate to Settings tab → verify tenant config loads/saves
5. **SharePoint connect:** Click "Connect SharePoint" → complete OAuth → verify token stored
6. **Publish single:** Approve photo → click "Publish to SharePoint" → verify file appears in SP library
7. **Publish bulk:** Select 5 photos → click "Publish" → verify all 5 published
8. **Retry failed:** Disconnect SharePoint → publish → verify failure → reconnect → retry → verify success
9. **Audit:** Check audit_log for all publish events with correct tenant scoping

---

## Implementation Order

1. Phase 1 (DB schema) → 2 (auth scoping) → 3 (settings UI) → 4 (Graph integration) → 5 (publish workflow) → 6 (onboarding)
2. Each phase is independently deployable and testable
3. Existing ASPR functionality remains working throughout (backward compatible)
