# Software Requirements Specification

**ASPR Photo Repository Application**

| Field | Value |
|---|---|
| Document ID | ASPR-PHOTOS-SRS-001 |
| Version | 1.1 |
| Date | 2026-02-07 |
| Status | Development |
| Classification | For Official Use Only (FOUO) |
| Author | HHS ASPR / Leidos |

---

## 1. Introduction

### 1.1 Purpose

The ASPR Photo Repository is a secure, web-based application that enables Administration for Strategic Preparedness and Response (ASPR) field teams to capture, upload, and manage disaster-related photographs during incident response operations.

### 1.2 Scope

The application provides:
- PIN-based authentication for field teams with bcrypt-hashed credentials
- Multi-step wizard for photo upload with metadata (GPS, incident ID, notes)
- Photo gallery with download, delete, and filtering capabilities
- Admin dashboard for session/PIN management
- Signed image URLs for CDN-safe photo delivery
- Secure storage via Azure cloud services
- Government-compliant (ASPR/HHS) branding and security controls

### 1.3 Intended Users

| Role | Description |
|---|---|
| **Field Team Member** | ASPR responders who capture and upload photos from the field |
| **Admin** | Operations staff who create PINs, manage sessions, and monitor activity |

### 1.4 Technology Stack

| Component | Technology |
|---|---|
| Framework | Next.js 16.1.6 (React 19, TypeScript) |
| Styling | Tailwind CSS 4, Framer Motion 12, Lenis smooth scroll |
| Database | Azure SQL Server (mssql 12.2) |
| Storage | Azure Blob Storage (@azure/storage-blob 12.30) |
| Auth | JWT (jsonwebtoken 9.x), bcryptjs 3.x, HMAC-SHA256 signed URLs |
| Image Processing | Sharp 0.34.5 |
| Deployment | Azure App Service via GitHub Actions CI/CD |
| Runtime | Node.js 22.x |

---

## 2. Functional Requirements

### 2.1 Authentication & Authorization

#### FR-2.1.1 PIN Login (Field Teams)
- The system SHALL present a multi-step wizard at the root URL (`/`) starting with a welcome screen.
- The system SHALL validate 6-digit PINs by fetching all non-expired sessions and comparing bcrypt hashes.
- The system SHALL only accept PINs linked to sessions not yet expired (`expires_at > GETUTCDATE()`).
- The system SHALL generate a JWT token (HS256, 24-hour expiration) upon successful PIN validation.
- The system SHALL store the JWT token, session ID, and team name in the browser's `sessionStorage`.
- The system SHALL display remaining login attempts on failure.
- The system SHALL auto-advance the PIN input when all 6 digits are entered.

#### FR-2.1.2 Admin Authentication
- The system SHALL provide an admin dashboard at `/admin`.
- The system SHALL require an admin token (matching the `ADMIN_TOKEN` environment variable) via the `x-admin-token` header for administrative API calls.
- The system SHALL use timing-safe comparison (`crypto.timingSafeEqual`) for admin token verification.
- The system SHALL support admin login through the web dashboard UI.

#### FR-2.1.3 Session Management
- JWT tokens SHALL expire after 24 hours.
- Session data SHALL be stored in `sessionStorage` (cleared on tab close).
- PINs SHALL expire 48 hours after creation.
- Users SHALL be able to log out, clearing all session data.

#### FR-2.1.4 Signed Image URLs
- The system SHALL generate HMAC-SHA256 signed URLs for image access.
- Signed URLs SHALL include photo ID, image type, expiry timestamp, and signature.
- Signed URLs SHALL expire after 24 hours (default).
- The image proxy SHALL verify signatures before serving blob content.

### 2.2 Photo Upload

#### FR-2.2.1 File Upload
- The system SHALL accept photo uploads at `POST /api/photos/upload`.
- The system SHALL require a valid JWT token in the `Authorization: Bearer` header.
- The system SHALL accept JPEG, PNG, and WebP image formats only.
- The system SHALL enforce a maximum file size of 50 MB per upload.
- The system SHALL validate filenames to allow only alphanumeric characters, spaces, hyphens, dots, and underscores.
- The system SHALL support multi-photo selection in a single wizard session.

