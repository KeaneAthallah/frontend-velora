import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
  const page = await ctx.newPage();
  await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
  for (const route of ["login", "register"]) {
    await page.goto(`${BASE}/${route}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(700);
    const info = await page.evaluate(() => {
      const pick = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { color: cs.color, bg: cs.backgroundColor };
      };
      return {
        html: document.documentElement.className,
        panel: pick(".auth__aside"),
        brand: pick(".auth__brand"),
        heading: pick(".auth__pitch-heading"),
        em: pick(".auth__pitch-heading em"),
        body: pick(".auth__pitch p"),
        point: pick(".auth__point"),
        pointB: pick(".auth__point b"),
        foot: pick(".auth__foot"),
      };
    });
    console.log(theme, route, JSON.stringify(info));
    await page.screenshot({ path: `./screenshots/tmp/${route}-${theme}.png` });
  }
  await ctx.close();
}
await browser.close();
