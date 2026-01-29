/**
 * Generate PWA icons from SVG
 * Run with: node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const iconsDir = join(projectRoot, 'public', 'icons');

// FPL brand colors
const BG_COLOR = '#37003c';
const FG_COLOR = '#00ff85';

// Icon sizes to generate
const SIZES = [192, 512];

// Create an SVG with the FPL Insights logo
function createSvgIcon(size) {
  const fontSize = Math.round(size * 0.55);
  const yOffset = Math.round(size * 0.62);
  const cornerRadius = Math.round(size * 0.125);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="${BG_COLOR}"/>
  <text x="${size / 2}" y="${yOffset}" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${FG_COLOR}" text-anchor="middle">F</text>
</svg>`;
}

async function generateIcons() {
  console.log('Generating PWA icons...');

  // Ensure icons directory exists
  await mkdir(iconsDir, { recursive: true });

  for (const size of SIZES) {
    const svg = createSvgIcon(size);
    const outputPath = join(iconsDir, `icon-${size}.png`);

    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath);

    console.log(`Created: icon-${size}.png`);
  }

  // Also create apple-touch-icon (180x180)
  const appleSvg = createSvgIcon(180);
  await sharp(Buffer.from(appleSvg))
    .png()
    .toFile(join(iconsDir, 'apple-touch-icon.png'));
  console.log('Created: apple-touch-icon.png');

  // Create favicon (32x32)
  const faviconSvg = createSvgIcon(32);
  await sharp(Buffer.from(faviconSvg))
    .png()
    .toFile(join(iconsDir, 'favicon-32x32.png'));
  console.log('Created: favicon-32x32.png');

  // Create favicon.ico (16x16)
  const favicon16Svg = createSvgIcon(16);
  await sharp(Buffer.from(favicon16Svg))
    .png()
    .toFile(join(iconsDir, 'favicon-16x16.png'));
  console.log('Created: favicon-16x16.png');

  console.log('Done! Icons generated in public/icons/');
}

generateIcons().catch(console.error);
