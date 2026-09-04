/**
 * Probe VIEW ALL for each stat section — reload page between each to avoid DOM mutation issues.
 */
import { chromium } from "playwright";

const TOURNAMENT_ID = 67662;
const BASE_URL = "https://simulatorgolftour.com";

const TARGET_STATS = ["FIR", "GIR", "GIR PROXIMITY", "PUTTS/ROUND", "PUTTS/GIR"];

async function probeOne(page: import("playwright").Page, statName: string): Promise<string[]> {
  await page.goto(`${BASE_URL}/tournament/${TOURNAMENT_ID}`, {
    waitUntil: "domcontentloaded", timeout: 20000,
  });
  await page.waitForTimeout(1500);
  await page.locator("text=STATISTICS").first().click();
  await page.waitForTimeout(2000);

  const capturedUrls: string[] = [];
  const onRequest = (req: import("playwright").Request) => {
    if (req.url().includes("sgt-api/leaderboard")) capturedUrls.push(req.url());
  };
  page.on("request", onRequest);

  await page.evaluate((heading: string) => {
    const headings = Array.from(document.querySelectorAll("h5"));
    const h = headings.find(el => el.textContent?.trim() === heading);
    if (!h) return false;
    let el: HTMLElement | null = h as HTMLElement;
    for (let i = 0; i < 8; i++) {
      el = el?.parentElement ?? null;
      if (!el) break;
      if (el.className.includes("bg-sgt-md-gray")) {
        const viewAll = Array.from(el.querySelectorAll("button, a")).find(
          b => b.textContent?.toUpperCase().includes("VIEW ALL")
        ) as HTMLElement | null;
        if (viewAll) { viewAll.click(); return true; }
        return false;
      }
    }
    return false;
  }, statName);

  await page.waitForTimeout(2500);
  page.off("request", onRequest);

  return capturedUrls
    .filter(u => u.includes("/stats/"))
    .map(u => { const m = u.match(/\/stats\/([^?]+)/); return m ? m[1] : u; })
    .filter((v, i, a) => a.indexOf(v) === i);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const statName of TARGET_STATS) {
    const apis = await probeOne(page, statName);
    console.log(`${statName}: ${apis.join(", ") || "(none)"}`);
  }

  await browser.close();
}
main().catch(console.error);
