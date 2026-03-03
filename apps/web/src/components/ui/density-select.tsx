import type { FeedDensity } from '@paperscraper/shared/browser';
import { Select } from './select';

interface DensitySelectProps {
  value: FeedDensity;
  className?: string;
  onChange: (density: FeedDensity) => void;
}

export function DensitySelect({ value, className, onChange }: DensitySelectProps) {
  return (
    <Select
      value={value}
      className={className}
      onChange={(event) =>
        onChange(event.target.value === 'compact' ? 'compact' : 'comfortable')
      }
      aria-label="Density mode"
    >
      <option value="comfortable">Comfortable</option>
      <option value="compact">Compact</option>
    </Select>
  );
}
