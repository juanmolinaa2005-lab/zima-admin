import type { FormEvent, ReactNode } from "react";
import { PlusIcon, TrashIcon } from "@/components/dashboard/icons";

export function SectionHead({
  kicker,
  title,
  description,
  action,
}: {
  kicker: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="ui-kicker">{kicker}</p>
        <h1 className="ui-title mt-1.5">{title}</h1>
        <p className="ui-lead mt-1">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="mt-5 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-5 py-12 text-center">
      <p className="text-[15px] font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-1 text-[13px] text-[var(--muted)]">{body}</p>
      <button type="button" onClick={onAction} className="ui-btn-primary mt-5">
        <PlusIcon className="h-4 w-4" />
        {actionLabel}
      </button>
    </div>
  );
}

export function FormCard({
  title,
  children,
  onSubmit,
  onCancel,
  pending,
  submitLabel,
}: {
  title: string;
  children: ReactNode;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  pending?: boolean;
  submitLabel: string;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="ui-card mt-5 space-y-3 p-5"
    >
      <p className="text-[14px] font-semibold text-[var(--foreground)]">{title}</p>
      {children}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="ui-btn-secondary">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="ui-btn-primary disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-[var(--foreground-soft)]">
        {label}
      </span>
      {children}
    </label>
  );
}

export function DeleteButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl p-1.5 text-[var(--muted-soft)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
      aria-label={label}
    >
      <TrashIcon className="h-3.5 w-3.5" />
    </button>
  );
}
