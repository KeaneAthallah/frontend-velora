import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ colorScheme: "dark" });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem("theme", "dark"));
await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(600);
console.log(await page.evaluate(() => {
  const aside = document.querySelector(".auth__aside");
  const p = document.querySelector(".auth__pitch p");
  const em = document.querySelector(".auth__pitch-heading em");
  return {
    html: document.documentElement.className,
    asideVars: ["--auth-ink", "--auth-body", "--auth-accent", "--auth-strong", "--auth-muted"].map((v) => v + "=" + getComputedStyle(aside).getPropertyValue(v)),
    pVars: getComputedStyle(p).getPropertyValue("--auth-body"),
    pColor: getComputedStyle(p).color,
    emColor: getComputedStyle(em).color,
    sheetCount: document.styleSheets.length,
  };
}));
await browser.close();
