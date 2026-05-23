import { FastifyInstance } from 'fastify'
import { requireAuth } from '../lib/auth'

// Auth (sign-in, sign-up, sign-out) is handled by Clerk on the frontend.
// This module exposes a single read endpoint so the SPA can fetch the joined
// Clerk + local user profile in one call.
export default async function authRoutes(app: FastifyInstance) {
  app.get('/me', { preHandler: requireAuth }, async (req) => {
    const user = (req as any).user
    return {
      user: {
        _id: user._id,
        clerkUserId: user.clerkUserId,
        email: user.email,
        name: user.name,
        plan: user.plan,
        isActive: user.isActive,
      },
    }
  })
}
