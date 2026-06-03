import { FastifyInstance } from 'fastify'
import path from 'path'
import fs from 'fs'
import { nanoid } from 'nanoid'
import Campaign from '../models/Campaign'
import CampaignScan from '../models/CampaignScan'
import { requireAuth } from '../lib/auth'
import { saveStream, getLocalPath, repairAssetUrls } from '../lib/storage'
import { addCampaignJob } from '../workers/queue'
import { generateCampaignQR } from '../workers/generateCampaignQR'
import { buildCampaignPrintPack } from '../workers/buildCampaignPrintPack'
import { compileMindARTarget } from '../workers/compileMindAR'

export default async function campaignRoutes(app: FastifyInstance) {

  // Create campaign
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
    if (!fields.title?.trim()) return reply.code(400).send({ message: 'Campaign title is required.' })

    const slug = nanoid(8)
    const campaign = await Campaign.create({
      userId: user._id,
      slug,
      title: fields.title.trim(),
      description: fields.description?.trim() ?? '',
      ctaText: fields.ctaText?.trim() ?? '',
      ctaUrl: fields.ctaUrl ?? '',
      videoStorageId: video.url,    // public URL stored in DB
      audioStorageId: audio.url,
      status: 'processing',
    })

    // Pass relative filenames — worker resolves absolute disk path directly
    await addCampaignJob(String(campaign._id), video.filename, audio.filename || undefined)

    return reply.code(202).send({ campaignId: campaign._id, slug, status: 'processing' })
  })

  // List user campaigns
  app.get('/', { preHandler: requireAuth }, async (req) => {
    const user = (req as any).user
    const { page = '1', limit = '20' } = req.query as any

    const campaigns = await Campaign.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean()

    const campaignIds = campaigns.map((c) => c._id)
    const scanCounts = await CampaignScan.aggregate([
      { $match: { campaignId: { $in: campaignIds } } },
      { $group: { _id: '$campaignId', count: { $sum: 1 } } },
    ])
    const scanMap = Object.fromEntries(scanCounts.map((s) => [String(s._id), s.count]))

    return {
      campaigns: campaigns.map((c) => ({ ...repairAssetUrls(c), scanCount: scanMap[String(c._id)] ?? 0 })),
    }
  })

  // Public get by slug (AR viewer) — must be before /:id
  app.get('/view/:slug', async (req, reply) => {
    const { slug } = req.params as any
    const campaign = await Campaign.findOne({ slug }).select('-userId -videoStorageId -audioStorageId -errorMsg').lean()
    if (!campaign) return reply.code(404).send({ message: 'Campaign not found.' })
    return { campaign: repairAssetUrls(campaign) }
  })

  // Get single campaign by ID
  app.get('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any
    const campaign = await Campaign.findOne({
      $or: [{ _id: id.match(/^[a-f\d]{24}$/i) ? id : null }, { slug: id }],
      userId: user._id,
    }).lean()
    if (!campaign) return reply.code(404).send({ message: 'Campaign not found.' })
    return { campaign: repairAssetUrls(campaign) }
  })

  // Update campaign fields
  app.patch('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any
    const allowed = ['title', 'description', 'ctaText', 'ctaUrl', 'isActive']
    const updates: Record<string, any> = {}
    const body = req.body as any
    for (const k of allowed) if (k in body) updates[k] = body[k]

    const campaign = await Campaign.findOneAndUpdate(
      { _id: id, userId: user._id },
      { $set: updates },
      { new: true }
    ).lean()
    if (!campaign) return reply.code(404).send({ message: 'Campaign not found.' })
    return { campaign }
  })

  // Delete campaign
  app.delete('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any
    const campaign = await Campaign.findOneAndDelete({ _id: id, userId: user._id }).lean()
    if (!campaign) return reply.code(404).send({ message: 'Campaign not found.' })

    const cleanFile = (url: string) => {
      if (!url) return
      const filename = url.replace(/.*\/files\//, '')
      try { fs.unlinkSync(getLocalPath(filename)) } catch {}
    }
    cleanFile(campaign.videoStorageId)
    cleanFile(campaign.thumbnailUrl)
    cleanFile(campaign.qrImageUrl)
    cleanFile(campaign.printPackUrl)

    await CampaignScan.deleteMany({ campaignId: id })
    return reply.code(204).send()
  })

  // Download QR PNG
  app.get('/:id/qr', { preHandler: requireAuth }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any
    let campaign = await Campaign.findOne({ _id: id, userId: user._id }).lean()
    if (!campaign || campaign.status !== 'ready') return reply.code(404).send({ message: 'QR not ready yet.' })

    const filename = `qr/${campaign.slug}-300dpi.png`
    let filePath = getLocalPath(filename)

    if (!fs.existsSync(filePath)) {
      // Files wiped by redeploy — regenerate QR and MindAR target on-demand
      const { qrPngUrl, qrSvgPath } = await generateCampaignQR(campaign.slug)
      const [, targetFileUrl] = await Promise.all([
        buildCampaignPrintPack(campaign.slug, qrPngUrl, qrSvgPath, campaign.title),
        compileMindARTarget(qrPngUrl, campaign.slug),
      ])
      await Campaign.findByIdAndUpdate(id, { qrImageUrl: qrPngUrl, targetFileUrl })
      filePath = getLocalPath(filename)
    }

    return reply
      .header('Content-Type', 'image/png')
      .header('Content-Disposition', `attachment; filename="champqr-${campaign.slug}.png"`)
      .send(fs.readFileSync(filePath))
  })

  // Download QR SVG
  app.get('/:id/qr/svg', { preHandler: requireAuth }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any
    const campaign = await Campaign.findOne({ _id: id, userId: user._id }).lean()
    if (!campaign || campaign.status !== 'ready') return reply.code(404).send({ message: 'QR not ready yet.' })

    let svgPath = getLocalPath(`qr/${campaign.slug}-vector.svg`)

    if (!fs.existsSync(svgPath)) {
      const { qrPngUrl, qrSvgPath } = await generateCampaignQR(campaign.slug)
      const [, targetFileUrl] = await Promise.all([
        buildCampaignPrintPack(campaign.slug, qrPngUrl, qrSvgPath, campaign.title),
        compileMindARTarget(qrPngUrl, campaign.slug),
      ])
      await Campaign.findByIdAndUpdate(id, { qrImageUrl: qrPngUrl, targetFileUrl })
      svgPath = getLocalPath(`qr/${campaign.slug}-vector.svg`)
    }

    return reply
      .header('Content-Type', 'image/svg+xml')
      .header('Content-Disposition', `attachment; filename="champqr-${campaign.slug}.svg"`)
      .send(fs.readFileSync(svgPath))
  })

  // Download print pack ZIP
  app.get('/:id/qr/print-pack', { preHandler: requireAuth }, async (req, reply) => {
    const user = (req as any).user
    const { id } = req.params as any
    const campaign = await Campaign.findOne({ _id: id, userId: user._id }).lean()
    if (!campaign || campaign.status !== 'ready') return reply.code(404).send({ message: 'Print pack not ready yet.' })

    const zipFilename = `printpacks/${campaign.slug}-print-pack.zip`
    let filePath = getLocalPath(zipFilename)

    if (!fs.existsSync(filePath)) {
      const { qrPngUrl, qrSvgPath } = await generateCampaignQR(campaign.slug)
      const [printPackUrl, targetFileUrl] = await Promise.all([
        buildCampaignPrintPack(campaign.slug, qrPngUrl, qrSvgPath, campaign.title),
        compileMindARTarget(qrPngUrl, campaign.slug),
      ])
      await Campaign.findByIdAndUpdate(id, { qrImageUrl: qrPngUrl, printPackUrl, targetFileUrl })
      filePath = getLocalPath(zipFilename)
    }

    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="champqr-${campaign.slug}-print-pack.zip"`)
      .send(fs.readFileSync(filePath))
  })
}
