# User Guide

**ASPR Photo Repository Application**

| Field | Value |
|---|---|
| System Name | ASPR Photo Repository |
| Document Version | 1.0 |
| Last Updated | 2026-02-07 |
| Owner | HHS ASPR / Leidos |

---

## 1. Introduction

### 1.1 What Is the ASPR Photo Repository?

The ASPR Photo Repository is a secure web application that allows Administration for Strategic Preparedness and Response (ASPR) field teams to upload, manage, and review disaster-related photographs during incident response operations. Photos can be tagged with GPS coordinates, incident IDs, and descriptive notes.

### 1.2 Who Is This Guide For?

| User Role | Sections |
|---|---|
| **Field Team Members** | Sections 2–5 (Login, Photo Upload, Gallery, Tips) |
| **Administrators** | Sections 6–7 (Admin Dashboard, CLI Tools) |

### 1.3 Browser Requirements

| Browser | Minimum Version | Notes |
|---|---|---|
| Google Chrome | 100+ | Recommended |
| Microsoft Edge | 100+ | Recommended for HHS devices |
| Safari | 16+ | iOS and macOS |
| Firefox | 100+ | Supported |

The application is mobile-responsive and optimized for field use on smartphones and tablets.

---

## 2. Getting Started (Field Teams)

### 2.1 Accessing the Application

Navigate to the application URL provided by your administrator:

```
https://app-aspr-photos-lab.azurewebsites.net
```

You will see the welcome screen with ASPR branding and a "Get Started" button.

### 2.2 PIN Login

1. Tap **Get Started** on the welcome screen
2. Enter the **6-digit PIN** provided by your operations administrator
3. The PIN auto-advances when all 6 digits are entered
4. On success, you will be taken to the photo upload screen

**Important:**
- PINs expire after **48 hours** — request a new one if yours has expired
- You have **5 attempts** per minute before a 15-minute lockout
- Remaining attempts are displayed after each failed login
- PINs are shared per team — all members of your team use the same PIN

### 2.3 Session Information

After logging in:
- Your **team name** is displayed at the top of the screen
- Your session is valid for **24 hours**
- Closing the browser tab will end your session
- You can log out at any time using the **Log Out** button

---

## 3. Uploading Photos

### 3.1 Step 1: Select Photos

1. After PIN login, you will see the **photo selection** screen
2. Tap the **camera/upload area** to:
   - **Take a photo** using your device camera (mobile)
   - **Select files** from your device (desktop or mobile)
3. Supported formats: **JPEG, PNG, WebP**
4. Maximum file size: **50 MB per photo**
5. You can select **multiple photos** at once
6. Selected photos appear in a preview strip at the bottom
7. Tap **Continue** when ready to add metadata

### 3.2 Step 2: Add Metadata

The metadata screen allows you to tag your photos with important incident information:

| Field | Required | Description |
|---|---|---|
| **Incident ID** | No | Incident identifier (e.g., HU-2024-001) |
| **GPS Location** | No | Latitude and longitude coordinates |
| **Notes** | No | Free-text description (max 1,000 characters) |

#### Adding GPS Coordinates

**Automatic (Recommended):**
1. Tap the **GPS pin icon** button
2. Allow browser location access when prompted
3. Coordinates will auto-populate

**Manual Entry:**
1. Enter latitude and longitude directly in the coordinate fields
2. Valid ranges: Latitude -90 to 90, Longitude -180 to 180

**ZIP Code Lookup:**
1. Enter a 5-digit ZIP code in the ZIP field
2. Tap **Go** to look up approximate coordinates

### 3.3 Step 3: Upload

1. Tap the **Upload Photos** button
2. Photos upload sequentially with a progress indicator
3. Each photo is processed: original stored + thumbnail generated
4. Upload progress shows "Uploading X of Y..."
5. On completion, the success screen displays the number of photos uploaded

### 3.4 After Upload

From the success screen, you can:
- **Take More Photos** — return to the photo selection step
- **View Gallery** — go to the gallery to review your uploads

---

## 4. Photo Gallery

### 4.1 Accessing the Gallery

Navigate to `/gallery` or tap **View Gallery** after uploading. The gallery shows all photos uploaded during your current session.

