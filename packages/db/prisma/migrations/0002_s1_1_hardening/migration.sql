-- CreateEnum
CREATE TYPE "StreamRunStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');

-- Normalize existing rows before enum conversion
UPDATE "stream_runs"
SET "status" = 'failed'
WHERE "status" NOT IN ('queued', 'running', 'succeeded', 'failed');

-- AlterTable
ALTER TABLE "stream_runs"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "StreamRunStatus" USING ("status"::"StreamRunStatus"),
  ALTER COLUMN "status" SET DEFAULT 'queued';

ALTER TABLE "stream_runs"
  ADD CONSTRAINT "stream_runs_processedCount_nonnegative" CHECK ("processedCount" >= 0),
  ADD CONSTRAINT "stream_runs_insertedCount_nonnegative" CHECK ("insertedCount" >= 0),
  ADD CONSTRAINT "stream_runs_updatedCount_nonnegative" CHECK ("updatedCount" >= 0),
  ADD CONSTRAINT "stream_runs_failedCount_nonnegative" CHECK ("failedCount" >= 0);

ALTER TABLE "pipeline_stages"
  ADD CONSTRAINT "pipeline_stages_position_nonnegative" CHECK ("position" >= 0);

ALTER TABLE "object_pipeline_cards"
  ADD CONSTRAINT "object_pipeline_cards_position_nonnegative" CHECK ("position" >= 0);

ALTER TABLE "api_keys"
  ADD CONSTRAINT "api_keys_encryptedKey_format" CHECK ("encryptedKey" LIKE 'enc:v1:%');
