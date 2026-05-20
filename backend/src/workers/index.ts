import 'dotenv/config'
import mongoose from 'mongoose'
import { startCardWorker } from './cardWorker'

const start = async () => {
  const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/champlens'
  await mongoose.connect(MONGODB_URI)
  console.log('[worker process] MongoDB connected')

  const worker = startCardWorker()
  console.log('[worker process] Card processing worker started')

  process.on('SIGTERM', async () => {
    await worker.close()
    await mongoose.disconnect()
    process.exit(0)
  })
}

start().catch((err) => { console.error(err); process.exit(1) })