### 4.2 Gallery Features

| Feature | Description |
|---|---|
| **Thumbnail Grid** | Photos displayed in a responsive grid layout |
| **Photo Details** | Tap a photo to see full details (filename, size, dimensions, metadata) |
| **Download** | Download the original full-resolution image |
| **Delete** | Remove a photo (requires confirmation) |
| **Filter** | Filter photos by incident ID |

### 4.3 Downloading Photos

1. Tap the **Download** button on a photo card
2. The original full-resolution image will download to your device
3. Downloads use signed URLs that expire after 24 hours

### 4.4 Deleting Photos

1. Tap the **Delete** button on a photo card
2. Confirm the deletion when prompted
3. Both the original image and thumbnail are permanently removed
4. **This action cannot be undone**

---

## 5. Photography Tips

### 5.1 Best Practices for Field Photography

- **Steady shots:** Hold your device steady or brace against a surface
- **Good lighting:** Face the light source; avoid shooting into the sun
- **Multiple angles:** Capture wide shots and close-ups of damage
- **Include context:** Show surrounding area for scale and location reference
- **GPS tagging:** Enable GPS for every photo when possible
- **Incident ID:** Always tag photos with the correct incident identifier
- **Descriptive notes:** Add notes describing what the photo shows

### 5.2 File Size Considerations

- Photos larger than 50 MB cannot be uploaded
- Standard smartphone photos (12–50 MP) are typically 3–15 MB
- JPEG format is recommended for the best balance of quality and file size
- The system generates WebP thumbnails automatically

---

## 6. Admin Dashboard

### 6.1 Accessing the Admin Dashboard

1. Navigate to `/admin`
2. Enter the **admin authentication token** provided by system operations
3. Tap **Authenticate**

### 6.2 Creating a PIN

1. After authentication, you will see the PIN creation dashboard
2. Optionally enter a **Team Name** (e.g., "Alpha Team", "FEMA Region 4")
   - If left blank, the team name defaults to "Anonymous"
3. Tap **Generate New PIN**
4. A new 6-digit PIN will be displayed
5. **Copy the PIN immediately** — it is shown only once and cannot be retrieved later

### 6.3 PIN Details

| Property | Value |
|---|---|
| Length | 6 numeric digits |
| Expiration | 48 hours from creation |
| Sharing | One PIN can be shared with multiple team members |
| Storage | PIN is stored as a bcrypt hash — plaintext is not recoverable |

### 6.4 PIN Distribution

- Communicate the PIN to field teams **verbally or via secure channel**
- Do not send PINs via unencrypted email
- A new PIN should be created for each deployment/operation
- Expired PINs cannot be reactivated — create a new one

---

## 7. Admin CLI Tool

### 7.1 Overview

For administrators who prefer command-line tools, the `scripts/admin-cli.js` utility provides PIN management capabilities.

### 7.2 Usage

```bash
# Create a new PIN with default team name
node scripts/admin-cli.js create

# Create a PIN with custom team name
node scripts/admin-cli.js create --team "Hurricane Response Team"
```

### 7.3 Requirements

- Node.js 22+ installed
- `ADMIN_TOKEN` environment variable set (or passed via `--token` flag)
- Network access to the application API endpoint

---

## 8. Troubleshooting

### 8.1 Common Issues

| Problem | Solution |
|---|---|
| "Invalid or expired PIN" | Request a new PIN from your admin; PINs expire after 48 hours |
| "Too many attempts" | Wait 15 minutes, then try again |
| Upload fails | Check file is JPEG/PNG/WebP and under 50 MB |
| Photos not showing in gallery | Refresh the page; ensure you are logged in |
| GPS not working | Allow location access in browser settings |
| Page won't load | Check internet connection; try a different browser |
| Session expired | Log in again with your PIN (if still valid) |

### 8.2 Getting Help

Contact your system administrator or the ASPR IT support desk for assistance with:
- PIN generation and distribution
- Application access issues
- Technical problems with uploads

---

## 9. Document Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Federal Project Sponsor | | | |
| Operations Lead | | | |

### Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-02-07 | HHS ASPR / Leidos | Initial user guide |
