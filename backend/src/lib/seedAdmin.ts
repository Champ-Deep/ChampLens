import bcrypt from 'bcryptjs'
import User from '../models/User'

export async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    console.warn('[seedAdmin] ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin seed')
    return
  }

  const existing = await User.findOne({ role: 'admin' })
  if (existing) return

  const passwordHash = await bcrypt.hash(password, 12)
  await User.create({
    email: email.toLowerCase(),
    passwordHash,
    name: 'Admin',
    role: 'admin',
    plan: 'business',
    isActive: true,
  })

  console.log(`[seedAdmin] Admin account created: ${email}`)
}
