// Regenerates public/og-card.png — the 1200x630 social-preview card used by
// LinkedIn/Twitter/iMessage (og:image). Run from the frontend/ dir:
//   npm i sharp --no-save && node scripts/make-og-card.cjs
const sharp = require('sharp');
const W = 1200, H = 630;
const PHOTO_W = 540;

(async () => {
  // 1) Headshot tile, cover-fit the right column, then fade its left edge into the bg
  const photo = await sharp('public/headshot.webp')
    .resize(PHOTO_W, H, { fit: 'cover', position: 'top' })
    .toBuffer();

  const fadeMask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PHOTO_W}" height="${H}">
       <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
         <stop offset="0" stop-color="#000"/>
         <stop offset="0.32" stop-color="#fff"/>
       </linearGradient></defs>
       <rect width="${PHOTO_W}" height="${H}" fill="url(#g)"/>
     </svg>`);

  const fadedPhoto = await sharp(photo)
    .composite([{ input: fadeMask, blend: 'dest-in' }])
    .png().toBuffer();

  // 2) Background (brand gradient + soft glow)
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
       <defs>
         <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
           <stop offset="0" stop-color="#0b1220"/>
           <stop offset="1" stop-color="#111c33"/>
         </linearGradient>
         <radialGradient id="glow" cx="0.18" cy="0.30" r="0.7">
           <stop offset="0" stop-color="#1d4ed8" stop-opacity="0.38"/>
           <stop offset="1" stop-color="#1d4ed8" stop-opacity="0"/>
         </radialGradient>
       </defs>
       <rect width="${W}" height="${H}" fill="url(#bg)"/>
       <rect width="${W}" height="${H}" fill="url(#glow)"/>
     </svg>`);

  // 3) Text layer (left)
  const text = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
       <g font-family="Helvetica, Arial, sans-serif">
         <rect x="80" y="150" width="54" height="5" rx="2.5" fill="#3b82f6"/>
         <text x="78" y="278" font-family="Georgia, 'Times New Roman', serif"
               font-size="86" font-weight="700" fill="#f8fafc">Nathan Blatter</text>
         <text x="80" y="338" font-size="34" font-weight="600" fill="#cbd5e1">Full-Stack Engineer · AI Systems</text>
         <text x="80" y="392" font-size="25" fill="#94a3b8">Full-stack apps, AI systems &amp; research tools.</text>
         <circle cx="90" cy="512" r="6" fill="#3b82f6"/>
         <text x="108" y="520" font-size="27" font-weight="600" fill="#60a5fa">nathanblatter.com</text>
       </g>
     </svg>`);

  await sharp(bg)
    .composite([
      { input: fadedPhoto, left: W - PHOTO_W, top: 0 },
      { input: text, left: 0, top: 0 },
    ])
    .png({ quality: 95 })
    .toFile('public/og-card.png');

  console.log('wrote public/og-card.png');
})();
