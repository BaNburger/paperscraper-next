-- CreateEnum
CREATE TYPE "ScoringProvider" AS ENUM ('openai', 'anthropic');

-- Normalize existing provider values before enum conversion
UPDATE "api_keys"
SET "provider" = CASE
  WHEN lower("provider") = 'openai' THEN 'openai'
  WHEN lower("provider") = 'anthropic' THEN 'anthropic'
  ELSE 'openai'
END;

-- AlterTable
ALTER TABLE "api_keys"
  ALTER COLUMN "provider" DROP DEFAULT,
  ALTER COLUMN "provider" TYPE "ScoringProvider" USING ("provider"::"ScoringProvider");

ALTER TABLE "dimensions"
  ADD COLUMN "provider" "ScoringProvider",
  ADD COLUMN "model" TEXT;

UPDATE "dimensions"
SET "provider" = 'openai',
    "model" = 'gpt-4o-mini'
WHERE "provider" IS NULL
   OR "model" IS NULL;

ALTER TABLE "dimensions"
  ALTER COLUMN "provider" SET NOT NULL,
  ALTER COLUMN "model" SET NOT NULL;

ALTER TABLE "research_objects"
  ADD COLUMN "sourceMetadata" JSONB;

-- CreateIndex
CREATE INDEX "object_entities_objectId_idx" ON "object_entities"("objectId");
CREATE INDEX "object_scores_dimensionId_idx" ON "object_scores"("dimensionId");
