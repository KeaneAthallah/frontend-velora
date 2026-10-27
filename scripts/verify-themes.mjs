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
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);

  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => {
      localStorage.setItem("theme", t);
    }, theme);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    const favicon = await page.evaluate(() => document.querySelector('link[rel="icon"]')?.getAttribute("href"));
    const sidebarBg = await page.evaluate(() => {
      const el = document.querySelector(".sidebar");
      return el ? getComputedStyle(el).backgroundColor : null;
    });
    const project = await page.evaluate(() => {
      const link = document.querySelector(".nav-item[aria-current='page']");
      return link ? getComputedStyle(link).backgroundImage || getComputedStyle(link).backgroundColor : null;
    });
    console.log(`[${theme}] favicon=${favicon} sidebarBg=${sidebarBg} activeNavBg=${project}`);
    await page.screenshot({ path: `screenshots/theme-${theme}-home.png`, fullPage: false });

    // mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `screenshots/theme-${theme}-mobile.png`, fullPage: false });
    await page.setViewportSize({ width: 1440, height: 900 });
  }

  // login page in both themes (shows auth logos)
  await page.evaluate(() => localStorage.removeItem("theme") ?? null);
  await page.evaluate(() => {
    localStorage.setItem("theme", "light");
  });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "screenshots/theme-light-login.png", fullPage: false });
  await page.evaluate(() => {
    localStorage.setItem("theme", "dark");
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "screenshots/theme-dark-login.png", fullPage: false });

  console.log("console errors:", errors.length, errors.slice(0, 4));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
