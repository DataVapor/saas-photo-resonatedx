# Software Requirements Document
## ASPR Photo Repository Application

**Version:** 1.0
**Date:** February 6, 2026
**Project:** app-aspr-photos-lab
**Status:** Development (v0.1.0)

---

## 1. Introduction

### 1.1 Purpose
The ASPR Photo Repository is a secure, web-based application that enables Administration for Strategic Preparedness and Response (ASPR) field teams to capture, upload, and manage disaster-related photographs during incident response operations.

### 1.2 Scope
The application provides:
- PIN-based authentication for field teams
- Photo upload with metadata (GPS, incident ID, notes)
- Admin dashboard for session/PIN management
- Secure storage via Azure cloud services
- Government-compliant (ASPR/HHS) branding and security

### 1.3 Intended Users
| Role | Description |
|------|-------------|
| **Field Team Member** | ASPR responders who capture and upload photos from the field |
| **Admin** | Operations staff who create PINs, manage sessions, and monitor activity |

### 1.4 Technology Stack
| Component | Technology |
|-----------|-----------|
| Framework | Next.js 16.1.6 (React 19, TypeScript) |
| Styling | Tailwind CSS 4, shadcn/ui, Radix UI |
| Database | Azure SQL Server (mssql) |
| Storage | Azure Blob Storage |
| Auth | JWT (jsonwebtoken), PIN-based |
| Image Processing | Sharp |
| Deployment | Azure App Service via GitHub Actions |
| Runtime | Node.js 22.x |

---

## 2. Functional Requirements

### 2.1 Authentication & Authorization

#### FR-2.1.1 PIN Login (Field Teams)
- The system SHALL present a login page at the root URL (`/`) with a 6-digit numeric PIN input.
- The system SHALL validate PINs against the `upload_sessions` database table.
- The system SHALL only accept PINs that are active (`is_active = 1`) and not expired (`expires_at > current time`).
- The system SHALL generate a JWT token (24-hour expiration) upon successful PIN validation.
- The system SHALL store the JWT token, session ID, and team name in the browser's `sessionStorage`.
- The system SHALL redirect authenticated users to the `/upload` page.
- The system SHALL display remaining login attempts on failure.

#### FR-2.1.2 Admin Authentication
- The system SHALL provide an admin dashboard at `/admin`.
- The system SHALL require an admin token (matching the `ADMIN_TOKEN` environment variable) via the `x-admin-token` header for administrative API calls.
- The system SHALL support admin login through the web dashboard UI.

#### FR-2.1.3 Session Management
- JWT tokens SHALL expire after 24 hours.
- Session data SHALL be stored in `sessionStorage` (cleared on tab close).
- PINs SHALL expire 7 days after creation.
- Users SHALL be able to log out, clearing all session data.

### 2.2 Photo Upload

#### FR-2.2.1 File Upload
- The system SHALL accept photo uploads at `POST /api/photos/upload`.
- The system SHALL require a valid JWT token in the `Authorization: Bearer` header.
- The system SHALL accept JPEG, PNG, and WebP image formats only.
- The system SHALL enforce a maximum file size of 50 MB per upload.
- The system SHALL validate filenames to allow only alphanumeric characters, spaces, hyphens, dots, and underscores.

#### FR-2.2.2 Photo Metadata
- The system SHALL accept the following optional metadata with each upload:
  - **Incident ID** — format: `XX-YYYY-000` (2 uppercase letters, dash, 4 digits, dash, 3 digits)
  - **GPS Coordinates** — latitude (-90 to 90) and longitude (-180 to 180)
  - **Location Name** — formatted coordinate string
  - **Notes** — free text, maximum 1,000 characters

#### FR-2.2.3 Image Processing
- The system SHALL extract image metadata (width, height, format) using Sharp.
- The system SHALL generate a thumbnail for each uploaded photo:
  - Maximum dimensions: 400 x 300 pixels
  - Format: WebP
  - Quality: 80
  - Aspect ratio preserved (no upscaling)

#### FR-2.2.4 Storage
- The system SHALL upload the original photo to Azure Blob Storage at path `aspr-photos/{photoId}/original`.
- The system SHALL upload the generated thumbnail to Azure Blob Storage at path `aspr-photos/{photoId}/thumbnail`.
- The system SHALL store photo metadata (file name, blob URL, file size, dimensions, MIME type, coordinates, notes, incident ID, timestamp) in the `photos` database table.
- The system SHALL return a success response with `photoId` and file size upon successful upload.

