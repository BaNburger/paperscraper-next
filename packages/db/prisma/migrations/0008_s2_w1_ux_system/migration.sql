CREATE TABLE "feed_saved_views" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "definition" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feed_saved_views_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workspace_preferences" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workspace_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "object_notes" (
  "id" TEXT NOT NULL,
  "objectId" TEXT NOT NULL,
  "document" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "object_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feed_saved_views_name_key"
  ON "feed_saved_views"("name");

CREATE INDEX "feed_saved_views_updatedAt_idx"
  ON "feed_saved_views"("updatedAt" DESC);

CREATE UNIQUE INDEX "workspace_preferences_key_key"
  ON "workspace_preferences"("key");

CREATE INDEX "workspace_preferences_updatedAt_idx"
  ON "workspace_preferences"("updatedAt" DESC);

CREATE UNIQUE INDEX "object_notes_objectId_key"
  ON "object_notes"("objectId");

CREATE INDEX "object_notes_updatedAt_idx"
  ON "object_notes"("updatedAt" DESC);

ALTER TABLE "object_notes"
  ADD CONSTRAINT "object_notes_objectId_fkey"
  FOREIGN KEY ("objectId") REFERENCES "research_objects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
