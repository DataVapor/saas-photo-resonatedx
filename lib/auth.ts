import jwt from 'jsonwebtoken'
import { createHmac } from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const SIGNING_KEY = process.env.IMAGE_SIGNING_KEY || JWT_SECRET

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

/* ─── Signed Image URLs (CDN-safe, no JWT in query string) ─── */

/**
 * Generate a signed image URL for the blob proxy.
 * URL format: /api/photos/{id}/image?type={type}&exp={expiry}&sig={signature}
 * Signature = HMAC-SHA256(photoId:type:expiry, SIGNING_KEY)
 */
export function signImageUrl(photoId: string, type: 'thumbnail' | 'original', ttlSeconds = 86400): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const sig = createHmac('sha256', SIGNING_KEY)
    .update(`${photoId}:${type}:${exp}`)
    .digest('hex')
    .slice(0, 32) // truncate for shorter URLs
  return `/api/photos/${photoId}/image?type=${type}&exp=${exp}&sig=${sig}`
}

/**
 * Verify a signed image URL's signature and expiry.
 * Returns true if the signature is valid and not expired.
 */
export function verifyImageSignature(photoId: string, type: string, exp: string, sig: string): boolean {
  const expNum = parseInt(exp, 10)
  if (isNaN(expNum) || expNum < Math.floor(Date.now() / 1000)) {
    return false // expired
  }
  const expected = createHmac('sha256', SIGNING_KEY)
    .update(`${photoId}:${type}:${exp}`)
    .digest('hex')
    .slice(0, 32)
  return sig === expected
}
