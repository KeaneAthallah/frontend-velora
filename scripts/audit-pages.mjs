import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";

const ROUTES = [
  { path: "/", name: "home" },
  { path: "/sales", name: "sales" },
  { path: "/transactions", name: "transactions" },
  { path: "/products", name: "products" },
  { path: "/inventory", name: "inventory" },
  { path: "/purchasing", name: "purchasing" },
  { path: "/suppliers", name: "suppliers" },
  { path: "/customers", name: "customers" },
  { path: "/reports", name: "reports" },
  { path: "/employees", name: "employees" },
  { path: "/settings", name: "settings" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

async function auditRoute(page, theme, viewportName, route) {
  await page.evaluate((t) => {
    localStorage.setItem("theme", t);
  }, theme);
  await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(700);
  const info = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const text = document.body.innerText;
    return {
      url: location.pathname,
      title: document.title,
      heading: q("h1")?.textContent?.trim() ?? null,
      hasAppShell: !!q(".app"),
      hasSidebar: !!q(".sidebar"),
      hasTopbar: !!q(".topbar"),
      hasBottomNav: !!q(".bottom-nav"),
      navItems: document.querySelectorAll(".nav-item").length,
      tableRows: document.querySelectorAll("tbody tr").length,
      buttons: document.querySelectorAll("button").length,
      inputs: document.querySelectorAll("input, select, textarea").length,
      images: Array.from(document.images).filter((img) => !img.complete || img.naturalWidth === 0).length,
      horizScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      notFound: text.includes("does not exist"),
      denied: text.includes("You do not have access"),
    };
  });
  info.viewport = viewportName;
  info.theme = theme;
  info.route = route.name;
  info.ok =
    !info.notFound &&
    !info.denied &&
    (info.hasAppShell || info.url.includes("login")) &&
    info.images === 0 &&
    !info.horizScroll;
  await page.screenshot({
    path: `screenshots/audit-${viewportName}-${theme}-${route.name}.png`,
    fullPage: true,
  });
  return info;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  // Sign in once; session cookie lives in the shared context
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`${page.url()} :: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`${page.url()} :: [pageerror] ${err.message}`));

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.fill("#email", "admin@velora.test");
  await page.fill("#password", "password");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const theme of ["light", "dark"]) {
      for (const route of ROUTES) {
        const info = await auditRoute(page, theme, vp.name, route);
        results.push(info);
        const flag = info.ok ? "" : "  <== CHECK";
        console.log(
          `[${vp.name}/${theme}] ${route.name}: h="${info.heading}" shell=${info.hasAppShell} nav=${info.navItems} rows=${info.tableRows} imgfail=${info.images} hscroll=${info.horizScroll} 404=${info.notFound} denied=${info.denied}${flag}`
        );
      }
    }
  }

  console.log("\n== summary ==");
  const bad = results.filter((r) => !r.ok);
  console.log(`total=${results.length} ok=${results.length - bad.length} problems=${bad.length}`);
  for (const r of bad) {
    console.log(
      `  problem: [${r.viewport}/${r.theme}] ${r.route} 404=${r.notFound} denied=${r.denied} shell=${r.hasAppShell} imgfail=${r.images} hscroll=${r.horizScroll}`
    );
  }
  const uniqErrors = [...new Set(errors)];
  console.log(`console/page errors: ${uniqErrors.length}`);
  uniqErrors.slice(0, 12).forEach((e) => console.log("  •", e));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
