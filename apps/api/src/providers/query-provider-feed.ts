import { Prisma, type PrismaClient } from '@paperscraper/db';
import type { ObjectsFeedInput, ObjectsFeedOutput } from '@paperscraper/shared';

type FeedQueryRow = {
  id: string;
  externalId: string;
  source: 'openalex';
  title: string;
  publishedAt: Date | null;
  topScore: number | null;
  stagePipelineId: string | null;
  stageId: string | null;
  stageName: string | null;
  stagePosition: number | null;
};

type FeedCursor = {
  sortBy: 'topScore' | 'publishedAt';
  id: string;
  sortValue: number | string | null;
};

function encodeCursor(cursor: FeedCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string): FeedCursor {
  const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as FeedCursor;
  if (
    !parsed ||
    (parsed.sortBy !== 'topScore' && parsed.sortBy !== 'publishedAt') ||
    typeof parsed.id !== 'string' ||
    parsed.id.length === 0
  ) {
    throw new Error('Invalid feed cursor.');
  }
  return parsed;
}

function normalizeDate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function asScore(value: number | null): number | null {
  if (value === null || Number.isNaN(value)) {
    return null;
  }
  return Math.max(0, Math.min(100, value));
}

export async function feedObjects(
  prisma: PrismaClient,
  input: ObjectsFeedInput
): Promise<ObjectsFeedOutput> {
  const filters: Prisma.Sql[] = [];
  if (input.query) {
    const search = `%${input.query}%`;
    filters.push(Prisma.sql`(ro."title" ILIKE ${search} OR ro."abstract" ILIKE ${search})`);
  }
  if (input.streamId) {
    filters.push(
      Prisma.sql`EXISTS (
        SELECT 1
        FROM "stream_run_objects" sro
        WHERE sro."objectId" = ro."id"
          AND sro."streamId" = ${input.streamId}
      )`
    );
  }
  if (input.pipelineId || input.stageId) {
    const pipelineFilter = input.pipelineId
      ? Prisma.sql`AND opc_filter."pipelineId" = ${input.pipelineId}`
      : Prisma.empty;
    const stageFilter = input.stageId
      ? Prisma.sql`AND opc_filter."stageId" = ${input.stageId}`
      : Prisma.empty;
    filters.push(
      Prisma.sql`EXISTS (
        SELECT 1
        FROM "object_pipeline_cards" opc_filter
        WHERE opc_filter."objectId" = ro."id"
          ${pipelineFilter}
          ${stageFilter}
      )`
    );
  }

  if (input.cursor) {
    const cursor = decodeCursor(input.cursor);
    if (cursor.sortBy !== input.sortBy) {
      throw new Error('Feed cursor sort does not match request sort.');
    }
    if (input.sortBy === 'topScore') {
      if (typeof cursor.sortValue !== 'number') {
        throw new Error('Invalid topScore cursor.');
      }
      filters.push(
        Prisma.sql`(
          COALESCE(score."topScore", -1) < ${cursor.sortValue}
          OR (COALESCE(score."topScore", -1) = ${cursor.sortValue} AND ro."id" < ${cursor.id})
        )`
      );
    } else {
      const cursorDate =
        typeof cursor.sortValue === 'string'
          ? new Date(cursor.sortValue)
          : new Date('1970-01-01T00:00:00.000Z');
      if (Number.isNaN(cursorDate.getTime())) {
        throw new Error('Invalid publishedAt cursor.');
      }
      filters.push(
        Prisma.sql`(
          COALESCE(ro."publishedAt", TIMESTAMP '1970-01-01') < ${cursorDate}
          OR (
            COALESCE(ro."publishedAt", TIMESTAMP '1970-01-01') = ${cursorDate}
            AND ro."id" < ${cursor.id}
          )
        )`
      );
    }
  }

  const whereClause =
    filters.length > 0 ? Prisma.sql`${Prisma.join(filters, ' AND ')}` : Prisma.sql`TRUE`;
  const stagePipelineFilter = input.pipelineId
    ? Prisma.sql`AND opc_stage."pipelineId" = ${input.pipelineId}`
    : Prisma.empty;
  const stageIdFilter = input.stageId
    ? Prisma.sql`AND opc_stage."stageId" = ${input.stageId}`
    : Prisma.empty;
  const orderBy =
    input.sortBy === 'topScore'
      ? Prisma.sql`COALESCE(score."topScore", -1) DESC, ro."id" DESC`
      : Prisma.sql`COALESCE(ro."publishedAt", TIMESTAMP '1970-01-01') DESC, ro."id" DESC`;

  const rows = await prisma.$queryRaw<FeedQueryRow[]>(Prisma.sql`
    WITH score AS (
      SELECT os."objectId", MAX(os."value") AS "topScore"
      FROM "object_scores" os
      GROUP BY os."objectId"
    )
    SELECT
      ro."id" AS "id",
      ro."externalId" AS "externalId",
      ro."source" AS "source",
      ro."title" AS "title",
      ro."publishedAt" AS "publishedAt",
      score."topScore" AS "topScore",
      stage."pipelineId" AS "stagePipelineId",
      stage."stageId" AS "stageId",
      stage."stageName" AS "stageName",
      stage."position" AS "stagePosition"
    FROM "research_objects" ro
    LEFT JOIN score ON score."objectId" = ro."id"
    LEFT JOIN LATERAL (
      SELECT
        opc_stage."pipelineId" AS "pipelineId",
        opc_stage."stageId" AS "stageId",
        ps."name" AS "stageName",
        opc_stage."position" AS "position"
      FROM "object_pipeline_cards" opc_stage
      INNER JOIN "pipeline_stages" ps ON ps."id" = opc_stage."stageId"
      WHERE opc_stage."objectId" = ro."id"
        ${stagePipelineFilter}
        ${stageIdFilter}
      ORDER BY opc_stage."updatedAt" DESC, opc_stage."position" ASC
      LIMIT 1
    ) stage ON TRUE
    WHERE ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ${input.limit + 1}
  `);

  const pageRows = rows.slice(0, input.limit);
  const objectIds = pageRows.map((row) => row.id);
  const entityLinks =
    objectIds.length === 0
      ? []
      : await prisma.objectEntity.findMany({
          where: { objectId: { in: objectIds } },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          select: {
            objectId: true,
            entity: { select: { id: true, name: true, kind: true } },
          },
        });
  const entitiesByObject = new Map<string, Array<{ id: string; name: string; kind: string }>>();
  for (const link of entityLinks) {
    const current = entitiesByObject.get(link.objectId) || [];
    if (current.length < 3) {
      current.push(link.entity);
      entitiesByObject.set(link.objectId, current);
    }
  }

  const items = pageRows.map((row) => ({
    id: row.id,
    externalId: row.externalId,
    source: row.source,
    title: row.title,
    publishedAt: normalizeDate(row.publishedAt),
    topScore: asScore(row.topScore),
    stage:
      row.stageId && row.stagePipelineId && row.stageName && row.stagePosition !== null
        ? {
            pipelineId: row.stagePipelineId,
            stageId: row.stageId,
            stageName: row.stageName,
            position: row.stagePosition,
          }
        : null,
    entities: entitiesByObject.get(row.id) || [],
  }));

  const next = rows.length > input.limit ? rows[input.limit] || null : null;
  return {
    items,
    nextCursor:
      next === null
        ? null
        : encodeCursor({
            sortBy: input.sortBy,
            id: next.id,
            sortValue:
              input.sortBy === 'topScore' ? Number(next.topScore ?? -1) : normalizeDate(next.publishedAt),
          }),
  };
}
