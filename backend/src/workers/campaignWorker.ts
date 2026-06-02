import { Worker } from 'bullmq'
import Campaign from '../models/Campaign'
import { transcodeVideo } from './transcode'
import { generateCampaignQR } from './generateCampaignQR'
import { buildCampaignPrintPack } from './buildCampaignPrintPack'
import { compileMindARTarget } from './compileMindAR'
import { publishCampaignStatus as emitCampaignStatus } from '../lib/wsEmitter'

function getRedisConnection() {
  if (process.env.REDIS_URL) return { url: process.env.REDIS_URL }
  return { host: process.env.REDIS_HOST ?? 'localhost', port: Number(process.env.REDIS_PORT ?? 6379) }
}

export function startCampaignWorker() {
  const worker = new Worker(
    'campaign-processing',
    async (job) => {
      const { campaignId, videoPath, audioPath } = job.data
      const t0 = Date.now()
      console.log(`[campaign-worker] Processing campaign ${campaignId}`)

      const campaign = await Campaign.findById(campaignId)
      if (!campaign) throw new Error(`Campaign ${campaignId} not found`)

      try {
        await job.updateProgress(5)

        // Transcode video AND generate QR in parallel
        const [{ videoUrl, thumbnailUrl }, { qrPngUrl, qrSvgPath }] = await Promise.all([
          transcodeVideo(videoPath, campaign.slug, audioPath, campaign.videoStorageId, campaign.audioStorageId || undefined),
          generateCampaignQR(campaign.slug),
        ])

        await Campaign.findByIdAndUpdate(campaignId, { videoUrl, thumbnailUrl, qrImageUrl: qrPngUrl })
        await job.updateProgress(60)

        // Build print pack AND compile MindAR target in parallel
        const [printPackUrl, targetFileUrl] = await Promise.all([
          buildCampaignPrintPack(campaign.slug, qrPngUrl, qrSvgPath, campaign.title),
          compileMindARTarget(qrPngUrl, campaign.slug),
        ])

        await Campaign.findByIdAndUpdate(campaignId, { printPackUrl, targetFileUrl })
        await job.updateProgress(100)

        await Campaign.findByIdAndUpdate(campaignId, { status: 'ready', errorMsg: '' })
        emitCampaignStatus(campaignId, 'ready')
        console.log(`[campaign-worker] Campaign ${campaignId} ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

      } catch (err: any) {
        console.error(`[campaign-worker] Campaign ${campaignId} failed:`, err.message)
        await Campaign.findByIdAndUpdate(campaignId, { status: 'error', errorMsg: err.message ?? 'Processing failed' })
        emitCampaignStatus(campaignId, 'error')
        // If fallback URL download also failed, don't burn retries — job is unrecoverable
        if (err.message?.includes('Download failed') || err.message?.includes('Input file not found')) return
        throw err
      }
    },
    { connection: getRedisConnection(), concurrency: 2 }
  )

  worker.on('failed', (job, err) => {
    console.error(`[campaign-worker] Job ${job?.id} failed permanently:`, err.message)
  })

  return worker
}
