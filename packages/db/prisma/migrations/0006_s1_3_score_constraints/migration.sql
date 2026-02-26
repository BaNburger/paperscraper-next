-- Normalize historical out-of-range scores before adding hard constraints.
UPDATE "object_scores"
SET "value" = LEAST(100, GREATEST(0, "value"))
WHERE "value" < 0 OR "value" > 100;

UPDATE "entity_scores"
SET "value" = LEAST(100, GREATEST(0, "value"))
WHERE "value" < 0 OR "value" > 100;

-- Enforce score bounds at the database layer.
ALTER TABLE "object_scores"
  ADD CONSTRAINT "object_scores_value_range" CHECK ("value" BETWEEN 0 AND 100);

ALTER TABLE "entity_scores"
  ADD CONSTRAINT "entity_scores_value_range" CHECK ("value" BETWEEN 0 AND 100);
