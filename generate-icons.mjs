import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'

const svgPath = './frontend/public/favicon.svg'
const svgBuffer = readFileSync(svgPath)

const sizes = [
  { name: 'pwa-192.png', size: 192 },
  { name: 'pwa-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

// Dark background + icon centered
async function generate() {
  for (const { name, size } of sizes) {
    const bg = Buffer.from(
      `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#080C0A"/>
      </svg>`
    )

    const iconSize = Math.round(size * 0.6)
    const offset = Math.round((size - iconSize) / 2)

    const iconPng = await sharp(svgBuffer).resize(iconSize, iconSize).png().toBuffer()
    const bgPng = await sharp(bg).png().toBuffer()

    await sharp(bgPng)
      .composite([{ input: iconPng, top: offset, left: offset }])
      .png()
      .toFile(`./frontend/public/${name}`)

    console.log(`✓ ${name} (${size}x${size})`)
  }
}

generate().catch(console.error)
