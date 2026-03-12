-- CreateTable
CREATE TABLE "LaunchMonitorShot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tournamentId" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "roundKey" TEXT NOT NULL,
    "shotKey" TEXT NOT NULL,
    "hole" INTEGER NOT NULL,
    "holeShot" INTEGER NOT NULL,
    "globalShotNum" INTEGER NOT NULL,
    "clubName" TEXT NOT NULL,
    "shotResult" TEXT,
    "ballSpeed" REAL,
    "carryDist" REAL,
    "totalDist" REAL,
    "distToPin" REAL,
    "peakHeight" REAL,
    "offline" REAL,
    "clubSpeed" REAL,
    "backSpin" REAL,
    "spinAxis" REAL,
    "clubAoA" REAL,
    "clubPath" REAL,
    "faceToPath" REAL,
    "faceToTarget" REAL,
    "descAngle" REAL,
    "hla" REAL,
    "vla" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LaunchMonitorShot_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LaunchMonitorShot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LaunchMonitorShot_shotKey_key" ON "LaunchMonitorShot"("shotKey");

-- CreateIndex
CREATE INDEX "LaunchMonitorShot_tournamentId_playerId_idx" ON "LaunchMonitorShot"("tournamentId", "playerId");
