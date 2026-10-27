import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";

async function capture(browser, name, path) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  const failed = [];
  page.on("response", (res) => {
    if (res.status() >= 400) failed.push(`${res.status()} ${res.url()}`);
  });
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 }).catch((e) => errors.push(String(e)));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  const info = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    return {
      url: location.href,
      title: document.title,
      hasAppShell: !!q(".app"),
      hasSidebar: !!q(".sidebar"),
      hasTopbar: !!q(".topbar"),
      hasBottomNav: !!q(".bottom-nav"),
      navItems: document.querySelectorAll(".nav-item").length,
      is404: !!q(".status-card") || document.body.innerText.includes("does not exist"),
      pageHead: !!q(".page-head"),
      bodyStart: document.body.innerText.slice(0, 120).replace(/\s+/g, " "),
    };
  });
  console.log(`[${name}]`, JSON.stringify(info, null, 2));
  if (errors.length) console.log(`[${name}] console errors:`, errors.slice(0, 5));
  if (failed.length) console.log(`[${name}] failed requests:`, failed.slice(0, 8));
  await context.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  await capture(browser, "home", "/");
  await capture(browser, "settings", "/settings");
  await capture(browser, "login", "/login");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
