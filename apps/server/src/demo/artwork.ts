import sharp from 'sharp';
const colors = ['#fcba58', '#a5d8cc', '#aebcf1', '#f6a8b8', '#b9d987', '#c9b6e8'];
const icons = [
  '<circle cx="200" cy="136" r="35" fill="#ffc44d"/><path d="M200 75v-14m0 150v-14m61-61h14m-150 0h14m18-43-10-10m96 106-10-10m0-86 10-10m-96 106 10-10"/>',
  '<path d="M151 110h82v47a30 30 0 0 1-82 0z" fill="#ffb791"/><path d="M233 115q45 0 26 32h-26M145 191h105M170 85v-15m25 15v-15m25 15v-15"/>',
  '<path d="m143 129 57-45 57 45v65h-114z" fill="#abcff2"/><path d="M183 194v-40h34v40M159 133h15m51 0h15"/>',
  '<ellipse cx="200" cy="144" rx="57" ry="30" fill="#c0dea5"/><ellipse cx="200" cy="144" rx="33" ry="17" fill="#fff8e8"/><path d="M125 105v79m-10-79v25h20v-25m140 0v79m-9-79v30h9"/>',
  '<circle cx="200" cy="135" r="53" fill="#a8d5c9"/><path d="m200 111 24 18-9 28h-30l-9-28zM200 82v29m-50-4 26 22m-8 49 17-21m47 22-17-22m35-50-26 22"/>',
  '<path d="M149 171h103l-8-43h-87z" fill="#f3b9cd"/><path d="M143 179h115M176 104q-12-14 0-27m24 27q-12-14 0-27m24 27q-12-14 0-27"/>',
  '<path d="M200 106q-37-22-66-10v81q31-8 66 12 35-20 66-12v-81q-29-12-66 10z" fill="#c5b9ea"/><path d="M200 106v83m-49-69 31 6m-31 19 31 6m37-25 30-6m-30 31 30-6"/>',
  '<path d="M222 85a54 54 0 1 0 24 87 56 56 0 0 1-24-87" fill="#ffc44d"/><path d="m247 100 3 9 10 0-8 6 3 9-8-6-8 6 3-9-8-6h10z" fill="#ffc44d"/>',
];
export async function demoArtwork(slot: number, activity: number): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" rx="28" fill="${colors[slot]}"/><circle cx="200" cy="136" r="82" fill="#fff8e8"/><g stroke="#303452" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none">${icons[activity]}</g><path d="M50 252 Q120 225 200 252 T350 252" fill="none" stroke="#303452" stroke-width="5" stroke-linecap="round"/><circle cx="355" cy="40" r="12" fill="#fff8e8"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
