# ASPR Photo Repository — Project Charter

**Project Name:** ASPR Photo Repository (BETA)
**Date:** February 9, 2026
**Version:** 1.0
**Classification:** For Official Use Only

---

## Project Team

| Role | Name | Organization |
|---|---|---|
| **Executive Sponsor** | DeRamus Smart | ASPR |
| **Federal Lead (Business)** | Elizabeth Jarret | ASPR |
| **Federal Lead (Technical)** | Timothy Miller | OCIO |
| **Systems Architect** | Solomon Freeman | OCIO |
| **Azure Engineer** | Ravinder Mathaudhu | OCIO |
| **Infrastructure and Development Support** | Ravinder Mathaudhu | Leidos, Inc. (OCIO Contractor) |

> **Access and Development Policy:** All source code, Azure infrastructure, CI/CD pipelines, and system administration are owned and managed exclusively by OCIO personnel. ASPR serves as the business stakeholder and end-user customer. ASPR staff do not have access to the codebase, deployment pipelines, or underlying cloud resources. All change requests, feature enhancements, and bug fixes must be submitted through OCIO and will be prioritized, developed, and deployed by the OCIO development team.

---

## 1. Purpose

This charter authorizes the development, deployment, and operation of the **ASPR Photo Repository** — a secure, web-based application enabling Administration for Strategic Preparedness and Response (ASPR) field teams to capture, upload, and manage disaster-related photographs during incident response operations. The system includes a full-featured admin dashboard for photo management, tag-based organization, bulk operations, and compliance audit logging. Administrators review, curate, and approve photos through the admin dashboard, then submit approved images to the designated M365 SharePoint Online document library, which serves as the official system of record for ASPR incident photography.

---

## 2. Business Justification

ASPR field teams require rapid, secure photo documentation during disaster and emergency response operations. Existing workflows for collecting and managing incident photos are fragmented, lack audit trails, and do not provide centralized access for headquarters review.

The ASPR Photo Repository provides:

- Multi-tier authentication supporting field teams (PIN), HHS staff (single sign-on), and external responders (Login.gov, ID.me — planned)
- Drag-and-drop photo upload with automatic metadata extraction (GPS coordinates, timestamps, camera info)
- Automatic image optimization generating multiple sizes for fast viewing across devices
- Secure image delivery through a global content delivery network
- Full-featured admin dashboard with photo grid, bulk operations, photo editor, and tag management
- Efficient handling of large photo collections
- Admin-curated publishing of approved photos to M365 SharePoint Online as the official system of record
- Immutable audit trail for all administrative actions
- Enterprise-grade security with web application firewall, geo-fencing, and private networking

---

## 3. Scope

### In Scope

- Multi-step photo upload wizard with metadata capture (incident ID, GPS coordinates, location, notes)
- Multi-tier authentication: PIN for field teams, HHS single sign-on for admins, Login.gov and ID.me for external responders (planned)
- Automatic metadata extraction and storage (GPS, camera model, timestamp, orientation)
- Automatic image optimization generating multiple sizes for web viewing
- Admin dashboard with photo grid, detail sidebar, and metadata editing
- Photo editor with crop, rotate, and annotation tools
- Bulk operations: delete, tag, status changes, ZIP download
- Tag-based photo organization with category support
- Session/PIN management with expiration and revocation
- Admin curation and approval workflow to submit approved photos to M365 SharePoint Online (system of record)
- Enterprise security: web application firewall, geo-fencing, content delivery, and private networking
- Azure cloud-native deployment
- Automated build and deployment pipeline

### Out of Scope

- Video capture or upload (photos only)
- Real-time collaboration or annotation sharing
- Integration with FEMA or other external incident management systems (future enhancement)
- Offline or mobile-native application
- Facial recognition or automated image classification

---

## 4. Key Deliverables