#### FR-2.2.5 Upload UI
- The upload page SHALL display the authenticated team name.
- The upload page SHALL provide a camera/file selection button.
- The upload page SHALL provide optional fields for incident ID, location, and notes.
- The upload page SHALL support browser geolocation for GPS coordinates.
- The upload page SHALL show upload progress and success/error notifications.
- The upload page SHALL prompt the user to capture another photo after a successful upload.
- The upload page SHALL display photography tips.

### 2.3 Admin Dashboard

#### FR-2.3.1 PIN Creation
- Admins SHALL be able to create new 6-digit PINs via the web dashboard, CLI tool, or direct API call.
- The system SHALL generate random 6-digit PINs (range: 100000–999999).
- Admins SHALL be able to assign a team name to each PIN (auto-generated as "Team {timestamp}" if left blank).
- Created PINs SHALL have a 7-day expiration.

#### FR-2.3.2 PIN Management
- The admin dashboard SHALL display all created PINs with their team names and expiration dates.
- The admin dashboard SHALL provide copy-to-clipboard functionality for PINs.

#### FR-2.3.3 Admin API
- `POST /api/auth/create-session` SHALL create a new PIN and return `{ id, pin, team_name }`.
- The endpoint SHALL require the `x-admin-token` header.
- The endpoint SHALL validate team names (max 255 characters, alphanumeric with spaces/hyphens/underscores).

---

## 3. Non-Functional Requirements

### 3.1 Security

#### NFR-3.1.1 Rate Limiting
| Endpoint | Max Attempts | Window | Lockout |
|----------|-------------|--------|---------|
| PIN Validation (`/api/auth/validate-pin`) | 5 | 60 seconds | 15 minutes |
| Admin Auth (failed attempts) | 3 | 60 seconds | 30 minutes |
| PIN Creation (`/api/auth/create-session`) | 20 | 60 seconds | None |
| Photo Upload (`/api/photos/upload`) | 50 | 1 hour | None |

- Rate limiting SHALL be enforced per IP address.
- Rate limit state SHALL be stored in-memory (with recommendation to migrate to Redis for production scale).

#### NFR-3.1.2 Input Validation
- All user inputs SHALL be validated server-side before processing.
- PINs SHALL match the pattern `^\d{6}$`.
- Incident IDs SHALL match the pattern `^[A-Z]{2}-\d{4}-\d{3}$`.
- All database queries SHALL use parameterized inputs to prevent SQL injection.

#### NFR-3.1.3 Security Headers
The application SHALL set the following HTTP headers on all responses:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(self), payment=()`
- `Content-Security-Policy` restricting sources to `self` with necessary exceptions
- The `X-Powered-By` header SHALL be suppressed.

#### NFR-3.1.4 Audit Logging
The system SHALL log the following security events with timestamp, IP address, and relevant details:
- `AUTH_SUCCESS` — successful PIN validation
- `AUTH_FAILURE` — failed PIN validation
- `PIN_CREATED` — new PIN created (last 2 digits only)
- `UPLOAD_SUCCESS` — successful photo upload
- `UPLOAD_FAILURE` — failed photo upload
- `RATE_LIMIT_EXCEEDED` — rate limit triggered

#### NFR-3.1.5 Error Handling
- The system SHALL NOT expose internal error details to clients.
- The system SHALL return generic, safe error messages (400, 401, 403, 404, 429, 500).
- The system SHALL log full error details server-side.

#### NFR-3.1.6 OWASP Compliance
The application SHALL address all OWASP Top 10 (2021) categories:
1. Broken Access Control — JWT verification, admin token validation
2. Cryptographic Failures — HTTPS enforcement, JWT HS256
3. Injection — parameterized SQL, input validation
4. Insecure Design — rate limiting, session expiry
5. Security Misconfiguration — security headers, no debug output
6. Vulnerable Components — dependency auditing
7. Authentication Failures — JWT expiration, session management
8. Software Integrity — version control, CI/CD pipeline
9. Logging & Monitoring — audit logging
10. SSRF — no user-controlled URL fetching

### 3.2 Performance

#### NFR-3.2.1 Image Processing
- Thumbnail generation SHALL complete server-side using Sharp without blocking the upload response unnecessarily.
- The system SHALL support files up to 50 MB.

#### NFR-3.2.2 Build & Deployment
- The application SHALL use Next.js standalone output mode for minimal deployment footprint.
- Source maps SHALL be disabled in production.
- Response compression SHALL be enabled.

### 3.3 Reliability

#### NFR-3.3.1 Database Fallback
- In development mode, the application SHALL fall back to an in-memory mock database if Azure SQL Server is unavailable.

#### NFR-3.3.2 Blob Storage
- The system SHALL automatically create the `aspr-photos` container if it does not exist.

### 3.4 Usability

#### NFR-3.4.1 Design System
- The application SHALL use ASPR/HHS government branding with the following primary colors:
  - Primary Blue: `#155197`
  - Dark Blue: `#062e61`
  - Secondary Gold: `#AA6404`
  - Accent Red: `#990000`
