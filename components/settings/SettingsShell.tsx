import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { LogoutIcon } from "@/components/dashboard/icons";

type SettingsShellProps = {
  projectId: string;
  projectName: string;
  userEmail?: string | null;
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
  footer?: boolean;
};

export function SettingsShell({
  projectId,
  projectName,
  userEmail,
  title,
  subtitle,
  backHref,
  backLabel = "← Back",
  children,
  footer = true,
}: SettingsShellProps) {
  const resolvedBack = backHref ?? `/projects/${projectId}`;

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[12px] font-bold text-white shadow-[0_2px_6px_rgba(99,91,255,0.35)]">
              Z
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">Settings</p>
              <p className="truncate text-[11px] text-[var(--muted)]">
                {projectName}
              </p>
            </div>
          </div>
          <Link
            href={resolvedBack}
            className="ui-btn-secondary h-8 px-3 text-[12px]"
          >
            {backLabel}
          </Link>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl space-y-6 px-5 py-8 outline-none">
        <div>
          <h1 className="ui-title">{title}</h1>
          {subtitle || userEmail ? (
            <p className="mt-1 text-[14px] text-[var(--muted)]">
              {subtitle}
              {subtitle && userEmail ? " · " : ""}
              {userEmail}
            </p>
          ) : null}
        </div>

        {children}

        {footer ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href={resolvedBack} className="ui-btn-secondary">
              {backLabel}
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--muted)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
              >
                <LogoutIcon className="h-3.5 w-3.5" />
                Sign out
              </button>
            </form>
          </div>
        ) : null}
      </main>
    </div>
  );
}