| Deliverable | Status |
|---|---|
| ASPR Photo Repository web application (upload wizard + admin dashboard) | MVP Deployed |
| Azure cloud hosting infrastructure | MVP Deployed |
| Database for photo metadata, sessions, and audit records | MVP Deployed |
| Secure photo storage with multi-rendition image processing | MVP Deployed |
| Content delivery network with edge caching | MVP Deployed |
| Web Application Firewall and DDoS protection | MVP Deployed |
| Geo-fencing (US-only access) | MVP Deployed |
| Network isolation via private endpoints | MVP Deployed |
| HHS single sign-on (Entra ID) for admin dashboard | MVP Deployed |
| PIN-based authentication for field teams | MVP Deployed |
| Automated build and deployment pipeline | MVP Deployed |
| SharePoint Online integration (system of record for approved photos) | Pending |
| Login.gov / ID.me integration for external responders | Pending |
| Custom domain configuration | Pending |
| BETA user acceptance testing | Pending |
| Production release | Pending |
| Software Requirements Specification (SRS) | In Progress |
| System Design Document (SDD) | In Progress |
| System Security Plan (SSP) | In Progress |
| Deployment & Operations Guide | In Progress |
| User Guide | In Progress |
| API Reference | In Progress |

---

## 5. Architecture Overview

The ASPR Photo Repository is a cloud-native web application hosted entirely within the HHS Azure environment. The system is designed for high availability, security, and performance.

| Component | Description |
|---|---|
| **Web Application** | Hosted on Azure App Service within the OCIO shared infrastructure |
| **Database** | Azure SQL Database for metadata, user sessions, and audit records |
| **Photo Storage** | Azure Blob Storage for secure, scalable photo storage |
| **Content Delivery** | Azure Front Door Premium with global edge caching for fast image delivery |
| **Security Layer** | Web Application Firewall (WAF), geo-fencing, and DDoS protection |
| **Secrets Management** | Azure Key Vault for secure credential storage |
| **Networking** | All backend resources communicate over private network connections (no public endpoints) |
| **System of Record** | M365 SharePoint Online document library for approved, finalized photos |

> **Note:** Detailed resource names, configuration, and infrastructure diagrams are maintained in the System Design Document and Deployment & Operations Guide (OCIO internal use only).

---

## 6. Security Posture

| Control | Description |
|---|---|
| **Encryption in Transit** | All data encrypted using TLS 1.2+ between every component |
| **Encryption at Rest** | Industry-standard AES-256 encryption for all stored data and photos |
| **Field Team Authentication** | Secure PIN-based access with encrypted credentials and automatic lockout after failed attempts |
| **Admin Authentication** | HHS single sign-on via Microsoft Entra ID (HHS personnel only) |
| **External Responder Auth** | Login.gov and ID.me integration (planned) |
| **Web Application Firewall** | Protection against OWASP Top 10 threats and automated bot traffic |
| **Geo-Fencing** | Access restricted to United States only |
| **Network Isolation** | All backend resources accessible only through private network connections |
| **DDoS Protection** | Azure-native distributed denial-of-service protection |
| **Input Validation** | File type and size validation; protection against injection attacks |
| **Rate Limiting** | Automatic throttling and lockout to prevent brute-force attempts |
| **Secure Image Access** | Time-limited signed URLs for photo retrieval |
| **Audit Logging** | Immutable record of all administrative actions with timestamps and user identity |

> **Note:** Detailed security configurations, thresholds, and implementation specifics are documented in the System Security Plan (OCIO internal use only).

---

## 7. Image Processing

When photos are uploaded, the system automatically generates multiple optimized versions for different viewing contexts:

| Version | Purpose |
|---|---|
| **Original** | Full-resolution archival copy preserved as uploaded |
| **Small Thumbnail** | Compact preview for photo grid and search results |
| **Medium Thumbnail** | Larger preview for detail panels and selection views |
| **Web-Optimized** | High-quality version optimized for full-screen browser viewing |

All photo versions are stored securely in Azure cloud storage and delivered through the content delivery network for fast access across the continental United States.

---

## 8. Milestones

