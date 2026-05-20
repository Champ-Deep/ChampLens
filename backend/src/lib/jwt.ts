import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me'
const EXPIRES = process.env.JWT_EXPIRES_IN ?? '7d'

export function signToken(payload: { userId: string }) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES } as any)
}

export function verifyToken(token: string): { userId: string } {
  return jwt.verify(token, SECRET) as { userId: string }
}
