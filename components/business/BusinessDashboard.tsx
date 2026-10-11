"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { deleteProject } from "@/app/actions/projects";
import type { Project } from "@/lib/types";
import { ConnectSupabaseModal } from "@/components/projects/ConnectSupabaseModal";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import { PlusIcon, TrashIcon } from "@/components/dashboard/icons";

type BusinessDashboardProps = {
  projects: Project[];
  userEmail: string | null;
  supabaseConnected: boolean;
};

export function BusinessDashboard({ projects, userEmail, supabaseConnected: initialConnected }: BusinessDashboardProps) {
  const router = useRouter();
  const userKey = userEmail ?? "default";
  const [connected, setConnected] = useState(initialConnected);
  const [connectOpen, setConnectOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [lastInitial, setLastInitial] = useState(initialConnected);
  if (initialConnected !== lastInitial) {
    setLastInitial(initialConnected);
    setConnected(initialConnected);
  }

  function handleCreate() {
    if (!connected) setConnectOpen(true);
    else setCreateOpen(true);
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`¿Eliminar el proyecto “${name}”?`)) return;
    startTransition(async () => {
      await deleteProject(id);
      router.refresh();
    });
  }

  return (
    <div className="min-h-dvh bg-[var(--background)]">
      <header className="mx-auto flex h-16 max-w-[720px] items-center justify-between px-5 sm:px-8">
        <span className="text-[15px] font-semibold tracking-tight text-[var(--foreground)]">Vantko</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setConnectOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-[var(--success)]" : "bg-[var(--muted-soft)]"}`} />
            Supabase
          </button>
          <form action={signOut}>
            <button
              type="submit"
              title={userEmail ?? undefined}
              className="rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-[720px] px-5 pb-16 pt-10 outline-none sm:px-8">
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--foreground)]">Proyectos</h1>
          <button type="button" onClick={handleCreate} className="ui-btn-primary">
            <PlusIcon className="h-4 w-4" />
            Nuevo
          </button>
        </div>

        {!connected ? (
          <button
            type="button"
            onClick={() => setConnectOpen(true)}
            className="mt-6 text-[13px] text-[var(--muted)] underline-offset-4 hover:text-[var(--foreground)] hover:underline"
          >
            Conecta Supabase para crear proyectos →
          </button>
        ) : null}

        {projects.length === 0 ? (
          <p className="mt-16 text-center text-[14px] text-[var(--muted)]">Aún no tienes proyectos.</p>
        ) : (
          <ul className="mt-8 divide-y divide-[var(--border)] border-t border-[var(--border)]">
            {projects.map((project) => (
              <li key={project.id} className="group flex items-center gap-3">
                <Link href={`/projects/${project.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[image:var(--accent-metal)] text-[13px] font-bold text-white">
                    {(project.name.trim()[0] || "P").toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-[var(--foreground)]">{project.name}</span>
                    {project.description ? (
                      <span className="block truncate text-[13px] text-[var(--muted)]">{project.description}</span>
                    ) : null}
                  </span>
                  <span className="text-[13px] text-[var(--muted-soft)] transition group-hover:text-[var(--foreground)]">→</span>
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleDelete(project.id, project.name)}
                  className="rounded-lg p-1.5 text-[var(--muted-soft)] opacity-0 transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label={`Eliminar ${project.name}`}
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <CreateProjectModal
        open={createOpen}
        userKey={userKey}
        connected={connected}
        onClose={() => setCreateOpen(false)}
        onNeedConnect={() => {
          setCreateOpen(false);
          setConnectOpen(true);
        }}
      />
      <ConnectSupabaseModal
        open={connectOpen}
        connected={connected}
        onClose={() => setConnectOpen(false)}
        onChanged={(value) => {
          setConnected(value);
          router.refresh();
        }}
      />
    </div>
  );
}
