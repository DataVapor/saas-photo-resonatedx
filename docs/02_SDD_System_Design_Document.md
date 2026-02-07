# System Design Document

**ASPR Photo Repository Application**

| Field | Value |
|---|---|
| Document ID | ASPR-PHOTOS-SDD-001 |
| Version | 1.0 |
| Date | 2026-02-07 |
| Status | Draft |
| Classification | For Official Use Only (FOUO) |
| Author | HHS ASPR / Leidos |
| Standards | IEEE 1016-2009 |

---

## 1. Introduction

### 1.1 Purpose

This System Design Document (SDD) describes the architecture, component design, data structures, and technology decisions for the ASPR Photo Repository application. It serves as the primary technical reference for developers, architects, and operations staff.

### 1.2 Scope

The ASPR Photo Repository is a secure, web-based application that enables Administration for Strategic Preparedness and Response (ASPR) field teams to capture, upload, and manage disaster-related photographs during incident response operations. The system provides PIN-based authentication, photo upload with geospatial metadata, a review gallery, and an admin dashboard for session management.

### 1.3 Intended Audience

| Audience | Purpose |
|---|---|
| Software Developers | Implementation reference and code architecture |
| System Architects | Design rationale and integration patterns |
| Security Engineers | Security design decisions and controls |
| DevOps / SRE | Deployment architecture and operational concerns |
| QA Engineers | Component boundaries and testability |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │  Welcome  │→│   PIN    │→│  Upload   │→│  Gallery    │  │
│  │  (wizard) │  │  Login   │  │  Wizard   │  │  Review     │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│                     │                                        │
│  ┌──────────────────┼───────────────────────────────────┐   │
│  │  Admin Dashboard  │  (separate entry at /admin)       │   │
│  └───────────────────┘──────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS (JWT / Admin Token)
┌─────────────────────────┴───────────────────────────────────┐
│                   NEXT.JS APP SERVICE                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  API Layer (Route Handlers)                          │    │
│  │  ┌───────────┐ ┌────────────┐ ┌──────────────────┐  │    │
│  │  │ /api/auth │ │ /api/photos│ │ /api/photos/[id] │  │    │
│  │  └───────────┘ └────────────┘ └──────────────────┘  │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  Shared Libraries (lib/)                             │    │
│  │  ┌──────┐ ┌────┐ ┌──────────┐ ┌──────────┐         │    │
│  │  │ auth │ │ db │ │rateLimit │ │ security │         │    │
│  │  └──────┘ └────┘ └──────────┘ └──────────┘         │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────┬──────────────────────────────┬───────────────────┘
           │                              │
┌──────────┴──────────┐    ┌──────────────┴──────────────┐
│   Azure SQL Server  │    │   Azure Blob Storage        │
│   (upload_sessions, │    │   (aspr-photos container)   │
│    photos tables)   │    │   {uuid}/original           │
│                     │    │   {uuid}/thumbnail           │
└─────────────────────┘    └─────────────────────────────┘
```

### 2.2 Request Flow

1. **Field Team Login:** User enters 6-digit PIN → `POST /api/auth/validate-pin` → bcrypt comparison against all non-expired sessions → JWT token issued (24h TTL)
2. **Photo Upload:** Authenticated user selects photos + metadata → `POST /api/photos/upload` → Sharp processes thumbnail → blobs uploaded to Azure → metadata saved to SQL
3. **Gallery View:** `GET /api/photos` → signed image URLs generated (HMAC-SHA256) → client fetches images via `/api/photos/[id]/image?sig=...`
4. **Photo Delete:** `DELETE /api/photos/[id]` → ownership verified → blobs removed → SQL record deleted
5. **Admin PIN Creation:** Admin authenticates with `x-admin-token` → `POST /api/auth/create-session` → CSPRNG generates PIN → bcrypt hash stored → plaintext PIN returned once

### 2.3 Authentication Flow

```
Field Team:
  PIN (6-digit) → bcrypt.compare() → JWT (HS256, 24h) → Bearer token

Admin:
  Admin Token → timing-safe comparison → x-admin-token header

Image Access:
  HMAC-SHA256 signed URL → /api/photos/[id]/image?type=...&exp=...&sig=...
