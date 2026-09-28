"use client";

import { useEffect, type ComponentType, type ReactNode, type SVGProps } from "react";

export type MobileNavItem = {
  id: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  active?: boolean;
  onClick: () => void;
};

export type MobileNavSection = {
  label?: string;
  items: MobileNavItem[];
};

type MobileFabMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  sections: MobileNavSection[];
  fabLabel: string;
  fabIcon?: ReactNode;
  /** Tailwind classes for FAB position (mobile only wrapper already applies md:hidden) */
  fabClassName?: string;
  accent?: "brand" | "dark";
  footer?: ReactNode;
};

export function MobileFabMenu({
  open,
  onOpenChange,
  title,
  subtitle,
  sections,
  fabLabel,
  fabIcon,
  fabClassName = "bottom-5 right-4",
  accent = "brand",
  footer,
}: MobileFabMenuProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange]);

  const fabTone =
    accent === "dark"
      ? "bg-[var(--accent)] text-white shadow-[0_8px_24px_rgba(99,91,255,0.35)] hover:bg-[var(--accent-hover)]"
      : "bg-[var(--accent)] text-white shadow-[0_8px_24px_rgba(var(--accent-rgb),0.35)] hover:bg-[var(--accent-hover)]";

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={fabLabel}
        title={fabLabel}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={`fixed z-40 flex h-12 w-12 items-center justify-center rounded-full transition ${fabTone} ${fabClassName}`}
      >
        {fabIcon ?? (
          <span className="text-[13px] font-bold tracking-tight">
            {title.slice(0, 1)}
          </span>
        )}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-[rgba(26,31,54,0.4)] backdrop-blur-[2px]"
            onClick={() => onOpenChange(false)}
          />
          <div className="relative z-10 max-h-[78dvh] overflow-hidden rounded-t-3xl border border-[var(--border)] bg-white shadow-[var(--shadow-lg)]">
            <div className="flex items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
                  {title}
                </p>
                {subtitle ? (
                  <p className="truncate text-[12px] text-[var(--muted-soft)]">{subtitle}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--muted)] hover:bg-[var(--surface-alt)]"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {sections.map((section, idx) => (
                <div key={section.label ?? `s-${idx}`} className="mb-1">
                  {section.label ? (
                    <p className="mb-1 mt-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)] first:mt-0">
                      {section.label}
                    </p>
                  ) : null}
                  <ul className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => {
                              item.onClick();
                              onOpenChange(false);
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl p-3 text-left text-[14px] font-medium transition ${
                              item.active
                                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                                : "text-[var(--foreground-soft)] hover:bg-[var(--surface-alt)]"
                            }`}
                          >
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                                item.active
                                  ? "bg-white text-[var(--accent)]"
                                  : "bg-[var(--surface-alt)] text-[var(--muted)]"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="truncate">{item.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {footer ? <div className="mt-2 border-t border-[var(--border)] pt-2">{footer}</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
