import { v4 as uuid } from 'uuid'
import { query } from '@/lib/db'

function generatePin(): string {
  return Math.random().toString().slice(2, 8) // 6 digits
}

export async function POST(req: Request) {
  try {
    const { teamName } = await req.json()

    // Check if caller is admin (simple header auth for setup)
    const adminToken = req.headers.get('x-admin-token')
    if (adminToken !== process.env.ADMIN_TOKEN) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pin = generatePin()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const result = await query(
      `INSERT INTO upload_sessions (pin, team_name, expires_at) 
       VALUES ($1, $2, $3) 
       RETURNING id, pin, team_name`,
      [pin, teamName || 'Anonymous', expiresAt]
    )

    return Response.json(result.rows[0])
  } catch (error) {
    console.error('PIN creation error:', error)
    return Response.json({ error: 'Failed to create PIN' }, { status: 500 })
  }
}
