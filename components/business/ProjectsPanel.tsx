"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteProject,
  fetchRemoteSupabaseProjects,
} from "@/app/actions/projects";
import type { Project } from "@/lib/types";
import {
  loadRemoteNamesCache,
  saveRemoteNamesCache,
  saveRemotesCache,
} from "@/lib/client-cache";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import { PlusIcon, TrashIcon } from "@/components/dashboard/icons";
import { EmptyState, SectionHead } from "./section-ui";
import type { BusinessWorkspace } from "@/lib/business/workspace-store";

type ProjectsPanelProps = {
  projects: Project[];
  userEmail: string | null;
  connected: boolean;
  workspace: BusinessWorkspace;
  onNeedConnect: () => void;
  onOpenSection: (section: "proyectos" | "task" | "documents" | "contratos" | "team") => void;
};

export function ProjectsPanel({
  projects,
  userEmail,
  connected,
  workspace,
  onNeedConnect,
  onOpenSection,
}: ProjectsPanelProps) {
  const router = useRouter();
  const userKey = userEmail ?? "default";
  const [modalOpen, setModalOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [remoteNames, setRemoteNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!connected) {
      setRemoteNames({});
      return;
    }

    const cached = loadRemoteNamesCache(userKey);
    if (cached) setRemoteNames(cached.data);

    fetchRemoteSupabaseProjects()
      .then((remotes) => {
        saveRemotesCache(remotes, userKey);
        const names = Object.fromEntries(remotes.map((r) => [r.id, r.name]));
        saveRemoteNamesCache(names, userKey);
        setRemoteNames(names);
      })
      .catch(() => {
        // keep cached names if any
      });
  }, [connected, userKey]);

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`¿Eliminar el proyecto “${name}”?`)) return;
    startTransition(async () => {
      await deleteProject(id);
      router.refresh();
    });
  }

  function handleCreateClick() {
    if (!connected) {
      onNeedConnect();
      return;
    }
    setModalOpen(true);
  }

  const openTasks = workspace.tasks.filter((t) => t.status !== "done").length;
  const activeContracts = workspace.contracts.filter(
    (c) => c.status === "active"
  ).length;

  return (
    <>
      {!connected ? (
        <div className="relative mb-6 flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-xl bg-[image:var(--accent-metal)] p-5 text-white shadow-[var(--shadow-md)]">
          <div>
            <p className="text-[15px] font-semibold">Conecta Supabase</p>
            <p className="mt-1 text-[13px] text-white/80">
              Cada cuenta ve solo sus proyectos.
            </p>
          </div>
          <button
            type="button"
            onClick={onNeedConnect}
            className="inline-flex h-9 items-center rounded-lg bg-white px-4 text-[13px] font-semibold text-[var(--accent-ink)] shadow-sm transition hover:bg-white/90"
          >
            Conectar ahora
          </button>
        </div>
      ) : null}

      <SectionHead
        kicker="My Business"
        title="Proyectos"
        description="Elige un proyecto o crea uno nuevo."
        action={
          <button type="button" onClick={handleCreateClick} className="ui-btn-primary">
            <PlusIcon className="h-4 w-4" />
            Nuevo proyecto
          </button>
        }
      />

      <ul className="mt-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Proyectos"
          value={String(projects.length)}
        />
        <StatCard
          label="Task abiertas"
          value={String(openTasks)}
          onClick={() => onOpenSection("task")}
        />
        <StatCard
          label="Contratos activos"
          value={String(activeContracts)}
          onClick={() => onOpenSection("contratos")}
        />
        <StatCard
          label="Team"
          value={String(workspace.team.length)}
          onClick={() => onOpenSection("team")}
        />
      </ul>

      {projects.length === 0 ? (
        <EmptyState
          title="Sin proyectos"
          body="Crea el primero."
          actionLabel="Crear proyecto"
          onAction={handleCreateClick}
        />
      ) : (
        <section className="ui-card mt-6 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
            <h2 className="text-[14px] font-semibold text-[var(--foreground)]">
              Todos los proyectos
            </h2>
            <span className="ui-tag ui-tag-muted">{projects.length}</span>
          </div>
          <table className="w-full text-left text-[13px]">
            <thead className="hidden bg-[var(--background)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted-soft)] sm:table-header-group">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Proyecto</th>
                <th className="hidden px-3 py-2.5 font-semibold md:table-cell">Descripción</th>
                <th className="px-3 py-2.5 font-semibold">Supabase</th>
                <th className="w-24 px-5 py-2.5" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {projects.map((project) => {
                const linked = project.supabase_project_ref
                  ? remoteNames[project.supabase_project_ref] ??
                    project.supabase_project_ref
                  : null;
                return (
                  <tr
                    key={project.id}
                    className="group cursor-pointer transition hover:bg-[var(--background)]"
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/projects/${project.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-3"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[14px] font-bold text-[var(--accent-ink)]">
                          {(project.name.trim()[0] || "P").toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-[var(--foreground)]">
                            {project.name}
                          </span>
                          <span className="block truncate text-[12px] text-[var(--muted-soft)] md:hidden">
                            {project.description || "Sin descripción"}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="hidden max-w-[320px] px-3 py-3.5 md:table-cell">
                      <span className="line-clamp-1 text-[var(--muted)]">
                        {project.description || (
                          <span className="text-[var(--muted-soft)]">Sin descripción</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      {linked ? (
                        <span className="ui-tag ui-tag-success">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                          <span className="max-w-[140px] truncate">{linked}</span>
                        </span>
                      ) : (
                        <span className="ui-tag ui-tag-muted">Sin vincular</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(project.id, project.name);
                          }}
                          className="rounded-lg p-1.5 text-[var(--muted-soft)] opacity-0 transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] group-hover:opacity-100"
                          aria-label={`Eliminar ${project.name}`}
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-[12px] font-semibold text-[var(--accent)] opacity-0 transition group-hover:opacity-100">
                          Abrir →
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <CreateProjectModal
        open={modalOpen}
        userKey={userKey}
        connected={connected}
        onClose={() => setModalOpen(false)}
        onNeedConnect={() => {
          setModalOpen(false);
          onNeedConnect();
        }}
      />
    </>
  );
}

function StatCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const className =
    "ui-card block p-4 text-left" + (onClick ? " ui-card-hover" : "");

  const body = (
    <>
      <p className="text-[12px] font-medium text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[var(--foreground)]">
        {value}
      </p>
    </>
  );

  if (onClick) {
    return (
      <li>
        <button type="button" onClick={onClick} className={`w-full ${className}`}>
          {body}
        </button>
      </li>
    );
  }

  return <li className={className}>{body}</li>;
}
