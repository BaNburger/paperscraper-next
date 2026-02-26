import type { PrismaClient } from '@paperscraper/db';
import type { NormalizedResearchObject } from './openalex-normalizer';

export interface PersistResult {
  insertedIds: string[];
  insertedCount: number;
  updatedCount: number;
  failedCount: number;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const maybeCode = (error as { code?: unknown }).code;
  return maybeCode === 'P2002';
}

function dedupeByExternalId(rows: NormalizedResearchObject[]): NormalizedResearchObject[] {
  const byExternalId = new Map<string, NormalizedResearchObject>();
  for (const row of rows) {
    byExternalId.set(row.externalId, row);
  }
  return Array.from(byExternalId.values());
}

export async function persistResearchObjects(
  prisma: PrismaClient,
  records: NormalizedResearchObject[]
): Promise<PersistResult> {
  const deduped = dedupeByExternalId(records);
  if (deduped.length === 0) {
    return {
      insertedIds: [],
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0,
    };
  }

  const externalIds = deduped.map((row) => row.externalId);
  const existing = await prisma.researchObject.findMany({
    where: {
      source: 'openalex',
      externalId: { in: externalIds },
    },
    select: { id: true, externalId: true },
  });
  const existingByExternalId = new Map(existing.map((row) => [row.externalId, row.id]));
  const toInsert = deduped.filter((row) => !existingByExternalId.has(row.externalId));
  const toUpdate = deduped.filter((row) => existingByExternalId.has(row.externalId));

  const insertedIds: string[] = [];
  let insertedCount = 0;
  let updatedCount = 0;
  let failedCount = 0;

  if (toInsert.length > 0) {
    try {
      const insertedRows = await prisma.researchObject.createManyAndReturn({
        data: toInsert.map((row) => ({
          externalId: row.externalId,
          source: row.source,
          title: row.title,
          abstract: row.abstract,
          publishedAt: row.publishedAt,
        })),
        skipDuplicates: true,
        select: { id: true },
      });
      insertedCount = insertedRows.length;
      insertedIds.push(...insertedRows.map((row) => row.id));
    } catch {
      for (const row of toInsert) {
        try {
          const inserted = await prisma.researchObject.create({
            data: {
              externalId: row.externalId,
              source: row.source,
              title: row.title,
              abstract: row.abstract,
              publishedAt: row.publishedAt,
            },
            select: { id: true },
          });
          insertedCount += 1;
          insertedIds.push(inserted.id);
        } catch (error) {
          if (!isUniqueViolation(error)) {
            failedCount += 1;
          }
        }
      }
    }
  }

  for (const row of toUpdate) {
    const objectId = existingByExternalId.get(row.externalId);
    if (!objectId) {
      failedCount += 1;
      continue;
    }
    try {
      await prisma.researchObject.update({
        where: { id: objectId },
        data: {
          title: row.title,
          abstract: row.abstract,
          publishedAt: row.publishedAt,
        },
        select: { id: true },
      });
      updatedCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  return {
    insertedIds,
    insertedCount,
    updatedCount,
    failedCount,
  };
}
