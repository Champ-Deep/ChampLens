import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import User from '../models/User'
import { signToken } from '../lib/jwt'
import { requireAuth } from '../lib/auth'

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60,
}

export default async function authRoutes(app: FastifyInstance) {
  // Register
  app.post('/register', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
  }, async (req, reply) => {
    const { name, email, password } = req.body as any
    if (!name?.trim() || !email?.trim() || !password) {
      return reply.code(400).send({ message: 'Name, email and password are required.' })
    }
    if (password.length < 8) {
      return reply.code(400).send({ message: 'Password must be at least 8 characters.' })
    }

    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) return reply.code(409).send({ message: 'An account with this email already exists.' })

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      passwordHash,
      plan: 'free',
      role: 'user',
      isActive: true,
    })

    const token = signToken({ userId: String(user._id) })
    reply.setCookie('champlens_token', token, COOKIE_OPTS)
    return reply.code(201).send({
      user: { _id: user._id, email: user.email, name: user.name, plan: user.plan, role: user.role },
    })
  })

  // Login
  app.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
  }, async (req, reply) => {
    const { email, password } = req.body as any
    if (!email || !password) return reply.code(400).send({ message: 'Email and password are required.' })

    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) return reply.code(401).send({ message: 'Invalid email or password.' })

    const match = await bcrypt.compare(password, user.passwordHash)
    if (!match) return reply.code(401).send({ message: 'Invalid email or password.' })

    const token = signToken({ userId: String(user._id) })
    reply.setCookie('champlens_token', token, COOKIE_OPTS)
    return { user: { _id: user._id, email: user.email, name: user.name, plan: user.plan, role: user.role } }
  })

  // Logout
  app.post('/logout', async (req, reply) => {
    reply.clearCookie('champlens_token', { path: '/' })
    return reply.code(204).send()
  })

  // Me
  app.get('/me', { preHandler: requireAuth }, async (req) => {
    const user = (req as any).user
    return { user: { _id: user._id, email: user.email, name: user.name, plan: user.plan, role: user.role } }
  })
}
