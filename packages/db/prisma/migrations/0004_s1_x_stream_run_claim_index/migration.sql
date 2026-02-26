CREATE INDEX "stream_runs_streamId_status_startedAt_idx"
ON "stream_runs"("streamId", "status", "startedAt" DESC);