```

---

## 3. Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | Next.js | 16.1.6 | Full-stack React framework with API routes |
| UI Library | React | 19.2.3 | Component-based UI rendering |
| Language | TypeScript | 5.x | Type-safe development |
| Styling | Tailwind CSS | 4.x | Utility-first CSS framework |
| Animation | Framer Motion | 12.33.0 | Page transitions and micro-interactions |
| Smooth Scroll | Lenis | 1.3.17 | Smooth scrolling experience |
| Icons | Lucide React | 0.563.0 | SVG icon library |
| Database | Azure SQL (mssql) | 12.2.0 | Relational data storage |
| Blob Storage | @azure/storage-blob | 12.30.0 | Binary file storage |
| Identity | @azure/identity | 4.13.0 | Entra ID managed identity |
| Auth | jsonwebtoken | 9.0.3 | JWT token management |
| Password Hashing | bcryptjs | 3.0.3 | PIN hashing (10 salt rounds) |
| Image Processing | Sharp | 0.34.5 | Thumbnail generation, metadata extraction |
| Runtime | Node.js | 22.x LTS | Server runtime |

---

## 4. Directory Structure

```
app-ndms-photos-lab/
├── app/                                # Next.js App Router
│   ├── page.tsx                        # Main wizard (welcome → pin → photos → metadata → upload → success)
│   ├── layout.tsx                      # Root layout (fonts, SmoothScroll wrapper)
│   ├── globals.css                     # ASPR brand colors, Lenis CSS, animations
│   ├── gallery/page.tsx                # Photo gallery with download/delete
│   ├── admin/page.tsx                  # Admin dashboard (login + PIN creation)
│   └── api/
│       ├── auth/
│       │   ├── create-session/route.ts # PIN creation (admin)
│       │   └── validate-pin/route.ts   # PIN validation (field teams)
│       └── photos/
│           ├── route.ts                # GET photos list (signed URLs)
│           ├── upload/route.ts         # POST photo upload
│           ├── [id]/route.ts           # DELETE photo
│           ├── [id]/image/route.ts     # GET image proxy (signed URL verification)
│           └── fix-blobs/route.ts      # POST fix blob content types (admin)
├── components/
│   ├── SmoothScroll.tsx                # Lenis smooth scroll provider
│   └── ui/                             # shadcn/ui components (Button, Input, Card, etc.)
├── lib/
│   ├── auth.ts                         # JWT sign/verify + HMAC signed image URLs
│   ├── db.ts                           # Azure SQL connection pool + mock DB fallback
│   ├── rateLimit.ts                    # In-memory rate limiter with lockout
│   ├── security.ts                     # OWASP validation, audit logging, error handling
│   └── utils.ts                        # Tailwind cn() utility
├── scripts/
│   ├── admin-cli.js                    # CLI tool for PIN management
│   ├── migrate.js                      # Database migration script
│   └── fix-pin-column.mjs             # PIN column migration (NVARCHAR(10)→72)
├── docs/                               # Project documentation
├── public/                             # Static assets (logos)
├── next.config.ts                      # Security headers, standalone output
├── package.json                        # Dependencies
└── .github/workflows/                  # CI/CD pipeline
```

---

## 5. Component Design

### 5.1 Page Architecture

The application uses Next.js App Router with three page routes:

| Route | Component | Type | Description |
|---|---|---|---|
| `/` | `app/page.tsx` | Client Component | Multi-step wizard with 6 steps |
| `/gallery` | `app/gallery/page.tsx` | Client Component | Photo review gallery with grid view |
| `/admin` | `app/admin/page.tsx` | Client Component | Admin login and PIN creation |

### 5.2 Main Wizard Flow (page.tsx)

The main page implements a wizard-style interface with animated page transitions:

```
welcome → pin → photos → metadata → uploading → success
```

| Step | Purpose | Key Features |
|---|---|---|
| welcome | Landing page | ASPR branding, floating particles, CTA |
| pin | Authentication | 6-digit PIN input, auto-advance, error display |
| photos | Photo selection | Camera/file picker, preview strip, multi-select |
| metadata | Metadata entry | Incident ID, GPS (auto/manual), ZIP lookup, notes |
| uploading | Upload progress | Animated ring, progress counter, sequential upload |
| success | Confirmation | Photo count, gallery link, "take more" option |

Page transitions use Framer Motion's `AnimatePresence` with directional sliding animations (left/right based on navigation direction).

### 5.3 Gallery Page (gallery/page.tsx)

- Displays photos uploaded in the current session
- Grid layout with thumbnail cards
- Photo detail view with original image display
- Download (original resolution) and delete functionality
- Filter by incident ID
- Responsive grid: 1 column (mobile) → 2 (sm) → 3 (md) → 4 (lg)

### 5.4 Admin Page (admin/page.tsx)

- Two-step interface: login → dashboard
- Admin token authentication via API
- PIN generation with optional team name
- Displays created PINs with copy-to-clipboard
- Dark theme with ASPR branding
- Animated transitions matching main wizard style

### 5.5 Layout System

```tsx
// app/layout.tsx
RootLayout
  └── <html>
        └── <body> (Bebas Neue + Open Sans font variables)
              └── <SmoothScroll> (Lenis wrapper)
                    └── {children}
