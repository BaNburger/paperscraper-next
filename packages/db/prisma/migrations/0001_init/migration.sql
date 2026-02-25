-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "streams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "streams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stream_runs" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,

    CONSTRAINT "stream_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_objects" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "object_entities" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "position" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "object_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimensions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "object_scores" (
    "id" TEXT NOT NULL,
    "dimensionId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "explanation" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "object_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_scores" (
    "id" TEXT NOT NULL,
    "dimensionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "explanation" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipelines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_stages" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "object_pipeline_cards" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "object_pipeline_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stream_runs_streamId_idx" ON "stream_runs"("streamId");

-- CreateIndex
CREATE INDEX "stream_runs_status_idx" ON "stream_runs"("status");

-- CreateIndex
CREATE INDEX "research_objects_publishedAt_idx" ON "research_objects"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "research_objects_externalId_source_key" ON "research_objects"("externalId", "source");

-- CreateIndex
CREATE INDEX "entities_externalId_idx" ON "entities"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "entities_kind_name_key" ON "entities"("kind", "name");

-- CreateIndex
CREATE INDEX "object_entities_entityId_idx" ON "object_entities"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "object_entities_objectId_entityId_role_key" ON "object_entities"("objectId", "entityId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "dimensions_name_key" ON "dimensions"("name");

-- CreateIndex
CREATE INDEX "object_scores_objectId_idx" ON "object_scores"("objectId");

-- CreateIndex
CREATE UNIQUE INDEX "object_scores_dimensionId_objectId_key" ON "object_scores"("dimensionId", "objectId");

-- CreateIndex
CREATE INDEX "entity_scores_entityId_idx" ON "entity_scores"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "entity_scores_dimensionId_entityId_key" ON "entity_scores"("dimensionId", "entityId");

-- CreateIndex
CREATE INDEX "pipeline_stages_pipelineId_idx" ON "pipeline_stages"("pipelineId");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stages_pipelineId_position_key" ON "pipeline_stages"("pipelineId", "position");

-- CreateIndex
CREATE INDEX "object_pipeline_cards_stageId_position_idx" ON "object_pipeline_cards"("stageId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "object_pipeline_cards_pipelineId_objectId_key" ON "object_pipeline_cards"("pipelineId", "objectId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_provider_key" ON "api_keys"("provider");

-- AddForeignKey
ALTER TABLE "stream_runs" ADD CONSTRAINT "stream_runs_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_entities" ADD CONSTRAINT "object_entities_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "research_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_entities" ADD CONSTRAINT "object_entities_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_scores" ADD CONSTRAINT "object_scores_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "dimensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_scores" ADD CONSTRAINT "object_scores_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "research_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_scores" ADD CONSTRAINT "entity_scores_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "dimensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_scores" ADD CONSTRAINT "entity_scores_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_pipeline_cards" ADD CONSTRAINT "object_pipeline_cards_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_pipeline_cards" ADD CONSTRAINT "object_pipeline_cards_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "pipeline_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_pipeline_cards" ADD CONSTRAINT "object_pipeline_cards_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "research_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

