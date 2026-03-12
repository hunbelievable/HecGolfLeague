import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

const PLAYERS = [
  { id: "BDizzle", handicap: 4 },
  { id: "NickP", handicap: 8 },
  { id: "holiday402", handicap: 9 },
  { id: "bsteffy", handicap: 10 },
  { id: "BozClubBreaker", handicap: 9 },
  { id: "TLindell", handicap: 11 },
];

const TOURNAMENTS = [
  { id: 40579, name: "Cypress Point Club", week: "Week 1", date: "2026-01-10", isMajor: false },
  { id: 43157, name: "Pine Valley (AutoPutt)", week: "Week 2", date: "2026-01-17", isMajor: false },
  { id: 44078, name: "Shinnecock Hills", week: "Week 3", date: "2026-01-23", isMajor: false },
  { id: 45169, name: "National Golf Links", week: "Week 4", date: "2026-01-30", isMajor: false },
  { id: 45853, name: "DPC County Down", week: "Week 5", date: "2026-02-04", isMajor: false },
  { id: 47001, name: "DPC Portrush", week: "Week 6", date: "2026-02-11", isMajor: false },
  { id: 47836, name: "The Renaissance Club", week: "Week 7", date: "2026-02-18", isMajor: false },
  { id: 48674, name: "Gilded Dunes", week: "Week 8", date: "2026-02-24", isMajor: false },
  { id: 49707, name: "Jack's Point (NZ)", week: "Week 9", date: "2026-03-04", isMajor: false },
  { id: 50643, name: "Georgia Golf Club (Augusta)", week: "Week 10", date: "2026-03-11", isMajor: true },
];

// Gross results: [position, player, points, score]
const GROSS_RESULTS: Record<number, [number, string, number, string][]> = {
  40579: [
    [1, "BDizzle", 500, "+13"],
    [2, "BozClubBreaker", 300, "+14"],
    [3, "bsteffy", 190, "+14"],
    [4, "holiday402", 135, "+15"],
    [5, "NickP", 110, "+16"],
    [6, "TLindell", 100, "+26"],
  ],
  43157: [
    [1, "NickP", 500, "+22"],
    [2, "holiday402", 300, "+29"],
    [3, "BDizzle", 190, "+38"],
    [4, "BozClubBreaker", 135, "+39"],
    [5, "bsteffy", 110, "+42"],
    [6, "TLindell", 100, "+47"],
  ],
  44078: [
    [1, "BDizzle", 500, "+13"],
    [2, "holiday402", 300, "+14"],
    [3, "NickP", 190, "+16"],
    [4, "BozClubBreaker", 135, "+16"],
    [5, "bsteffy", 110, "+17"],
    [6, "TLindell", 100, "+23"],
  ],
  45169: [
    [1, "BDizzle", 500, "+15"],
    [2, "NickP", 300, "+18"],
    [3, "BozClubBreaker", 190, "+19"],
    [4, "bsteffy", 135, "+20"],
    [5, "holiday402", 110, "+21"],
    [6, "TLindell", 100, "+28"],
  ],
  45853: [
    [1, "BDizzle", 500, "+14"],
    [2, "NickP", 300, "+17"],
    [3, "holiday402", 190, "+18"],
    [4, "BozClubBreaker", 135, "+20"],
    [5, "bsteffy", 110, "+22"],
    [6, "TLindell", 100, "+25"],
  ],
  47001: [
    [1, "BDizzle", 500, "+16"],
    [2, "holiday402", 300, "+18"],
    [3, "bsteffy", 190, "+19"],
    [4, "BozClubBreaker", 135, "+21"],
    [5, "NickP", 110, "+23"],
    [6, "TLindell", 100, "+27"],
  ],
  47836: [
    [1, "bsteffy", 500, "+11"],
    [2, "BDizzle", 300, "+12"],
    [3, "NickP", 190, "+14"],
    [4, "holiday402", 135, "+15"],
    [5, "TLindell", 110, "+18"],
    [6, "BozClubBreaker", 100, "+20"],
  ],
  48674: [
    [1, "BDizzle", 500, "+10"],
    [2, "holiday402", 300, "+10"],
    [3, "NickP", 190, "+12"],
    [4, "BozClubBreaker", 135, "+14"],
    [5, "bsteffy", 110, "+16"],
    [6, "TLindell", 100, "+18"],
  ],
  49707: [
    [1, "BDizzle", 500, "+8"],
    [2, "BozClubBreaker", 300, "+12"],
    [3, "NickP", 190, "+13"],
    [4, "holiday402", 135, "+14"],
    [5, "bsteffy", 110, "+16"],
    [6, "TLindell", 100, "+19"],
  ],
  50643: [
    [1, "BDizzle", 500, "+12"],
    [2, "NickP", 300, "+15"],
    [3, "BozClubBreaker", 190, "+18"],
    [4, "bsteffy", 135, "+20"],
    [5, "TLindell", 110, "+22"],
    [6, "holiday402", 100, "+30"],
  ],
};

