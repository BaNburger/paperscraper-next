CREATE TABLE "stream_run_objects" (
  "id" TEXT NOT NULL,
  "streamRunId" TEXT NOT NULL,
  "streamId" TEXT NOT NULL,
  "objectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stream_run_objects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stream_run_objects_streamRunId_objectId_key"
  ON "stream_run_objects"("streamRunId", "objectId");

CREATE INDEX "stream_run_objects_streamId_objectId_idx"
  ON "stream_run_objects"("streamId", "objectId");

CREATE INDEX "stream_run_objects_objectId_idx"
  ON "stream_run_objects"("objectId");

CREATE INDEX "object_pipeline_cards_pipelineId_stageId_position_idx"
  ON "object_pipeline_cards"("pipelineId", "stageId", "position");

ALTER TABLE "stream_run_objects"
  ADD CONSTRAINT "stream_run_objects_streamRunId_fkey"
  FOREIGN KEY ("streamRunId") REFERENCES "stream_runs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stream_run_objects"
  ADD CONSTRAINT "stream_run_objects_streamId_fkey"
  FOREIGN KEY ("streamId") REFERENCES "streams"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stream_run_objects"
  ADD CONSTRAINT "stream_run_objects_objectId_fkey"
  FOREIGN KEY ("objectId") REFERENCES "research_objects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
