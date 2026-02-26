import type { OpenAlexWork } from './openalex-provider';

const OPENALEX_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface NormalizedResearchObject {
  externalId: string;
  source: 'openalex';
  title: string;
  abstract: string | null;
  sourceMetadata: {
    authorships: Array<{
      authorId: string | null;
      authorName: string;
      position: number;
    }>;
  } | null;
  publishedAt: Date | null;
}

function parsePublishedAt(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  if (!OPENALEX_DATE_PATTERN.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function rebuildAbstract(
  invertedIndex: Record<string, number[]> | null | undefined
): string | null {
  if (!invertedIndex) {
    return null;
  }
  const pairs = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const position of positions) {
      pairs.push({ word, position });
    }
  }
  if (pairs.length === 0) {
    return null;
  }
  pairs.sort((left, right) => left.position - right.position);
  return pairs.map((item) => item.word).join(' ');
}

function normalizeAuthorships(work: OpenAlexWork): NormalizedResearchObject['sourceMetadata'] {
  if (!work.authorships || work.authorships.length === 0) {
    return null;
  }
  const authorships = [];
  for (let index = 0; index < work.authorships.length; index += 1) {
    const author = work.authorships[index]?.author;
    const authorName = author?.display_name?.trim();
    if (!authorName) {
      continue;
    }
    authorships.push({
      authorId: author?.id ?? null,
      authorName,
      position: index,
    });
  }
  return authorships.length > 0 ? { authorships } : null;
}

export function normalizeOpenAlexWorks(works: OpenAlexWork[]): {
  normalized: NormalizedResearchObject[];
  failedCount: number;
} {
  const normalized = [];
  let failedCount = 0;

  for (const work of works) {
    const publishedAt = parsePublishedAt(work.publication_date ?? null);
    if (work.publication_date && !publishedAt) {
      failedCount += 1;
      continue;
    }
    normalized.push({
      externalId: work.id,
      source: 'openalex' as const,
      title: work.display_name,
      abstract: rebuildAbstract(work.abstract_inverted_index ?? null),
      sourceMetadata: normalizeAuthorships(work),
      publishedAt,
    });
  }

  return { normalized, failedCount };
}
