# API & Data Reference

**ASPR Photo Repository Application**

| Field | Value |
|---|---|
| System Name | ASPR Photo Repository |
| Document Version | 1.0 |
| Last Updated | 2026-02-07 |
| Owner | HHS ASPR / Leidos |

---

## 1. Overview

### 1.1 API Base URL

```
https://app-aspr-photos-lab.azurewebsites.net
```

### 1.2 Authentication Methods

| Method | Header | Used By |
|---|---|---|
| JWT Bearer Token | `Authorization: Bearer <token>` | Field team photo operations |
| Admin Token | `x-admin-token: <token>` | PIN creation and management |
| Signed URL | Query params: `exp`, `sig` | Image proxy access |

### 1.3 Common Response Headers

All responses include security headers:
- `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`
- `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`

---

## 2. Authentication Endpoints

### 2.1 POST /api/auth/validate-pin

Authenticate a field team member with a 6-digit PIN.

**Request:**

| Property | Value |
|---|---|
| Method | POST |
| Content-Type | application/json |
| Authentication | None |
| Rate Limit | 5 attempts / 60s, then 15-min lockout |

```json
{
  "pin": "123456"
}
```

**Success Response (200):**

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "teamName": "Alpha Team",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Error Responses:**

| Status | Body | Condition |
|---|---|---|
| 400 | `{ "error": "PIN must be exactly 6 digits" }` | Invalid PIN format |
| 401 | `{ "error": "Invalid or expired PIN. 3 attempts remaining." }` | Wrong or expired PIN |
| 429 | `{ "error": "Too many attempts. Try again in 900 seconds." }` | Rate limit exceeded |
| 500 | `{ "error": "Validation failed" }` | Server error |

### 2.2 POST /api/auth/create-session

Create a new PIN and upload session (admin only).

**Request:**

| Property | Value |
|---|---|
| Method | POST |
| Content-Type | application/json |
| Authentication | `x-admin-token` header |
| Rate Limit | 20 / 60s (creation); 3 / 60s + 30-min lockout (auth failures) |

```json
{
  "teamName": "Hurricane Response Team"
}
```

`teamName` is optional; defaults to "Anonymous" if omitted.

