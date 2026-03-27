import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const resourcesDir = join(__dirname, '..', 'resources')

async function generateIcons() {
  const svgPath = join(resourcesDir, 'icon.svg')
  const pngPath = join(resourcesDir, 'icon.png')
  const icoPath = join(resourcesDir, 'icon.ico')

  console.log('Reading SVG...')
  const svgBuffer = readFileSync(svgPath)

  console.log('Generating PNG (256x256)...')
  await sharp(svgBuffer)
    .resize(256, 256)
    .png()
    .toFile(pngPath)
  console.log(`Created: ${pngPath}`)

  console.log('Generating ICO with multiple sizes...')
  const sizes = [16, 24, 32, 48, 64, 128, 256]
  const pngBuffers = await Promise.all(
    sizes.map(size =>
      sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toBuffer()
    )
  )

  const icoBuffer = await pngToIco(pngBuffers)
  writeFileSync(icoPath, icoBuffer)
  console.log(`Created: ${icoPath}`)

  console.log('Icons generated successfully!')
}

generateIcons().catch(console.error)
