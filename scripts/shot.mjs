// Usage: node scripts/shot.mjs <path> <out.png> [width=1360] [height=900] [email=nouman@taskflow.local] [--full]
// Logs in via the UI API, opens the page, prints console errors / failed requests, saves a screenshot.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const [, , pagePath = "/", out = "/tmp/claude-1000/shot.png", w = "1360", h = "900", email = "nouman@taskflow.local"] = process.argv;
const full = process.argv.includes("--full");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const cache = path.join(process.env.HOME, ".cache/ms-playwright");
let exe;
try {
  const dirs = fs.readdirSync(cache).filter((d) => d.startsWith("chromium-")).sort();
  for (const d of dirs.reverse()) {
    const c = path.join(cache, d, "chrome-linux64/chrome");
    const c2 = path.join(cache, d, "chrome-linux/chrome");
    if (fs.existsSync(c)) { exe = c; break; }
    if (fs.existsSync(c2)) { exe = c2; break; }
  }
} catch {}
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h } });
const res = await ctx.request.post(`${base}/api/auth/login`, { data: { email, password: "Password@123" } });
if (!res.ok()) { console.error("login failed", res.status(), await res.text()); process.exit(1); }
const page = await ctx.newPage();
const problems = [];
page.on("console", (m) => m.type() === "error" && problems.push("console: " + m.text()));
page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
page.on("response", (r) => r.status() >= 400 && problems.push(`http ${r.status()}: ${r.url()}`));
await page.goto(base + pagePath, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: out, fullPage: full });
console.log(problems.length ? "PROBLEMS:\n" + problems.join("\n") : "no console errors / failed requests");
console.log("saved", out);
await browser.close();
