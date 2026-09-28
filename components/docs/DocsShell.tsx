import Link from "next/link";
import { DocsNav } from "./DocsNav";

export function DocsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 p-5">
          <Link href="/docs" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-[12px] font-bold text-white">
              Z
            </span>
            <span className="truncate">
              <span className="block text-[13px] font-semibold leading-tight">
                Zima Admin
              </span>
              <span className="block text-[11px] text-[var(--muted-soft)]">
                Documentación
              </span>
            </span>
          </Link>
          <Link
            href="/login"
            className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
          >
            Iniciar sesión
          </Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-5xl gap-5 p-5 lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 hidden px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-soft)] lg:block">
            Guías
          </p>
          <DocsNav />
        </aside>
        <article className="rounded-xl bg-white p-6">
          {children}
        </article>
      </div>
    </div>
  );
}