- The UI SHALL use the shadcn/ui component library with Tailwind CSS.
- The application SHALL be mobile-responsive (mobile-first design).

#### NFR-3.4.2 Accessibility
- The application SHALL use semantic HTML elements.
- Interactive elements SHALL have visible focus states.
- Color choices SHALL be accessible to color-blind users.
- ARIA labels SHALL be used where appropriate.

#### NFR-3.4.3 Fonts & Icons
- Typography SHALL use Geist Sans (primary) and Geist Mono (monospace).
- Icons SHALL use the lucide-react library.

### 3.5 Deployment & Infrastructure

#### NFR-3.5.1 Azure Services
| Service | Purpose |
|---------|---------|
| Azure App Service | Application hosting (Node.js 22.x, Linux) |
| Azure SQL Database | Session and photo metadata storage |
| Azure Blob Storage | Photo and thumbnail file storage |
| Azure Key Vault | Secrets management (recommended) |

#### NFR-3.5.2 CI/CD
- The application SHALL deploy automatically via GitHub Actions on push to the `main` branch.
- The pipeline SHALL build the standalone package, upload artifacts, and deploy to Azure App Service.
- Azure authentication SHALL use OpenID Connect (OIDC) with federated identity.

#### NFR-3.5.3 Environment Configuration
The following environment variables are required:
| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | Secret key for JWT signing | Yes |
| `ADMIN_TOKEN` | Admin authentication token | Yes |
| `SQL_SERVER` | Azure SQL Database server hostname | Yes |
| `SQL_DATABASE` | Database name | Yes |
| `SQL_USERNAME` | Database username (dev only) | Dev |
| `SQL_PASSWORD` | Database password (dev only) | Dev |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob Storage connection string | Yes |
| `NODE_ENV` | Runtime environment | No |
| `NEXT_PUBLIC_API_URL` | Public API base URL | No |

---

## 4. Data Model

### 4.1 upload_sessions
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | NVARCHAR(36) | PRIMARY KEY | UUID |
| pin | NVARCHAR(6) | NOT NULL | 6-digit PIN |
| team_name | NVARCHAR(255) | NOT NULL | Team identifier |
| is_active | BIT | DEFAULT 1 | Active flag |
| created_at | DATETIME | DEFAULT GETDATE() | Creation timestamp |
| expires_at | DATETIME | NOT NULL | Expiration (7 days) |

### 4.2 photos
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | NVARCHAR(36) | PRIMARY KEY | UUID |
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
| timestamp | DATETIME | DEFAULT GETDATE() | Upload timestamp |

### 4.3 Relationships
- One `upload_session` → Many `photos` (via `session_id` foreign key)
- A single PIN/session can be shared across multiple team members

---

## 5. API Specification

### 5.1 POST /api/auth/validate-pin
**Purpose:** Authenticate a field team member with a PIN.

| | Details |
|---|---|
| **Auth** | None |
| **Request Body** | `{ "pin": "123456" }` |
| **Success (200)** | `{ "sessionId": "uuid", "teamName": "string", "token": "jwt" }` |
| **Errors** | 400 (invalid format), 401 (invalid/expired PIN), 429 (rate limited) |

### 5.2 POST /api/auth/create-session
**Purpose:** Create a new PIN (admin only).

