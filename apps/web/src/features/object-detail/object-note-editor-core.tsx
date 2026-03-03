import type { ObjectNoteDocument } from '@paperscraper/shared/browser';
import type { PartialBlock } from '@blocknote/core';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/shadcn';
import { useEffect, useRef } from 'react';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/shadcn/style.css';

interface ObjectNoteEditorCoreProps {
  initialDocument: ObjectNoteDocument;
  onDocumentChange: (document: ObjectNoteDocument) => void;
}

export function ObjectNoteEditorCore({
  initialDocument,
  onDocumentChange,
}: ObjectNoteEditorCoreProps) {
  const editor = useCreateBlockNote({
    initialContent: initialDocument as PartialBlock[],
  });
  const changeTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (changeTimerRef.current !== null) {
        window.clearTimeout(changeTimerRef.current);
      }
    },
    []
  );

  return (
    <div className="blocknote-shell">
      <BlockNoteView
        editor={editor}
        onChange={() => {
          if (changeTimerRef.current !== null) {
            window.clearTimeout(changeTimerRef.current);
          }
          changeTimerRef.current = window.setTimeout(() => {
            onDocumentChange(editor.document as ObjectNoteDocument);
          }, 120);
        }}
      />
    </div>
  );
}
