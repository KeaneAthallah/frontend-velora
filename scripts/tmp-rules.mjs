import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ colorScheme: "dark" });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem("theme", "dark"));
await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(500);
const res = await page.evaluate(() => {
  const out = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of rules) {
      const t = rule.cssText || "";
      if (t.includes("auth__pitch p") || t.includes("auth__point") || t.includes("auth__foot") || t.includes("auth__aside")) out.push(t.slice(0, 160));
    }
  }
  return out;
});
res.forEach((r) => console.log("-", r));
await browser.close();
