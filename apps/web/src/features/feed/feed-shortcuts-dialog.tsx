import { Button } from '../../components/ui/button';

interface FeedShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function FeedShortcutsDialog({ open, onClose }: FeedShortcutsDialogProps) {
  return (
    <dialog
      id="shortcuts"
      open={open}
      className="max-w-xl rounded-xl border border-border bg-card p-0 text-foreground"
      onClose={onClose}
    >
      <div className="grid gap-3 p-4">
        <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
        <div className="grid gap-1 text-sm text-muted-foreground">
          <p>`j`/`k`: move feed focus</p>
          <p>`x`: toggle selected row</p>
          <p>`Shift+X`: select all visible rows</p>
          <p>`Enter`: open focused object detail</p>
          <p>`[` and `]`: previous/next page</p>
          <p>`Shift+A`: jump to assignment panel</p>
          <p>`?`: open shortcuts</p>
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </dialog>
  );
}
