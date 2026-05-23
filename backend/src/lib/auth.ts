import { FastifyRequest, FastifyReply } from 'fastify'
import { getAuth, clerkClient } from '@clerk/fastify'
import User, { IUser } from '../models/User'

// Find-or-create the local Mongo User row that mirrors a Clerk user.
// We sync email + name from Clerk on first hit, then trust the local row.
async function syncLocalUser(clerkUserId: string): Promise<IUser> {
  const existing = await User.findOne({ clerkUserId })
  if (existing) return existing

  const clerkUser = await clerkClient.users.getUser(clerkUserId)
  const primaryEmail =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    `${clerkUserId}@no-email.local`

  return User.create({
    clerkUserId,
    email: primaryEmail.toLowerCase(),
    name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || clerkUser.username || primaryEmail,
    plan: 'free',
    isActive: true,
  })
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const { userId } = getAuth(req)
  if (!userId) {
    return reply.code(401).send({ message: 'Unauthorized' })
  }

  try {
    const user = await syncLocalUser(userId)
    if (!user.isActive) return reply.code(401).send({ message: 'Account disabled. Contact your administrator.' })
    ;(req as any).user = user
    ;(req as any).clerkUserId = userId
  } catch (err) {
    req.log.error({ err, userId }, 'Failed to sync local user from Clerk')
    return reply.code(500).send({ message: 'Failed to load user' })
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
