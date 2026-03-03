import { describe, expect, it } from 'vitest';
import { createWorkspaceEngine } from './workspace-engine';

function createEngine() {
  return createWorkspaceEngine({
    listSavedViews: async () => [
      {
        id: 'view_1',
        name: 'Default',
        definition: {
          filters: { sortBy: 'topScore' },
          layout: {
            density: 'comfortable',
            visibleColumns: ['title', 'topScore'],
            sidePaneWidth: 360,
          },
        },
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
    ],
    createSavedView: async () => ({
      id: 'view_2',
      name: 'Created',
      definition: {
        filters: { sortBy: 'topScore' },
        layout: {
          density: 'comfortable',
          visibleColumns: ['title', 'topScore'],
          sidePaneWidth: 360,
        },
      },
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    }),
    updateSavedView: async (input) =>
      input.id === 'view_1'
        ? {
            id: 'view_1',
            name: 'Renamed',
            definition: {
              filters: { sortBy: 'publishedAt' },
              layout: {
                density: 'compact',
                visibleColumns: ['title', 'publishedAt'],
                sidePaneWidth: 340,
              },
            },
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-02T00:00:00.000Z',
          }
        : null,
    deleteSavedView: async (id) => (id === 'view_1' ? { id, status: 'deleted' as const } : null),
    getFeedPreferences: async () => null,
    upsertFeedPreferences: async (value) => value,
    getObjectNote: async (objectId) =>
      objectId === 'obj_1'
        ? {
            objectId: 'obj_1',
            document: [{ type: 'paragraph', content: 'Hello' }],
            revision: 1,
            updatedAt: '2026-03-01T00:00:00.000Z',
          }
        : null,
    upsertObjectNote: async (input) =>
      input.expectedRevision === 0
        ? {
            status: 'updated' as const,
            note: {
              objectId: input.objectId,
              document: input.document,
              revision: 1,
              updatedAt: '2026-03-01T00:00:00.000Z',
            },
          }
        : {
            status: 'conflict' as const,
            latest: {
              objectId: input.objectId,
              document: [{ type: 'paragraph', content: 'Latest' }],
              revision: 3,
              updatedAt: '2026-03-01T00:01:00.000Z',
            },
          },
  });
}

describe('workspace engine', () => {
  it('supports saved view lifecycle and not-found guards', async () => {
    const engine = createEngine();
    const list = await engine.listSavedViews({});
    expect(list).toHaveLength(1);
    const created = await engine.createSavedView({
      name: 'Created',
      definition: {
        filters: { sortBy: 'topScore' },
        layout: {
          density: 'comfortable',
          visibleColumns: ['title', 'topScore'],
          sidePaneWidth: 360,
        },
      },
    });
    expect(created.id).toBe('view_2');
    const updated = await engine.updateSavedView({ id: 'view_1', name: 'Renamed' });
    expect(updated.name).toBe('Renamed');
    await expect(engine.updateSavedView({ id: 'missing', name: 'x' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const deleted = await engine.deleteSavedView({ id: 'view_1' });
    expect(deleted.status).toBe('deleted');
  });

  it('returns defaults for missing preferences and validates upsert', async () => {
    const engine = createEngine();
    const defaults = await engine.getFeedPreferences({});
    expect(defaults.defaultDensity).toBe('comfortable');
    const updated = await engine.upsertFeedPreferences({
      defaultDensity: 'compact',
      defaultVisibleColumns: ['title', 'topScore'],
      feedSidePaneWidth: 340,
      pipelineSidePaneWidth: 360,
      lastSavedViewId: null,
    });
    expect(updated.defaultDensity).toBe('compact');
  });

  it('returns object notes and validates conflict-aware upsert results', async () => {
    const engine = createEngine();
    const existing = await engine.getObjectNote({ objectId: 'obj_1' });
    expect(existing.revision).toBe(1);
    await expect(engine.getObjectNote({ objectId: 'missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    const updated = await engine.upsertObjectNote({
      objectId: 'obj_1',
      document: [{ type: 'paragraph', content: 'Draft' }],
      expectedRevision: 0,
    });
    expect(updated.status).toBe('updated');
    const conflict = await engine.upsertObjectNote({
      objectId: 'obj_1',
      document: [{ type: 'paragraph', content: 'Draft' }],
      expectedRevision: 2,
    });
    expect(conflict.status).toBe('conflict');
  });
});
