import mongoose from 'mongoose'
import { Readable } from 'stream'
import path from 'path'
import fs from 'fs'

const uploadsDir = path.join(__dirname, '../../uploads')

export async function saveFile(buffer: Buffer, filename: string): Promise<string> {
  const filePath = path.join(uploadsDir, filename)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, buffer)
  const fileBaseUrl = process.env.FILE_BASE_URL ?? 'http://localhost:3001/files'
  return `${fileBaseUrl}/${filename}`
}

export async function saveStream(stream: Readable, filename: string): Promise<string> {
  const filePath = path.join(uploadsDir, filename)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  return new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(filePath)
    stream.pipe(ws)
    ws.on('finish', () => {
      const fileBaseUrl = process.env.FILE_BASE_URL ?? 'http://localhost:3001/files'
      resolve(`${fileBaseUrl}/${filename}`)
    })
    ws.on('error', reject)
  })
}

export function getLocalPath(filename: string): string {
  return path.join(uploadsDir, filename)
}

export function deleteFile(filename: string) {
  const filePath = path.join(uploadsDir, filename)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
}
