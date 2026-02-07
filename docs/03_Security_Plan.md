# Security Plan

**System Name:** ASPR Photo Repository Application
**Document Version:** 1.1
**Last Updated:** 2026-02-07
**Classification:** CUI // SP-SSP
**Owner:** HHS ASPR / Leidos

---

## 1. System Identification

| Field | Value |
|---|---|
| **System Name** | ASPR Photo Repository |
| **System Acronym** | ASPR-Photos |
| **Production URL** | https://app-aspr-photos-lab.azurewebsites.net |
| **System Owner** | HHS Administration for Strategic Preparedness and Response (ASPR) |
| **Operating Organization** | Leidos (Contractor Support) |
| **FIPS 199 Categorization** | **MODERATE** |
| **System Type** | Major Application (Web) |
| **Authorization Boundary** | Azure App Service (Linux), Azure SQL Database, Azure Blob Storage |
| **Operational Status** | Development |
| **Information System Security Officer (ISSO)** | [Designated ISSO Name] |
| **Authorizing Official (AO)** | [Designated AO Name] |

This system enables ASPR field teams to securely upload disaster-related photographs during incident response operations. As a federal agency application processing operational imagery with geospatial metadata, it is categorized at the FIPS 199 MODERATE impact level.

---

## 2. Security Categorization (FIPS 199)

| Security Objective | Impact Level | Justification |
|---|---|---|
| **Confidentiality** | Moderate | Contains operational photos from disaster response, GPS coordinates of incident locations, and authentication credentials (hashed PINs) |
| **Integrity** | Moderate | Photo evidence integrity is critical for incident documentation; metadata must accurately represent field conditions |
| **Availability** | Moderate | System must be available during active incident response operations; downtime could impair documentation of disaster conditions |

**Overall Categorization: MODERATE**

---

## 3. System Description

### 3.1 Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js | 16.1.6 |
| UI Library | React | 19.2.3 |
| Language | TypeScript | 5.x |
| Runtime | Node.js | 22.x LTS |
| Database | Azure SQL Server | Managed |
| Blob Storage | Azure Blob Storage | v12 SDK |
| Authentication (Field) | JWT (HS256) + bcrypt | jsonwebtoken 9.x, bcryptjs 3.x |
| Authentication (SSO) | Auth.js with OIDC providers | Auth.js v5 (NextAuth) |
| Identity Providers | Entra ID, Login.gov, ID.me | OIDC authorization code flow |
| Azure Identity | Azure Entra ID (Managed Identity) | DefaultAzureCredential |
| Image Processing | Sharp | 0.34.5 |
| Hosting | Azure App Service | Linux |

### 3.2 Data Types Processed

| Data Type | Sensitivity | Description |
|---|---|---|
| Disaster photographs | Moderate | Operational imagery from incident response sites |
| GPS coordinates | Moderate | Geolocation data of disaster sites and field positions |
| Incident IDs | Low | Structured identifiers for incident tracking |
| PIN credentials | High | 6-digit PINs stored as bcrypt hashes |
| JWT tokens | Moderate | Session tokens with 24-hour expiration |
| Admin tokens | High | Static fallback tokens for administrative access (deprecated by Entra ID SSO) |
| Entra ID tokens | Moderate | OIDC tokens for HHS staff authentication |
| Login.gov tokens | Moderate | OIDC tokens for federal/public user authentication |
| ID.me tokens | Moderate | OIDC tokens for external responder authentication |
| User notes | Low | Free-text annotations on uploaded photos |
| Team identifiers | Low | Team names associated with upload sessions |

### 3.3 User Types

| Role | Count | Access Level | Authentication Methods |
|---|---|---|---|
| Field Team Member (HHS) | Variable (per incident) | Upload photos, view own session gallery | Entra ID SSO or 6-digit PIN → JWT |
| Field Team Member (External) | Variable (per incident) | Upload photos, view own session gallery | Login.gov, ID.me, or 6-digit PIN → JWT |
| Administrator | Limited | Create PINs, manage sessions | Entra ID SSO (HHS tenant, admin group) |

---

## 4. Security Controls

