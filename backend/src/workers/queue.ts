import { Queue, QueueEvents } from 'bullmq'

function getRedisConnection() {
  if (process.env.REDIS_URL) {
    return { url: process.env.REDIS_URL }
  }
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
  }
}

export const cardQueue = new Queue('card-processing', { connection: getRedisConnection() })
export const queueEvents = new QueueEvents('card-processing', { connection: getRedisConnection() })

export async function addCardJob(cardId: string, videoPath: string, audioPath?: string) {
  return cardQueue.add('process-card', { cardId, videoPath, audioPath }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  })
}
