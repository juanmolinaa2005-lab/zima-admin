"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { EstudioInfluencer } from "@/lib/creator/estudio-v1";
import type { SocialAccountPublic } from "@/lib/redes/types";
import type { UploadFlow, UploadItem } from "@/lib/upload/flows";
import { resolveSocialAvatar } from "@/lib/redes/avatar";
import { AccountAvatar } from "../AccountAvatar";
import { PlatformLogo } from "./vt-ui";

type DynamicOption = { id: string; name: string; description?: string };
type Options = {
  influencers: EstudioInfluencer[];
  dynamics: DynamicOption[];
  accounts: SocialAccountPublic[];
};
type StepId = "influencer" | "dynamic" | "network" | "schedule";
type FolderView = "review" | "ready" | "trash";

const TRASH_DAYS = 30;

const NETWORK_GROUPS = [
  { id: "tiktok", label: "TikTok", color: "#111827" },
  { id: "instagram", label: "Instagram", color: "#d62976" },
  { id: "youtube", label: "YouTube", color: "#ff0000" },
  { id: "other", label: "Otras", color: "#6b7280" },
];

const INTERVALS = [
  { hours: 1, label: "Cada hora" },
  { hours: 3, label: "Cada 3 h" },
  { hours: 6, label: "Cada 6 h" },
  { hours: 8, label: "Cada 8 h" },
  { hours: 12, label: "Cada 12 h" },
  { hours: 24, label: "1 al día" },
  { hours: 48, label: "Cada 2 días" },
  { hours: 72, label: "Cada 3 días" },
  { hours: 168, label: "1 a la semana" },
];

function intervalLabel(hours: number) {
  return INTERVALS.find((i) => i.hours === hours)?.label ?? `Cada ${hours} h`;
}

function when(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysLeft(rejectedAt: string | null) {
  if (!rejectedAt) return TRASH_DAYS;
  const passed = (Date.now() - new Date(rejectedAt).getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(TRASH_DAYS - passed));
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body
      ? { "Content-Type": "application/json", ...(init.headers || {}) }
      : init?.headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      (data as { error?: string; message?: string }).message ||
        (data as { error?: string }).error ||
        "Algo salió mal",
    );
  return data as T;
}

/* ---------------- icons ---------------- */

