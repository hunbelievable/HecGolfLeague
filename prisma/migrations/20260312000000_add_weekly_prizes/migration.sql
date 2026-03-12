-- CreateTable
CREATE TABLE "WeeklyPrize" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tournamentId" INTEGER NOT NULL,
    "skinsWinner" TEXT,
    "ctpWinner" TEXT,
    "netWinner" TEXT,
    CONSTRAINT "WeeklyPrize_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyPrize_tournamentId_key" ON "WeeklyPrize"("tournamentId");
