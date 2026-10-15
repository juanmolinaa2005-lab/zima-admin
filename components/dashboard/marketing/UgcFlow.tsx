"use client";

import { UGC_FLOW, VIEW_META, type ViewId } from "../nav";

export function UgcFlow({
  current,
  onNavigate,
  counts,
}: {
  current?: ViewId;
  onNavigate: (view: ViewId) => void;
  counts?: Partial<Record<ViewId, string>>;
}) {
  return (
    <ol className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {UGC_FLOW.map((s, i) => {
        const Icon = VIEW_META[s.id].icon;
        const active = s.id === current;
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onNavigate(s.id)}
              aria-current={active ? "step" : undefined}
              className={`group relative flex h-full w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
                active
                  ? "border-[var(--foreground)] bg-white shadow-[0_0_0_3px_rgba(17,17,19,0.06)]"
                  : "border-[var(--border)] bg-white/70 hover:-translate-y-px hover:border-[var(--border-strong)] hover:bg-white"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  active ? "bg-[var(--foreground)] text-white" : "bg-[var(--surface-alt)] text-[var(--muted)] group-hover:text-[var(--foreground)]"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted-soft)]">
                  Paso {i + 1}
                  {counts?.[s.id] ? <span className="ml-1.5 normal-case tracking-normal text-[var(--muted)]">· {counts[s.id]}</span> : null}
                </span>
                <span className="block text-[13px] font-semibold text-[var(--foreground)]">{s.step}</span>
                <span className="block truncate text-[11px] text-[var(--muted)]">{s.text}</span>
              </span>
              {i < UGC_FLOW.length - 1 ? (
                <span aria-hidden className="absolute -right-[7px] top-1/2 z-10 hidden h-3 w-3 -translate-y-1/2 rotate-45 border-r border-t border-[var(--border-strong)] bg-[var(--background)] lg:block" />
              ) : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
