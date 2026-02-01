import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

export interface TokenPayload {
  sessionId: string
  iat?: number
  exp?: number
}

export function signToken(payload: Omit<TokenPayload, 'iat' | 'exp'>, expiresIn: string = '24h'): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn } as any)
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload
    return decoded
  } catch (error) {
    throw new Error('Invalid or expired token')
  }
}
