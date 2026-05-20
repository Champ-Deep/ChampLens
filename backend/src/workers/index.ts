import 'dotenv/config'
import mongoose from 'mongoose'
import { startCardWorker } from './cardWorker'

const start = async () => {
  const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/champlens'

  for (let attempt = 1; ; attempt++) {
    try {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10_000 })
      console.log('[worker process] MongoDB connected')
      break
    } catch (err) {
      console.error(`[worker process] MongoDB connection failed (attempt ${attempt}); retrying in 10s`, err)
      await new Promise((r) => setTimeout(r, 10_000))
    }
  }

  const worker = startCardWorker()
  console.log('[worker process] Card processing worker started')

  process.on('SIGTERM', async () => {
    await worker.close()
    await mongoose.disconnect()
    process.exit(0)
  })
}

start().catch((err) => { console.error(err); process.exit(1) })