### 4.1 Access Control (AC)

| Control | Implementation |
|---|---|
| **AC-2 Account Management** | Upload sessions created by admins with expiration (48 hours); SSO users identified by OIDC subject claims; no local persistent user accounts |
| **AC-3 Access Enforcement** | JWT Bearer tokens required for all photo operations; admin access requires Entra ID SSO (HHS tenant) with security group membership or fallback admin token |
| **AC-7 Unsuccessful Login Attempts** | 5 PIN attempts per minute per IP, then 15-minute lockout; 3 admin attempts then 30-minute lockout |
| **AC-8 System Use Notification** | Government branding (ASPR/HHS) establishes federal system context |
| **AC-11 Session Lock** | JWT tokens expire after 24 hours; session data stored in browser sessionStorage (cleared on tab close) |
| **AC-17 Remote Access** | HTTPS-only via HSTS with preload; all API endpoints require authentication |

### 4.2 Audit and Accountability (AU)

| Control | Implementation |
|---|---|
| **AU-2 Auditable Events** | AUTH_SUCCESS, AUTH_FAILURE, PIN_CREATED, UPLOAD_SUCCESS, UPLOAD_FAILURE, RATE_LIMIT_EXCEEDED |
| **AU-3 Content of Audit Records** | Timestamp, event type, IP address (x-forwarded-for), user agent, session ID, relevant details |
| **AU-6 Audit Review** | Server-side console logging with structured audit log objects; PIN creation logs last 2 digits only |
| **AU-8 Time Stamps** | ISO 8601 timestamps from server clock (`new Date().toISOString()`) |

#### Audit Events Detail

| Event | Trigger | Data Logged |
|---|---|---|
| `AUTH_SUCCESS` | Successful PIN validation | sessionId, teamName, IP, userAgent |
| `AUTH_FAILURE` | Invalid PIN or format | reason, remainingAttempts, IP |
| `PIN_CREATED` | New PIN generated | teamName, last 2 PIN digits, IP |
| `UPLOAD_SUCCESS` | Photo uploaded | photoId, fileSize, sessionId |
| `UPLOAD_FAILURE` | Upload validation failed | reason, sessionId, IP |
| `RATE_LIMIT_EXCEEDED` | Rate limit triggered | endpoint type, IP |

### 4.3 Identification and Authentication (IA)

| Control | Implementation |
|---|---|
| **IA-2 User Identification** | Field teams identified by session ID (PIN) or OIDC subject claim (SSO); admins identified by Entra ID principal |
| **IA-2(1) Multi-Factor Auth (Privileged)** | Entra ID enforces MFA per HHS tenant policy for admin users |
| **IA-2(2) Multi-Factor Auth (Non-Privileged)** | Login.gov requires phishing-resistant MFA; ID.me requires MFA; PIN auth is single-factor (mitigated by rate limiting and expiration) |
| **IA-5 Authenticator Management** | PINs generated via CSPRNG, bcrypt-hashed, 48h expiry; OIDC tokens managed by identity providers per their policies |
| **IA-6 Authenticator Feedback** | PIN input shows dots/asterisks; remaining attempts displayed on failure; OIDC login uses provider-hosted UI |
| **IA-8 Identification (Non-Org Users)** | External responders authenticate via Login.gov (GSA) or ID.me; both provide verified identity claims via OIDC |

#### PIN Security Details

- **Generation:** `crypto.randomInt(100000, 999999)` — NIST SP 800-63B compliant CSPRNG
- **Storage:** bcrypt hash with 10 salt rounds in NVARCHAR(72) column
- **Comparison:** `bcrypt.compare()` — constant-time comparison inherent to bcrypt
- **Expiration:** 48 hours from creation
- **Distribution:** Plaintext PIN returned once at creation, communicated verbally to field team
- **Admin Token Comparison:** `crypto.timingSafeEqual()` — prevents timing attacks (fallback mode only)

#### OIDC Identity Provider Security

