-- CreateTable
CREATE TABLE "Project" (
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
    "thumbnailPath" TEXT,
    "thumbnailUpdatedAt" DATETIME,
    "voiceProfileId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_voiceProfileId_fkey" FOREIGN KEY ("voiceProfileId") REFERENCES "VoiceProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "synopsis" TEXT NOT NULL,
    "hookLines" TEXT NOT NULL,
    "ctrEstimate" REAL,
    "score" INTEGER,
    "retention30s" REAL,
    "editingPace" TEXT,
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "coverPath" TEXT,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "promptVersion" TEXT,
    "model" TEXT,
    "viralityReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Idea_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Script" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "ideaId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "estimatedDuration" INTEGER NOT NULL DEFAULT 0,
    "retentionCurve" TEXT NOT NULL DEFAULT '[]',
    "metrics" TEXT NOT NULL DEFAULT '{}',
    "suggestions" TEXT NOT NULL DEFAULT '[]',
    "promptVersion" TEXT,
    "model" TEXT,
    "logline" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Script_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Script_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScriptBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scriptId" TEXT NOT NULL,
    "act" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "narration" TEXT NOT NULL,
    "wpm" INTEGER NOT NULL DEFAULT 150,
    "startMs" INTEGER,
    "endMs" INTEGER,
    "brollCue" TEXT,
    "soundCue" TEXT,
    "retentionScore" INTEGER,
    "note" TEXT,
    CONSTRAINT "ScriptBlock_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VoiceTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scriptBlockId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "params" TEXT NOT NULL DEFAULT '{}',
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VoiceTrack_scriptBlockId_fkey" FOREIGN KEY ("scriptBlockId") REFERENCES "ScriptBlock" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Caption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "voiceTrackId" TEXT NOT NULL,
    "words" TEXT NOT NULL,
    CONSTRAINT "Caption_voiceTrackId_fkey" FOREIGN KEY ("voiceTrackId") REFERENCES "VoiceTrack" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scriptBlockId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "provider" TEXT,
    "providerRef" TEXT,
    "prompt" TEXT,
    "filePath" TEXT,
    "mediaType" TEXT NOT NULL DEFAULT 'image',
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "motion" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "license" TEXT,
    "keywords" TEXT,
    "description" TEXT,
    "preferVideo" BOOLEAN NOT NULL DEFAULT false,
    "sourceUrl" TEXT,
    "thumbPath" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    CONSTRAINT "Scene_scriptBlockId_fkey" FOREIGN KEY ("scriptBlockId") REFERENCES "ScriptBlock" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VoiceProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "style" TEXT NOT NULL DEFAULT '',
    "rate" REAL NOT NULL DEFAULT 1.0,
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "fallbacks" TEXT NOT NULL DEFAULT '[]',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RenderJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "log" TEXT NOT NULL DEFAULT '',
    "outputPath" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    CONSTRAINT "RenderJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'YOUTUBE',
    "videoId" TEXT,
    "url" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "chapters" TEXT NOT NULL DEFAULT '[]',
    "thumbnailPath" TEXT,
    "publishedAt" DATETIME,
    "stats" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "Publication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "projectId" TEXT,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "logs" TEXT NOT NULL DEFAULT '',
    "result" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    CONSTRAINT "Job_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Usage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "provider" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "costUsd" REAL NOT NULL DEFAULT 0,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Usage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ReferenceChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "niche" TEXT NOT NULL,
    "notes" TEXT,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ScriptSkill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "niche" TEXT,
    "content" TEXT NOT NULL,
    "notes" TEXT,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GeneratedImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "model" TEXT,
    "aspect" TEXT NOT NULL DEFAULT '16:9',
    "filePath" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "costUsd" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedImage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EditPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "promptVersion" TEXT,
    "model" TEXT,
    "data" TEXT NOT NULL DEFAULT '{}',
    "insertions" INTEGER NOT NULL DEFAULT 0,
    "unresolved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'VERTICAL_COMMERCIAL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "graph" TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Job_status_createdAt_idx" ON "Job"("status", "createdAt");

-- CreateIndex
CREATE INDEX "GeneratedImage_projectId_createdAt_idx" ON "GeneratedImage"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "EditPlan_projectId_version_idx" ON "EditPlan"("projectId", "version");