```

- **Bebas Neue** (`--font-bebas`): Display font for headings
- **Open Sans** (`--font-opensans`): Body text
- **Lenis**: Smooth scroll with `duration: 1.2`, custom easing, `touchMultiplier: 2`

### 5.6 UI Design System

The application uses a glassmorphic design language:

| Element | Style |
|---|---|
| Primary buttons | `bg-white/90 backdrop-blur-sm border border-white/30 shadow-glow` |
| Ghost buttons | `bg-white/[0.08] border border-white/15` |
| Inputs | `bg-white/[0.07] backdrop-blur-sm border border-white/15 rounded-lg` |
| Cards | `bg-white/[0.06] border border-white/10 rounded-xl` |
| Hover effects | `whileHover={{ y: -1 }}` gentle lift micro-interaction |
| Corner radius | `rounded-lg` (8px) for buttons, `rounded-xl` for containers |

ASPR brand colors defined as CSS custom properties:

| Variable | Color | Usage |
|---|---|---|
| `--aspr-blue-dark` | #062E61 | Backgrounds, headers |
| `--aspr-blue-primary` | #155197 | Primary actions, links |
| `--aspr-gold` | #AA6404 | Secondary accents |
| `--aspr-red` | #990000 | Error states, destructive actions |

---

## 6. API Design

### 6.1 Route Handler Architecture

All API routes follow a consistent pattern:

1. **Rate limiting check** (per-IP, in-memory store)
2. **Authentication verification** (JWT or admin token)
3. **Input validation** (OWASP security module)
4. **Business logic** (database operations, blob storage)
5. **Audit logging** (security event recording)
6. **Response** (JSON with appropriate cache headers)

### 6.2 API Endpoints

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/validate-pin` | None | Field team PIN login |
| POST | `/api/auth/create-session` | Admin token | Create new PIN |
| POST | `/api/photos/upload` | JWT Bearer | Upload photo with metadata |
| GET | `/api/photos` | JWT Bearer | List session photos (signed URLs) |
| DELETE | `/api/photos/[id]` | JWT Bearer | Delete photo (ownership verified) |
| GET | `/api/photos/[id]/image` | Signed URL | Proxy image from blob storage |
| POST | `/api/photos/fix-blobs` | JWT Bearer | Fix blob content types (admin utility) |

### 6.3 Signed Image URL Design

Instead of exposing Azure Blob Storage URLs or putting JWTs in query strings, the system uses HMAC-SHA256 signed URLs:

```
/api/photos/{id}/image?type=thumbnail&exp=1707350400&sig=abc123...

Signature = HMAC-SHA256(photoId:type:expiry, SIGNING_KEY).slice(0, 32)
```

Benefits:
- CDN-safe (no authentication headers needed)
- Time-limited (default 24h TTL)
- Type-locked (thumbnail vs original)
- Short URLs (32-char truncated signature)

Cache headers on image responses:
- `Cache-Control: public, max-age=3600, s-maxage=604800, immutable`
- `CDN-Cache-Control: public, max-age=604800`

---

## 7. Data Design

### 7.1 Database Schema

**Azure SQL Server** with two tables:

#### upload_sessions

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | NVARCHAR(36) | PRIMARY KEY, DEFAULT NEWID() | UUID |
| pin | NVARCHAR(72) | NOT NULL | bcrypt hash of 6-digit PIN |
| team_name | NVARCHAR(255) | NOT NULL | Team identifier |
| is_active | BIT | DEFAULT 1 | Active flag |
| created_at | DATETIME | DEFAULT GETDATE() | Creation timestamp |
| expires_at | DATETIME | NOT NULL | Expiration (48 hours from creation) |

#### photos

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | NVARCHAR(36) | PRIMARY KEY | UUID (v4) |
| session_id | NVARCHAR(36) | FK → upload_sessions.id | Owning session |
| file_name | NVARCHAR(255) | NOT NULL | Original filename |
| blob_url | NVARCHAR(MAX) | NOT NULL | Azure Blob Storage URL |
| file_size | BIGINT | NOT NULL | Size in bytes |
| width | INT | NULL | Image width (px) |
| height | INT | NULL | Image height (px) |
| mime_type | NVARCHAR(50) | NULL | MIME type |
| latitude | FLOAT | NULL | GPS latitude |
| longitude | FLOAT | NULL | GPS longitude |
| location_name | NVARCHAR(255) | NULL | Formatted location |
| notes | NVARCHAR(1000) | NULL | User notes |
| incident_id | NVARCHAR(50) | NULL | Incident identifier |
| created_at | DATETIME | DEFAULT GETDATE() | Upload timestamp |

