interface PaneWidthControlProps {
  value: number;
  min?: number;
  max?: number;
  id?: string;
  onChange: (width: number) => void;
}

export function PaneWidthControl({
  value,
  min = 280,
  max = 640,
  id,
  onChange,
}: PaneWidthControlProps) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Pane width</span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
