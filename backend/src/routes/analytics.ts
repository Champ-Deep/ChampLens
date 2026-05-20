import { FastifyInstance } from 'fastify'
import crypto from 'crypto'
import Scan from '../models/Scan'
import Card from '../models/Card'
import { requireAuth } from '../lib/auth'

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip + (process.env.JWT_SECRET ?? 'salt')).digest('hex')
}

function detectDevice(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/Tablet|iPad/i.test(ua)) return 'tablet'
  if (/Mobi|Android/i.test(ua)) return 'mobile'
  return 'desktop'
}

export default async function analyticsRoutes(app: FastifyInstance) {

  // Log a scan (public, rate-limited)
  app.post('/scan', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { slug } = req.body as any
    if (!slug) return reply.code(400).send({ message: 'slug required' })

    const card = await Card.findOne({ slug, isActive: true }).lean()
    if (!card) return reply.code(404).send()

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.socket?.remoteAddress
      ?? 'unknown'

    await Scan.create({
      cardId: card._id,
      slug,
      userAgent: req.headers['user-agent'] ?? '',
      deviceType: detectDevice(req.headers['user-agent'] ?? ''),
      country: (req.headers['cf-ipcountry'] as string) ?? '',
      city: '',
      ipHash: hashIp(ip),
    })

    return reply.code(204).send()
  })

  // Get analytics for a card
  app.get('/:cardId', { preHandler: requireAuth }, async (req, reply) => {
    const user = (req as any).user
    const { cardId } = req.params as any

    const card = await Card.findOne({ _id: cardId, userId: user._id }).lean()
    if (!card) return reply.code(404).send({ message: 'Card not found.' })

    const [totalScans, scans] = await Promise.all([
      Scan.countDocuments({ cardId }),
      Scan.find({ cardId }).sort({ timestamp: -1 }).limit(500).lean(),
    ])

    // Unique scans by ipHash
    const uniqueIps = new Set(scans.map((s) => s.ipHash))
    const uniqueScans = uniqueIps.size

    // Scans by day (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recentScans = scans.filter((s) => s.timestamp >= thirtyDaysAgo)
    const dayMap: Record<string, number> = {}
    for (const scan of recentScans) {
      const day = scan.timestamp.toISOString().slice(0, 10)
      dayMap[day] = (dayMap[day] ?? 0) + 1
    }
    const scansByDay = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))

    // Device breakdown
    const deviceMap: Record<string, number> = {}
    for (const scan of scans) {
      deviceMap[scan.deviceType] = (deviceMap[scan.deviceType] ?? 0) + 1
    }
    const deviceBreakdown = Object.entries(deviceMap).map(([name, value]) => ({ name, value }))

    // Top countries
    const countryMap: Record<string, number> = {}
    for (const scan of scans) {
      if (scan.country) countryMap[scan.country] = (countryMap[scan.country] ?? 0) + 1
    }
    const topCountries = Object.entries(countryMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([country, count]) => ({ country, count }))

    return { totalScans, uniqueScans, scansByDay, deviceBreakdown, topCountries }
  })
}
