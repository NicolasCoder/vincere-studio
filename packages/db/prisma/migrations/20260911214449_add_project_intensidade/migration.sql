-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "costMode" TEXT NOT NULL DEFAULT 'FREE',
    "niche" TEXT NOT NULL,
    "tone" TEXT,
    "targetDuration" INTEGER,
    "audience" TEXT,
    "hooks" TEXT NOT NULL DEFAULT '[]',
    "stage" TEXT NOT NULL DEFAULT 'IDEATION',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "costUsd" REAL NOT NULL DEFAULT 0,
    "visualStyle" TEXT NOT NULL DEFAULT 'DARK_DOC',
    "intensidade" TEXT NOT NULL DEFAULT 'equilibrado',
    "thumbnailPath" TEXT,
    "thumbnailUpdatedAt" DATETIME,
    "voiceProfileId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_voiceProfileId_fkey" FOREIGN KEY ("voiceProfileId") REFERENCES "VoiceProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("audience", "costMode", "costUsd", "createdAt", "format", "hooks", "id", "niche", "stage", "status", "targetDuration", "thumbnailPath", "thumbnailUpdatedAt", "title", "tone", "updatedAt", "visualStyle", "voiceProfileId") SELECT "audience", "costMode", "costUsd", "createdAt", "format", "hooks", "id", "niche", "stage", "status", "targetDuration", "thumbnailPath", "thumbnailUpdatedAt", "title", "tone", "updatedAt", "visualStyle", "voiceProfileId" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