| Milestone | Target Date | Status |
|---|---|---|
| Application development complete | February 2026 | Complete |
| Azure cloud infrastructure deployment | January 2026 | Complete |
| Database and storage integration | January 2026 | Complete |
| Image optimization pipeline | February 2026 | Complete |
| Security layer deployment (WAF, geo-fencing, CDN, private networking) | February 2026 | Complete |
| Admin dashboard (photo grid, editor, bulk operations, tags) | February 2026 | Complete |
| HHS single sign-on for admin dashboard | February 2026 | Complete |
| Automated deployment pipeline | February 2026 | Complete |
| Project documentation suite | February 2026 | Complete |
| SharePoint Online integration (approved photo publishing) | TBD | Planned |
| Login.gov / ID.me integration | TBD | Planned |
| Custom domain configuration | TBD | Pending DNS Admin |
| BETA user acceptance testing | TBD | Pending |
| Production release | TBD | Pending |

---

## 9. Success Criteria

- [ ] Application accessible via secure public endpoint
- [ ] Photo upload wizard captures metadata and generates optimized image versions
- [ ] Location, camera, and timestamp data extracted and stored automatically
- [ ] PIN-based authentication grants field team access correctly
- [ ] HHS single sign-on authenticates admins and protects admin routes
- [ ] Admin photo grid renders efficiently with large photo collections
- [ ] Bulk operations (delete, tag, download) execute correctly
- [ ] Photo editor (crop, rotate, annotate) functions correctly
- [ ] Images delivered through content delivery network with secure access controls
- [ ] Web application firewall blocks common attack patterns
- [ ] Geo-fencing restricts access to United States only
- [ ] All backend resources isolated on private network (no public endpoints)
- [ ] Admin-approved photos successfully submitted to SharePoint Online document library
- [ ] Audit log captures all administrative and authentication events

---

## 10. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Large photo uploads (up to 50 MB) may timeout on slow field connections | Medium | Low | Upload progress tracking; chunked upload recommended for future |
| Custom domain configuration delayed by DNS administration | Medium | Low | Application fully functional via default secure endpoint |
| Login.gov / ID.me integration timeline uncertain | Medium | Medium | PIN-based authentication provides fallback for external responders |
| Shared database infrastructure during BETA phase | Low | Low | Logical separation adequate for BETA; dedicated resources recommended for production |
| SharePoint Online integration requires M365 Graph API permissions and ASPR site provisioning | Medium | Medium | Coordinate with ASPR and M365 admin teams early; photos remain accessible in the application until integration is complete |
| No automated test suite during BETA | Medium | Medium | Recommend automated unit and end-to-end testing before production release |

---

## 11. Assumptions and Constraints

### Assumptions

- Disaster photos are operational documentation, not classified material
- ASPR field teams access the application from mobile devices and laptops in the field
- External responders (non-HHS) will use Login.gov or ID.me for authentication when available
- Custom domain DNS is managed by a separate HHS DNS administration team
- Azure hosting infrastructure is shared across OCIO microsite projects
- An ASPR-designated M365 SharePoint Online document library is available as the system of record for approved photos

### Constraints

- Photo uploads limited to JPEG, PNG, and WebP formats (up to 50 MB per file)
- Geo-fenced to US-only traffic during BETA phase
- Field team PINs expire after 48 hours (configurable for field operations context)
- Custom domain requires DNS admin action outside the project team's control

---

## 12. Authorization

By signing below, I authorize the project team to proceed with the deployment and operation of the ASPR Photo Repository as described in this charter and its supporting documentation.

| Role | Name | Organization | Signature | Date |
|---|---|---|---|---|
| **Executive Sponsor** | DeRamus Smart | ASPR | __________________ | ________ |
| **Federal Lead (Business)** | Elizabeth Jarret | ASPR | __________________ | ________ |
| **Federal Lead (Technical)** | Timothy Miller | OCIO | __________________ | ________ |

---

### Supporting Documentation

| Document | Audience |
|---|---|
| Software Requirements Specification (SRS) | Stakeholder |
| User Guide | Stakeholder |
| System Design Document (SDD) | OCIO Internal |
| System Security Plan (SSP) | OCIO Internal |
| Deployment & Operations Guide | OCIO Internal |
| API & Data Reference | OCIO Internal |

---

*This charter is maintained by the OCIO development team at the U.S. Department of Health and Human Services.*