// Net results: [position, player, points, score]
const NET_RESULTS: Record<number, [number, string, number, string][]> = {
  40579: [
    [1, "BDizzle", 500, "E"],
    [2, "BozClubBreaker", 300, "+5"],
    [3, "NickP", 190, "+8"],
    [4, "bsteffy", 135, "+4"],
    [5, "holiday402", 110, "+6"],
    [6, "TLindell", 100, "+15"],
  ],
  43157: [
    [1, "TLindell", 500, "+12"],
    [2, "NickP", 300, "+14"],
    [3, "holiday402", 190, "+20"],
    [4, "BDizzle", 135, "+34"],
    [5, "BozClubBreaker", 110, "+30"],
    [6, "bsteffy", 100, "+32"],
  ],
  44078: [
    [1, "TLindell", 500, "+12"],
    [2, "BDizzle", 300, "+9"],
    [3, "NickP", 190, "+8"],
    [4, "holiday402", 135, "+5"],
    [5, "BozClubBreaker", 110, "+7"],
    [6, "bsteffy", 100, "+7"],
  ],
  45169: [
    [1, "BDizzle", 500, "+11"],
    [2, "NickP", 300, "+10"],
    [3, "TLindell", 190, "+17"],
    [4, "holiday402", 135, "+12"],
    [5, "BozClubBreaker", 110, "+10"],
    [6, "bsteffy", 100, "+10"],
  ],
  45853: [
    [1, "BDizzle", 500, "+10"],
    [2, "TLindell", 300, "+14"],
    [3, "NickP", 190, "+9"],
    [4, "holiday402", 135, "+9"],
    [5, "BozClubBreaker", 110, "+11"],
    [6, "bsteffy", 100, "+12"],
  ],
  47001: [
    [1, "BDizzle", 500, "+12"],
    [2, "TLindell", 300, "+16"],
    [3, "NickP", 190, "+15"],
    [4, "holiday402", 135, "+9"],
    [5, "BozClubBreaker", 110, "+12"],
    [6, "bsteffy", 100, "+9"],
  ],
  47836: [
    [1, "NickP", 500, "+6"],
    [2, "TLindell", 300, "+7"],
    [3, "BDizzle", 190, "+8"],
    [4, "bsteffy", 135, "+1"],
    [5, "holiday402", 110, "+6"],
    [6, "BozClubBreaker", 100, "+11"],
  ],
  48674: [
    [1, "BDizzle", 500, "+6"],
    [2, "holiday402", 300, "+1"],
    [3, "NickP", 190, "+4"],
    [4, "BozClubBreaker", 135, "+5"],
    [5, "bsteffy", 110, "+6"],
    [6, "TLindell", 100, "+7"],
  ],
  49707: [
    [1, "BDizzle", 500, "+4"],
    [2, "TLindell", 300, "+8"],
    [3, "NickP", 190, "+5"],
    [4, "BozClubBreaker", 135, "+3"],
    [5, "holiday402", 110, "+5"],
    [6, "bsteffy", 100, "+6"],
  ],
  50643: [
    [1, "BDizzle", 500, "+8"],
    [2, "TLindell", 300, "+11"],
    [3, "NickP", 190, "+7"],
    [4, "BozClubBreaker", 135, "+9"],
    [5, "bsteffy", 100, "+10"],
    [6, "holiday402", 100, "+21"],
  ],
};

async function main() {
  console.log("Seeding database...");

  // Upsert players
  for (const player of PLAYERS) {
    await prisma.player.upsert({
      where: { id: player.id },
      update: { handicap: player.handicap },
      create: player,
    });
  }
  console.log(`Seeded ${PLAYERS.length} players`);

  // Upsert tournaments
  for (const t of TOURNAMENTS) {
    await prisma.tournament.upsert({
      where: { id: t.id },
      update: { name: t.name, week: t.week, date: t.date, isMajor: t.isMajor },
      create: t,
    });
  }
  console.log(`Seeded ${TOURNAMENTS.length} tournaments`);

  // Upsert gross results
  let resultCount = 0;
  for (const [tid, results] of Object.entries(GROSS_RESULTS)) {
    for (const [pos, player, points, score] of results) {
      await prisma.result.upsert({
        where: { tournamentId_playerId_type: { tournamentId: Number(tid), playerId: player, type: "gross" } },
        update: { position: pos, points, score },
        create: { tournamentId: Number(tid), playerId: player, type: "gross", position: pos, points, score },
      });
      resultCount++;
    }
  }

  // Upsert net results
  for (const [tid, results] of Object.entries(NET_RESULTS)) {
    for (const [pos, player, points, score] of results) {
      await prisma.result.upsert({
        where: { tournamentId_playerId_type: { tournamentId: Number(tid), playerId: player, type: "net" } },
        update: { position: pos, points, score },
        create: { tournamentId: Number(tid), playerId: player, type: "net", position: pos, points, score },
      });
      resultCount++;
    }
  }

  console.log(`Seeded ${resultCount} results`);
  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
