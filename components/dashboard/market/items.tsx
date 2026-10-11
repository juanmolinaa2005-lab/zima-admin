"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import type { MarketApp } from "@/lib/market/appstore";
import { AppIcon, compact, IconSearch, Star, useMarket } from "./shared";

export type MarketItemKind = "keyword" | "my_app" | "competitor" | "onboarding" | "ad" | "organic";

export type MarketItem<T> = { id: string; kind: MarketItemKind; key: string; data: T; created_at: string; updated_at: string };

export type MiniApp = Pick<MarketApp, "id" | "name" | "seller" | "icon" | "genre" | "rating" | "ratingCount" | "releasedAt">;

export function miniApp(app: MarketApp): MiniApp {
  return {
    id: app.id,
    name: app.name,
    seller: app.seller,
    icon: app.icon,
    genre: app.genre,
    rating: app.rating,
    ratingCount: app.ratingCount,
    releasedAt: app.releasedAt,
  };
}

export function useMarketItems<T>(projectId: string, kind: MarketItemKind) {
  const [items, setItems] = useState<MarketItem<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/market/items?kind=${kind}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo cargar");
      setItems(data.items as MarketItem<T>[]);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [projectId, kind]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(
    async (key: string, data: T) => {
      const res = await fetch(`/api/projects/${projectId}/market/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, key, data }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo guardar");
      const item = body.item as MarketItem<T>;
      setItems((prev) => {
        const exists = prev.some((row) => row.key === key);
        return exists ? prev.map((row) => (row.key === key ? item : row)) : [item, ...prev];
      });
      return item;
    },
    [projectId, kind]
  );

  const remove = useCallback(
    async (key: string) => {
      setItems((prev) => prev.filter((row) => row.key !== key));
      await fetch(`/api/projects/${projectId}/market/items?kind=${kind}&key=${encodeURIComponent(key)}`, { method: "DELETE" });
    },
    [projectId, kind]
  );

  return { items, loading, error, save, remove, reload };
}

export async function uploadMarketFile(projectId: string, folder: string, file: File) {
  const supabase = createClient();
  const ext = (file.name.split(".").pop() || (file.type.includes("video") ? "mp4" : "png")).toLowerCase().slice(0, 5);
  const path = `${projectId}/market/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("gallery").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from("gallery").getPublicUrl(path).data.publicUrl;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[26px] bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)] sm:rounded-[26px] ${wide ? "sm:max-w-[760px]" : "sm:max-w-[520px]"}`}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-[16px] font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-alt)]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export function AppPicker({
  projectId,
  country,
  onPick,
  placeholder = "Busca la app por nombre…",
  exclude = [],
  autoFocus = false,
}: {
  projectId: string;
  country: string;
  onPick: (app: MarketApp) => void;
  placeholder?: string;
  exclude?: string[];
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const handle = window.setTimeout(() => setTerm(draft.trim()), 350);
    return () => window.clearTimeout(handle);
  }, [draft]);
  const { data, loading } = useMarket<{ items: MarketApp[] }>(projectId, term.length >= 2 ? { op: "search", term, country } : null);
  const items = (data?.items ?? []).filter((app) => !exclude.includes(app.id)).slice(0, 12);
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-3.5 focus-within:border-black/25">
        <IconSearch className="h-4 w-4 shrink-0 text-[var(--muted)]" />
        <input
          autoFocus={autoFocus}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          className="h-11 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--muted-soft)]"
        />
      </label>
      {term.length >= 2 ? (
        loading ? (
          <p className="px-1 text-[12px] text-[var(--muted)]">Buscando…</p>
        ) : items.length === 0 ? (
          <p className="px-1 text-[12px] text-[var(--muted)]">Sin resultados para “{term}”.</p>
        ) : (
          <ul className="max-h-[320px] space-y-1 overflow-y-auto">
            {items.map((app) => (
              <li key={app.id}>
                <button
                  type="button"
                  onClick={() => onPick(app)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-[var(--surface-alt)]"
                >
                  <AppIcon src={app.icon} name={app.name} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{app.name}</span>
                    <span className="block truncate text-[11px] text-[var(--muted)]">{app.seller}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[12px] text-[var(--muted)]">
                    <Star className="h-3 w-3 text-[#f59e0b]" />
                    {app.rating?.toFixed(1) ?? "—"} · {compact(app.ratingCount)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

export function PickedApp({ app, onClear }: { app: MiniApp; onClear?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)]/50 p-2.5">
      <AppIcon src={app.icon} name={app.name} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold">{app.name}</span>
        <span className="block truncate text-[11px] text-[var(--muted)]">{app.seller}</span>
      </span>
      {onClear ? (
        <button type="button" onClick={onClear} className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[var(--muted)] hover:bg-white">
          Cambiar
        </button>
      ) : null}
    </div>
  );
}

export function GhostButton({ children, onClick, href, disabled }: { children: ReactNode; onClick?: () => void; href?: string; disabled?: boolean }) {
  const className =
    "inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-white px-3 text-[12px] font-semibold text-[var(--foreground)] transition hover:border-black/25 disabled:opacity-50";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
        <span aria-hidden className="text-[var(--muted)]">↗</span>
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}

export function PrimaryButton({ children, onClick, disabled, type = "button" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="ui-btn-primary inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold text-white disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function TrashButton({ onClick, label = "Eliminar" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted-soft)] transition hover:bg-[#fee2e2] hover:text-[#e11d48]"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
      </svg>
    </button>
  );
}
