import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = "screenshots/design";
const EMAIL = process.env.DEMO_EMAIL || "admin@velora.test";
const PASSWORD = process.env.DEMO_PASSWORD || "password";

fs.mkdirSync(OUT, { recursive: true });

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 40000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1200);
}

async function capture(browser, name, path, { viewport, authed }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  if (authed) await login(page);
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 }).catch((e) => errors.push(String(e)));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`[${name}] ${page.url()}${errors.length ? ` errors=${errors.length}` : ""}`);
  if (errors.length) console.log(errors.slice(0, 3));
  await context.close();
}

const desktop = { width: 1280, height: 860 };
const mobile = { width: 390, height: 844 };

async function main() {
  const browser = await chromium.launch({ headless: true });
  const pages = [
    ["overview", "/"],
    ["sales", "/sales"],
    ["orders", "/orders"],
    ["kitchen", "/kitchen"],
    ["products", "/products"],
    ["inventory", "/inventory"],
  ];
  for (const [name, path] of pages) {
    await capture(browser, name, path, { viewport: desktop, authed: true });
  }
  await capture(browser, "mobile-sell", "/sales", { viewport: mobile, authed: true });
  for (const [name, path] of [
    ["landing", "/landing"],
    ["login", "/login"],
    ["register", "/register"],
  ]) {
    await capture(browser, name, path, { viewport: desktop, authed: false });
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
