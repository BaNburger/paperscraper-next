import { useMemo, useState } from 'react';
import type { ObjectsFeedInput } from '@paperscraper/shared/browser';
import type { FeedFilters } from './types';

const PAGE_SIZE = 20;
const DEFAULT_FILTERS: FeedFilters = { sortBy: 'topScore' };

function normalizeFilters(filters: FeedFilters): FeedFilters {
  return {
    query: filters.query?.trim() || undefined,
    streamId: filters.streamId || undefined,
    pipelineId: filters.pipelineId || undefined,
    stageId: filters.stageId || undefined,
    sortBy: filters.sortBy,
  };
}

export function useFeedQueryState() {
  const [draft, setDraft] = useState<FeedFilters>(DEFAULT_FILTERS);
  const [active, setActive] = useState<FeedFilters>(DEFAULT_FILTERS);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const input = useMemo<ObjectsFeedInput>(
    () => ({ ...normalizeFilters(active), cursor, limit: PAGE_SIZE }),
    [active, cursor]
  );

  function patchDraft(patch: Partial<FeedFilters>): void {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function applyDraft(): void {
    setCursor(undefined);
    setCursorHistory([]);
    setActive(normalizeFilters(draft));
  }

  function moveCursorNext(nextCursor: string | null): void {
    if (!nextCursor) {
      return;
    }
    setCursorHistory((history) => [...history, cursor ?? '']);
    setCursor(nextCursor);
  }

  function moveCursorPrevious(): void {
    setCursorHistory((history) => {
      if (history.length === 0) {
        return history;
      }
      const next = history[history.length - 1] || undefined;
      setCursor(next);
      return history.slice(0, -1);
    });
  }

  return {
    draft,
    active,
    input,
    cursorHistory,
    patchDraft,
    applyDraft,
    moveCursorNext,
    moveCursorPrevious,
  };
}
