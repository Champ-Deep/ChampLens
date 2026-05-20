import '@tensorflow/tfjs-backend-cpu'
import path from 'path'
import fs from 'fs'
import { loadImage } from 'canvas'

const uploadsDir = path.join(__dirname, '../../uploads')

export async function compileMindARTarget(qrPngUrl: string, slug: string): Promise<string> {
  const qrFilename = qrPngUrl.replace(/.*\/files\//, '')
  const qrAbsPath = path.join(uploadsDir, qrFilename)

  if (!fs.existsSync(qrAbsPath)) {
    throw new Error(`QR PNG not found at ${qrAbsPath}`)
  }

  const outDir = path.join(uploadsDir, 'mind')
  fs.mkdirSync(outDir, { recursive: true })

  const mindFilename = `${slug}.mind`
  const mindOutPath = path.join(outDir, mindFilename)

  // OfflineCompiler is the only server-side (Node.js) compiler in mind-ar.
  // It calls createProcessCanvas(img) then ctx.drawImage(img) internally,
  // so `img` must be a canvas Image (from the `canvas` package), not ImageData.
  const { OfflineCompiler } = await import('mind-ar/src/image-target/offline-compiler.js' as any)

  // Downscale to 512px for MindAR feature extraction — same tracking quality, much faster compile
  const { createCanvas } = await import('canvas')
  const srcImg = await loadImage(qrAbsPath)
  const size = 256
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(srcImg as any, 0, 0, size, size)
  const img = canvas

  const compiler = new OfflineCompiler()
  await compiler.compileImageTargets([img], (progress: number) => {
    process.stdout.write(`\r[mind-ar] compiling: ${progress.toFixed(1)}%`)
  })
  process.stdout.write('\n')

  const buffer = compiler.exportData()
  fs.writeFileSync(mindOutPath, Buffer.from(buffer))

  if (!fs.existsSync(mindOutPath)) {
    throw new Error('MindAR compilation produced no output file')
  }

  const base = process.env.FILE_BASE_URL ?? 'http://localhost:3001/files'
  return `${base}/mind/${mindFilename}`
}
