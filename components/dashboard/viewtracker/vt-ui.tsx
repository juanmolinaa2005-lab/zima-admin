"use client";

import { type FormEvent, type ReactNode } from "react";

export const VT_PLATFORMS = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "x", label: "X" },
  { id: "snapchat", label: "Snapchat" },
] as const;

export function PlatformChip({
  id,
  label,
  active,
  onClick,
}: {
  id: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border text-[10px] font-bold transition ${
        active
          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
          : "border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--border-strong)]"
      }`}
    >
      {id === "tiktok" ? "TT" : id === "instagram" ? "IG" : id === "youtube" ? "YT" : id === "snapchat" ? "SC" : "X"}
    </button>
  );
}

export function StatusOk() {
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#16a34a]">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#dcfce7] text-[10px]">
        ✓
      </span>
      OK
    </span>
  );
}

export function GrowthPill({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="text-[12px] text-[var(--muted-soft)]">—</span>;
  }
  const up = value >= 1;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        up ? "bg-[#dcfce7] text-[var(--success)]" : "bg-[#ffedd5] text-[#c2410c]"
      }`}
    >
      {value.toFixed(1)}x
    </span>
  );
}

export function SparkBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const labels = ["F", "S", "S", "M", "T", "W", "T", "S", "S"];
  return (
    <div className="flex items-end gap-[3px]">
      {values.slice(0, 9).map((n, i) => (
        <div key={`${labels[i]}-${i}`} className="flex flex-col items-center gap-0.5">
          <div
            className="w-[6px] rounded-sm bg-[#8b85ff]"
            style={{ height: `${Math.max(3, Math.round((n / max) * 22))}px` }}
          />
        </div>
      ))}
    </div>
  );
}

export function PageHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
          {title}
        </h1>
        <p className="mt-1 text-[13px] text-[var(--muted)]">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function Toolbar({
  search,
  onSearch,
  searchPlaceholder,
  platform,
  onPlatform,
  extra,
}: {
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder: string;
  platform: string | null;
  onPlatform: (id: string | null) => void;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={searchPlaceholder}
        className="min-w-[220px] flex-1 rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-soft)] focus:border-[var(--border-strong)]"
      />
      <div className="flex items-center gap-1.5">
        {VT_PLATFORMS.map((p) => (
          <PlatformChip
            key={p.id}
            id={p.id}
            label={p.label}
            active={platform === p.id}
            onClick={() => onPlatform(platform === p.id ? null : p.id)}
          />
        ))}
      </div>
      {extra}
    </div>
  );
}

export function AddLinksForm({
  label,
  placeholder,
  value,
  onChange,
  onSubmit,
  onCancel,
  submitting,
  submitLabel,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  submitting: boolean;
  submitLabel: string;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4"
    >
      <label className="block text-[12px] font-medium text-[var(--foreground-soft)]">
        {label}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className="mt-1.5 w-full resize-y rounded-xl border border-[var(--border)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-soft)] focus:border-[var(--border-strong)]"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Guardando…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-[var(--border)] px-3.5 py-2 text-[13px] font-medium text-[var(--foreground-soft)]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function EmptyTable({ message }: { message: string }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-[var(--border)] bg-white">
      <p className="text-[14px] text-[var(--muted-soft)]">{message}</p>
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[0_20px_50px_rgba(17,24,39,0.22)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-[var(--foreground)]">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-[13px] text-[var(--muted)]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[16px] text-[var(--muted-soft)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
