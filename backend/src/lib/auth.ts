import { FastifyRequest, FastifyReply } from 'fastify'
import { verifyToken } from './jwt'
import User from '../models/User'

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies?.champlens_token
  if (!token) return reply.code(401).send({ message: 'Unauthorized' })

  try {
    const { userId } = verifyToken(token)
    const user = await User.findById(userId).lean()
    if (!user) return reply.code(401).send({ message: 'Unauthorized' })
    if (!user.isActive) return reply.code(401).send({ message: 'Account disabled. Contact your administrator.' })
    ;(req as any).user = user
  } catch {
    return reply.code(401).send({ message: 'Unauthorized' })
  }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply)
  if (reply.sent) return
  const user = (req as any).user
  if (user?.role !== 'admin') return reply.code(403).send({ message: 'Forbidden' })
}
