-- Course Journal: per-event course setup (from SGT) and per-course league notes
CREATE TABLE "CourseSetup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tournamentId" INTEGER NOT NULL,
    "courseName" TEXT NOT NULL,
    "sgtCourseId" INTEGER,
    "coursePar" INTEGER,
    "tees" TEXT,
    "slope" INTEGER,
    "rating" REAL,
    "stimp" INTEGER,
    "fairways" TEXT,
    "greens" TEXT,
    "pins" TEXT,
    "weather" TEXT,
    "wind" TEXT,
    "gimmies" TEXT,
    CONSTRAINT "CourseSetup_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CourseSetup_tournamentId_key" ON "CourseSetup"("tournamentId");

CREATE TABLE "CourseJournal" (
    "courseName" TEXT NOT NULL PRIMARY KEY,
    "notes" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
