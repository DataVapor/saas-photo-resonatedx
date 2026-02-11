/**
 * @fileoverview Next.js middleware — hostname redirect + Auth.js session check
 *
 * 1. If the request arrives on the App Service hostname (not Front Door),
 *    redirect to the Front Door URL before any auth flow starts.
 * 2. Delegates admin route protection to Auth.js authorized() callback.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/auth'

/**
 * Parse the Front Door hostname from AUTH_URL at startup.
 * In production AUTH_URL = "https://cdn-asprphotos-app-....azurefd.net"
 * In development AUTH_URL is unset, so AFD_HOSTNAME = null (no redirect).
 */
const AFD_HOSTNAME = (() => {
  try {
    return process.env.AUTH_URL
      ? new URL(process.env.AUTH_URL).hostname
      : null
  } catch {
    return null
  }
})()

export default auth((req) => {
  // X-Forwarded-Host is set by Front Door to the client-facing hostname.
  // When Front Door proxies to App Service, Host = origin hostname,
  // so we must check X-Forwarded-Host first to avoid redirect loops.
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''

  // Redirect App Service direct access → Front Door
  if (AFD_HOSTNAME && !host.includes(AFD_HOSTNAME)) {
    const url = req.nextUrl.clone()
    url.hostname = AFD_HOSTNAME
    url.port = ''
    url.protocol = 'https'
    return NextResponse.redirect(url, 308)
  }

  // Auth.js authorized() callback already evaluated by this point.
  return NextResponse.next()
})

export const config = {
  matcher: ['/admin/:path*'],
}
