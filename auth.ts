/**
 * @fileoverview Auth.js v5 configuration — Entra ID (OIDC) for admin SSO.
 * PIN-based field team auth is entirely separate and not managed by Auth.js.
 */

import NextAuth from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      // Single-tenant: issuer URL locks to HHS tenant at OIDC level
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER!,
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/admin',
  },
  callbacks: {
    authorized({ auth: session, request }) {
      const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
      if (isAdminRoute) return !!session?.user
      return true
    },
  },
})
