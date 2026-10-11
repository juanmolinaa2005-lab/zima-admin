"use client";

import { type FormEvent, type ReactNode } from "react";

export const VT_PLATFORMS = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "x", label: "X" },
  { id: "snapchat", label: "Snapchat" },
] as const;

const TIKTOK_PATH =
  "M14.1 3.1c.4 2.5 1.8 4.4 4.2 5v2.4a7.1 7.1 0 0 1-4.1-1.3v6.7a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.6a3 3 0 1 0 2.1 2.9V3.1h2.5Z";

export function PlatformLogo({ id, className = "h-[18px] w-[18px]" }: { id: string; className?: string }) {
  if (id === "facebook") {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="11" fill="#0866FF" />
        <path fill="#fff" d="M13.4 21.9v-7.1h2.4l.4-2.8h-2.8v-1.8c0-.8.3-1.4 1.4-1.4h1.5V6.3c-.3 0-1.2-.1-2.2-.1-2.2 0-3.6 1.3-3.6 3.7V12H8.1v2.8h2.4v7.1c.9.1 2 .1 2.9 0Z" />
      </svg>
    );
  }
  if (id === "tiktok") {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden>
        <path fill="#25F4EE" d={TIKTOK_PATH} transform="translate(-0.7 .35)" />
        <path fill="#FE2C55" d={TIKTOK_PATH} transform="translate(.7 -.25)" />
        <path fill="#111" d={TIKTOK_PATH} />
      </svg>
    );
  }
  if (id === "instagram") {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden>
        <defs>
          <radialGradient id="vt-ig-mark" cx="30%" cy="107%" r="120%">
            <stop offset="0%" stopColor="#feda75" />
            <stop offset="28%" stopColor="#fa7e1e" />
            <stop offset="52%" stopColor="#d62976" />
            <stop offset="76%" stopColor="#962fbf" />
            <stop offset="100%" stopColor="#4f5bd5" />
          </radialGradient>
        </defs>
        <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#vt-ig-mark)" />
        <rect x="7.2" y="7.2" width="9.6" height="9.6" rx="4.8" fill="none" stroke="#fff" strokeWidth="1.6" />
        <circle cx="16.7" cy="7.2" r="1.05" fill="#fff" />
      </svg>
    );
  }
  if (id === "youtube") {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden>
        <rect x="1.2" y="5" width="21.6" height="14" rx="4" fill="#FF0033" />
        <path d="M10 9.1v5.8l5.2-2.9L10 9.1Z" fill="#fff" />
      </svg>
    );
  }
  if (id === "snapchat") {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden>
        <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="#FFFC00" />
        <path
          d="M12 5.2c2.3 0 4 1.8 4 4.1v1.8c.3.1.7.1 1.1 0 .4-.2.8.3.5.6-.4.4-1 .6-1.5.8.5 1.3 1.5 2.2 2.7 2.5.3.1.3.5 0 .6-.5.2-1.1.3-1.6.4-.2.3-.1.8-.5.9-.6.1-1.1-.1-1.7.2-.6.3-1.3 1.1-3 1.1s-2.4-.8-3-1.1c-.6-.3-1.1-.1-1.7-.2-.4-.1-.3-.6-.5-.9-.5-.1-1.1-.2-1.6-.4-.3-.1-.3-.5 0-.6 1.2-.3 2.2-1.2 2.7-2.5-.5-.2-1.1-.4-1.5-.8-.3-.3.1-.8.5-.6.4.1.8.1 1.1 0V9.3c0-2.3 1.7-4.1 4-4.1Z"
          fill="#fff"
          stroke="#111"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#111"
        d="M17.75 3h3.07l-6.71 7.67L22 21h-6.18l-4.84-6.33L5.44 21H2.37l7.18-8.2L2 3h6.34l4.37 5.78L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z"
      />
    </svg>
  );
}

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
      aria-label={label}
      aria-pressed={Boolean(active)}
      onClick={onClick}
      className={`relative flex h-9 w-9 items-center justify-center rounded-lg border bg-white transition ${
        active
          ? "border-[#111113] shadow-[0_0_0_3px_rgba(17,17,19,0.1)]"
          : "border-[var(--border)] hover:-translate-y-px hover:border-[var(--border-strong)] hover:shadow-[0_2px_6px_rgba(17,24,39,0.08)]"
      }`}
    >
      <PlatformLogo id={id} />
      {active ? (
        <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#111113] ring-2 ring-white">
          <svg viewBox="0 0 24 24" className="h-2 w-2" fill="none" aria-hidden>
            <path d="m5 12.5 4.5 4.5L19 7.5" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : null}
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
