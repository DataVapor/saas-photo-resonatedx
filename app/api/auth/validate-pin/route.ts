import { query } from '@/lib/db'
import { signToken } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'
import { validation, secureErrorResponse, createAuditLog } from '@/lib/security'

export async function POST(req: Request) {
  try {
    // Get client IP for rate limiting
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitKey = `pin-attempt:${ip}`

    // Rate limit: 5 attempts per minute, then 15 min lockout
    const limit = rateLimit(rateLimitKey, {
      maxAttempts: 5,
      windowMs: 60 * 1000,
      lockoutMs: 15 * 60 * 1000,
    })

    if (!limit.allowed) {
      // Log rate limit exceeded
      console.warn(`⚠️ Rate limit exceeded for PIN validation from ${ip}`)
      return Response.json(
        { error: `Too many attempts. Try again in ${limit.retryAfter} seconds.` },
        {
          status: 429,
          headers: { 'Retry-After': limit.retryAfter?.toString() || '' },
        }
      )
    }

    const { pin } = await req.json()

    // OWASP: Input Validation
    const validation_result = validation.validatePin(pin)
    if (!validation_result.valid) {
      // Log failed validation
      const auditLog = createAuditLog('AUTH_FAILURE', req, {
        reason: 'Invalid PIN format',
        remainingAttempts: limit.remaining,
      })
      console.warn('AUTH_FAILURE:', auditLog)
      
      return Response.json({ error: validation_result.error }, { status: 400 })
    }
    const result = await query(
      `SELECT id, team_name FROM upload_sessions
       WHERE pin = @pin
       AND expires_at > GETUTCDATE()`,
      { pin }
    )

    if (result.rows.length === 0) {
      // Log failed PIN validation
      const auditLog = createAuditLog('AUTH_FAILURE', req, {
        reason: 'Invalid or expired PIN',
        remainingAttempts: limit.remaining,
      })
      console.warn('AUTH_FAILURE:', auditLog)
      
      return Response.json(
        { error: `Invalid or expired PIN. ${limit.remaining} attempts remaining.` },
        { status: 401 }
      )
    }

    const sessionId = result.rows[0].id
    const teamName = result.rows[0].team_name
    const token = signToken({ sessionId }, '24h')

    // Log successful authentication
    const auditLog = createAuditLog('AUTH_SUCCESS', req, {
      sessionId,
      teamName,
    })
    console.log('✅ AUTH_SUCCESS:', auditLog)

    return Response.json({
      sessionId,
      teamName,
      token,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('PIN validation error:', error)
    return Response.json({ error: 'Validation failed' }, { status: 500 })
  }
}