| | Details |
|---|---|
| **Auth** | `x-admin-token` header |
| **Request Body** | `{ "teamName": "Team A" }` (optional) |
| **Success (200)** | `{ "id": "uuid", "pin": "654321", "team_name": "Team A" }` |
| **Errors** | 401 (invalid admin token), 429 (rate limited) |

### 5.3 POST /api/photos/upload
**Purpose:** Upload a photo with metadata.

| | Details |
|---|---|
| **Auth** | `Authorization: Bearer {JWT}` |
| **Content-Type** | `multipart/form-data` |
| **Fields** | `photo` (required), `notes`, `incidentId`, `latitude`, `longitude`, `locationName` |
| **Success (200)** | `{ "success": true, "photoId": "uuid", "size": "X.XX MB" }` |
| **Errors** | 400 (invalid file/metadata), 401 (unauthorized), 429 (rate limited), 500 (server error) |

---

## 6. System Limits

| Parameter | Value |
|-----------|-------|
| PIN length | 6 digits |
| PIN expiration | 7 days |
| JWT token expiration | 24 hours |
| Max upload file size | 50 MB |
| Supported image types | JPEG, PNG, WebP |
| Thumbnail max dimensions | 400 x 300 px |
| Thumbnail format | WebP (quality 80) |
| Max notes length | 1,000 characters |
| Max team name length | 255 characters |
| Latitude range | -90 to 90 |
| Longitude range | -180 to 180 |

---

## 7. Pages & Navigation

| Route | Page | Access | Description |
|-------|------|--------|-------------|
| `/` | Login | Public | PIN entry form, redirects to `/upload` on success |
| `/upload` | Photo Upload | Authenticated (JWT) | Photo capture/upload with metadata fields |
| `/admin` | Admin Dashboard | Admin token | PIN creation and management |

---

## 8. Future Considerations

The following features are not currently implemented but are supported by the existing data model and architecture:

- **Photo Gallery / Viewer** — browse uploaded photos by session, incident, or date
- **Geospatial Map View** — plot photos on a map using stored GPS coordinates
- **Photo Search & Filtering** — search by incident ID, date range, or team
- **PIN Revocation** — admin ability to deactivate PINs before expiration
- **Redis Rate Limiting** — distributed rate limiting for multi-instance deployments
- **OAuth 2.0 / Entra ID Integration** — enterprise SSO for admin access
- **Dark Mode** — theme toggle using the existing design system
- **Additional UI Components** — Dialog, Select, Badge, Popover, Tooltip (planned in design system)
- **Structured Audit Log Table** — persistent database-backed audit trail
- **Azure Application Insights** — production monitoring and alerting

---

## 9. Project Structure

```
app-aspr-photos-lab/
├── app/                              # Next.js app directory
│   ├── page.tsx                      # Login page (/)
│   ├── layout.tsx                    # Root layout
│   ├── globals.css                   # Global styles
│   ├── upload/page.tsx               # Photo upload page
│   ├── admin/page.tsx                # Admin dashboard
│   └── api/
│       ├── auth/
│       │   ├── create-session/route.ts   # PIN creation API
│       │   └── validate-pin/route.ts     # PIN validation API
│       └── photos/
│           └── upload/route.ts           # Photo upload API
├── components/ui/                    # shadcn/ui components
│   ├── button.tsx
│   ├── input.tsx
│   ├── card.tsx
│   ├── alert.tsx
│   └── textarea.tsx
├── lib/                              # Shared libraries
│   ├── auth.ts                       # JWT sign/verify
│   ├── db.ts                         # Database connection & queries
│   ├── rateLimit.ts                  # Rate limiting
│   ├── security.ts                   # Validation & audit logging
│   └── utils.ts                      # Utility functions (cn)
├── docs/                             # Documentation
│   ├── REQUIREMENTS.md               # This document
│   └── PIN_MANAGEMENT.md             # PIN admin guide
├── scripts/
│   └── admin-cli.js                  # CLI tool for PIN management
├── .github/workflows/
│   └── main_app-aspr-photos-lab.yml  # CI/CD pipeline
├── SECURITY.md                       # Security implementation docs
├── DESIGN_SYSTEM.md                  # UI component docs
├── next.config.ts                    # Next.js + security headers
├── tsconfig.json                     # TypeScript configuration
├── package.json                      # Dependencies & scripts
└── components.json                   # shadcn/ui configuration
```
