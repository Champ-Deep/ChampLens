import QRCode from 'qrcode'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

const uploadsDir = path.join(__dirname, '../../uploads')

export async function generateQR(slug: string): Promise<{ qrPngUrl: string; qrSvgPath: string }> {
  const outDir = path.join(uploadsDir, 'qr')
  fs.mkdirSync(outDir, { recursive: true })

  const url = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/v/${slug}`

  // Generate base QR as PNG (1000×1000) without logo first
  const qrBuffer = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'H',
    type: 'png',
    width: 1000,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  })

  // Generate SVG
  const svgString = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    width: 1000,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  })

  const svgPath = path.join(outDir, `${slug}-vector.svg`)
  fs.writeFileSync(svgPath, svgString)

  // Composite Champions Group logo onto center of QR
  const logoPath = process.env.LOGO_PATH ?? path.join(__dirname, '../assets/qr-logo.jpeg')
  let finalBuffer = qrBuffer

  if (fs.existsSync(logoPath)) {
    const logoSize = 150 // 15% of 1000px
    const offset = Math.floor((1000 - logoSize) / 2)

    const logoBuffer = await sharp(logoPath)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer()

    // White padding behind logo (180×180 to give 15px quiet zone around logo)
    const paddingSize = logoSize + 20
    const paddingOffset = Math.floor((1000 - paddingSize) / 2)
    const whitePad = await sharp({
      create: { width: paddingSize, height: paddingSize, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    }).png().toBuffer()

    finalBuffer = await sharp(qrBuffer)
      .composite([
        { input: whitePad, top: paddingOffset, left: paddingOffset },
        { input: logoBuffer, top: offset, left: offset },
      ])
      .png()
      .toBuffer()
  }

  // Set 300 DPI metadata
  const pngFilename = `${slug}-300dpi.png`
  const pngPath = path.join(outDir, pngFilename)

  await sharp(finalBuffer)
    .withMetadata({ density: 300 })
    .png({ compressionLevel: 9 })
    .toFile(pngPath)

  const rawBase = (process.env.FILE_BASE_URL ?? 'http://localhost:3001/files').trim().replace(/\/+$/, '')
  const base = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`
  return {
    qrPngUrl: `${base}/qr/${pngFilename}`,
    qrSvgPath: svgPath,
  }
}
