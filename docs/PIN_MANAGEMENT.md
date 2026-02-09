# ASPR PIN Management - Admin Guide

## Overview

Administrators manage PINs for field teams exclusively through the **Web Admin Dashboard** (`/admin`), authenticated via **Microsoft Entra ID SSO**.

---

## Web Admin Dashboard

### Access the Dashboard

1. **Local Development:**
   ```
   http://localhost:3000/admin
   ```

2. **Production:**
   ```
   https://aspr-photos-lab.azurewebsites.net/admin
   ```

### Sign In

1. Navigate to the admin dashboard URL
2. Click **"Sign in with HHS"**
3. Authenticate with your **HHS Entra ID credentials** (you must be a member of the ASPR Photo Admins security group)
4. After successful SSO login, you will see the admin dashboard with the **Sessions** and **Photos** tabs

### Create a PIN

1. Go to the **Sessions** tab
2. Optionally enter a **Team Name** (e.g., "Alpha Team", "FEMA Region 4")
   - If left blank, the team name defaults to "Anonymous"
3. Click **Generate New PIN**
4. A new 6-digit PIN will be displayed
5. **Copy the PIN immediately** -- it is shown only once and cannot be retrieved later

### Features

- User-friendly web interface
- View all active sessions and PINs
- Copy PIN to clipboard
- See PIN expiration date (48 hours)
- Team identification
- Search sessions by team name
- Revoke sessions immediately

---

## PIN Lifecycle

| Status | Details |
|--------|---------|
| **Created** | PIN is issued to team via the admin dashboard |
| **Active** | PIN can be used to authenticate (up to 48 hours) |
| **Expired** | PIN automatically expires after 48 hours |
| **Revoked** | Admin manually deactivates the session via the dashboard |
| **Shared** | PINs can be reused by multiple team members on the same team |

---

## PIN Security

### How PINs Are Stored

- PINs are **hashed with bcrypt** before being stored in the database
- The plaintext PIN is displayed only once at creation time and is never recoverable
- PIN validation compares a bcrypt hash, not plaintext

### Rate Limiting

| Endpoint | Max Attempts | Window | Lockout |
|----------|-------------|--------|---------|
| PIN Validation (`/api/auth/validate-pin`) | 5 | 60 seconds | 15 minutes |
| PIN Creation (`/api/auth/create-session`) | 20 | 60 seconds | None |

- Rate limiting is enforced per IP address
- Failed PIN validation attempts are logged with the client IP

### PIN Properties

| Property | Value |
|----------|-------|
| Length | 6 numeric digits |
| Range | 100000 -- 999999 |
| Expiration | 48 hours from creation |
| Hashing | bcrypt |
| Sharing | One PIN can be shared with multiple team members |

---

## Monitoring & Logging

### Audit Trail

All PIN creation and session management actions are recorded in the immutable audit log:

| Event | Details Logged |
|-------|---------------|
| `PIN_CREATED` | Admin email (Entra ID), team name, last 2 digits of PIN, timestamp |
| `SESSION_REVOKED` | Admin email, session ID, timestamp |
| `AUTH_SUCCESS` | Successful PIN validation, IP address, timestamp |
| `AUTH_FAILURE` | Failed PIN validation, IP address, timestamp |

### Production Monitoring (Azure Application Insights)

1. Go to **App Service** > `app-aspr-photos`
2. Click **Application Insights**
3. Go to **Logs** and run:
   ```kusto
   customEvents
   | where name in ('PIN_CREATED', 'AUTH_FAILURE', 'SESSION_REVOKED')
   | order by timestamp desc
   ```

---

## Security Best Practices

### DO

- Share PINs via secure channels (encrypted email, Signal, Microsoft Teams)
- Limit PIN creation to authorized admins only (enforced by Entra ID security group membership)
- Monitor PIN creation attempts for suspicious activity
- Create a new PIN for each deployment or operation
- Revoke sessions immediately if a PIN is compromised
- Use HTTPS in production

### DON'T

- Never log full PINs (last 2 digits only)
- Never share PINs via unencrypted channels (SMS, plain email)
- Never allow public PIN creation (Entra ID SSO enforced)
- Never increase PIN validity beyond 48 hours without review

---

## Troubleshooting

### Cannot Access Admin Dashboard

**Cause:** You are not a member of the ASPR Photo Admins Entra ID security group.

**Fix:** Contact your Azure AD administrator to be added to the security group.

### "Rate limit exceeded" After Creating 20+ PINs/Min

**Cause:** PIN creation rate limit (20 per minute)

**Fix:** Wait 60 seconds before creating more PINs.

### PIN Not Working for Field Team

**Possible causes:**
- PIN has expired (48-hour lifetime)
- Session was revoked by an admin
- Field team member exceeded 5 failed attempts (15-minute lockout)

**Fix:** Create a new PIN from the admin dashboard and distribute it to the team.

---

## Support

For issues or questions:
1. Check this guide (PIN Management section)
2. Review the SECURITY.md file for rate limiting details
3. Check Azure Application Insights logs
4. Contact the ASPR team

---

## Quick Reference

| Task | How |
|------|-----|
| Create a PIN | Sign in at `/admin` with Entra ID, go to Sessions tab, click Generate New PIN |
| View active sessions | Sign in at `/admin`, Sessions tab shows all sessions with status |
| Revoke a session | Sign in at `/admin`, find the session, click Revoke |
| Search sessions | Use the search bar in the Sessions tab to filter by team name |
| Access dashboard (local) | `http://localhost:3000/admin` |
| Access dashboard (prod) | `https://aspr-photos-lab.azurewebsites.net/admin` |
