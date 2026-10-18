"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

export async function api<T = unknown>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export function useLoad<T>(url: string, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialRef = useRef(initial);

  const reload = useCallback(async () => {
    try {
      const next = await api<T>(url);
      setData(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
      setData(initialRef.current);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    api<T>(url).then(
      (next) => {
        if (cancelled) return;
        setData(next);
        setError(null);
        setLoading(false);
      },
      (e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Error al cargar");
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, setData, loading, error, reload };
}

/** Views stay mounted while hidden; refetch when one becomes visible again. */
export function useRefreshOnActive(active: boolean | undefined, ...reloads: (() => Promise<void>)[]) {
  const wasActive = useRef(active);
  const latest = useRef(reloads);
  useEffect(() => {
    latest.current = reloads;
  });
  useEffect(() => {
    if (active && wasActive.current === false) latest.current.forEach((r) => void r());
    wasActive.current = active;
  }, [active]);
}

export function notifyError(e: unknown) {
  toast.error(e instanceof Error ? e.message : "Algo salió mal");
}

export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="h-full min-w-0 overflow-y-auto">
      <div className="ui-enter mx-auto w-full max-w-[1280px] space-y-6 p-4 pb-28 sm:p-6 md:pb-10">{children}</div>
    </div>
  );
}

export function Header({
  kicker,
  title,
  subtitle,
  actions,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {kicker ? <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">{kicker}</p> : null}
        <h1 className="text-[26px] font-semibold tracking-tight text-[var(--foreground)] sm:text-[28px]">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-[13px] text-[var(--muted)]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  type = "button",
  disabled,
  size = "md",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  size?: "sm" | "md";
  title?: string;
}) {
  const v = {
    primary: "ui-btn-primary",
    secondary: "ui-btn-secondary hover:bg-[var(--surface-alt)]",
    ghost: "text-[var(--muted)] hover:bg-black/[0.04] hover:text-[var(--foreground)]",
    danger: "text-[var(--danger)] hover:bg-[var(--danger-soft)]",
  }[variant];
  const s = size === "sm" ? "h-8 px-2.5 text-[12px]" : "h-9 px-3.5 text-[13px]";
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`ui-press inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[10px] font-semibold transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 ${v} ${s}`}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`ui-card ${className}`}>{children}</div>;
}

export function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-[14px] font-semibold text-[var(--foreground)]">{title}</h2>
        {hint ? <p className="text-[12px] text-[var(--muted-soft)]">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Kpi({
  label,
  value,
  hint,
  delta,
  invert,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Change vs previous period, as a fraction (0.12 = +12%). */
  delta?: number | null;
  /** When true, a decrease is good (e.g. CPA). */
  invert?: boolean;
  tone?: "good" | "bad";
}) {
  const showDelta = delta != null && Number.isFinite(delta);
  const good = showDelta ? (invert ? delta! <= 0 : delta! >= 0) : null;
  return (
    <div className="ui-card px-4 py-3.5">
      <p className="text-[12px] font-medium text-[var(--muted)]">{label}</p>
      <p
        className={`mt-1 text-[22px] font-semibold tabular-nums tracking-tight ${
          tone === "good" ? "text-[var(--success)]" : tone === "bad" ? "text-[var(--danger)]" : "text-[var(--foreground)]"
        }`}
      >
        {value}
      </p>
      <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
        {showDelta ? (
          <span
            className={`rounded-full px-1.5 py-px font-semibold tabular-nums ${
              good ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--danger-soft)] text-[var(--danger)]"
            }`}
          >
            {delta! >= 0 ? "▲" : "▼"} {Math.abs(delta! * 100).toFixed(0)}%
          </span>
        ) : null}
        {hint ? <span className="truncate text-[var(--muted-soft)]">{hint}</span> : null}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-full border border-[var(--border)] bg-white p-1 shadow-[var(--shadow-xs)]">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all duration-300 ease-[var(--ease)] ${
              active ? "ui-btn-primary text-white" : "text-[var(--muted)] hover:bg-black/[0.04] hover:text-[var(--foreground)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[12px] font-medium text-[var(--foreground-soft)]">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-[var(--muted-soft)]">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`ui-input text-[13px] ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`ui-input h-auto min-h-[84px] resize-y py-2 text-[13px] leading-relaxed ${props.className ?? ""}`}
    />
  );
}

export function SelectInput({
  value,
  onChange,
  options,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly { id: string; label: string }[];
  className?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`ui-input text-[13px] ${className}`}>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button type="button" aria-label="Cerrar" className="animate-fade-in absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`animate-scale-in relative z-10 flex max-h-full w-full flex-col overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--background)] shadow-[0_24px_60px_-12px_rgba(17,24,39,0.35)] ${
          wide ? "max-w-[760px]" : "max-w-[560px]"
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-white px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold tracking-tight text-[var(--foreground)]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[12px] text-[var(--muted)]">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[18px] text-[var(--muted-soft)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] bg-white px-5 py-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-strong)] bg-white/60 px-6 py-14 text-center">
      <p className="text-[15px] font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-1 max-w-md text-[13px] text-[var(--muted)]">{text}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />;
}

/** Daily bar chart with an optional line overlay (e.g. spend bars + revenue line). */
export function BarChart({
  data,
  format,
  lineFormat,
  barLabel,
  lineLabel,
  height = 180,
}: {
  data: { day: string; bar: number; line?: number }[];
  format: (n: number) => string;
  lineFormat?: (n: number) => string;
  barLabel: string;
  lineLabel?: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const hasLine = data.some((d) => d.line != null);
  const max = Math.max(1, ...data.map((d) => Math.max(d.bar, hasLine ? (d.line ?? 0) : 0)));
  const w = 100 / Math.max(1, data.length);
  const linePoints = hasLine
    ? data.map((d, i) => `${i * w + w / 2},${100 - ((d.line ?? 0) / max) * 100}`).join(" ")
    : "";
  const h = hover != null ? data[hover] : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#c7d2fe]" /> {barLabel}
        </span>
        {hasLine && lineLabel ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded bg-[#10b981]" /> {lineLabel}
          </span>
        ) : null}
        <span className="ml-auto tabular-nums text-[var(--foreground-soft)]">
          {h
            ? `${new Date(`${h.day}T12:00:00`).toLocaleDateString("es", { day: "numeric", month: "short" })} · ${format(h.bar)}${
                hasLine && h.line != null ? ` · ${(lineFormat ?? format)(h.line)}` : ""
              }`
            : ""}
        </span>
      </div>
      <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          {[25, 50, 75].map((y) => (
            <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#eef0f4" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
          ))}
          {data.map((d, i) => {
            const bh = (d.bar / max) * 100;
            return (
              <rect
                key={d.day}
                x={i * w + w * 0.18}
                width={w * 0.64}
                y={100 - bh}
                height={Math.max(bh, d.bar > 0 ? 0.8 : 0)}
                rx="0.6"
                fill={hover === i ? "#818cf8" : "#c7d2fe"}
              />
            );
          })}
          {hasLine ? (
            <polyline points={linePoints} fill="none" stroke="#10b981" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex">
          {data.map((d, i) => (
            <div key={d.day} className="h-full flex-1" onMouseEnter={() => setHover(i)} />
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-[var(--muted-soft)]">
        <span>{data[0] ? new Date(`${data[0].day}T12:00:00`).toLocaleDateString("es", { day: "numeric", month: "short" }) : ""}</span>
        <span>{data.at(-1) ? new Date(`${data.at(-1)!.day}T12:00:00`).toLocaleDateString("es", { day: "numeric", month: "short" }) : ""}</span>
      </div>
    </div>
  );
}

export function Progress({ value, color = "var(--foreground)" }: { value: number; color?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-alt)]">
      <div className="h-full rounded-full transition-[width] duration-500 ease-[var(--ease)]" style={{ width: `${v * 100}%`, background: color }} />
    </div>
  );
}

export function copyText(text: string, label = "Copiado") {
  void navigator.clipboard.writeText(text).then(
    () => toast.success(label),
    () => toast.error("No se pudo copiar"),
  );
}
