// gen-icons.js — generates PNG icons from favicon.svg using sharp
// Run: node scripts/gen-icons.js
const path = require('path');
const fs = require('fs');

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('sharp not found. Installing...');
    require('child_process').execSync('npm install --save-dev sharp', { stdio: 'inherit' });
    sharp = require('sharp');
  }

  const svgPath = path.join(__dirname, '../public/favicon.svg');
  const svg = fs.readFileSync(svgPath);

  const sizes = [192, 512];
  for (const size of sizes) {
    const out = path.join(__dirname, `../public/icon-${size}.png`);
    await sharp(svg)
      .resize(size, size, { fit: 'contain', background: { r: 13, g: 15, b: 20, alpha: 1 } })
      .png()
      .toFile(out);
    console.log(`Generated ${out}`);
  }
}

main().catch(console.error);