#### FR-2.2.2 Photo Metadata
- The system SHALL accept the following optional metadata with each upload:
  - **Incident ID** — alphanumeric with hyphens/underscores, max 50 characters
  - **GPS Coordinates** — latitude (-90 to 90) and longitude (-180 to 180)
  - **Location Name** — formatted coordinate string
  - **Notes** — free text, maximum 1,000 characters
- The system SHALL support browser geolocation for automatic GPS capture.
- The system SHALL support ZIP code lookup for approximate coordinates.

#### FR-2.2.3 Image Processing
- The system SHALL extract image metadata (width, height, format) using Sharp.
- The system SHALL generate a thumbnail for each uploaded photo:
  - Maximum dimensions: 400 × 300 pixels
  - Format: WebP
  - Quality: 80
  - Aspect ratio preserved (no upscaling)

#### FR-2.2.4 Storage
- The system SHALL upload the original photo to Azure Blob Storage at path `aspr-photos/{photoId}/original`.
- The system SHALL upload the generated thumbnail to Azure Blob Storage at path `aspr-photos/{photoId}/thumbnail`.
- The system SHALL store photo metadata in the `photos` database table.
- The system SHALL return a success response with `photoId` and file size upon successful upload.
- Blob IDs SHALL be lowercase UUIDs.

#### FR-2.2.5 Upload User Interface
- The upload page SHALL implement a wizard flow: welcome → pin → photos → metadata → uploading → success.
- The photos step SHALL provide a camera/file selection area with preview strip.
- The metadata step SHALL provide fields for incident ID, GPS coordinates, and notes.
- The uploading step SHALL show animated progress with sequential upload counter.
- The success step SHALL display photo count and offer "Take More" and "View Gallery" actions.
- Page transitions SHALL use Framer Motion animated slides with directional awareness.

### 2.3 Photo Gallery

#### FR-2.3.1 Gallery View
- The system SHALL provide a photo gallery at `/gallery`.
- The gallery SHALL display thumbnails in a responsive grid layout.
- The gallery SHALL show photo details (filename, size, dimensions, metadata).
- Photos SHALL be ordered by upload date (newest first).
- Only photos belonging to the authenticated session SHALL be displayed.

#### FR-2.3.2 Photo Actions
- Users SHALL be able to download the original full-resolution image.
- Users SHALL be able to delete photos with confirmation.
- Photo deletion SHALL remove both blob storage files and the database record.

#### FR-2.3.3 Filtering
- The gallery SHALL support filtering photos by incident ID.

### 2.4 Admin Dashboard

#### FR-2.4.1 PIN Creation
- Admins SHALL be able to create new 6-digit PINs via the web dashboard or CLI tool.
- The system SHALL generate PINs using CSPRNG (`crypto.randomInt(100000, 999999)`).
- PINs SHALL be stored as bcrypt hashes (10 salt rounds) in NVARCHAR(72) column.
- Admins SHALL be able to assign a team name to each PIN (defaults to "Anonymous").
- Created PINs SHALL have a 48-hour expiration.
- The plaintext PIN SHALL be returned only once at creation and cannot be retrieved afterward.

#### FR-2.4.2 PIN Management
- The admin dashboard SHALL display created PINs with team names.
- The admin dashboard SHALL provide copy-to-clipboard functionality for PINs.

#### FR-2.4.3 Admin API
- `POST /api/auth/create-session` SHALL create a new PIN and return `{ id, pin, team_name }`.
- The endpoint SHALL require the `x-admin-token` header.
- The endpoint SHALL validate team names (max 255 characters, alphanumeric with spaces/hyphens/underscores).

---

## 3. Non-Functional Requirements

### 3.1 Security

#### NFR-3.1.1 Rate Limiting

