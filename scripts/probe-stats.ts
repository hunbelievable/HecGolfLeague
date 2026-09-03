import { chromium } from "playwright";

async function main() {
  const userDataDir = require("path").join(process.env.HOME || "", ".hec-golf-scraper-profile");
  let browser: any, page: any;
  try {
    const ctx = await chromium.launchPersistentContext(userDataDir, { headless: true, channel: "chrome", args: ["--no-first-run"] });
    browser = ctx; page = ctx.pages()[0] || await ctx.newPage();
  } catch { browser = await chromium.launch({ headless: true }); page = await browser.newPage(); }

  const captured: string[] = [];
  page.on("request", (req: any) => {
    const u = req.url();
    if (u.includes("sgt-api") && u.includes("stats")) captured.push(u);
  });

  // Navigate to tournament page and click STATISTICS to establish context
  await page.goto("https://simulatorgolftour.com/tournament/67662", { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.locator("text=STATISTICS").first().click();
  await page.waitForTimeout(2000);

  // Click ALL VIEW ALL buttons on the stats page and capture every URL hit
  const viewAllBtns = page.locator("text=VIEW ALL");
  const count = await viewAllBtns.count();
  console.log(`Found ${count} VIEW ALL buttons`);

  captured.length = 0;
  for (let i = 0; i < count; i++) {
    const btn = viewAllBtns.nth(i);
    await btn.click().catch(() => {});
    await page.waitForTimeout(600);
  }
  console.log("\nAll stat URLs discovered:");
  [...new Set(captured)].forEach(u => console.log(" ", u.replace(/\?.*/, "")));

  // Now also click LONG DRIVE and capture those VIEW ALL URLs
  captured.length = 0;
  await page.locator("text=LONG DRIVE").first().click();
  await page.waitForTimeout(2000);

  const ldBtns = page.locator("text=VIEW ALL");
  const ldCount = await ldBtns.count();
  console.log(`\nLong Drive VIEW ALL buttons: ${ldCount}`);
  for (let i = 0; i < ldCount; i++) {
    await ldBtns.nth(i).click().catch(() => {});
    await page.waitForTimeout(600);
  }
  console.log("Long Drive URLs:");
  [...new Set(captured)].forEach(u => console.log(" ", u.replace(/\?.*/, "")));

  // Show full long drive page text after expanding all
  const ldText = await page.evaluate(() => document.body.innerText) as string;
  const idx = ldText.indexOf("ROUND 1");
  console.log("\n=== Full Long Drive page ===");
  console.log(ldText.slice(idx >= 0 ? idx : 0, (idx >= 0 ? idx : 0) + 2000));

  await browser.close();
}
main().catch(console.error);
