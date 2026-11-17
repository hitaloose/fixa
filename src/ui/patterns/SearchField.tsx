import { Icon } from "../primitives/Icon";
import { IconButton } from "../primitives/IconButton";

export interface SearchFieldProps {
  label: string;
  clearLabel: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchField({ label, clearLabel, value, onChange, placeholder }: SearchFieldProps) {
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-field border border-line bg-surface pl-3 text-muted focus-within:border-primary">
      <Icon name="browse" className="size-5" />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 flex-1 bg-transparent text-field text-ink outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? <IconButton icon="close" label={clearLabel} onClick={() => onChange("")} /> : null}
    </div>
  );
}
