import { auth } from '@/auth'

export interface AdminContext {
  isAuthorized: boolean
  adminEmail: string | null
  authMethod: 'entra_id' | null
}

/**
 * Verify admin authorization via Entra ID session.
 * Returns the admin context with auth method and identity.
 */
export async function requireAdmin(req: Request): Promise<AdminContext> {
  const session = await auth()
  if (session?.user) {
    return {
      isAuthorized: true,
      adminEmail: session.user.email || session.user.name || 'admin',
      authMethod: 'entra_id',
    }
  }

  return { isAuthorized: false, adminEmail: null, authMethod: null }
}

/**
 * Guard helper — returns 401 Response if not authorized, null if OK.
 */
export async function guardAdmin(req: Request): Promise<{ ctx: AdminContext; error?: Response }> {
  const ctx = await requireAdmin(req)
  if (!ctx.isAuthorized) {
    return { ctx, error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { ctx }
}
