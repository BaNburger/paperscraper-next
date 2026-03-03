import { describe, expect, it } from 'vitest';
import {
  feedSavedViewSchema,
  objectNoteUpsertResultSchema,
  pipelineAddCardsBatchOutputSchema,
  workspaceFeedPreferencesSchema,
  workspaceSavedViewCreateInputSchema,
} from './contracts-s2_w1';

describe('s2.w1 contracts', () => {
  it('validates saved view create payloads and entities', () => {
    const createInput = workspaceSavedViewCreateInputSchema.parse({
      name: 'Priority Reading',
      definition: {
        filters: {
          query: 'federated learning',
          sortBy: 'topScore',
        },
        layout: {
          density: 'comfortable',
          visibleColumns: ['title', 'topScore', 'entities'],
          sidePaneWidth: 360,
        },
      },
    });
    expect(createInput.name).toBe('Priority Reading');

    const savedView = feedSavedViewSchema.parse({
      id: 'view_1',
      name: 'Priority Reading',
      definition: createInput.definition,
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    });
    expect(savedView.definition.layout.visibleColumns).toContain('entities');
  });

  it('validates workspace preferences and notes upsert outcomes', () => {
    const preferences = workspaceFeedPreferencesSchema.parse({
      defaultDensity: 'compact',
      defaultVisibleColumns: ['title', 'topScore', 'stage'],
      feedSidePaneWidth: 340,
      pipelineSidePaneWidth: 360,
      lastSavedViewId: 'view_1',
    });
    expect(preferences.defaultDensity).toBe('compact');

    const updated = objectNoteUpsertResultSchema.parse({
      status: 'updated',
      note: {
        objectId: 'obj_1',
        document: [{ type: 'paragraph', content: 'Draft note' }],
        revision: 2,
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
    });
    expect(updated.status).toBe('updated');

    const conflicted = objectNoteUpsertResultSchema.parse({
      status: 'conflict',
      latest: {
        objectId: 'obj_1',
        document: [{ type: 'paragraph', content: 'Latest note' }],
        revision: 3,
        updatedAt: '2026-03-01T00:01:00.000Z',
      },
    });
    expect(conflicted.status).toBe('conflict');
  });

  it('validates deterministic pipeline batch operation outputs', () => {
    const output = pipelineAddCardsBatchOutputSchema.parse({
      pipelineId: 'pipe_1',
      stageId: 'stage_1',
      added: 2,
      skippedAlreadyPresent: 1,
      addedCardIds: ['card_a', 'card_b'],
    });
    expect(output.added + output.skippedAlreadyPresent).toBe(3);
  });
});
