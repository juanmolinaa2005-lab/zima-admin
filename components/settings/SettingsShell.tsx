"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { ChevronLeftIcon, LogoutIcon } from "@/components/dashboard/icons";

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

const NAV = [
  { href: "", label: "General" },
  { href: "/api", label: "API" },
  { href: "/password", label: "Contraseña" },
] as const;

export function SettingsShell({
  projectId,
  projectName,
  userEmail,
  title,
  subtitle,
  children,
}: SettingsShellProps) {
  const pathname = usePathname();
  const base = `/projects/${projectId}/settings`;

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-5">
          <Link
            href={`/projects/${projectId}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
            aria-label="Volver al proyecto"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Link>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-[12px] font-bold text-white">
            {(projectName.trim()[0] || "Z").toUpperCase()}
          </span>
          <div className="flex min-w-0 items-center gap-2 text-[14px]">
            <Link
              href={`/projects/${projectId}`}
              className="truncate text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {projectName}
            </Link>
            <span aria-hidden className="text-[var(--border-strong)]">
              /
            </span>
            <span className="truncate font-semibold">Ajustes</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 md:grid-cols-[200px_minmax(0,1fr)]">
        <aside>
          <nav aria-label="Ajustes" className="flex gap-1 overflow-x-auto md:flex-col">
            {NAV.map((item) => {
              const href = `${base}${item.href}`;
              const active = pathname === href;
              return (
                <Link
                  key={item.label}
                  href={href}
                  data-active={active}
                  aria-current={active ? "page" : undefined}
                  className="ui-nav-item shrink-0"
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 hidden border-t border-[var(--border)] pt-4 md:block">
            {userEmail ? (
              <p className="truncate px-3 text-[12px] text-[var(--muted-soft)]">{userEmail}</p>
            ) : null}
            <form action={signOut} className="mt-1">
              <button
                type="submit"
                className="ui-nav-item hover:!bg-[var(--danger-soft)] hover:!text-[var(--danger)]"
              >
                <LogoutIcon className="h-4 w-4" />
                Cerrar sesión
              </button>
            </form>
          </div>
        </aside>

        <main id="main" tabIndex={-1} className="min-w-0 space-y-6 outline-none">
          <div className="border-b border-[var(--border)] pb-5">
            <h1 className="ui-title">{title}</h1>
            {subtitle ? <p className="ui-lead mt-1">{subtitle}</p> : null}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
