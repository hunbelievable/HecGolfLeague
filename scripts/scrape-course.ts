/**
 * Scrapes each event's course + round settings from the public SGT tournament
 * page into CourseSetup (feeds the Course Journal).
 *
 * - /tournament/{id}                 → #settingsView (tees, slope, rating, stimp, ...)
 *                                      and scorecard_{sgtCourseId}.jpg
 * - /sgt-api/courses/courseDetails/{sgtCourseId} → full 18-hole course par
 *
 * No login needed. Scrapes every tournament in the DB by default.
 *
 * Run: npm run scrape-course
 * Only some events: npm run scrape-course -- 74230 75012
 */

import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const dbPath = path.resolve(process.cwd(), "data/dev.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

const BASE_URL = "https://simulatorgolftour.com";
const HEADERS = { "User-Agent": "Mozilla/5.0", "X-Requested-With": "XMLHttpRequest" };

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

// Settings panel is a flat list of LABEL / value pairs: "ROUND 1", course, "STIMP", "11", ...
function parseSettings(html: string) {
  const $ = cheerio.load(html);
  const tokens = $("#settingsView *")
    .contents()
    .filter((_, n) => n.type === "text")
    .map((_, n) => $(n).text().trim())
    .get()
    .filter(Boolean);

  const value = (label: string) => {
    const i = tokens.indexOf(label);
    return i >= 0 && i + 1 < tokens.length ? tokens[i + 1] : null;
  };
  const round = tokens.findIndex(t => /^ROUND \d+$/.test(t));
  const courseName = round >= 0 ? tokens[round + 1] : null;
  const sgtCourseId = html.match(/scorecard_(\d+)\.jpg/)?.[1];
  const num = (s: string | null) => (s !== null && s !== "" && !isNaN(Number(s)) ? Number(s) : null);

  return {
    courseName,
    sgtCourseId: sgtCourseId ? Number(sgtCourseId) : null,
    tees: value("TEES"),
    slope: num(value("SLOPE")),
    rating: num(value("RATING")),
    stimp: num(value("STIMP")),
    fairways: value("FAIRWAYS"),
    greens: value("GREENS"),
    pins: value("PINS"),
    weather: value("WEATHER"),
    wind: value("WIND"),
    gimmies: value("GIMMIES"),
  };
}

async function fetchCoursePar(sgtCourseId: number): Promise<number | null> {
  const html = await getText(`${BASE_URL}/sgt-api/courses/courseDetails/${sgtCourseId}`);
  const $ = cheerio.load(html);
  const text = $.root().text().replace(/\s+/g, " ");
  const par = text.match(/PAR (\d{2})/)?.[1];
  return par ? Number(par) : null;
}

async function main() {
  const args = process.argv.slice(2).map(Number).filter(n => !isNaN(n));
  const tournaments = await prisma.tournament.findMany({
    where: args.length ? { id: { in: args } } : undefined,
    orderBy: [{ season: "asc" }, { date: "asc" }],
  });

  for (const t of tournaments) {
    try {
      const s = parseSettings(await getText(`${BASE_URL}/tournament/${t.id}`));
      if (!s.courseName) {
        console.log(`⚠️  ${t.id} ${t.name}: no settings panel found — skipped`);
        continue;
      }
      const coursePar = s.sgtCourseId ? await fetchCoursePar(s.sgtCourseId) : null;
      const data = { ...s, courseName: s.courseName, coursePar };

      await prisma.courseSetup.upsert({
        where: { tournamentId: t.id },
        create: { tournamentId: t.id, ...data },
        update: data,
      });
      console.log(
        `✓ S${t.season} ${t.week.padEnd(7)} ${s.courseName} — ${s.tees} tees, ` +
        `slope ${s.slope}, rating ${s.rating}, par ${coursePar}`
      );
    } catch (err) {
      console.log(`✗ ${t.id} ${t.name}: ${(err as Error).message}`);
    }
  }
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
