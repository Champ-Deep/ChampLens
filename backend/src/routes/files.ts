import { FastifyInstance } from 'fastify'
import path from 'path'
import fs from 'fs'

const uploadsDir = path.join(__dirname, '../../uploads')

export default async function fileRoutes(app: FastifyInstance) {
  app.get('/*', async (req, reply) => {
    const filePath = path.join(uploadsDir, (req.params as any)['*'])
    if (!fs.existsSync(filePath)) return reply.code(404).send()

    // Prevent path traversal
    const resolved = path.resolve(filePath)
    if (!resolved.startsWith(path.resolve(uploadsDir))) return reply.code(403).send()

    const ext = path.extname(filePath).toLowerCase()
    const contentTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.zip': 'application/zip',
      '.pdf': 'application/pdf',
      '.mind': 'application/octet-stream',
    }

    const stat = fs.statSync(filePath)
    reply.header('Content-Type', contentTypes[ext] ?? 'application/octet-stream')
    reply.header('Content-Length', stat.size)
    reply.header('Cache-Control', 'public, max-age=31536000, immutable')

    // Range requests for video streaming
    const range = req.headers.range
    if (range && (ext === '.mp4' || ext === '.webm')) {
      const [startStr, endStr] = range.replace('bytes=', '').split('-')
      const start = parseInt(startStr, 10)
      const end = endStr ? parseInt(endStr, 10) : stat.size - 1
      const chunkSize = end - start + 1

      reply.code(206)
      reply.header('Content-Range', `bytes ${start}-${end}/${stat.size}`)
      reply.header('Accept-Ranges', 'bytes')
      reply.header('Content-Length', chunkSize)
      return reply.send(fs.createReadStream(filePath, { start, end }))
    }

    return reply.send(fs.createReadStream(filePath))
  })
}
