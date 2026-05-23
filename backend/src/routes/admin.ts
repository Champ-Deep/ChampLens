import { FastifyInstance } from 'fastify'
import User from '../models/User'
import Card from '../models/Card'
import Scan from '../models/Scan'
import { requireAdmin } from '../lib/auth'

// Admin user management — note that user create/delete/password operations
// happen in the Clerk dashboard, not here. This module only edits the local
// Mongo mirror of users (plan, isActive) and exposes aggregate stats.
export default async function adminRoutes(app: FastifyInstance) {
  // List users with card counts
  app.get('/users', { preHandler: requireAdmin }, async (req) => {
    const { page = '1', limit = '50' } = req.query as any
    const skip = (Number(page) - 1) * Number(limit)

    const [users, total] = await Promise.all([
      User.find().sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      User.countDocuments(),
    ])

    const userIds = users.map((u) => u._id)
    const cardCounts = await Card.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ])
    const cardMap = Object.fromEntries(cardCounts.map((c) => [String(c._id), c.count]))

    return {
      users: users.map((u) => ({
        _id: u._id,
        clerkUserId: u.clerkUserId,
        email: u.email,
        name: u.name,
        plan: u.plan,
        isActive: u.isActive,
        cardCount: cardMap[String(u._id)] ?? 0,
        createdAt: u.createdAt,
      })),
      total,
      page: Number(page),
    }
  })

  // Update local user record. Email/name/password live in Clerk —
  // update those in the Clerk dashboard.
  app.patch('/users/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as any
    const { plan, isActive } = req.body as any
    const admin = (req as any).user

    if (String(admin._id) === id && isActive === false) {
      return reply.code(400).send({ message: 'You cannot disable your own admin account.' })
    }

    const updates: Record<string, any> = {}
    if (plan !== undefined) updates.plan = plan
    if (isActive !== undefined) updates.isActive = isActive

    const user = await User.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean()
    if (!user) return reply.code(404).send({ message: 'User not found.' })

    return {
      user: { _id: user._id, email: user.email, name: user.name, plan: user.plan, isActive: user.isActive },
    }
  })

  // Delete local user record + reassign their cards. The Clerk user is NOT
  // deleted — manage that separately in the Clerk dashboard if needed.
  app.delete('/users/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as any
    const admin = (req as any).user

    if (String(admin._id) === id) {
      return reply.code(400).send({ message: 'You cannot delete your own admin account.' })
    }

    const target = await User.findById(id)
    if (!target) return reply.code(404).send({ message: 'User not found.' })

    await Card.updateMany({ userId: id }, { $set: { userId: admin._id } })
    await User.findByIdAndDelete(id)

    return reply.code(200).send({ message: 'Local user deleted. Cards reassigned to admin. Delete the Clerk user separately if needed.' })
  })

  // Platform-wide stats
  app.get('/stats', { preHandler: requireAdmin }, async () => {
    const [totalUsers, totalCards, totalScans] = await Promise.all([
      User.countDocuments(),
      Card.countDocuments(),
      Scan.countDocuments(),
    ])

    const recentScans = await Scan.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 30 },
    ])

    const cardsByStatus = await Card.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])

    return {
      totalUsers,
      totalCards,
      totalScans,
      recentScans: recentScans.reverse(),
      cardsByStatus: Object.fromEntries(cardsByStatus.map((c) => [c._id, c.count])),
    }
  })
}
