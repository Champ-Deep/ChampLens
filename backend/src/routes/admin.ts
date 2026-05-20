import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import User from '../models/User'
import Card from '../models/Card'
import Scan from '../models/Scan'
import { requireAdmin } from '../lib/auth'
import { getLocalPath } from '../lib/storage'

export default async function adminRoutes(app: FastifyInstance) {

  // List all users with card count
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
        email: u.email,
        name: u.name,
        plan: u.plan,
        role: u.role,
        isActive: u.isActive,
        cardCount: cardMap[String(u._id)] ?? 0,
        createdAt: u.createdAt,
      })),
      total,
      page: Number(page),
    }
  })

  // Create user (admin only)
  app.post('/users', { preHandler: requireAdmin }, async (req, reply) => {
    const { name, email, password, plan = 'free' } = req.body as any
    if (!name || !email || !password) return reply.code(400).send({ message: 'name, email and password are required.' })
    if (password.length < 8) return reply.code(400).send({ message: 'Password must be at least 8 characters.' })

    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) return reply.code(409).send({ message: 'An account with this email already exists.' })

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      passwordHash,
      plan,
      role: 'user',
      isActive: true,
    })

    return reply.code(201).send({
      user: { _id: user._id, email: user.email, name: user.name, plan: user.plan, role: user.role, isActive: user.isActive },
    })
  })

  // Update user
  app.patch('/users/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as any
    const { name, email, password, plan, isActive } = req.body as any
    const admin = (req as any).user

    // Prevent admin from disabling their own account
    if (String(admin._id) === id && isActive === false) {
      return reply.code(400).send({ message: 'You cannot disable your own admin account.' })
    }

    const updates: Record<string, any> = {}
    if (name !== undefined) updates.name = name.trim()
    if (email !== undefined) updates.email = email.toLowerCase()
    if (plan !== undefined) updates.plan = plan
    if (isActive !== undefined) updates.isActive = isActive
    if (password !== undefined) {
      if (password.length < 8) return reply.code(400).send({ message: 'Password must be at least 8 characters.' })
      updates.passwordHash = await bcrypt.hash(password, 12)
    }

    if (email !== undefined) {
      const conflict = await User.findOne({ email: email.toLowerCase(), _id: { $ne: id } })
      if (conflict) return reply.code(409).send({ message: 'Email already in use.' })
    }

    const user = await User.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean()
    if (!user) return reply.code(404).send({ message: 'User not found.' })

    return {
      user: { _id: user._id, email: user.email, name: user.name, plan: user.plan, role: user.role, isActive: user.isActive },
    }
  })

  // Delete user — reassign cards to admin, then delete user
  app.delete('/users/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as any
    const admin = (req as any).user

    if (String(admin._id) === id) {
      return reply.code(400).send({ message: 'You cannot delete your own admin account.' })
    }

    const target = await User.findById(id)
    if (!target) return reply.code(404).send({ message: 'User not found.' })

    // Reassign all cards to admin
    await Card.updateMany({ userId: id }, { $set: { userId: admin._id } })

    await User.findByIdAndDelete(id)

    return reply.code(200).send({ message: `User deleted. Their cards have been reassigned to admin.` })
  })

  // Platform-wide stats
  app.get('/stats', { preHandler: requireAdmin }, async () => {
    const [totalUsers, totalCards, totalScans] = await Promise.all([
      User.countDocuments({ role: 'user' }),
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