function Icon({ d, className = "h-4 w-4" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
const ICONS = {
  person:
    "M12 12a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5ZM4.75 20a7.25 7.25 0 0 1 14.5 0",
  dynamic: "M4.5 6.5h15v11h-15zM10 9.75v4.5l4-2.25z",
  network:
    "M8.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Zm14 -6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm0 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8.2 10.6l8.4-3.6M8.2 13.4l8.4 3.6",
  clock:
    "M12 7.5V12l3 2M20.25 12a8.25 8.25 0 1 1-16.5 0 8.25 8.25 0 0 1 16.5 0Z",
  folder:
    "M3.75 7.25A1.75 1.75 0 0 1 5.5 5.5h4l2 2h7a1.75 1.75 0 0 1 1.75 1.75v8.25a1.75 1.75 0 0 1-1.75 1.75h-13a1.75 1.75 0 0 1-1.75-1.75z",
  check: "m5 12.5 4.5 4.5L19 7.5",
  trash:
    "M5 7h14M10 4.5h4M9.5 10.5v6M14.5 10.5v6M6.5 7l.75 11.25A1.75 1.75 0 0 0 9 19.9h6a1.75 1.75 0 0 0 1.75-1.65L17.5 7",
  send: "M4.5 12 19.5 4.5l-4.5 15-3-6.5z",
  back: "M15 6 9 12l6 6",
  plus: "M12 5v14M5 12h14",
  pencil:
    "M4.5 19.5h3.75L18.6 9.15a2.12 2.12 0 0 0-3-3L5.25 16.5zM13.5 8.25l3 3",
  restore: "M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3.75h3.75",
  play: "M8 5.5v13l10-6.5z",
  pause: "M8.5 5.5v13M15.5 5.5v13",
};

/* ---------------- shared ui ---------------- */

function Dialog({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
        className={`w-full ${wide ? "max-w-2xl" : "max-w-sm"} rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[0_20px_50px_rgba(17,24,39,0.18)]`}
      >
        <p className="text-[15px] font-semibold text-[var(--foreground)]">
          {title}
        </p>
        <div className="mt-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

function Confirm({
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog title={title} onClose={() => !busy && onClose()}>
      <div className="text-[13px] leading-relaxed text-[var(--muted)]">
        {body}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="ui-btn-secondary disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="button"
          autoFocus
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } finally {
              setBusy(false);
            }
          }}
          className={
            danger
              ? "rounded-xl bg-[var(--danger)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
              : "ui-btn-primary disabled:opacity-60"
          }
        >
          {busy ? "Un momento…" : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

function Avatar({
  src,
  name,
  size = 28,
}: {
  src?: string | null;
  name: string;
  size?: number;
}) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-[var(--surface-alt)] text-[11px] font-semibold text-[var(--foreground-soft)]"
      style={{ width: size, height: size }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function influencerPhoto(inf: EstudioInfluencer | undefined) {
  return inf?.images.find((img) => img.imageUrl)?.imageUrl ?? null;
}

/* ---------------- flows list ---------------- */

function FlowsList({
  flows,
  options,
  loading,
  onOpen,
  onCreate,
}: {
  flows: UploadFlow[];
  options: Options;
  loading: boolean;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="w-full space-y-5 p-4 pb-28 sm:p-6 md:pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
            Upload
          </h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Flujos que revisas y publican solos en segundo plano: influencer →
            dinámica → red → programación.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="ui-btn-primary inline-flex items-center gap-1.5"
        >
          <Icon d={ICONS.plus} />
          Nuevo flujo
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-[200px] animate-pulse rounded-[28px] border border-[var(--border)] bg-white"
            />
          ))}
        </div>
      ) : flows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-6 py-14 text-center">
          <p className="text-[15px] font-semibold text-[var(--foreground)]">
            Aún no tienes flujos
          </p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--muted)]">
            Crea uno, elige influencer, dinámica, red y cada cuánto publicar.
            Revisas los videos y los aprobados se suben solos.
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="ui-btn-primary mt-4 inline-flex items-center gap-1.5"
          >
            <Icon d={ICONS.plus} />
            Crear flujo
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {flows.map((flow) => (
            <FlowRow
              key={flow.id}
              flow={flow}
              options={options}
              onOpen={() => onOpen(flow.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RowStep({
  label,
  icon,
  children,
  empty,
  photo,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  empty?: boolean;
  photo?: string | null;
}) {
  return (
    <div
      className={`flex min-h-[66px] min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-2xl border ${
        photo ? "self-stretch py-0 pl-0 pr-3.5" : "px-3.5 py-3"
      } ${
        empty
          ? "border-dashed border-[var(--border)] bg-transparent"
          : "border-[var(--border)] bg-white shadow-[0_2px_8px_rgba(17,24,39,0.04)]"
      }`}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          className="h-full min-h-[66px] w-16 shrink-0 self-stretch object-cover object-top"
        />
      ) : (
        icon
      )}
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">
          {label}
        </span>
        <span
          title={typeof children === "string" ? children : undefined}
          className={`block truncate text-[13px] font-semibold ${empty ? "text-[var(--muted)]" : "text-[var(--foreground)]"}`}
        >
          {children}
        </span>
      </span>
    </div>
  );
}

function RowArrow() {
  return (
    <span
      className="hidden shrink-0 items-center text-[var(--muted-soft)] lg:flex"
      aria-hidden
    >
      <span className="h-px w-4 bg-[var(--border)]" />
      <svg viewBox="0 0 8 10" className="h-2.5 w-2" fill="currentColor">
        <path d="M0 0l8 5-8 5z" />
      </svg>
    </span>
  );
}

function StepIcon({ d }: { d: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
      <Icon d={d} />
    </span>
  );
}

function FlowRow({
  flow,
  options,
  onOpen,
}: {
  flow: UploadFlow;
  options: Options;
  onOpen: () => void;
}) {
  const inf = options.influencers.find((i) => i.id === flow.influencerId);
  const dyn = options.dynamics.find((d) => d.id === flow.dynamicId);
  const acc = options.accounts.find((a) => a.id === flow.accountId);
  const photo = influencerPhoto(inf);
  const stats = [
    { label: "Por revisar", value: flow.counts.pending },
    { label: "Listos", value: flow.counts.approved },
    { label: "Publicados", value: flow.counts.published },
  ];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block w-full overflow-hidden rounded-[28px] border border-[var(--border)] bg-white text-left shadow-[0_1px_2px_rgba(17,24,39,0.04),0_12px_32px_-18px_rgba(17,24,39,0.18)] transition hover:-translate-y-0.5 hover:border-black/15 hover:shadow-[0_1px_2px_rgba(17,24,39,0.04),0_22px_44px_-20px_rgba(17,24,39,0.28)]"
    >
      <div className="flex">
        {photo ? (
          <span className="relative w-28 shrink-0 self-stretch border-r border-[var(--border)] sm:w-36">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-top"
            />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-6 py-4">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {flow.active ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-60" />
              ) : null}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${flow.active ? "bg-[#22c55e]" : "bg-[#d4d4d8]"}`}
              />
            </span>
            <p className="min-w-0 truncate text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
              {flow.name}
            </p>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                flow.active
                  ? "bg-[var(--success-soft)] text-[var(--success)]"
                  : "bg-[var(--surface-alt)] text-[var(--muted)]"
              }`}
            >
              {flow.active ? "Activo" : "Pausado"}
            </span>
            <span className="flex-1" />
            <span className="text-[12px] text-[var(--muted)]">
              {flow.active
                ? flow.nextPublishAt
                  ? `Próxima publicación · ${when(flow.nextPublishAt)}`
                  : "Esperando videos aprobados"
                : flow.lastPublishedAt
                  ? `Última publicación · ${when(flow.lastPublishedAt)}`
                  : "Sin publicaciones aún"}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] transition group-hover:border-[var(--foreground)] group-hover:bg-[var(--foreground)] group-hover:text-white">
              <Icon d={ICONS.back} className="h-4 w-4 rotate-180" />
            </span>
          </div>

          <div className="px-6 py-6">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <RowStep
                label="Influencer"
                empty={!inf}
                icon={<StepIcon d={ICONS.person} />}
              >
                {inf?.name ?? "Sin elegir"}
              </RowStep>
              <RowArrow />
              <RowStep
                label="Dinámica"
                empty={!dyn}
                icon={<StepIcon d={ICONS.dynamic} />}
              >
                {dyn?.name ?? "Sin elegir"}
              </RowStep>
              <RowArrow />
              <RowStep
                label="Red"
                empty={!acc}
                icon={
                  acc ? (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-alt)]">
                      <PlatformLogo id={acc.platform} className="h-5 w-5" />
                    </span>
                  ) : (
                    <StepIcon d={ICONS.network} />
                  )
                }
              >
                {acc
                  ? `@${acc.username || acc.displayName || acc.platform}`
                  : "Sin elegir"}
              </RowStep>
              <RowArrow />
              <RowStep label="Programación" icon={<StepIcon d={ICONS.clock} />}>
                {intervalLabel(flow.everyHours)}
              </RowStep>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-[var(--border)] border-t border-[var(--border)] bg-[var(--surface-alt)]/60">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-baseline justify-center gap-2 px-4 py-3.5"
              >
                <span className="text-[20px] font-semibold leading-none tabular-nums tracking-tight text-[var(--foreground)]">
                  {stat.value}
                </span>
                <span className="text-[12px] font-medium text-[var(--muted)]">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ---------------- canvas ---------------- */

function Node({
  step,
  label,
  icon,
  value,
  sub,
  done,
  active,
  onClick,
}: {
  step: number;
  label: string;
  icon: string;
  value: ReactNode;
  sub?: string;
  done: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full min-w-0 rounded-2xl border bg-white p-3 text-left shadow-[0_6px_18px_rgba(17,24,39,0.06)] transition hover:-translate-y-0.5 ${
        active
          ? "border-[var(--foreground)] ring-2 ring-black/10"
          : "border-[var(--border)] hover:border-black/25"
      }`}
    >
      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
            done
              ? "bg-[var(--foreground)] text-white"
              : "border border-[var(--border)] text-[var(--muted)]"
          }`}
        >
          {done ? <Icon d={ICONS.check} className="h-3 w-3" /> : step}
        </span>
        {label}
        <span className="ml-auto text-[var(--muted)]">
          <Icon d={icon} className="h-3.5 w-3.5" />
        </span>
      </span>
      <span className="mt-2.5 block min-h-[34px] text-[13px] font-semibold text-[var(--foreground)]">
        {value}
      </span>
      {sub ? (
        <span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">
          {sub}
        </span>
      ) : null}
    </button>
  );
}

