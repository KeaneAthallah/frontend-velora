import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.fill("#email", "admin@velora.test");
  await page.fill("#password", "password");
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.pathname.includes("/login"), { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);

  const info = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    return {
      url: location.pathname,
      hasAppShell: !!q(".app"),
      hasSidebar: !!q(".sidebar"),
      hasTopbar: !!q(".topbar"),
      hasBottomNav: !!q(".bottom-nav"),
      navItems: document.querySelectorAll(".nav-item").length,
      navLabels: [...document.querySelectorAll(".nav-item__label")].map((el) => el.textContent.trim()),
      has404: document.body.innerText.includes("does not exist"),
      heading: q(".page-head h1")?.textContent?.trim() ?? null,
    };
  });
  console.log("[signed-in home]", JSON.stringify(info, null, 2));
  await page.screenshot({ path: "screenshots/signed-in-home.png", fullPage: false });

  // Navigate via the sidebar to /settings
  const settingsLink = page.locator('.sidebar .nav-item').filter({ hasText: "Settings" }).first();
  await settingsLink.click().catch(() => {});
  await page.waitForTimeout(900);
  const settings = await page.evaluate(() => ({
    url: location.pathname,
    hasSidebar: !!document.querySelector(".sidebar"),
    heading: document.querySelector(".page-head h1")?.textContent?.trim() ?? null,
  }));
  console.log("[settings]", JSON.stringify(settings));
  await page.screenshot({ path: "screenshots/signed-in-settings.png", fullPage: false });

  if (errors.length) console.log("console errors:", errors.slice(0, 6));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
