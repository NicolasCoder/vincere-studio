ALTER TABLE "Scene" ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Scene" ADD COLUMN "reviewNote" TEXT;

ALTER TABLE "RenderJob" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RenderJob" ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "RenderJob" ADD COLUMN "reviewNote" TEXT;
ALTER TABLE "RenderJob" ADD COLUMN "reviewedAt" DATETIME;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY projectId ORDER BY COALESCE(startedAt, '1970-01-01'), id) AS rev
  FROM "RenderJob"
)
UPDATE "RenderJob"
SET revision = (SELECT rev FROM numbered WHERE numbered.id = "RenderJob".id);
