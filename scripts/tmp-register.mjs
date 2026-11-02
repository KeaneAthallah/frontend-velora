import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ colorScheme: theme, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
  await page.goto("http://localhost:3000/register", { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(600);
  console.log(`-- ${theme} --`, await page.evaluate(() => {
    const g = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { color: cs.color, bg: cs.backgroundColor };
    };
    return {
      panel: g(".auth__aside"),
      brand: g(".auth__brand"),
      eyebrow: g(".auth__aside .eyebrow"),
      heading: g(".auth__pitch-heading"),
      em: g(".auth__pitch-heading em"),
      body: g(".auth__pitch p"),
      point: g(".auth__point"),
      pointB: g(".auth__point b"),
      foot: g(".auth__foot"),
    };
  }));
  await ctx.close();
}
await browser.close();
