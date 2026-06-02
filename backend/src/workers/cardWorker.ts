import { Worker } from 'bullmq'
import Card from '../models/Card'
import { transcodeVideo } from './transcode'
import { generateQR } from './generateQR'
import { buildPrintPack } from './buildPrintPack'
import { compileMindARTarget } from './compileMindAR'
import { publishCardStatus } from '../lib/wsEmitter'

function getRedisConnection() {
  if (process.env.REDIS_URL) return { url: process.env.REDIS_URL }
  return { host: process.env.REDIS_HOST ?? 'localhost', port: Number(process.env.REDIS_PORT ?? 6379) }
}

export function startCardWorker() {
  const worker = new Worker(
    'card-processing',
    async (job) => {
      const { cardId, videoPath, audioPath } = job.data
      const t0 = Date.now()
      console.log(`[worker] Processing card ${cardId}`)

      const card = await Card.findById(cardId)
      if (!card) throw new Error(`Card ${cardId} not found`)

      try {
        await job.updateProgress(5)

        // Step 1+2: Transcode video AND generate QR in parallel — saves ~15-30s
        const [{ videoUrl, thumbnailUrl }, { qrPngUrl, qrSvgPath }] = await Promise.all([
          transcodeVideo(videoPath, card.slug, audioPath, card.videoStorageId, card.audioStorageId || undefined),
          generateQR(card.slug),
        ])

        await Card.findByIdAndUpdate(cardId, { videoUrl, thumbnailUrl, qrImageUrl: qrPngUrl })
        await job.updateProgress(50)

        // Step 3+4: Print pack AND MindAR compile in parallel — saves ~5s
        const [printPackUrl, targetFileUrl] = await Promise.all([
          buildPrintPack(card.slug, qrPngUrl, qrSvgPath, card.ownerName),
          compileMindARTarget(qrPngUrl, card.slug),
        ])

        await Card.findByIdAndUpdate(cardId, { printPackUrl, targetFileUrl })
        await job.updateProgress(100)

        // Only publish the terminal statuses — they match the Card enum and the
        // frontend CardStatus type. Intermediate ('processing:transcoded',
        // 'processing:ar') would cast-corrupt frontend state and momentarily
        // render the "Processing failed" UI on the card-detail page.

        await Card.findByIdAndUpdate(cardId, { status: 'ready', errorMsg: '' })
        publishCardStatus(cardId, 'ready')
        console.log(`[worker] Card ${cardId} ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

      } catch (err: any) {
        console.error(`[worker] Card ${cardId} failed:`, err.message)
        await Card.findByIdAndUpdate(cardId, { status: 'error', errorMsg: err.message ?? 'Processing failed' })
        publishCardStatus(cardId, 'error')
        // If fallback URL download also failed, don't burn retries — job is unrecoverable
        if (err.message?.includes('Download failed') || err.message?.includes('Input file not found')) return
        throw err
      }
    },
    { connection: getRedisConnection(), concurrency: 2 }
  )

  worker.on('failed', (job, err) => {
    console.error(`[worker] Job ${job?.id} failed permanently:`, err.message)
  })

  return worker
}
