import { chromium } from "playwright";

function lum(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return ((x + 0.05) / (y + 0.05)).toFixed(2);
}
const parse = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);

const browser = await chromium.launch({ headless: true });
for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ colorScheme: theme });
  const page = await ctx.newPage();
  await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(500);
  const data = await page.evaluate(() => {
    const g = (sel) => {
      const el = document.querySelector(sel);
      const cs = getComputedStyle(el);
      return { color: cs.color, size: cs.fontSize, weight: cs.fontWeight };
    };
    return {
      bg: getComputedStyle(document.querySelector(".auth__aside")).backgroundColor,
      brand: g(".auth__brand"),
      eyebrow: g(".auth__aside .eyebrow"),
      heading: g(".auth__pitch-heading"),
      em: g(".auth__pitch-heading em"),
      body: g(".auth__pitch p"),
      point: g(".auth__point"),
      pointB: g(".auth__point b"),
      foot: g(".auth__foot"),
    };
  });
  const bg = parse(data.bg);
  console.log(`\n== ${theme} ==  panel bg ${data.bg}`);
  for (const [k, v] of Object.entries(data)) {
    if (k === "bg") continue;
    console.log(`  ${k.padEnd(8)} ${v.size.padEnd(7)} ${v.color.padEnd(20)} contrast ${ratio(parse(v.color), bg)}`);
  }
  await ctx.close();
}
await browser.close();
