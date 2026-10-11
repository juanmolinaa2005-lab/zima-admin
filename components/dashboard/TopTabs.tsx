"use client";

export function TopTabs<T extends string>({
  label,
  items,
  active,
  onSelect,
}: {
  label: string;
  items: { id: T; label: string }[];
  active: T;
  onSelect: (id: T) => void;
}) {
  return (
    <nav className="flex shrink-0 gap-5 overflow-x-auto border-b border-[var(--border)] px-5 pt-5 sm:px-8" aria-label={label}>
      {items.map((item) => {
        const on = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={on ? "page" : undefined}
            className={`-mb-px shrink-0 border-b-2 pb-2.5 text-[14px] font-medium transition ${
              on ? "border-[var(--foreground)] text-[var(--foreground)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
