import sharp from 'sharp';

export async function processImage(buffer: Buffer) {
  return sharp(buffer)
    .resize(800, 800, { fit: 'inside' })
    .webp({ quality: 80 })
    .toBuffer();
}