function VWire() {
  return (
    <span className="relative flex h-7 justify-center" aria-hidden>
      <span className="w-[2px] bg-[var(--border)]" />
      <span className="absolute bottom-0 h-2 w-2 rounded-full border-2 border-[var(--border)] bg-white" />
    </span>
  );
}

function FolderCard({
  title,
  count,
  hint,
  onClick,
  highlight,
  icon = ICONS.folder,
}: {
  title: string;
  count: number;
  hint: string;
  onClick: () => void;
  highlight?: boolean;
  icon?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl border bg-white p-3 text-left shadow-[0_6px_18px_rgba(17,24,39,0.06)] transition hover:-translate-y-0.5 hover:border-black/25 ${
        highlight ? "border-[var(--foreground)]" : "border-[var(--border)]"
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
        <Icon d={icon} className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-[var(--foreground)]">
          {title}
        </span>
        <span className="block text-[11px] text-[var(--muted)]">
          <b className="tabular-nums text-[var(--foreground)]">{count}</b>{" "}
          {hint}
        </span>
      </span>
    </button>
  );
}

/* ---------------- step panels ---------------- */

function StepPanel({
  step,
  flow,
  options,
  onPatch,
  onClose,
}: {
  step: StepId;
  flow: UploadFlow;
  options: Options;
  onPatch: (
    patch: Partial<
      Record<
        "influencerId" | "dynamicId" | "accountId" | "caption",
        string | null
      >
    > & { everyHours?: number },
  ) => Promise<void>;
  onClose: () => void;
}) {
  const [caption, setCaption] = useState(flow.caption);
  const pill = (selected: boolean) =>
    `flex items-center gap-2.5 rounded-xl border p-2.5 text-left text-[13px] transition ${
      selected
        ? "border-[var(--foreground)] bg-[var(--surface-alt)] font-semibold"
        : "border-[var(--border)] bg-white hover:border-black/25"
    }`;

  const titles: Record<StepId, string> = {
    influencer: "1 · Elige el influencer",
    dynamic: "2 · Elige la dinámica",
    network: "3 · Elige la red donde publicar",
    schedule: "4 · Programación",
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 p-4 backdrop-blur-md"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
        className={`max-h-[85dvh] w-full ${step === "network" ? "max-w-md" : "max-w-3xl"} overflow-y-auto rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[0_30px_80px_rgba(17,24,39,0.25)]`}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[16px] font-semibold text-[var(--foreground)]">
            {titles[step]}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#ef4444] transition hover:bg-[#fee2e2]"
          >
            <Icon d="M6 6l12 12M18 6 6 18" className="h-5 w-5" />
          </button>
        </div>

        {step === "influencer" ? (
          options.influencers.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {options.influencers.map((inf) => {
                const photo = influencerPhoto(inf);
                const selected = flow.influencerId === inf.id;
                return (
                  <button
                    key={inf.id}
                    type="button"
                    onClick={() => void onPatch({ influencerId: inf.id })}
                    className={`group overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 ${
                      selected
                        ? "border-[var(--foreground)] ring-2 ring-black/15"
                        : "border-[var(--border)] hover:border-black/25"
                    }`}
                  >
                    <span className="relative block aspect-[4/5] bg-[var(--surface-alt)]">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo}
                          alt=""
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[28px] font-semibold text-[var(--muted)]">
                          {inf.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      {selected ? (
                        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--foreground)] text-white">
                          <Icon d={ICONS.check} className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate px-3 py-2.5 text-[13px] font-semibold text-[var(--foreground)]">
                      {inf.name}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-[13px] text-[var(--muted)]">
              No hay influencers todavía. Créalos en Studio → Influencers.
            </p>
          )
        ) : null}

        {step === "dynamic" ? (
          options.dynamics.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
              {options.dynamics.map((dyn) => (
                <button
                  key={dyn.id}
                  type="button"
                  onClick={() => void onPatch({ dynamicId: dyn.id })}
                  className={pill(flow.dynamicId === dyn.id)}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-alt)] text-[var(--muted)]">
                    <Icon d={ICONS.dynamic} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{dyn.name}</span>
                    {dyn.description ? (
                      <span className="block truncate text-[11px] font-normal text-[var(--muted)]">
                        {dyn.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[var(--muted)]">
              No hay dinámicas. Créalas en Studio → Dinámicas.
            </p>
          )
        ) : null}

        {step === "network" ? (
          options.accounts.length ? (
            <div className="space-y-3">
              {NETWORK_GROUPS.map((group) => {
                const list = options.accounts.filter((acc) =>
                  group.id === "other"
                    ? !NETWORK_GROUPS.some((g) => g.id === acc.platform)
                    : acc.platform === group.id,
                );
                if (!list.length) return null;
                return (
                  <div key={group.id}>
                    <div className="flex items-center gap-2.5 px-1 py-1.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-[inset_0_0_0_1px_rgba(17,24,39,0.08)]">
                        <PlatformLogo
                          id={
                            group.id === "other" ? list[0].platform : group.id
                          }
                          className="h-[18px] w-[18px]"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-[var(--foreground)]">
                          {group.label}
                        </span>
                        <span className="block text-[11px] text-[var(--muted)]">
                          {list.length === 1
                            ? "1 cuenta"
                            : `${list.length} cuentas`}
                        </span>
                      </span>
                    </div>
                    <div className="ml-5 space-y-0.5 border-l border-[var(--border)] py-1 pl-2.5">
                      {list.map((acc) => {
                        const selected = flow.accountId === acc.id;
                        const handle = acc.username
                          ? `@${acc.username.replace(/^@/, "")}`
                          : acc.displayName || acc.platform;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => void onPatch({ accountId: acc.id })}
                            className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition ${
                              selected
                                ? "bg-[var(--surface-alt)]"
                                : "hover:bg-[var(--surface-alt)]"
                            }`}
                          >
                            <AccountAvatar
                              src={resolveSocialAvatar({
                                platform: acc.platform,
                                username: acc.username,
                                avatarUrl: acc.avatarUrl,
                              })}
                              label={handle}
                              color={group.color}
                              size={30}
                            />
                            <span className="min-w-0 flex-1">
                              <span
                                className={`block truncate text-[13px] ${selected ? "font-semibold text-[var(--foreground)]" : "text-[var(--foreground-soft)]"}`}
                              >
                                {handle}
                              </span>
                              {!acc.hasTokens ? (
                                <span className="block truncate text-[11px] text-[#b45309]">
                                  Sin API: conéctala en Redes
                                </span>
                              ) : null}
                            </span>
                            {selected ? (
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-white">
                                <Icon d={ICONS.check} className="h-3 w-3" />
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[13px] text-[var(--muted)]">
              No hay cuentas conectadas. Añádelas en Redes.
            </p>
          )
        ) : null}

        {step === "schedule" ? (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[12px] font-medium text-[var(--foreground-soft)]">
                Cada cuánto se publica un video
              </p>
              <div className="flex flex-wrap gap-2">
                {INTERVALS.map((option) => (
                  <button
                    key={option.hours}
                    type="button"
                    onClick={() => void onPatch({ everyHours: option.hours })}
                    className={`rounded-full border px-3 py-1.5 text-[12px] transition ${
                      flow.everyHours === option.hours
                        ? "border-[var(--foreground)] bg-[var(--foreground)] font-semibold text-white"
                        : "border-[var(--border)] bg-white text-[var(--foreground-soft)] hover:border-black/25"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[12px] font-medium text-[var(--foreground-soft)]">
                Descripción por defecto de cada video
              </p>
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                onBlur={() =>
                  caption !== flow.caption && void onPatch({ caption })
                }
                rows={3}
                placeholder="Texto y hashtags que llevará cada publicación (puedes cambiarlo en cada video)"
                className="ui-input resize-y"
              />
            </div>
          </div>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}

/* ---------------- review (swipe) ---------------- */

function CaptionDialog({
  initial,
  onSave,
  onClose,
}: {
  initial: string;
  onSave: (value: string) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog title="Editar descripción" onClose={() => !busy && onClose()}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={5}
        autoFocus
        className="ui-input mt-1 resize-y"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="ui-btn-secondary"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(value);
              onClose();
            } finally {
              setBusy(false);
            }
          }}
          className="ui-btn-primary disabled:opacity-60"
        >
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </Dialog>
  );
}

function ReviewView({
  items,
  flow,
  influencer,
  dynamic,
  onDecide,
  onCaption,
}: {
  items: UploadItem[];
  flow: UploadFlow;
  influencer?: EstudioInfluencer;
  dynamic?: DynamicOption;
  onDecide: (item: UploadItem, action: "approve" | "reject") => Promise<void>;
  onCaption: (item: UploadItem, caption: string) => Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const safeIndex = Math.min(index, Math.max(0, items.length - 1));
  const current = items[safeIndex];

  const decide = useCallback(
    async (action: "approve" | "reject") => {
      if (!current || busy) return;
      setBusy(true);
      try {
        await onDecide(current, action);
      } finally {
        setBusy(false);
      }
    },
    [current, busy, onDecide],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (editing || (event.target as HTMLElement)?.closest("input,textarea"))
        return;
      if (event.key === "ArrowLeft") void decide("reject");
      if (event.key === "ArrowRight") void decide("approve");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, editing]);

  if (!current) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-6 py-14 text-center">
        <p className="text-[15px] font-semibold text-[var(--foreground)]">
          Nada por revisar
        </p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--muted)]">
          Aquí aparecen los videos terminados de{" "}
          {influencer?.name ?? "el influencer"} con la dinámica{" "}
          {dynamic?.name ?? "elegida"}. Genera más en Studio y vuelve.
        </p>
      </div>
    );
  }

  const caption = current.caption ?? flow.caption;

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-full bg-[#e5e7eb] px-3.5 py-1.5 text-[12px] font-medium text-[var(--foreground-soft)]">
          Video
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3.5 py-1.5 text-[12px] font-medium text-[var(--foreground)]">
          <Avatar
            src={influencerPhoto(influencer)}
            name={influencer?.name ?? "?"}
            size={16}
          />
          {influencer?.name ?? "Influencer"}
        </span>
        <span className="rounded-full border border-[var(--border)] bg-white px-3.5 py-1.5 text-[12px] font-medium text-[var(--foreground)]">
          {dynamic?.name ?? "Dinámica"}
        </span>
        <span className="text-[12px] tabular-nums text-[var(--muted)]">
          {safeIndex + 1} de {items.length}
        </span>
      </div>

      <div className="relative w-[min(100%,300px)] sm:w-[320px]">
        {items.length > 2 ? (
          <div
            className="absolute inset-0 translate-x-3 translate-y-3 rotate-[4deg] rounded-[22px] bg-[#1f1f22]"
            aria-hidden
          />
        ) : null}
        {items.length > 1 ? (
          <div
            className="absolute inset-0 translate-x-1.5 translate-y-1.5 rotate-[2deg] rounded-[22px] bg-[#2b2b30]"
            aria-hidden
          />
        ) : null}
        <div className="relative aspect-[9/16] overflow-hidden rounded-[22px] bg-black shadow-[0_18px_40px_rgba(17,24,39,0.25)]">
          <video
            key={current.id}
            src={current.videoUrl}
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            controls
          />
          {items.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Anterior"
                onClick={() =>
                  setIndex((safeIndex - 1 + items.length) % items.length)
                }
                className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white"
              >
                <Icon d={ICONS.back} />
              </button>
              <button
                type="button"
                aria-label="Siguiente"
                onClick={() => setIndex((safeIndex + 1) % items.length)}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 rotate-180 items-center justify-center rounded-full bg-black/55 text-white"
              >
                <Icon d={ICONS.back} />
              </button>
            </>
          ) : null}
        </div>
      </div>

      <p className="mt-4 max-w-[340px] text-center text-[12px] leading-relaxed text-[var(--muted)]">
        {caption ? (
          caption
        ) : (
          <span className="italic">
            Sin descripción. Toca Edit para escribir una.
          </span>
        )}
      </p>

      <div className="mt-5 grid grid-cols-[56px_auto_56px] items-start justify-items-center gap-x-5">
        <div className="flex flex-col items-center">
          <button
            type="button"
            title="Descartar (←)"
            disabled={busy}
            onClick={() => void decide("reject")}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white text-[28px] font-light leading-none text-[#ef4444] shadow-[0_8px_20px_rgba(17,24,39,0.08)] disabled:opacity-40"
          >
            ×
          </button>
          <kbd className="mt-2 rounded border border-[var(--border)] bg-white px-1.5 text-[10px] text-[var(--muted-soft)]">
            ←
          </kbd>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-0.5 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-9 text-[15px] font-medium text-[var(--foreground-soft)] shadow-[0_8px_20px_rgba(17,24,39,0.08)]"
        >
          <Icon d={ICONS.pencil} />
          Edit
        </button>
        <div className="flex flex-col items-center">
          <button
            type="button"
            title="Aprobar (→)"
            disabled={busy}
            onClick={() => void decide("approve")}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white text-[#22c55e] shadow-[0_8px_20px_rgba(17,24,39,0.08)] disabled:opacity-40"
          >
            <Icon d={ICONS.check} className="h-6 w-6" />
          </button>
          <kbd className="mt-2 rounded border border-[var(--border)] bg-white px-1.5 text-[10px] text-[var(--muted-soft)]">
            →
          </kbd>
        </div>
      </div>

      {editing ? (
        <CaptionDialog
          initial={caption}
          onSave={(value) => onCaption(current, value)}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}

/* ---------------- ready + trash ---------------- */

function VideoThumb({ url }: { url: string }) {
  return (
    <video
      src={`${url}#t=0.5`}
      preload="metadata"
      muted
      playsInline
      className="h-full w-full object-cover"
    />
  );
}

function ReadyView({
  flow,
  items,
  onRestore,
  onRetry,
  onCaption,
}: {
  flow: UploadFlow;
  items: UploadItem[];
  onRestore: (item: UploadItem) => Promise<void>;
  onRetry: (item: UploadItem) => Promise<void>;
  onCaption: (item: UploadItem, caption: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<UploadItem | null>(null);
  const queue = items.filter(
    (i) => i.status === "approved" || i.status === "publishing",
  );
  const failed = items.filter((i) => i.status === "failed");
  const published = items
    .filter((i) => i.status === "published")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const [now] = useState(() => Date.now());
  const base = flow.nextPublishAt
    ? new Date(flow.nextPublishAt).getTime()
    : null;

  const row = (item: UploadItem, right: ReactNode, meta: ReactNode) => (
    <li
      key={item.id}
      className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-2.5"
    >
      <span className="h-[72px] w-[42px] shrink-0 overflow-hidden rounded-lg bg-black">
        <VideoThumb url={item.videoUrl} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-[var(--foreground)]">
          {item.caption ?? flow.caption ?? ""}
        </span>
        <span className="block text-[11px] text-[var(--muted)]">{meta}</span>
      </span>
      {right}
    </li>
  );

  return (
    <div className="space-y-6">
      <section>
        <p className="mb-2 text-[13px] font-semibold text-[var(--foreground)]">
          Listos para publicar · {queue.length}
        </p>
        {!flow.active && queue.length ? (
          <p className="mb-2 rounded-xl bg-[#fef3c7] px-3 py-2 text-[12px] text-[#92400e]">
            El flujo está pausado. Actívalo para que empiece a publicar.
          </p>
        ) : null}
        {queue.length ? (
          <ul className="space-y-2">
            {queue.map((item, i) =>
              row(
                item,
                item.status === "publishing" ? (
                  <span className="text-[12px] font-medium text-[var(--muted)]">
                    Subiendo…
                  </span>
                ) : (
                  <span className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      className="rounded-lg px-2 py-1.5 text-[12px] text-[var(--muted)] hover:bg-[var(--surface-alt)]"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void onRestore(item)}
                      className="rounded-lg px-2 py-1.5 text-[12px] text-[var(--muted)] hover:bg-[var(--surface-alt)]"
                    >
                      Volver a revisión
                    </button>
                  </span>
                ),
                flow.active
                  ? base
                    ? `Se publica aprox. ${when(new Date(Math.max(base, now) + i * flow.everyHours * 3_600_000).toISOString())}`
                    : "Se publica en los próximos minutos"
                  : "En cola",
              ),
            )}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-4 py-8 text-center text-[12px] text-[var(--muted)]">
            Aprueba videos en “Por revisar” para que entren a la cola.
          </p>
        )}
      </section>

      {failed.length ? (
        <section>
          <p className="mb-2 text-[13px] font-semibold text-[var(--danger)]">
            Con error · {failed.length}
          </p>
          <ul className="space-y-2">
            {failed.map((item) =>
              row(
                item,
                <button
                  type="button"
                  onClick={() => void onRetry(item)}
                  className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[12px] font-medium hover:bg-[var(--surface-alt)]"
                >
                  Reintentar
                </button>,
                <span className="text-[var(--danger)]">{item.error}</span>,
              ),
            )}
          </ul>
        </section>
      ) : null}

      <section>
        <p className="mb-2 text-[13px] font-semibold text-[var(--foreground)]">
          Publicados · {published.length}
        </p>
        {published.length ? (
          <ul className="space-y-2">
            {published.map((item) =>
              row(item, null, `Publicado ${when(item.publishedAt)}`),
            )}
          </ul>
        ) : (
          <p className="text-[12px] text-[var(--muted)]">
            Todavía no se ha publicado ningún video de este flujo.
          </p>
        )}
      </section>

      {editing ? (
        <CaptionDialog
          initial={editing.caption ?? flow.caption}
          onSave={(value) => onCaption(editing, value)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function TrashView({
  items,
  onRestore,
  onDelete,
}: {
  items: UploadItem[];
  onRestore: (item: UploadItem) => Promise<void>;
  onDelete: (item: UploadItem) => Promise<void>;
}) {
  const [confirm, setConfirm] = useState<UploadItem | null>(null);
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-6 py-14 text-center">
        <p className="text-[15px] font-semibold text-[var(--foreground)]">
          El basurero está vacío
        </p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--muted)]">
          Los videos descartados quedan aquí {TRASH_DAYS} días y luego se borran
          solos.
        </p>
      </div>
    );
  }
  return (
    <>
      <p className="mb-3 text-[12px] text-[var(--muted)]">
        Los descartados se borran solos a los {TRASH_DAYS} días. Puedes
        restaurarlos antes.
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white"
          >
            <div className="aspect-[9/16] bg-black">
              <VideoThumb url={item.videoUrl} />
            </div>
            <div className="space-y-1.5 p-2.5">
              <p className="text-[11px] text-[var(--muted)]">
                Se borra en {daysLeft(item.rejectedAt)} días
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => void onRestore(item)}
                  className="flex-1 rounded-lg border border-[var(--border)] px-2 py-1.5 text-[12px] font-medium hover:bg-[var(--surface-alt)]"
                >
                  Restaurar
                </button>
                <button
                  type="button"
                  aria-label="Borrar ya"
                  onClick={() => setConfirm(item)}
                  className="rounded-lg px-2 py-1.5 text-[var(--muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                >
                  <Icon d={ICONS.trash} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {confirm ? (
        <Confirm
          title="¿Borrar ya este video del flujo?"
          body="Sale del basurero ahora mismo en lugar de esperar los 30 días. No se puede deshacer."
          confirmLabel="Borrar"
          danger
          onConfirm={() => onDelete(confirm)}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </>
  );
}

/* ---------------- flow workspace ---------------- */

function FlowWorkspace({
  projectId,
  flowId,
  options,
  onBack,
  onChanged,
}: {
  projectId: string;
  flowId: string;
  options: Options;
  onBack: () => void;
  onChanged: (flowId: string, flow: UploadFlow | null) => void;
}) {
  const base = `/api/projects/${projectId}/upload/flows/${flowId}`;
  const [flow, setFlow] = useState<UploadFlow | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [error, setError] = useState("");
  const [step, setStep] = useState<StepId | null>(null);
  const [view, setView] = useState<FolderView | null>(null);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const apply = useCallback(
    (data: { flow: UploadFlow; items: UploadItem[] }) => {
      setFlow(data.flow);
      setName(data.flow.name);
      setItems(data.items);
      setError("");
      onChanged(flowId, data.flow);
    },
    [flowId, onChanged],
  );
  const fail = useCallback(
    (err: unknown) =>
      setError(
        err instanceof Error ? err.message : "No se pudo cargar el flujo",
      ),
    [],
  );

  const load = useCallback(async () => {
    try {
      apply(await api<{ flow: UploadFlow; items: UploadItem[] }>(base));
    } catch (err) {
      fail(err);
    }
  }, [base, apply, fail]);

  useEffect(() => {
    api<{ flow: UploadFlow; items: UploadItem[] }>(base).then(apply, fail);
  }, [base, apply, fail]);

  const patchFlow = useCallback(
    async (patch: Record<string, unknown>) => {
      try {
        const data = await api<{ flow: UploadFlow }>(base, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        setFlow(data.flow);
        onChanged(flowId, data.flow);
        setError("");
        if ("influencerId" in patch || "dynamicId" in patch) await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar");
      }
    },
    [base, load, flowId, onChanged],
  );

  const patchItem = useCallback(
    async (item: UploadItem, body: Record<string, unknown>) => {
      try {
        const data = await api<{ item: UploadItem }>(
          `${base}/items/${item.id}`,
          { method: "PATCH", body: JSON.stringify(body) },
        );
        setItems((prev) => prev.map((i) => (i.id === item.id ? data.item : i)));
        setError("");
        if (body.action) void load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar");
      }
    },
    [base, load],
  );

  const counts = useMemo(() => {
    const c = { pending: 0, ready: 0, rejected: 0, published: 0 };
    for (const item of items) {
      if (item.status === "pending") c.pending += 1;
      else if (
        item.status === "approved" ||
        item.status === "publishing" ||
        item.status === "failed"
      )
        c.ready += 1;
      else if (item.status === "rejected") c.rejected += 1;
      else if (item.status === "published") c.published += 1;
    }
    return c;
  }, [items]);

  if (!flow) {
    return (
      <div className="p-6">
        {error ? (
          <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
            {error}
          </p>
        ) : (
          <div className="h-64 animate-pulse rounded-2xl bg-white" />
        )}
      </div>
    );
  }

  const inf = options.influencers.find((i) => i.id === flow.influencerId);
  const dyn = options.dynamics.find((d) => d.id === flow.dynamicId);
  const acc = options.accounts.find((a) => a.id === flow.accountId);
  const ready = Boolean(flow.influencerId && flow.dynamicId && flow.accountId);

  const folderTitle: Record<FolderView, string> = {
    review: "Videos por revisar",
    ready: "Videos revisados",
    trash: "Basurero",
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-white px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={view ? () => setView(null) : onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-alt)]"
          aria-label="Volver"
        >
          <Icon d={ICONS.back} />
        </button>
        {view ? (
          <p className="text-[15px] font-semibold text-[var(--foreground)]">
            {flow.name}{" "}
            <span className="text-[var(--muted)]">/ {folderTitle[view]}</span>
          </p>
        ) : (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() =>
              name.trim() && name !== flow.name && void patchFlow({ name })
            }
            className="min-w-0 flex-1 rounded-lg bg-transparent px-1.5 py-1 text-[16px] font-semibold text-[var(--foreground)] outline-none hover:bg-[var(--surface-alt)] focus:bg-[var(--surface-alt)]"
            aria-label="Nombre del flujo"
          />
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setView("trash")}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-medium text-[var(--muted)] hover:bg-[var(--surface-alt)]"
        >
          <Icon d={ICONS.trash} />
          Basurero{counts.rejected ? ` · ${counts.rejected}` : ""}
        </button>
        <button
          type="button"
          onClick={() => void patchFlow({ active: !flow.active })}
          disabled={!flow.active && !ready}
          title={!ready ? "Completa los 4 pasos para activarlo" : undefined}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            flow.active
              ? "border border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
              : "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
          }`}
        >
          <Icon
            d={flow.active ? ICONS.pause : ICONS.play}
            className="h-3.5 w-3.5"
          />
          {flow.active ? "Pausar" : "Activar"}
        </button>
        {!view ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label="Eliminar flujo"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
          >
            <Icon d={ICONS.trash} />
          </button>
        ) : null}
      </header>

      {error ? (
        <p className="mx-4 mt-3 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)] sm:mx-6">
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === "review" ? (
          <div className="p-4 pb-28 sm:p-6">
            <ReviewView
              items={items.filter((i) => i.status === "pending")}
              flow={flow}
              influencer={inf}
              dynamic={dyn}
              onDecide={(item, action) => patchItem(item, { action })}
              onCaption={(item, caption) => patchItem(item, { caption })}
            />
          </div>
        ) : view === "ready" ? (
          <div className="mx-auto max-w-3xl p-4 pb-28 sm:p-6">
            <ReadyView
              flow={flow}
              items={items}
              onRestore={(item) => patchItem(item, { action: "restore" })}
              onRetry={(item) => patchItem(item, { action: "retry" })}
              onCaption={(item, caption) => patchItem(item, { caption })}
            />
          </div>
        ) : view === "trash" ? (
          <div className="p-4 pb-28 sm:p-6">
            <TrashView
              items={items.filter((i) => i.status === "rejected")}
              onRestore={(item) => patchItem(item, { action: "restore" })}
              onDelete={async (item) => {
                await api(`${base}/items/${item.id}`, { method: "DELETE" });
                setItems((prev) => prev.filter((i) => i.id !== item.id));
              }}
            />
          </div>
        ) : (
          <div
            className="min-h-full space-y-4 p-4 pb-28 sm:p-6"
            style={{
              backgroundColor: "#fafafa",
              backgroundImage: "radial-gradient(#d4d4d8 1px, transparent 1px)",
              backgroundSize: "18px 18px",
            }}
          >
            <div className="py-6">
              <div className="mx-auto flex w-full max-w-md flex-col">
                <Node
                  step={1}
                  label="Influencer"
                  icon={ICONS.person}
                  done={Boolean(inf)}
                  active={step === "influencer"}
                  onClick={() =>
                    setStep(step === "influencer" ? null : "influencer")
                  }
                  value={
                    inf ? (
                      <span className="flex items-center gap-2">
                        <Avatar src={influencerPhoto(inf)} name={inf.name} />
                        <span className="truncate">{inf.name}</span>
                      </span>
                    ) : (
                      <span className="text-[var(--muted)]">Seleccionar</span>
                    )
                  }
                />
                <VWire />
                <Node
                  step={2}
                  label="Dinámica"
                  icon={ICONS.dynamic}
                  done={Boolean(dyn)}
                  active={step === "dynamic"}
                  onClick={() => setStep(step === "dynamic" ? null : "dynamic")}
                  value={
                    dyn ? (
                      <span className="line-clamp-2">{dyn.name}</span>
                    ) : (
                      <span className="text-[var(--muted)]">Seleccionar</span>
                    )
                  }
                />
                <VWire />
                <Node
                  step={3}
                  label="Red"
                  icon={ICONS.network}
                  done={Boolean(acc)}
                  active={step === "network"}
                  onClick={() => setStep(step === "network" ? null : "network")}
                  value={
                    acc ? (
                      <span className="flex items-center gap-2">
                        <PlatformLogo
                          id={acc.platform}
                          className="h-5 w-5 shrink-0"
                        />
                        <span className="truncate">
                          @{acc.username || acc.displayName || acc.platform}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[var(--muted)]">Seleccionar</span>
                    )
                  }
                  sub={
                    acc && !acc.hasTokens
                      ? "Sin API: no podrá publicar"
                      : undefined
                  }
                />
                <VWire />
                <Node
                  step={4}
                  label="Programación"
                  icon={ICONS.clock}
                  done
                  active={step === "schedule"}
                  onClick={() =>
                    setStep(step === "schedule" ? null : "schedule")
                  }
                  value={intervalLabel(flow.everyHours)}
                  sub={
                    flow.active
                      ? flow.nextPublishAt
                        ? `Próximo: ${when(flow.nextPublishAt)}`
                        : "Esperando videos aprobados"
                      : "Pausado"
                  }
                />
                <VWire />
                <div className="rounded-[22px] border border-dashed border-[var(--border)] bg-white/70 p-3">
                  <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">
                    Revisión
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <FolderCard
                      title="Por revisar"
                      count={counts.pending}
                      hint="videos"
                      onClick={() => setView("review")}
                      highlight={counts.pending > 0}
                    />
                    <FolderCard
                      title="Revisados"
                      count={counts.ready}
                      hint="listos"
                      onClick={() => setView("ready")}
                    />
                  </div>
                </div>
                <VWire />
                <FolderCard
                  title="Publicados"
                  icon={ICONS.send}
                  count={counts.published}
                  hint={
                    flow.lastPublishedAt
                      ? `· último ${when(flow.lastPublishedAt)}`
                      : "publicados"
                  }
                  onClick={() => setView("ready")}
                />
              </div>
            </div>

            {flow.lastError ? (
              <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-[12px] text-[var(--danger)]">
                Último error al publicar: {flow.lastError}
              </p>
            ) : null}

            {step ? (
              <StepPanel
                key={step}
                step={step}
                flow={flow}
                options={options}
                onPatch={async (patch) => {
                  if (!("caption" in patch)) setStep(null);
                  await patchFlow(patch);
                }}
                onClose={() => setStep(null)}
              />
            ) : !ready ? (
              <p className="text-center text-[12px] text-[var(--muted)]">
                Toca cada paso del flujo para configurarlo.
              </p>
            ) : null}
          </div>
        )}
      </div>

      {confirmDelete ? (
        <Confirm
          title="¿Eliminar este flujo?"
          body={
            <>
              Se borrará <b className="text-[var(--foreground)]">{flow.name}</b>{" "}
              con su cola de revisión. Los videos siguen en la galería.
            </>
          }
          confirmLabel="Eliminar"
          danger
          onConfirm={async () => {
            await api(base, { method: "DELETE" });
            onChanged(flowId, null);
            onBack();
          }}
          onClose={() => setConfirmDelete(false)}
        />
      ) : null}
    </div>
  );
}

/* ---------------- page ---------------- */

function nextFlowName(flows: UploadFlow[]) {
  const names = new Set(flows.map((f) => f.name));
  let n = flows.length + 1;
  while (names.has(`Flujo ${n}`)) n += 1;
  return `Flujo ${n}`;
}

export function UploadPage({ projectId }: { projectId: string }) {
  const [flows, setFlows] = useState<UploadFlow[]>([]);
  const [options, setOptions] = useState<Options>({
    influencers: [],
    dynamics: [],
    accounts: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const root = `/api/projects/${projectId}`;
      const [flowsRes, infRes, dynRes, accRes] = await Promise.allSettled([
        api<{ flows: UploadFlow[] }>(`${root}/upload/flows`),
        api<{ influencers: EstudioInfluencer[] }>(
          `${root}/creator/influencers`,
        ),
        api<{ dynamics: DynamicOption[] }>(`${root}/creator/dynamics`),
        api<{ accounts: SocialAccountPublic[] }>(`${root}/redes/accounts`),
      ]);
      if (cancelled) return;
      if (flowsRes.status === "fulfilled") setFlows(flowsRes.value.flows);
      else
        setError(
          flowsRes.reason instanceof Error
            ? flowsRes.reason.message
            : "No se pudieron cargar los flujos",
        );
      setOptions({
        influencers:
          infRes.status === "fulfilled" ? infRes.value.influencers : [],
        dynamics:
          dynRes.status === "fulfilled"
            ? dynRes.value.dynamics.map((d) => ({
                id: d.id,
                name: d.name,
                description: d.description,
              }))
            : [],
        accounts: accRes.status === "fulfilled" ? accRes.value.accounts : [],
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function create() {
    try {
      const { flow } = await api<{ flow: UploadFlow }>(
        `/api/projects/${projectId}/upload/flows`,
        {
          method: "POST",
          body: JSON.stringify({ name: nextFlowName(flows) }),
        },
      );
      setFlows((prev) => [flow, ...prev]);
      setOpenId(flow.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo crear el flujo",
      );
    }
  }

  const onChanged = useCallback((flowId: string, flow: UploadFlow | null) => {
    setFlows((prev) =>
      flow
        ? prev.map((f) => (f.id === flowId ? flow : f))
        : prev.filter((f) => f.id !== flowId),
    );
  }, []);

  if (openId) {
    return (
      <FlowWorkspace
        key={openId}
        projectId={projectId}
        flowId={openId}
        options={options}
        onBack={() => setOpenId(null)}
        onChanged={onChanged}
      />
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {error ? (
        <p className="mx-4 mt-4 rounded-xl sm:mx-6 bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      <FlowsList
        flows={flows}
        options={options}
        loading={loading}
        onOpen={setOpenId}
        onCreate={() => void create()}
      />
    </div>
  );
}
