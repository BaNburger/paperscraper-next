import { describe, expect, it } from 'vitest';
import {
  normalizeOpenAlexWorks,
  rebuildAbstract,
} from './openalex-normalizer';

describe('openalex normalizer', () => {
  it('rebuilds abstracts from inverted index', () => {
    expect(
      rebuildAbstract({
        transfer: [2],
        technology: [0],
        and: [1],
      })
    ).toBe('technology and transfer');
    expect(rebuildAbstract(null)).toBeNull();
  });

  it('normalizes works and tracks malformed publication dates', () => {
    const normalized = normalizeOpenAlexWorks([
      {
        id: 'https://openalex.org/W1',
        display_name: 'Paper One',
        publication_date: '2024-01-10',
        abstract_inverted_index: { graph: [0], network: [1] },
        authorships: [
          {
            author: {
              id: 'https://openalex.org/A1',
              display_name: 'Ada Lovelace',
            },
          },
        ],
      },
      {
        id: 'https://openalex.org/W2',
        display_name: 'Paper Two',
        publication_date: 'invalid-date',
        abstract_inverted_index: null,
        authorships: [],
      },
    ]);

    expect(normalized.failedCount).toBe(1);
    expect(normalized.normalized).toHaveLength(1);
    expect(normalized.normalized[0]!.title).toBe('Paper One');
    expect(normalized.normalized[0]!.publishedAt?.toISOString()).toBe(
      '2024-01-10T00:00:00.000Z'
    );
    expect(normalized.normalized[0]!.sourceMetadata).toEqual({
      authorships: [
        {
          authorId: 'https://openalex.org/A1',
          authorName: 'Ada Lovelace',
          position: 0,
        },
      ],
    });
  });
});
