import sharp from "sharp";

const MASTER_DIR = "../velora_separated_assets";

// Banners/logos carry a plain white field; the icon tiles carry a soft baked-in
// glow around the squircle, so they use a broader brightness-based fill.
const jobs = [
  { name: "velora_app_icon_dark.png", mode: "glow", avgCut: 160, featherR: 20, featherLo: 70, featherHi: 160 },
  { name: "velora_app_icon_light.png", mode: "glow", avgCut: 212, featherR: 4, featherLo: 130, featherHi: 190 },
  { name: "velora_dark_logo_banner.png", mode: "white" },
  { name: "velora_primary_logo.png", mode: "white" },
];

function floodTransparent(data, w, h, isBackground) {
  const visited = new Uint8Array(w * h);
  const queue = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    visited[p] = 1;
    if (isBackground(p * 4)) queue.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (queue.length) {
    const p = queue.pop();
    const x = p % w, y = (p / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  return visited;
}

function distanceField(w, h, seeds, radius) {
  const dist = new Uint8Array(w * h).fill(255);
  const queue = [];
  for (const p of seeds) { dist[p] = 0; queue.push(p); }
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (dist[p] >= radius) continue;
    const x = p % w, y = (p / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = ny * w + nx;
      if (dist[np] <= dist[p] + 1) continue;
      dist[np] = dist[p] + 1;
      queue.push(np);
    }
  }
  return dist;
}

for (const job of jobs) {
  const { info, data: raw } = await sharp(`${MASTER_DIR}/${job.name}`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  const isBackground =
    job.mode === "glow"
      ? (i) => (raw[i] + raw[i + 1] + raw[i + 2]) / 3 > (job.avgCut ?? 160) // swallow the glow halo
      : (i) => raw[i] > 237 && raw[i + 1] > 237 && raw[i + 2] > 237; // plain white

  const filled = floodTransparent(raw, w, h, isBackground);
  const seeds = [];
  for (let p = 0; p < w * h; p++) if (filled[p]) seeds.push(p);
  const featherR = job.featherR ?? 20;
  const featherLo = job.featherLo ?? 70;
  const featherHi = job.featherHi ?? 160;
  const dist = distanceField(w, h, seeds, featherR);

  const out = Buffer.from(raw);
  for (let p = 0; p < w * h; p++) {
    if (filled[p]) { out[p * 4 + 3] = 0; continue; }
    if (dist[p] > featherR) continue;
    const r = raw[p * 4], g = raw[p * 4 + 1], b = raw[p * 4 + 2];
    if (job.mode === "glow") {
      // pale residue near the edge becomes transparent: alpha from brightness
      const avg = (r + g + b) / 3;
      const amount = Math.max(0, Math.min(1, (avg - featherLo) / (featherHi - featherLo)));
      out[p * 4 + 3] = Math.min(out[p * 4 + 3], Math.round(255 * (1 - amount)));
    } else {
      const whiteness = Math.min(r, g, b);
      const MARK_WHITE = 205, MARK_DARK = 105;
      const amount = Math.max(0, Math.min(1, (whiteness - MARK_DARK) / (MARK_WHITE - MARK_DARK)));
      out[p * 4 + 3] = Math.min(out[p * 4 + 3], Math.round(255 * (1 - amount)));
    }
  }

  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(`public/brand/${job.name}`);
  console.log(`done: ${job.name} (${w}x${h}) [${job.mode}]`);
}
console.log("all logos converted from masters");