| Endpoint | Max Attempts | Window | Lockout |
|---|---|---|---|
| PIN Validation (`/api/auth/validate-pin`) | 5 | 60 seconds | 15 minutes |
| Admin Auth (failed attempts) | 3 | 60 seconds | 30 minutes |
| PIN Creation (`/api/auth/create-session`) | 20 | 60 seconds | None |
| Photo Upload (`/api/photos/upload`) | 50 | 1 hour | None |

- Rate limiting SHALL be enforced per IP address.
- Rate limit state SHALL be stored in-memory with automatic cleanup.

#### NFR-3.1.2 Input Validation
- All user inputs SHALL be validated server-side before processing.
- PINs SHALL match the pattern `^\d{6}$`.
- All database queries SHALL use parameterized inputs to prevent SQL injection.

#### NFR-3.1.3 Security Headers
The application SHALL set hardened HTTP headers on all responses including:
- `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`
- `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`
- The `X-Powered-By` header SHALL be suppressed.

#### NFR-3.1.4 Audit Logging
The system SHALL log security events: AUTH_SUCCESS, AUTH_FAILURE, PIN_CREATED, UPLOAD_SUCCESS, UPLOAD_FAILURE, RATE_LIMIT_EXCEEDED.

#### NFR-3.1.5 Cryptographic Security
- PINs SHALL be generated using CSPRNG (NIST SP 800-63B).
- PINs SHALL be stored as bcrypt hashes (10 salt rounds).
- Admin token comparison SHALL use `crypto.timingSafeEqual`.
- Image URLs SHALL use HMAC-SHA256 signatures.

### 3.2 Performance
- Thumbnail generation SHALL complete server-side using Sharp.
- The application SHALL use Next.js standalone output mode.
- Source maps SHALL be disabled in production.
- Response compression SHALL be enabled.
- Image responses SHALL include CDN-friendly cache headers (`s-maxage=604800`).

### 3.3 Reliability
- In development mode, the application SHALL fall back to an in-memory mock database.
- The system SHALL automatically create the `aspr-photos` container if it does not exist.

