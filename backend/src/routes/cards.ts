import { FastifyInstance } from 'fastify'
import path from 'path'
import fs from 'fs'
import { nanoid } from 'nanoid'
import Card from '../models/Card'
import Scan from '../models/Scan'
import { requireAuth } from '../lib/auth'
import { saveStream, getLocalPath } from '../lib/storage'
import { addCardJob } from '../workers/queue'
import { generateQR } from '../workers/generateQR'
import { buildPrintPack } from '../workers/buildPrintPack'

export default async function cardRoutes(app: FastifyInstance) {

  // Create card
  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const user = (req as any).user
    const parts = req.parts()

    const fields: Record<string, string> = {}
    let video = { filename: '', url: '' }
    let audio = { filename: '', url: '' }

    for await (const part of parts) {
      if (part.type === 'field') {
        fields[part.fieldname] = part.value as string
      } else if (part.type === 'file' && part.fieldname === 'video') {
        const ext = path.extname(part.filename || '.mp4')
        video = await saveStream(part.file, `videos/raw/${nanoid(12)}${ext}`)
      } else if (part.type === 'file' && part.fieldname === 'audio') {
        const ext = path.extname(part.filename || '.mp3')
        audio = await saveStream(part.file, `audio/raw/${nanoid(12)}${ext}`)
      }
    }

    if (!video.url) return reply.code(400).send({ message: 'Video file is required.' })
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
      videoStorageId: video.url,   // public URL stored in DB
      audioStorageId: audio.url,
      status: 'processing',
    })

    // Pass relative filenames to the job — worker resolves absolute disk path directly
    await addCardJob(String(card._id), video.filename, audio.filename || undefined)

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

  // Retry a failed (or stuck) card by re-enqueuing the BullMQ job.
  // Only works if the source video file still exists on disk — once Railway
  // wipes the ephemeral filesystem (no volume), the source is gone forever
  // and we return 410 Gone with a clear message instead of pretending to retry.
  app.post('/:id/retry', { preHandler: requireAuth }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any

    const card = await Card.findOne({ _id: id, userId: user._id })
    if (!card) return reply.code(404).send({ message: 'Card not found.' })
    if (card.status === 'ready') {
      return reply.code(400).send({ message: 'Card is already ready — nothing to retry.' })
    }

    // Re-derive the relative filenames the worker expects. videoStorageId is
    // the full URL the API returned at upload time; strip the /files/ prefix.
    const videoFilename = card.videoStorageId.replace(/.*\/files\//, '')
    const audioFilename = card.audioStorageId ? card.audioStorageId.replace(/.*\/files\//, '') : ''

    const absVideoPath = path.join(__dirname, '../../uploads', videoFilename)
    if (!fs.existsSync(absVideoPath)) {
      return reply.code(410).send({
        message: 'Source video is no longer on disk — likely lost on a container restart. Delete this card and re-upload to recover.',
        detail: `Expected file at ${absVideoPath} not found. Attach a Railway Volume to /app/uploads to prevent this in future.`,
      })
    }

    await Card.findByIdAndUpdate(id, { status: 'processing', errorMsg: '' })
    await addCardJob(String(card._id), videoFilename, audioFilename || undefined)

    return reply.code(202).send({ cardId: card._id, status: 'processing' })
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
    if (!card || card.status !== 'ready') return reply.code(404).send({ message: 'QR not ready yet.' })

    const filename = `qr/${card.slug}-300dpi.png`
    let filePath = getLocalPath(filename)

    if (!fs.existsSync(filePath)) {
      const { qrPngUrl, qrSvgPath } = await generateQR(card.slug)
      await buildPrintPack(card.slug, qrPngUrl, qrSvgPath, card.ownerName)
      await Card.findByIdAndUpdate(id, { qrImageUrl: qrPngUrl })
      filePath = getLocalPath(filename)
    }

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
    if (!card || card.status !== 'ready') return reply.code(404).send({ message: 'QR not ready yet.' })

    let svgPath = getLocalPath(`qr/${card.slug}-vector.svg`)

    if (!fs.existsSync(svgPath)) {
      const { qrPngUrl, qrSvgPath } = await generateQR(card.slug)
      await buildPrintPack(card.slug, qrPngUrl, qrSvgPath, card.ownerName)
      await Card.findByIdAndUpdate(id, { qrImageUrl: qrPngUrl })
      svgPath = getLocalPath(`qr/${card.slug}-vector.svg`)
    }

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
    if (!card || card.status !== 'ready') return reply.code(404).send({ message: 'Print pack not ready yet.' })

    const zipFilename = `printpacks/${card.slug}-print-pack.zip`
    let filePath = getLocalPath(zipFilename)

    if (!fs.existsSync(filePath)) {
      const { qrPngUrl, qrSvgPath } = await generateQR(card.slug)
      const printPackUrl = await buildPrintPack(card.slug, qrPngUrl, qrSvgPath, card.ownerName)
      await Card.findByIdAndUpdate(id, { qrImageUrl: qrPngUrl, printPackUrl })
      filePath = getLocalPath(zipFilename)
    }

    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="champlens-${card.slug}-print-pack.zip"`)
      .send(fs.readFileSync(filePath))
  })
}