| Provider | Protocol | Client Auth | MFA | Identity Proofing | Registration |
|---|---|---|---|---|---|
| Microsoft Entra ID | OIDC (authorization code) | Client secret | HHS tenant policy | N/A (org accounts) | Automatic (HHS staff) |
| Login.gov | OIDC (iGov Profile) | `private_key_jwt` | Required (phishing-resistant) | IAL1 or IAL2 | One-time (reusable across agencies) |
| ID.me | OIDC + PKCE | Authorization code | Required | IAL2 (verified) | One-time (reusable across partners) |

- All OIDC providers use TLS-encrypted redirect flows
- Auth.js (NextAuth v5) manages OIDC state, nonce, and PKCE verification
- OIDC tokens are validated server-side; only the application JWT is issued to the client
- Provider-issued access tokens are not stored client-side

### 4.4 System and Communications Protection (SC)

| Control | Implementation |
|---|---|
| **SC-8 Transmission Confidentiality** | HTTPS enforced via HSTS (`max-age=31536000; includeSubDomains; preload`) |
| **SC-12 Cryptographic Key Management** | JWT_SECRET, ADMIN_TOKEN, and OIDC client secrets via environment variables (Key Vault recommended); Login.gov uses `private_key_jwt` with asymmetric keys |
| **SC-13 Cryptographic Protection** | JWT HS256 for session tokens; bcrypt for PINs; HMAC-SHA256 for signed image URLs; OIDC providers enforce TLS and token signing |
| **SC-28 Protection of Information at Rest** | Azure SQL TDE (transparent data encryption); Azure Blob Storage encryption at rest |

#### Security Headers

All responses include hardened headers via `next.config.ts`:

| Header | Value | Purpose |
|---|---|---|
| Strict-Transport-Security | `max-age=31536000; includeSubDomains; preload` | Force HTTPS |
| X-Content-Type-Options | `nosniff` | Prevent MIME sniffing |
| X-Frame-Options | `DENY` | Prevent clickjacking |
| X-XSS-Protection | `1; mode=block` | Legacy XSS protection |
| Referrer-Policy | `strict-origin-when-cross-origin` | Limit referrer data |
| Permissions-Policy | `camera=(), microphone=(), geolocation=(self), payment=()` | Feature restrictions |
| Content-Security-Policy | `default-src 'self'; img-src 'self' https: data: blob:; ...` | Resource restrictions |
| X-Powered-By | Suppressed | Hide server technology |

### 4.5 System and Information Integrity (SI)

| Control | Implementation |
|---|---|
| **SI-2 Flaw Remediation** | Automated dependency updates; GitHub Actions CI/CD for rapid deployment |
| **SI-3 Malicious Code Protection** | File type validation (JPEG/PNG/WebP only); filename sanitization; max size enforcement (50 MB) |
| **SI-4 System Monitoring** | Console-based audit logging; Azure App Service diagnostic logs |
| **SI-10 Information Input Validation** | Server-side validation for all inputs (PINs, team names, coordinates, notes, incident IDs, filenames) |

---

## 5. OWASP Top 10 (2021) Compliance

| # | Vulnerability | Mitigation |
|---|---|---|
| A01 | Broken Access Control | JWT verification on every API call; session-scoped photo access; Entra ID SSO with group-based RBAC for admin; timing-safe fallback token |
| A02 | Cryptographic Failures | HTTPS enforced; bcrypt for PINs; JWT HS256; HMAC-SHA256 signed URLs; OIDC tokens validated server-side |
| A03 | Injection | Parameterized SQL queries (mssql `request.input()`); no string concatenation in queries |
| A04 | Insecure Design | Rate limiting on all auth endpoints; session expiration; input validation |
| A05 | Security Misconfiguration | Security headers on all responses; X-Powered-By suppressed; source maps disabled |
| A06 | Vulnerable Components | npm dependency management; version-locked packages |
| A07 | Identification & Auth Failures | bcrypt hashing; JWT expiration; rate limiting with lockout; OIDC SSO with MFA (Entra ID, Login.gov, ID.me) |
| A08 | Software & Data Integrity | CI/CD pipeline; GitHub version control; OIDC deployment authentication |
| A09 | Security Logging & Monitoring | Structured audit logging for all security events |
| A10 | Server-Side Request Forgery | No user-controlled URL fetching; image proxy validates signed URLs only |

