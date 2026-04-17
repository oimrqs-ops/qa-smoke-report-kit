import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const targetUrl = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!targetUrl) {
  console.error("Usage: npm run smoke -- https://example.com");
  process.exit(1);
}

const outDir = path.resolve("out");
await fs.mkdir(outDir, { recursive: true });

const issues = [];
const evidence = [];

function addIssue(severity, check, detail) {
  issues.push({ severity, check, detail });
}

function statusIcon(ok) {
  return ok ? "PASS" : "CHECK";
}

if (dryRun) {
  const report = [
    "# QA Smoke Report",
    "",
    `Target: ${targetUrl}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "Dry run completed. Install Playwright browsers and run without `--dry-run` for a live pass.",
    "",
  ].join("\n");
  await fs.writeFile(path.join(outDir, "smoke-report.md"), report);
  console.log(report);
  process.exit(0);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(err.message));

let response;
try {
  response = await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });
} catch (error) {
  addIssue("high", "page-load", error.message);
}

const status = response?.status() ?? 0;
if (!response || status >= 400) {
  addIssue("high", "http-status", `Page returned status ${status || "unknown"}`);
}

const title = await page.title().catch(() => "");
evidence.push(`Title: ${title || "(empty)"}`);

const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
if (desktopOverflow) addIssue("medium", "desktop-overflow", "Document is wider than the desktop viewport.");

await page.setViewportSize({ width: 390, height: 844 });
const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
if (mobileOverflow) addIssue("medium", "mobile-overflow", "Document is wider than the mobile viewport.");

const linkStats = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll("a"));
  return {
    total: links.length,
    empty: links.filter((link) => !link.getAttribute("href") || link.getAttribute("href") === "#").length,
  };
});

if (linkStats.empty > 0) {
  addIssue("low", "empty-links", `${linkStats.empty} links are missing useful href values.`);
}

if (consoleErrors.length > 0) {
  addIssue("medium", "console-errors", consoleErrors.slice(0, 5).join(" | "));
}

const screenshotPath = path.join(outDir, "smoke-mobile.png");
await page.screenshot({ path: screenshotPath, fullPage: true });
await browser.close();

const reportLines = [
  "# QA Smoke Report",
  "",
  `Target: ${targetUrl}`,
  `Generated: ${new Date().toISOString()}`,
  `HTTP status: ${status || "unknown"}`,
  `Result: ${statusIcon(issues.length === 0)}`,
  "",
  "## Evidence",
  "",
  ...evidence.map((item) => `- ${item}`),
  `- Links found: ${linkStats.total}`,
  `- Mobile screenshot: ${screenshotPath}`,
  "",
  "## Issues",
  "",
  issues.length
    ? "| Severity | Check | Detail |\n| --- | --- | --- |\n" +
      issues.map((issue) => `| ${issue.severity} | ${issue.check} | ${issue.detail.replaceAll("|", "\\|")} |`).join("\n")
    : "No issues found in this smoke pass.",
  "",
  "## Next Actions",
  "",
  issues.length
    ? "- Fix high severity items first, then rerun this smoke check.\n- Use the screenshot and console notes as review evidence."
    : "- Share the report with the handoff note.\n- Keep this smoke check as a lightweight regression gate.",
  "",
].join("\n");

await fs.writeFile(path.join(outDir, "smoke-report.md"), reportLines);
console.log(reportLines);
