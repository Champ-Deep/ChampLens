import { FastifyRequest, FastifyReply } from 'fastify'
import { getAuth, clerkClient } from '@clerk/fastify'
import mongoose from 'mongoose'
import User, { IUser } from '../models/User'

// Find-or-create the local Mongo User row that mirrors a Clerk user.
// We sync email + name from Clerk on first hit, then trust the local row.
//
// Defensive against: Clerk returning a partial user, races where two requests
// try to create the same user concurrently (E11000 duplicate key), and the
// stale email-unique index that may still live on Mongo from the pre-Clerk
// schema (we now key on clerkUserId; the old email-unique index would 500
// any second user with the same email — handled by findOneAndUpdate upsert).
async function syncLocalUser(clerkUserId: string): Promise<IUser> {
  const existing = await User.findOne({ clerkUserId })
  if (existing) return existing

  let clerkUser
  try {
    clerkUser = await clerkClient.users.getUser(clerkUserId)
  } catch (err) {
    throw new Error(`Clerk getUser(${clerkUserId}) failed: ${(err as Error).message}`)
  }

  const emails = clerkUser.emailAddresses ?? []
  const primaryEmail =
    emails.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    emails[0]?.emailAddress ??
    `${clerkUserId}@no-email.local`

  const nameParts = [clerkUser.firstName, clerkUser.lastName].filter(Boolean)
  const name = nameParts.join(' ') || clerkUser.username || primaryEmail

  // Upsert by clerkUserId so concurrent first-hits collapse to one document
  // instead of 500ing on duplicate-key.
  const upserted = await User.findOneAndUpdate(
    { clerkUserId },
    {
      $setOnInsert: {
        clerkUserId,
        email: primaryEmail.toLowerCase(),
        name,
        plan: 'free',
        isActive: true,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
  return upserted as IUser
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  let userId: string | null | undefined
  try {
    userId = getAuth(req).userId
  } catch (err) {
    // getAuth throws if clerkPlugin wasn't registered (e.g. env vars missing).
    // Surface that as 503 so the misconfig is obvious instead of a generic 500.
    req.log.error({ err }, 'getAuth threw — is CLERK_SECRET_KEY set and clerkPlugin registered?')
    return reply.code(503).send({ message: 'Auth not configured on the server.' })
  }
  if (!userId) {
    return reply.code(401).send({ message: 'Unauthorized' })
  }

  // Fail fast if Mongo isn't reachable, instead of letting mongoose buffer the
  // User.findOne() for ~10s and surfacing the timeout as "Failed to load user".
  // readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting.
  if (mongoose.connection.readyState !== 1) {
    req.log.error({ readyState: mongoose.connection.readyState }, 'Mongo not connected — auth check refused')
    return reply.code(503).send({
      message: 'Database unavailable. Please try again in a moment.',
      detail: `MongoDB readyState=${mongoose.connection.readyState} (1=connected). Check MONGODB_URI on the API service.`,
    })
  }

  try {
    const user = await syncLocalUser(userId)
    if (!user.isActive) return reply.code(401).send({ message: 'Account disabled. Contact your administrator.' })
    ;(req as any).user = user
    ;(req as any).clerkUserId = userId
  } catch (err) {
    // Log the full stack so the actual cause shows up in Railway's deploy log.
    req.log.error({ err: (err as Error).message, stack: (err as Error).stack, userId }, 'syncLocalUser failed')
    return reply.code(500).send({ message: 'Failed to load user', detail: (err as Error).message })
  }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply)
  if (reply.sent) return

  // Admin role is stored in Clerk's publicMetadata.role — set it in the Clerk
  // dashboard under Users → <user> → Metadata → Public.
  const { sessionClaims } = getAuth(req)
  const role = (sessionClaims as any)?.metadata?.role ?? (sessionClaims as any)?.publicMetadata?.role
  if (role !== 'admin') return reply.code(403).send({ message: 'Forbidden' })
}
