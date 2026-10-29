import assert from 'node:assert/strict';
import sharp from 'sharp';

/** A valid-sized file can still be a failed render: require visible light PLA. */
export async function assertVisiblePLA(buffer, label = 'frame') {
  const pixels = await sharp(buffer).removeAlpha().greyscale().raw().toBuffer();
  let brightPixels = 0;
  for (const value of pixels) if (value > 100) brightPixels++;
  assert(brightPixels >= 10_000, `${label}: visible light PLA missing (${brightPixels} bright pixels)`);
  return brightPixels;
}
