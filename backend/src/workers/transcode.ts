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

// Probe video to get display dimensions accounting for rotation metadata.
// Android phones record vertical video with a rotation tag — ffprobe streams
// report the coded (raw) size, but side_data rotate gives the display orientation.
function probeDisplaySize(filePath: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: Error | null, data: ffmpeg.FfprobeData) => {
      if (err) return reject(err)
      const vs = data.streams.find((s: ffmpeg.FfprobeStream) => s.codec_type === 'video')
      if (!vs) return reject(new Error('No video stream found'))

      let w = vs.width ?? 0
      let h = vs.height ?? 0

      // Check for rotation in side_data (common on Android/iOS recordings)
      const rotation = ((vs as any).side_data_list ?? []).find(
        (sd: any) => sd.side_data_type === 'Display Matrix'
      )?.rotation ?? (vs as any).tags?.rotate ?? 0
      const rot = Math.abs(Number(rotation))

      // 90° or 270° → swap width/height so we know the actual display orientation
      if (rot === 90 || rot === 270) {
        ;[w, h] = [h, w]
      }

      resolve({ width: w, height: h })
    })
  })
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

  // Determine display orientation so we scale the long edge to 720px correctly
  // and so portrait (9:16) videos aren't mistakenly scaled to landscape size.
  const { width: displayW, height: displayH } = await probeDisplaySize(absoluteInput)
  const isPortrait = displayH > displayW
  console.log(`[transcode] display size: ${displayW}x${displayH} portrait=${isPortrait}`)

  // Scale filter:
  // • Portrait (h > w): constrain height to 1280, width auto (preserves 9:16)
  // • Landscape (w >= h): constrain height to 720, width auto (preserves 16:9)
  // trunc(.../ 2)*2 keeps dimensions divisible by 2 (required by yuv420p).
  // The transpose filter in FFmpeg applies the display rotation from metadata;
  // using -vf with scale means we must handle the rotation ourselves via
  // autorotate (on by default) — scale sees the already-rotated decoded frames.
  const scaleFilter = isPortrait
    ? 'scale=trunc(1280*iw/ih/2)*2:1280'   // portrait: long edge (h) → 1280
    : 'scale=trunc(720*iw/ih/2)*2:720'      // landscape: height → 720

  // Thumbnail dimensions: match the display aspect ratio
  const thumbSize = isPortrait ? '360x640' : '640x360'

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
      .videoFilter(scaleFilter)
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

  // Extract thumbnail at 0s — use display-correct dimensions
  await new Promise<void>((resolve, reject) => {
    ffmpeg(videoOut)
      .screenshots({ timestamps: ['00:00:00.000'], filename: thumbFilename, folder: outDir, size: thumbSize })
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
