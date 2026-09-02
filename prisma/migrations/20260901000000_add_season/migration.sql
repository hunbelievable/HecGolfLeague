-- Add season field to Tournament (1 = Spring 2026, 2 = Fall 2026)
ALTER TABLE "Tournament" ADD COLUMN "season" INTEGER NOT NULL DEFAULT 1;
