import sharp from 'sharp'
import PDFDocument from 'pdfkit'
import archiver from 'archiver'
import path from 'path'
import fs from 'fs'

const uploadsDir = path.join(__dirname, '../../uploads')

export async function buildCampaignPrintPack(
  slug: string,
  qrPngUrl: string,
  qrSvgPath: string,
  title: string,
): Promise<string> {
  const outDir = path.join(uploadsDir, 'printpacks')
  fs.mkdirSync(outDir, { recursive: true })

  const qrFilename = qrPngUrl.replace(/.*\/files\//, '')
  const qrAbsPath = path.join(uploadsDir, qrFilename)

  const cardMockupPath = await buildCampaignCardMockup(qrAbsPath, slug, title)
  const stickerPath = await buildStickerSheet(qrAbsPath, slug)

  const readmePath = path.join(outDir, `${slug}-README.txt`)
  fs.writeFileSync(readmePath, buildReadme(title, slug))

  const zipPath = path.join(outDir, `${slug}-print-pack.zip`)
  await zipFiles(zipPath, [
    { path: qrAbsPath,       name: 'qr-300dpi.png' },
    { path: qrSvgPath,       name: 'qr-vector.svg' },
    { path: cardMockupPath,  name: 'qr-card-mockup.png' },
    { path: stickerPath,     name: 'qr-sticker-sheet.pdf' },
    { path: readmePath,      name: 'README.txt' },
  ])

  for (const p of [cardMockupPath, stickerPath, readmePath, qrSvgPath]) {
    try { fs.unlinkSync(p) } catch {}
  }

  const base = process.env.FILE_BASE_URL ?? 'http://localhost:3001/files'
  return `${base}/printpacks/${slug}-print-pack.zip`
}

async function buildCampaignCardMockup(qrPath: string, slug: string, title: string): Promise<string> {
  const cardW = 1050, cardH = 600
  const qrSize = 280
  const qrX = cardW - qrSize - 40
  const qrY = Math.floor((cardH - qrSize) / 2)

  const qrResized = await sharp(qrPath).resize(qrSize, qrSize).png().toBuffer()

  const outDir = path.join(uploadsDir, 'printpacks')
  const outPath = path.join(outDir, `${slug}-card-mockup.png`)

  await sharp({
    create: { width: cardW, height: cardH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([{ input: qrResized, top: qrY, left: qrX }])
    .withMetadata({ density: 300 })
    .png()
    .toFile(outPath)

  return outPath
}

async function buildStickerSheet(qrPath: string, slug: string): Promise<string> {
  const outDir = path.join(uploadsDir, 'printpacks')
  const outPath = path.join(outDir, `${slug}-sticker-sheet.pdf`)

  const stickerSize = 72
  const marginX = 36, marginY = 36, gap = 10
  const cols = Math.floor((595 - 2 * marginX + gap) / (stickerSize + gap))
  const rows = Math.floor((842 - 2 * marginY + gap) / (stickerSize + gap))

  const qrSmall = await sharp(qrPath).resize(stickerSize, stickerSize).png().toBuffer()

  const doc = new PDFDocument({ size: 'A4', margin: 0 })
  const ws = fs.createWriteStream(outPath)
  doc.pipe(ws)

  let count = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (count >= 20) break
      const x = marginX + c * (stickerSize + gap)
      const y = marginY + r * (stickerSize + gap)
      doc.image(qrSmall, x, y, { width: stickerSize, height: stickerSize })
      count++
    }
    if (count >= 20) break
  }

  doc.end()
  await new Promise<void>((res) => ws.on('finish', res))
  return outPath
}

function buildReadme(title: string, slug: string): string {
  return `ChampQR Campaign Print Package
================================
Campaign: ${title}
Slug: ${slug}

FILES INCLUDED
--------------
qr-300dpi.png      — High-resolution QR code, 1000×1000px at 300 DPI. Use this for print shops.
qr-vector.svg      — Infinitely scalable vector QR. Safe for any size.
qr-card-mockup.png — Preview of QR placed on a standard 3.5×2" card.
qr-sticker-sheet.pdf — A4 sheet of 20× QR stickers at 1"×1". Print and stick on any surface.

PRINT GUIDELINES
----------------
• Minimum print size: 0.8" × 0.8" (20mm × 20mm)
• NEVER stretch or distort the QR code. Keep it square.
• Preserve the white quiet zone (white border) around the QR. Never crop it.
• Use black ink on white or very light backgrounds only.
• Avoid printing QR on dark or patterned backgrounds.

HOW IT WORKS
------------
When someone scans this QR code with their phone camera, their browser opens and
a video plays immediately — no app required.

Use cases: product demos, restaurant menus, event promos, ads, packaging inserts.

Support: champqr.com
`
}

function zipFiles(outPath: string, files: { path: string; name: string }[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath)
    const archive = archiver('zip', { zlib: { level: 9 } })
    output.on('close', resolve)
    archive.on('error', reject)
    archive.pipe(output)
    for (const f of files) {
      if (fs.existsSync(f.path)) archive.file(f.path, { name: f.name })
    }
    archive.finalize()
  })
}
