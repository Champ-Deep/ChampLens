import { FastifyRequest, FastifyReply } from 'fastify'
import { getAuth, clerkClient } from '@clerk/fastify'
import mongoose from 'mongoose'
import User, { IUser } from '../models/User'

// Find-or-create the local Mongo User row that mirrors a Clerk user.
// We sync email + name from Clerk on first hit, then trust the local row.
//
// Defensive against three failure modes that have all bitten this codepath:
//   1. Concurrent first-hits for the same clerkUserId — two parallel requests
//      both findOne→null and both attempt insert. The clerkUserId unique index
//      makes the loser throw E11000; we resolve by re-reading the winner's row.
//   2. Stale email-unique index from the pre-Clerk schema. The new schema only
//      declares `clerkUserId` unique, but Mongo retains old indexes until
//      dropped. If a doc with this email already exists (e.g. a pre-Clerk row,
//      or the user signed up twice under different Clerk identities), the
//      insert hits E11000 on `email_1`. We adopt the existing row by stamping
//      it with the new clerkUserId.
//   3. Clerk returning a partial user — fall back through primary email →
//      first email → synthesized local-only email so the insert never NPEs.
function isDuplicateKeyError(err: unknown): err is { code: number; keyPattern?: Record<string, number>; keyValue?: Record<string, unknown> } {
  return !!err && typeof err === 'object' && (err as { code?: number }).code === 11000
}

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
  const email = primaryEmail.toLowerCase()

  const nameParts = [clerkUser.firstName, clerkUser.lastName].filter(Boolean)
  const name = nameParts.join(' ') || clerkUser.username || primaryEmail

  try {
    const created = await User.create({
      clerkUserId,
      email,
      name,
      plan: 'free',
      isActive: true,
    })
    return created
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err

    // Concurrent insert race: the other request won. Re-read its row.
    const raced = await User.findOne({ clerkUserId })
    if (raced) return raced

    // Stale email-unique index claimed the email. Adopt the orphan row by
    // stamping it with this clerkUserId so future logins find it by clerkUserId.
    const byEmail = await User.findOne({ email })
    if (byEmail) {
      byEmail.clerkUserId = clerkUserId
      byEmail.name = name
      byEmail.isActive = byEmail.isActive ?? true
      try {
        await byEmail.save()
      } catch (saveErr) {
        if (isDuplicateKeyError(saveErr)) {
          const resolved = await User.findOne({ clerkUserId })
          if (resolved) return resolved
        }
        throw saveErr
      }
      return byEmail
    }

    throw new Error(`Mongo duplicate-key (E11000) on User insert for clerkUserId=${clerkUserId}, email=${email}. Stale unique index? keys=${JSON.stringify((err as { keyPattern?: unknown }).keyPattern)}`)
  }
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

  // Admin role lives in Clerk's publicMetadata.role — set it in the Clerk
  // dashboard under Users → <user> → Metadata → Public → { "role": "admin" }.
  //
  // Two-path lookup:
  //   Fast: read `metadata.role` from sessionClaims. Only works if a Clerk
  //         session token template has been configured to inject it.
  //         (Dashboard → Sessions → Customize session token → add:
  //          { "metadata": "{{user.public_metadata}}" })
  //   Slow: clerkClient.users.getUser(clerkUserId) to read publicMetadata
  //         directly. Works regardless of session-template config — this is
  //         the path we hit by default.
  // Admin endpoints are low-volume so the Clerk roundtrip is fine.
  const { sessionClaims } = getAuth(req)
  const claimRole = (sessionClaims as any)?.metadata?.role ?? (sessionClaims as any)?.publicMetadata?.role
  if (claimRole === 'admin') return

  const clerkUserId = (req as any).clerkUserId as string
  try {
    const clerkUser = await clerkClient.users.getUser(clerkUserId)
    const role = (clerkUser.publicMetadata as { role?: string })?.role
    if (role !== 'admin') return reply.code(403).send({ message: 'Forbidden' })
  } catch (err) {
    req.log.error({ err: (err as Error).message, clerkUserId }, 'requireAdmin: Clerk getUser failed')
    return reply.code(503).send({
      message: 'Admin check unavailable. Please try again.',
      detail: (err as Error).message,
    })
  }
}
