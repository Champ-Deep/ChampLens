import { FastifyInstance } from 'fastify'
import path from 'path'
import fs from 'fs'
import { nanoid } from 'nanoid'
import Card from '../models/Card'
import Scan from '../models/Scan'
import { requireAuth } from '../lib/auth'
import { saveStream, getLocalPath } from '../lib/storage'
import { addCardJob } from '../workers/queue'

export default async function cardRoutes(app: FastifyInstance) {

  // Create card
  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const user = (req as any).user
    const parts = req.parts()

    const fields: Record<string, string> = {}
    let videoUrl = ''
    let audioUrl = ''
    let videoFilename = ''
    let audioFilename = ''

    for await (const part of parts) {
      if (part.type === 'field') {
        fields[part.fieldname] = part.value as string
      } else if (part.type === 'file' && part.fieldname === 'video') {
        const ext = path.extname(part.filename || '.mp4')
        videoFilename = `videos/raw/${nanoid(12)}${ext}`
        videoUrl = await saveStream(part.file, videoFilename)
      } else if (part.type === 'file' && part.fieldname === 'audio') {
        const ext = path.extname(part.filename || '.mp3')
        audioFilename = `audio/raw/${nanoid(12)}${ext}`
        audioUrl = await saveStream(part.file, audioFilename)
      }
    }

    if (!videoUrl) return reply.code(400).send({ message: 'Video file is required.' })
    if (!fields.ownerName?.trim()) return reply.code(400).send({ message: 'Owner name is required.' })
    if (!fields.ownerTitle?.trim()) return reply.code(400).send({ message: 'Owner title is required.' })

    const slug = nanoid(8)
    const card = await Card.create({
      userId: user._id,
      slug,
      ownerName: fields.ownerName.trim(),
      ownerTitle: fields.ownerTitle.trim(),
      company: fields.company?.trim() ?? '',
      website: fields.website ?? '',
      socialLinks: {
        linkedin: fields.linkedin ?? '',
        instagram: fields.instagram ?? '',
        twitter: fields.twitter ?? '',
      },
      videoStorageId: videoUrl,
      audioStorageId: audioUrl,
      status: 'processing',
    })

    // Pass relative filenames so the worker can resolve absolute disk paths
    // without depending on FILE_BASE_URL or a fragile URL-stripping regex.
    await addCardJob(String(card._id), videoFilename, audioFilename || undefined)

    return reply.code(202).send({ cardId: card._id, slug, status: 'processing' })
  })

  // List user cards
  app.get('/', { preHandler: requireAuth }, async (req) => {
    const user = (req as any).user
    const { page = '1', limit = '20' } = req.query as any

    const cards = await Card.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean()

    const cardIds = cards.map((c) => c._id)
    const scanCounts = await Scan.aggregate([
      { $match: { cardId: { $in: cardIds } } },
      { $group: { _id: '$cardId', count: { $sum: 1 } } },
    ])
    const scanMap = Object.fromEntries(scanCounts.map((s) => [String(s._id), s.count]))

    return {
      cards: cards.map((c) => ({ ...c, scanCount: scanMap[String(c._id)] ?? 0 })),
    }
  })

  // Public get by slug (AR viewer + preview) — must be before /:id
  app.get('/view/:slug', async (req, reply) => {
    const { slug } = req.params as any
    const card = await Card.findOne({ slug }).select('-userId -videoStorageId -errorMsg').lean()
    if (!card) return reply.code(404).send({ message: 'Card not found.' })
    return { card }
  })

  // Get single card by ID (dashboard — auth required)
  app.get('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any
    // Support slug lookup for the viewer fallback
    const card = await Card.findOne({
      $or: [{ _id: id.match(/^[a-f\d]{24}$/i) ? id : null }, { slug: id }],
      userId: user._id,
    }).lean()
    if (!card) return reply.code(404).send({ message: 'Card not found.' })
    return { card }
  })

  // Update card fields
  app.patch('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any
    const allowed = ['ownerName', 'ownerTitle', 'company', 'website', 'socialLinks', 'isActive']
    const updates: Record<string, any> = {}
    const body = req.body as any
    for (const k of allowed) if (k in body) updates[k] = body[k]

    const card = await Card.findOneAndUpdate(
      { _id: id, userId: user._id },
      { $set: updates },
      { new: true }
    ).lean()
    if (!card) return reply.code(404).send({ message: 'Card not found.' })
    return { card }
  })

  // Delete card
  app.delete('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any
    const card = await Card.findOneAndDelete({ _id: id, userId: user._id }).lean()
    if (!card) return reply.code(404).send({ message: 'Card not found.' })

    // Clean up files (best-effort)
    const cleanFile = (url: string) => {
      if (!url) return
      const filename = url.replace(/.*\/files\//, '')
      try { fs.unlinkSync(getLocalPath(filename)) } catch {}
    }
    cleanFile(card.videoStorageId)
    cleanFile(card.thumbnailUrl)
    cleanFile(card.qrImageUrl)
    cleanFile(card.targetFileUrl)
    cleanFile(card.printPackUrl)

    await Scan.deleteMany({ cardId: id })
    return reply.code(204).send()
  })

  // Download QR PNG
  app.get('/:id/qr', { preHandler: requireAuth }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any
    const card = await Card.findOne({ _id: id, userId: user._id }).lean()
    if (!card?.qrImageUrl) return reply.code(404).send({ message: 'QR not ready yet.' })
    const filename = card.qrImageUrl.replace(/.*\/files\//, '')
    const filePath = getLocalPath(filename)
    if (!fs.existsSync(filePath)) return reply.code(404).send({ message: 'File not found.' })
    return reply
      .header('Content-Type', 'image/png')
      .header('Content-Disposition', `attachment; filename="champlens-${card.slug}.png"`)
      .send(fs.readFileSync(filePath))
  })

  // Download QR SVG
  app.get('/:id/qr/svg', { preHandler: requireAuth }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any
    const card = await Card.findOne({ _id: id, userId: user._id }).lean()
    if (!card) return reply.code(404).send({ message: 'Card not found.' })
    const svgPath = getLocalPath(`qr/${card.slug}-vector.svg`)
    if (!fs.existsSync(svgPath)) return reply.code(404).send({ message: 'SVG not ready yet.' })
    return reply
      .header('Content-Type', 'image/svg+xml')
      .header('Content-Disposition', `attachment; filename="champlens-${card.slug}.svg"`)
      .send(fs.readFileSync(svgPath))
  })

  // Download print pack ZIP
  app.get('/:id/qr/print-pack', { preHandler: requireAuth }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any
    const card = await Card.findOne({ _id: id, userId: user._id }).lean()
    if (!card?.printPackUrl) return reply.code(404).send({ message: 'Print pack not ready yet.' })
    const filename = card.printPackUrl.replace(/.*\/files\//, '')
    const filePath = getLocalPath(filename)
    if (!fs.existsSync(filePath)) return reply.code(404).send({ message: 'File not found.' })
    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="champlens-${card.slug}-print-pack.zip"`)
      .send(fs.readFileSync(filePath))
  })
}
