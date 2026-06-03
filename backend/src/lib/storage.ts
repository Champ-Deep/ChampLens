import { Readable } from 'stream'
import path from 'path'
import fs from 'fs'

const uploadsDir = path.join(__dirname, '../../uploads')

function fileBaseUrl(): string {
  const raw = (process.env.FILE_BASE_URL ?? 'http://localhost:3001/files').trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(raw)) return `https://${raw}`
  return raw
}

export interface SaveResult {
  /** Relative path from uploadsDir root — e.g. "videos/raw/abc.mp4". Pass to BullMQ jobs. */
  filename: string
  /** Full public URL — e.g. "https://host/files/videos/raw/abc.mp4". Store in MongoDB. */
  url: string
}

export async function saveFile(buffer: Buffer, filename: string): Promise<SaveResult> {
  const filePath = path.join(uploadsDir, filename)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, buffer)
  return { filename, url: `${fileBaseUrl()}/${filename}` }
}

export async function saveStream(stream: Readable, filename: string): Promise<SaveResult> {
  const filePath = path.join(uploadsDir, filename)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  return new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(filePath)
    stream.pipe(ws)
    ws.on('finish', () => resolve({ filename, url: `${fileBaseUrl()}/${filename}` }))
    ws.on('error', reject)
  })
}

export function getLocalPath(filename: string): string {
  return path.join(uploadsDir, filename)
}

// Repair a stored asset URL whose origin is stale or a leftover placeholder
// (e.g. an unfilled "https://<champlens-api>.up.railway.app/files/...") by
// rebasing everything up to and including "/files/" onto the current
// FILE_BASE_URL. Self-healing: old DB rows written under a wrong/placeholder
// FILE_BASE_URL serve correctly once the env is right, with no migration.
export function repairFileUrl(url: string): string {
  if (!url) return url
  const idx = url.indexOf('/files/')
  if (idx === -1) return url
  const rel = url.slice(idx + '/files/'.length)
  return `${fileBaseUrl()}/${rel}`
}

// Apply repairFileUrl to every known asset-URL field on a card/campaign doc.
export function repairAssetUrls<T extends Record<string, any>>(doc: T): T {
  const fields = ['videoUrl', 'thumbnailUrl', 'qrImageUrl', 'targetFileUrl', 'printPackUrl']
  for (const f of fields) {
    if (typeof doc[f] === 'string') (doc as any)[f] = repairFileUrl(doc[f])
  }
  return doc
}

export function deleteFile(filename: string) {
  const filePath = path.join(uploadsDir, filename)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
}