---

## 6. Rate Limiting Strategy

### 6.1 Configuration

| Endpoint | Max Attempts | Window | Lockout Duration |
|---|---|---|---|
| `POST /api/auth/validate-pin` | 5 | 60 seconds | 15 minutes |
| Admin token failures | 3 | 60 seconds | 30 minutes |
| `POST /api/auth/create-session` | 20 | 60 seconds | None |
| `POST /api/photos/upload` | 50 | 1 hour | None |

### 6.2 Implementation

- **Storage:** In-memory `Map<string, RateLimitEntry>`
- **Key:** Per-IP address (`x-forwarded-for` header)
- **Cleanup:** Automatic entry expiration every 5 minutes (entries older than 1 hour)
- **Response:** HTTP 429 with `Retry-After` header

### 6.3 Future Enhancement

- Migrate to Redis for distributed rate limiting across multiple App Service instances
- Implement Azure Front Door WAF rules for network-level protection

---

## 7. Data Protection

### 7.1 Data at Rest

| Data | Protection | Location |
|---|---|---|
| Photos (original + thumbnail) | Azure Storage Service Encryption (AES-256) | Azure Blob Storage |
| Photo metadata | Azure SQL TDE (AES-256) | Azure SQL Database |
| PIN hashes | bcrypt (10 rounds) | Azure SQL Database |
| Secrets (JWT_SECRET, ADMIN_TOKEN) | Azure Key Vault (recommended) | Environment variables |

### 7.2 Data in Transit

| Channel | Protection |
|---|---|
| Client ↔ App Service | TLS 1.2+ via HSTS |
| App Service ↔ SQL | TLS 1.2 (Azure managed) |
| App Service ↔ Blob Storage | TLS 1.2 (Azure managed) |

### 7.3 Data Minimization

- PINs stored as irreversible bcrypt hashes (plaintext returned once at creation only)
- Audit logs record only last 2 digits of PINs
- JWT tokens contain only `sessionId` — no PII
- GPS coordinates are optional (user-provided)
- No persistent user accounts or profiles

---

## 8. Incident Response

### 8.1 Security Event Detection

| Event | Detection Method | Response |
|---|---|---|
| Brute force PIN attack | Rate limit exceeded logging | Automatic IP lockout (15 min) |
| Brute force admin attack | Rate limit exceeded + security alert | Automatic IP lockout (30 min) |
| Invalid file upload | Input validation failure logging | Request rejected with 400 |
| Unauthorized access attempt | JWT verification failure | Request rejected with 401 |

### 8.2 Escalation Procedures

1. **Automated Response:** Rate limiting and lockout mechanisms
2. **Log Review:** Check server logs for patterns of malicious activity
3. **Manual Response:** Rotate ADMIN_TOKEN, JWT_SECRET, and OIDC client secrets if compromise suspected; revoke Entra ID app registration if needed
4. **Notification:** Alert ISSO and system owner per HHS incident response procedures

---

## 9. Compliance Summary

| Standard | Status | Notes |
|---|---|---|
| FIPS 199 | Compliant | MODERATE categorization documented |
| NIST SP 800-53 (Rev 5) | Partial | Key controls implemented (AC, AU, IA, SC, SI); IA-2 enhanced with OIDC MFA via Entra ID, Login.gov, ID.me |
| NIST SP 800-63B | Compliant | CSPRNG for PIN generation, bcrypt storage |
| OWASP Top 10 (2021) | Compliant | All 10 categories addressed |
| HSTS Preload | Compliant | 1-year max-age with includeSubDomains |
| CSP Level 2 | Compliant | Restrictive Content-Security-Policy |

---

## 10. Document Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Federal Project Sponsor | | | |
| Information System Security Officer | | | |
| Authorizing Official | | | |
| Technical Lead | | | |

### Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-02-07 | HHS ASPR / Leidos | Initial security plan |
| 1.1 | 2026-02-07 | HHS ASPR / Leidos | Multi-tier authentication: Entra ID SSO, Login.gov, ID.me OIDC; updated IA controls for MFA and non-org users |
