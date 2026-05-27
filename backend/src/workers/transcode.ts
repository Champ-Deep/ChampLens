import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'

// Use ffmpeg-static if available, otherwise fall back to system ffmpeg (Docker)
try {
  const ffmpegStatic = require('ffmpeg-static')
  if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic)
} catch {
  // System ffmpeg is on PATH (e.g. Docker image has ffmpeg installed via apk)
}

const uploadsDir = path.join(__dirname, '../../uploads')

// Accepts either a relative path ("videos/raw/abc.mp4") or a full URL
// ("https://host/files/videos/raw/abc.mp4") and returns the absolute disk path.
function toAbsolutePath(input: string): string {
  const rel = input.includes('/files/') ? input.replace(/.*\/files\//, '') : input
  return path.join(uploadsDir, rel)
}

export async function transcodeVideo(inputRelPath: string, slug: string, audioRelPath?: string): Promise<{ videoUrl: string; thumbnailUrl: string }> {
  const outDir = path.join(uploadsDir, 'videos', 'processed')
  fs.mkdirSync(outDir, { recursive: true })

  const videoFilename = `${slug}.mp4`
  const thumbFilename = `${slug}-thumb.jpg`
  const videoOut = path.join(outDir, videoFilename)

  const absoluteInput = toAbsolutePath(inputRelPath)
  console.log(`[transcode] input: "${inputRelPath}" → "${absoluteInput}" exists:${fs.existsSync(absoluteInput)} uploadsDir:${uploadsDir}`)

  if (!fs.existsSync(absoluteInput)) {
    // List what's actually in the raw dir so we can see what landed
    const rawDir = path.join(uploadsDir, 'videos', 'raw')
    const files = fs.existsSync(rawDir) ? fs.readdirSync(rawDir) : []
    throw new Error(`Input file not found: ${absoluteInput} | uploadsDir=${uploadsDir} | raw dir contents: [${files.join(', ')}]`)
  }

  await new Promise<void>((resolve, reject) => {
    let cmd = ffmpeg(absoluteInput)

    if (audioRelPath) {
      const absoluteAudio = toAbsolutePath(audioRelPath)
      cmd = cmd.input(absoluteAudio)
        .outputOptions(['-map 0:v:0', '-map 1:a:0', '-shortest'])
    }

    cmd
      .videoCodec('libx264')
      .audioCodec('aac')
      .videoBitrate('1200k')
      .audioBitrate('128k')
      .size('?x720')
      .outputOptions([
        '-crf 23',
        '-preset fast',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
      ])
      .output(videoOut)
      .on('end', () => resolve())
      .on('error', reject)
      .run()
  })

  // Delete raw inputs now that the processed file exists
  try { fs.unlinkSync(absoluteInput) } catch {}
  if (audioRelPath) {
    try { fs.unlinkSync(toAbsolutePath(audioRelPath)) } catch {}
  }

  // Extract thumbnail at 0s
  await new Promise<void>((resolve, reject) => {
    ffmpeg(videoOut)
      .screenshots({ timestamps: ['00:00:00.000'], filename: thumbFilename, folder: outDir, size: '640x360' })
      .on('end', () => resolve())
      .on('error', reject)
  })

  const rawBase = (process.env.FILE_BASE_URL ?? 'http://localhost:3001/files').trim().replace(/\/+$/, '')
  const base = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`
  return {
    videoUrl: `${base}/videos/processed/${videoFilename}`,
    thumbnailUrl: `${base}/videos/processed/${thumbFilename}`,
  }
}