**Success Response (200):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "team_name": "Hurricane Response Team",
  "pin": "847291"
}
```

**Note:** The plaintext PIN is returned only once at creation. It is stored as a bcrypt hash and cannot be retrieved afterward.

**Error Responses:**

| Status | Body | Condition |
|---|---|---|
| 400 | `{ "error": "Team name contains invalid characters" }` | Invalid team name |
| 401 | `{ "error": "Unauthorized" }` | Invalid admin token |
| 429 | `{ "error": "Too many failed authentication attempts" }` | Admin auth rate limited |
| 500 | `{ "error": "Failed to create PIN" }` | Server error |

---

## 3. Photo Endpoints

### 3.1 POST /api/photos/upload

Upload a photo with optional metadata.

**Request:**

| Property | Value |
|---|---|
| Method | POST |
| Content-Type | multipart/form-data |
| Authentication | `Authorization: Bearer <JWT>` |
| Rate Limit | 50 / hour |

**Form Fields:**

| Field | Type | Required | Validation |
|---|---|---|---|
| `photo` | File | Yes | JPEG, PNG, or WebP; max 50 MB; safe filename |
| `notes` | String | No | Max 1,000 characters |
| `incidentId` | String | No | Max 50 chars, alphanumeric + hyphens/underscores |
| `latitude` | Float | No | -90 to 90 |
| `longitude` | Float | No | -180 to 180 |
| `locationName` | String | No | Formatted coordinate string |

**Success Response (200):**

```json
{
  "success": true,
  "photoId": "550e8400-e29b-41d4-a716-446655440000",
  "size": "4.25 MB"
}
```

**Processing:**
1. File validated (type, size, filename)
2. Image metadata extracted via Sharp (width, height, format)
3. Thumbnail generated: max 400×300 px, WebP format, quality 80
4. Original + thumbnail uploaded to Azure Blob Storage
5. Metadata record inserted into SQL database

**Error Responses:**

| Status | Body | Condition |
|---|---|---|
| 400 | `{ "error": "File type not allowed..." }` | Invalid file or metadata |
| 401 | `{ "error": "Unauthorized" }` | Missing or invalid JWT |
| 429 | `{ "error": "Upload rate limit exceeded" }` | Rate limit exceeded |
| 500 | `{ "error": "Upload failed" }` | Server error |

### 3.2 GET /api/photos

List all photos for the authenticated session.

**Request:**

| Property | Value |
|---|---|
| Method | GET |
| Authentication | `Authorization: Bearer <JWT>` |
| Cache-Control | `private, no-cache` |

**Success Response (200):**

```json
{
  "photos": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "fileName": "IMG_001.jpg",
      "thumbnailUrl": "/api/photos/550e.../image?type=thumbnail&exp=...&sig=...",
      "originalUrl": "/api/photos/550e.../image?type=original&exp=...&sig=...",
      "fileSize": 4456789,
      "width": 4032,
      "height": 3024,
      "mimeType": "image/jpeg",
      "latitude": 38.8977,
      "longitude": -77.0365,
      "locationName": "38.8977, -77.0365",
      "notes": "Flooding at intersection",
      "incidentId": "HU-2024-001",
      "createdAt": "2026-02-07T14:30:00.000Z"
    }
  ]
}
```

**Notes:**
- Photos are ordered by `created_at DESC` (newest first)
- Image URLs are signed with HMAC-SHA256 (24-hour TTL)
- Only photos belonging to the authenticated session are returned

### 3.3 DELETE /api/photos/[id]

Delete a photo (must belong to the authenticated session).

**Request:**

| Property | Value |
|---|---|
| Method | DELETE |
| Authentication | `Authorization: Bearer <JWT>` |

**Success Response (200):**

```json
{
  "success": true
}
```

**Processing:**
1. Verify photo belongs to the authenticated session
2. Delete original blob from Azure Blob Storage
3. Delete thumbnail blob from Azure Blob Storage
4. Delete photo record from SQL database

**Error Responses:**

| Status | Body | Condition |
|---|---|---|
| 401 | `{ "error": "Unauthorized" }` | Missing or invalid JWT |
| 404 | `{ "error": "Photo not found" }` | Photo doesn't exist or wrong session |
| 500 | `{ "error": "Delete failed" }` | Server error |

### 3.4 GET /api/photos/[id]/image

Proxy an image from Azure Blob Storage using a signed URL.

**Request:**

| Property | Value |
|---|---|
| Method | GET |
| Authentication | Signed URL (query params) |

**Query Parameters:**

| Parameter | Required | Description |
|---|---|---|
| `type` | Yes | `thumbnail` or `original` |
| `exp` | Yes | Unix timestamp expiry |
| `sig` | Yes | HMAC-SHA256 signature (32 chars) |

**Signature Verification:**
```
expected = HMAC-SHA256(photoId:type:exp, SIGNING_KEY).slice(0, 32)
```

**Success Response (200):**
- Binary image data streamed from Azure Blob Storage
- `Content-Type`: `image/webp` (thumbnails) or original MIME type
- `Cache-Control: public, max-age=3600, s-maxage=604800, immutable`

**Error Responses:**

| Status | Body | Condition |
|---|---|---|
| 403 | `Forbidden` | Invalid or expired signature |
| 404 | (empty) | Blob not found |
| 500 | `Failed to load image` | Server error |

### 3.5 POST /api/photos/fix-blobs

Admin utility to fix content types on existing blobs.

**Request:**

| Property | Value |
|---|---|
| Method | POST |
| Authentication | `Authorization: Bearer <JWT>` |

**Success Response (200):**

```json
{
  "fixed": 15,
  "total": 20
}
```

---

## 4. Data Model

### 4.1 upload_sessions Table

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | NVARCHAR(36) | PK, DEFAULT NEWID() | UUID |
| pin | NVARCHAR(72) | NOT NULL | bcrypt hash |
| team_name | NVARCHAR(255) | NOT NULL | Team identifier |
| is_active | BIT | DEFAULT 1 | Active flag |
| created_at | DATETIME | DEFAULT GETDATE() | Created |
| expires_at | DATETIME | NOT NULL | Expiration (48h) |

### 4.2 photos Table

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | NVARCHAR(36) | PK | UUID (v4) |
| session_id | NVARCHAR(36) | FK → upload_sessions.id | Session owner |
| file_name | NVARCHAR(255) | NOT NULL | Original filename |
| blob_url | NVARCHAR(MAX) | NOT NULL | Blob Storage URL |
| file_size | BIGINT | NOT NULL | Size in bytes |
| width | INT | NULL | Width (px) |
| height | INT | NULL | Height (px) |
| mime_type | NVARCHAR(50) | NULL | MIME type |
| latitude | FLOAT | NULL | GPS latitude |
| longitude | FLOAT | NULL | GPS longitude |
| location_name | NVARCHAR(255) | NULL | Formatted location |
| notes | NVARCHAR(1000) | NULL | User notes |
| incident_id | NVARCHAR(50) | NULL | Incident ID |
| created_at | DATETIME | DEFAULT GETDATE() | Upload time |

### 4.3 Relationships

```
upload_sessions (1) ──→ (many) photos
  via photos.session_id = upload_sessions.id
```

### 4.4 Indexes

| Index | Table | Column(s) | Purpose |
|---|---|---|---|
| PK (clustered) | upload_sessions | id | Primary key |
| PK (clustered) | photos | id | Primary key |
| IX_photos_session_id | photos | session_id | Session lookup |
| IX_sessions_expires | upload_sessions | expires_at | Expiration queries |

---

## 5. Rate Limiting Reference

### 5.1 Limits

| Key Pattern | Endpoint | Max | Window | Lockout |
|---|---|---|---|---|
| `pin-attempt:{ip}` | validate-pin | 5 | 60s | 15 min |
| `admin-auth-fail:{ip}` | create-session (failure) | 3 | 60s | 30 min |
| `pin-creation:{ip}` | create-session (success) | 20 | 60s | None |
| `upload:{ip}` | photos/upload | 50 | 1 hour | None |

### 5.2 Response

When rate limited, the API returns:

```json
HTTP/1.1 429 Too Many Requests
Retry-After: 900

{
  "error": "Too many attempts. Try again in 900 seconds."
}
```

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
| Latitude range | -90 to 90 |
| Longitude range | -180 to 180 |

---

## 7. Document Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Federal Project Sponsor | | | |
| Technical Lead | | | |

### Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-02-07 | HHS ASPR / Leidos | Initial API and data reference |
