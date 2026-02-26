-- CreateEnum
CREATE TYPE "StreamSource" AS ENUM ('openalex');

-- Normalize existing values before enum conversion
UPDATE "streams"
SET "source" = 'openalex'
WHERE "source" <> 'openalex';

-- AlterTable
ALTER TABLE "streams"
  ALTER COLUMN "source" DROP DEFAULT,
  ALTER COLUMN "source" TYPE "StreamSource" USING (
    CASE WHEN "source" = 'openalex' THEN "source" ELSE 'openalex' END::"StreamSource"
  ),
  ALTER COLUMN "source" SET DEFAULT 'openalex',
  ADD COLUMN "maxObjects" INTEGER NOT NULL DEFAULT 100;

ALTER TABLE "streams"
  ADD CONSTRAINT "streams_maxObjects_range" CHECK ("maxObjects" BETWEEN 1 AND 500);

-- CreateIndex
CREATE INDEX "stream_runs_streamId_startedAt_idx" ON "stream_runs"("streamId", "startedAt" DESC);
