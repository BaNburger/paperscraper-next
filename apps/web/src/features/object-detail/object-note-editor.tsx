import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import type { ObjectNoteDocument } from '@paperscraper/shared/browser';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { objectNoteQueryOptions } from '../workspace/queries';
import { queryKeys } from '../query/keys';
import { upsertWorkspaceObjectNote } from '../../lib/api/workspace';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { LoadingState } from '../ui/route-state';

const LazyObjectNoteEditorCore = lazy(async () => {
  const mod = await import('./object-note-editor-core');
  return { default: mod.ObjectNoteEditorCore };
});

interface ObjectNoteEditorProps {
  objectId: string;
}

export function ObjectNoteEditor({ objectId }: ObjectNoteEditorProps) {
  const queryClient = useQueryClient();
  const noteQuery = useQuery(objectNoteQueryOptions(objectId));
  const [draftDocument, setDraftDocument] = useState<ObjectNoteDocument>([]);
  const [revision, setRevision] = useState(0);
  const [editorKey, setEditorKey] = useState(0);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'conflict' | 'error'>('idle');
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [conflictDocument, setConflictDocument] = useState<ObjectNoteDocument | null>(null);
  const [conflictRevision, setConflictRevision] = useState(0);
  const draftHashRef = useRef('[]');

  useEffect(() => {
    setStatus('idle');
    setHasLocalChanges(false);
    setConflictDocument(null);
  }, [objectId]);

  useEffect(() => {
    if (!noteQuery.data) {
      return;
    }
    setDraftDocument(noteQuery.data.document);
    setRevision(noteQuery.data.revision);
    draftHashRef.current = JSON.stringify(noteQuery.data.document);
    setHasLocalChanges(false);
  }, [noteQuery.data]);

  const mutation = useMutation({
    mutationFn: (input: { document: ObjectNoteDocument; expectedRevision: number }) =>
      upsertWorkspaceObjectNote({
        objectId,
        document: input.document,
        expectedRevision: input.expectedRevision,
      }),
    onSuccess: async (result) => {
      if (result.status === 'conflict') {
        setStatus('conflict');
        setConflictDocument(result.latest.document);
        setConflictRevision(result.latest.revision);
        return;
      }
      setStatus('saved');
      setHasLocalChanges(false);
      setConflictDocument(null);
      setRevision(result.note.revision);
      queryClient.setQueryData(queryKeys.objectNote(objectId), result.note);
    },
    onError: () => {
      setStatus('error');
    },
  });

  useEffect(() => {
    if (!hasLocalChanges || mutation.isPending || status === 'conflict') {
      return;
    }
    const timer = window.setTimeout(() => {
      setStatus('saving');
      void mutation.mutate({ document: draftDocument, expectedRevision: revision });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draftDocument, hasLocalChanges, mutation, revision, status]);

  const statusLabel = useMemo(() => {
    if (noteQuery.isLoading) {
      return 'Loading note...';
    }
    if (status === 'saving') {
      return 'Saving...';
    }
    if (status === 'saved') {
      return `Saved (rev ${revision})`;
    }
    if (status === 'conflict') {
      return `Conflict detected (server rev ${conflictRevision})`;
    }
    if (status === 'error') {
      return 'Save failed';
    }
    return 'Ready';
  }, [conflictRevision, noteQuery.isLoading, revision, status]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Research Notes</CardTitle>
          <span className="text-xs text-muted-foreground">{statusLabel}</span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {status === 'conflict' && conflictDocument ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-2 text-xs">
            <span>Remote note changed. Choose how to proceed.</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDraftDocument(conflictDocument);
                setRevision(conflictRevision);
                setEditorKey((value) => value + 1);
                setStatus('idle');
                setConflictDocument(null);
                setHasLocalChanges(false);
              }}
            >
              Reload latest
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setStatus('saving');
                void mutation.mutate({
                  document: draftDocument,
                  expectedRevision: conflictRevision,
                });
              }}
            >
              Overwrite
            </Button>
          </div>
        ) : null}
        <Suspense fallback={<LoadingState label="Loading editor..." />}>
          <LazyObjectNoteEditorCore
            key={`${objectId}:${editorKey}:${revision}`}
            initialDocument={draftDocument}
            onDocumentChange={(document) => {
              const nextHash = JSON.stringify(document);
              if (nextHash === draftHashRef.current) {
                return;
              }
              draftHashRef.current = nextHash;
              setDraftDocument(document);
              setHasLocalChanges(true);
              if (status === 'saved') {
                setStatus('idle');
              }
            }}
          />
        </Suspense>
      </CardContent>
    </Card>
  );
}