### 3.4 Usability
- The application SHALL use ASPR/HHS government branding (Primary Blue #155197, Dark Blue #062E61, Gold #AA6404, Red #990000).
- The UI SHALL use a glassmorphic design system with Tailwind CSS.
- The application SHALL be mobile-responsive (mobile-first design).
- Typography SHALL use Bebas Neue (display) and Open Sans (body).
- Icons SHALL use the lucide-react library.
- Animations SHALL use Framer Motion with smooth page transitions.
- Smooth scrolling SHALL be provided by Lenis.

### 3.5 Deployment & Infrastructure

| Azure Service | Purpose |
|---|---|
| Azure App Service | Application hosting (Node.js 22.x, Linux) |
| Azure SQL Database | Session and photo metadata storage |
| Azure Blob Storage | Photo and thumbnail file storage |
| Azure Key Vault | Secrets management (recommended) |

- The application SHALL deploy automatically via GitHub Actions on push to `main`.
- Azure authentication SHALL use OpenID Connect (OIDC) with federated identity.
- Database authentication SHALL use Entra ID managed identity in production.

---

## 4. Data Model

### 4.1 upload_sessions

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | NVARCHAR(36) | PK, DEFAULT NEWID() | UUID |
| pin | NVARCHAR(72) | NOT NULL | bcrypt hash of 6-digit PIN |
| team_name | NVARCHAR(255) | NOT NULL | Team identifier |
| is_active | BIT | DEFAULT 1 | Active flag |
| created_at | DATETIME | DEFAULT GETDATE() | Creation timestamp |
| expires_at | DATETIME | NOT NULL | Expiration (48 hours) |

### 4.2 photos

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | NVARCHAR(36) | PK | UUID (v4) |
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

### 4.3 Relationships
- One `upload_session` → Many `photos` (via `session_id` foreign key)
- A single PIN/session can be shared across multiple team members

---

## 5. API Specification

### 5.1 POST /api/auth/validate-pin
Authenticate a field team member with a PIN.

| Property | Details |
|---|---|
| Auth | None |
| Request Body | `{ "pin": "123456" }` |
| Success (200) | `{ "sessionId": "uuid", "teamName": "string", "token": "jwt" }` |
| Errors | 400 (invalid format), 401 (invalid/expired PIN), 429 (rate limited) |

### 5.2 POST /api/auth/create-session
Create a new PIN (admin only).

| Property | Details |
|---|---|
| Auth | `x-admin-token` header |
| Request Body | `{ "teamName": "Team A" }` (optional) |
| Success (200) | `{ "id": "uuid", "pin": "654321", "team_name": "Team A" }` |
| Errors | 401 (invalid admin token), 429 (rate limited) |

### 5.3 POST /api/photos/upload
Upload a photo with metadata.

| Property | Details |
|---|---|
| Auth | `Authorization: Bearer {JWT}` |
| Content-Type | `multipart/form-data` |
| Fields | `photo` (required), `notes`, `incidentId`, `latitude`, `longitude`, `locationName` |
| Success (200) | `{ "success": true, "photoId": "uuid", "size": "X.XX MB" }` |
| Errors | 400 (invalid file/metadata), 401 (unauthorized), 429 (rate limited) |

### 5.4 GET /api/photos
List photos for the authenticated session.

| Property | Details |
|---|---|
| Auth | `Authorization: Bearer {JWT}` |
| Success (200) | `{ "photos": [{ id, fileName, thumbnailUrl, originalUrl, ... }] }` |

### 5.5 DELETE /api/photos/[id]
Delete a photo (must belong to authenticated session).

| Property | Details |
|---|---|
| Auth | `Authorization: Bearer {JWT}` |
| Success (200) | `{ "success": true }` |
| Errors | 401 (unauthorized), 404 (not found) |

### 5.6 GET /api/photos/[id]/image
Serve an image via signed URL proxy.

| Property | Details |
|---|---|
| Auth | Signed URL (query params: `type`, `exp`, `sig`) |
| Success (200) | Binary image data with CDN cache headers |
| Errors | 403 (invalid signature), 404 (not found) |

---

## 6. System Limits

| Parameter | Value |
|---|---|
| PIN length | 6 digits |
| PIN expiration | 48 hours |
| JWT token expiration | 24 hours |
| Signed URL expiration | 24 hours |
| Max upload file size | 50 MB |
| Supported image types | JPEG, PNG, WebP |
| Thumbnail max dimensions | 400 × 300 px |
| Thumbnail format | WebP (quality 80) |
| Max notes length | 1,000 characters |
| Max team name length | 255 characters |

---

## 7. Pages & Navigation

| Route | Page | Access | Description |
|---|---|---|---|
| `/` | Upload Wizard | Public → Authenticated | Multi-step: welcome, PIN, photos, metadata, upload, success |
| `/gallery` | Photo Gallery | Authenticated (JWT) | Review, download, delete uploaded photos |
| `/admin` | Admin Dashboard | Admin token | PIN creation and management |

---

## 8. Future Considerations

- Geospatial Map View — plot photos on a map using stored GPS coordinates
- Photo Search & Filtering — search by date range, team, or keyword
- PIN Revocation — admin ability to deactivate PINs before expiration
- Redis Rate Limiting — distributed rate limiting for multi-instance deployments
- OAuth 2.0 / Entra ID Integration — enterprise SSO for admin access
- Structured Audit Log Table — persistent database-backed audit trail
- Azure Application Insights — production monitoring and alerting
- Batch Download — ZIP download of all session photos

---

## 9. Document Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Federal Project Sponsor | | | |
| Technical Lead | | | |
| Security Officer | | | |
| Operations Lead | | | |

### Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-02-06 | HHS ASPR / Leidos | Initial requirements document |
| 1.1 | 2026-02-07 | HHS ASPR / Leidos | Updated: bcrypt PINs, 48h expiry, gallery page, signed URLs, wizard flow, glassmorphic UI, Lenis scroll |
