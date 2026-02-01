import { query } from '@/lib/db'
import { signToken } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const { pin } = await req.json()

    if (!pin || pin.length !== 6) {
      return Response.json({ error: 'Invalid PIN format' }, { status: 400 })
    }

    const result = await query(
      `SELECT id, team_name FROM upload_sessions 
       WHERE pin = $1 
       AND is_active = true 
       AND expires_at > NOW()`,
      [pin]
    )

    if (result.rows.length === 0) {
      return Response.json({ error: 'Invalid or expired PIN' }, { status: 401 })
    }

    const sessionId = result.rows[0].id
    const teamName = result.rows[0].team_name
    const token = signToken({ sessionId }, '24h')

    return Response.json({
      sessionId,
      teamName,
      token,
    })
  } catch (error) {
    console.error('PIN validation error:', error)
    return Response.json({ error: 'Validation failed' }, { status: 500 })
  }
}