#### Relationships

- One `upload_session` → Many `photos` (via `session_id` FK)
- A single PIN/session can be shared across multiple team members

### 7.2 Blob Storage Structure

```
Azure Blob Storage
└── aspr-photos (container)
    ├── {uuid}/original      # Full-resolution image (JPEG/PNG/WebP)
    └── {uuid}/thumbnail     # WebP thumbnail (max 400×300, quality 80)
```

- Blob IDs are lowercase UUIDs
- Original blob content type matches uploaded file MIME type
- Thumbnail content type is always `image/webp`
- Upload metadata includes `uploadTime` and `sessionId`

### 7.3 Connection Management

- **Production:** Entra ID managed identity (DefaultAzureCredential) for passwordless SQL auth
- **Development:** SQL username/password fallback, or in-memory mock database
- Connection pool singleton (mssql `ConnectionPool`)
- Automatic token refresh for Entra ID connections

---

## 8. Security Design

### 8.1 Authentication Architecture

| Component | Mechanism | Details |
|---|---|---|
| Field Team Auth | PIN + bcrypt | 6-digit PIN, 10 salt rounds, timing-safe |
| Token Issuance | JWT HS256 | 24-hour expiration, sessionId payload |
| Admin Auth | Static token | Timing-safe comparison, 30-min lockout |
| Image Access | HMAC-SHA256 | Signed URLs with expiry, no JWT needed |
| PIN Generation | CSPRNG | `crypto.randomInt(100000, 999999)` |

### 8.2 Rate Limiting

In-memory rate limiter with lockout support:

| Endpoint | Max Attempts | Window | Lockout |
|---|---|---|---|
| PIN Validation | 5 | 60s | 15 minutes |
| Admin Auth (failure) | 3 | 60s | 30 minutes |
| PIN Creation | 20 | 60s | None |
| Photo Upload | 50 | 1 hour | None |

### 8.3 Security Headers

Applied via `next.config.ts` to all routes:

- `Strict-Transport-Security`: HSTS with 1-year max-age, preload
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy`: Restrictive CSP with font/connect-src allowances
- `Permissions-Policy`: Camera/microphone disabled, geolocation self-only
- `X-Powered-By`: Suppressed

### 8.4 Input Validation (OWASP)

All inputs validated server-side via `lib/security.ts`:

| Input | Validation |
|---|---|
| PIN | Exactly 6 numeric digits |
| Team Name | Max 255 chars, alphanumeric + spaces/hyphens/underscores |
| File Upload | JPEG/PNG/WebP only, max 50 MB, safe filename pattern |
| Coordinates | Latitude -90..90, Longitude -180..180 |
| Notes | Max 1000 characters |
| Incident ID | Max 50 chars, alphanumeric + hyphens/underscores |

---

## 9. Deployment Architecture

### 9.1 Azure Resources

| Resource | Type | Purpose |
|---|---|---|
| Azure App Service | Linux, Node.js 22 | Application hosting |
| Azure SQL Database | Single database | Relational data |
| Azure Blob Storage | General purpose v2 | Photo storage |
| Azure Key Vault | Standard | Secrets management |

### 9.2 Build Configuration

- **Output mode:** `standalone` (minimal deployment footprint)
- **Source maps:** Disabled in production
- **Compression:** Enabled
- **System TLS:** `turbopackUseSystemTlsCerts: true` for HHS network proxy

### 9.3 CI/CD Pipeline

GitHub Actions workflow (`main_app-aspr-photos-lab.yml`):

```
Push to main → Build (standalone) → Upload artifact → Deploy to Azure App Service
```

- Authentication: OpenID Connect (OIDC) with Azure federated identity
- No secrets stored in repository
- Automatic deployment on merge to `main`

---

## 10. Error Handling

### 10.1 API Error Responses

| Status | Meaning | Details Exposed |
|---|---|---|
| 400 | Bad Request | Validation error message |
| 401 | Unauthorized | Generic "Unauthorized" |
| 403 | Forbidden | "Forbidden" (signed URL failure) |
| 404 | Not Found | No body |
| 429 | Rate Limited | Retry-After header |
| 500 | Server Error | Generic message only |

### 10.2 Error Principles

- Internal error details are **never** exposed to clients (OWASP Information Disclosure)
- Full error details logged server-side via `console.error`
- Rate limit responses include `Retry-After` header
- Cache-Control headers prevent caching of error responses (`no-store`)

---

## 11. Document Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Federal Project Sponsor | | | |
| Technical Lead | | | |
| Security Officer | | | |
| Operations Lead | | | |

### Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-02-07 | HHS ASPR / Leidos | Initial system design document |
