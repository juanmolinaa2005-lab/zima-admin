"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createProjectTool, deleteProjectTool, getProjectTools } from "@/app/actions/projects";
import type { ProjectTool } from "@/lib/types";
import { FaviconMark } from "./FaviconMark";
import { PlusIcon, SearchIcon, TrashIcon } from "./icons";
import { Button, Drawer, Empty, Field, Header, Page, TextInput, notifyError } from "./marketing/ui";

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function nameFromUrl(url: string) {
  const host = hostOf(url.includes("://") ? url : `https://${url}`);
  const base = host.split(".").slice(-2, -1)[0] || host;
  return base ? base[0].toUpperCase() + base.slice(1) : "";
}

export function AppsPage({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [tools, setTools] = useState<ProjectTool[] | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    getProjectTools(projectId)
      .then((list) => live && setTools(list))
      .catch((e) => {
        notifyError(e);
        if (live) setTools([]);
      });
    return () => {
      live = false;
    };
  }, [projectId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = tools ?? [];
    return q ? list.filter((t) => `${t.name} ${hostOf(t.url)}`.toLowerCase().includes(q)) : list;
  }, [tools, query]);

  function close() {
    setOpen(false);
    setName("");
    setUrl("");
  }

  async function save() {
    if (!url.trim()) return toast.error("Pega el link");
    setSaving(true);
    try {
      const created = await createProjectTool(projectId, name.trim() || nameFromUrl(url), url);
      setTools((prev) => [...(prev ?? []), created]);
      toast.success("Acceso añadido");
      close();
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  async function remove(tool: ProjectTool) {
    if (!window.confirm(`¿Eliminar ${tool.name}?`)) return;
    const prev = tools;
    setTools((list) => (list ?? []).filter((t) => t.id !== tool.id));
    try {
      await deleteProjectTool(projectId, tool.id);
    } catch (e) {
      setTools(prev);
      notifyError(e);
    }
  }

  return (
    <Page>
      <Header
        kicker={projectName}
        title="Apps"
        subtitle="Los links a las herramientas que usamos. Se abren en una pestaña nueva."
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            <PlusIcon className="h-3.5 w-3.5" />
            Nuevo acceso
          </Button>
        }
      />

      {tools === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="h-[132px] animate-pulse rounded-[20px] bg-black/[0.04]" />
          ))}
        </div>
      ) : tools.length === 0 ? (
        <Empty
          title="No hay apps todavía"
          text="Añade el link de una herramienta para tenerla siempre a mano."
          action={
            <Button variant="primary" onClick={() => setOpen(true)}>
              Nuevo acceso
            </Button>
          }
        />
      ) : (
        <>
          {tools.length > 8 ? (
            <div className="relative max-w-sm">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-soft)]" />
              <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar app…" className="pl-9" />
            </div>
          ) : null}
          {visible.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-[var(--muted)]">Ninguna app coincide con “{query}”.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {visible.map((tool) => (
                <li key={tool.id} className="group relative">
                  <a
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ui-press flex h-full flex-col items-center gap-3 rounded-[20px] border border-[var(--border)] bg-white px-4 py-5 text-center transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-14px_rgba(17,24,39,0.3)]"
                  >
                    <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[16px] ring-1 ring-[var(--border)]">
                      <FaviconMark url={tool.url} iconUrl={tool.icon_url} name={tool.name} imgClassName="h-full w-full object-contain p-2" />
                    </span>
                    <span className="w-full min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-[var(--foreground)]">{tool.name}</span>
                      <span className="block truncate text-[12px] text-[var(--muted-soft)]">{hostOf(tool.url)}</span>
                    </span>
                  </a>
                  <button
                    type="button"
                    onClick={() => void remove(tool)}
                    aria-label={`Eliminar ${tool.name}`}
                    className="absolute right-2 top-2 rounded-lg p-1.5 text-[var(--muted-soft)] opacity-0 transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Drawer
        open={open}
        title="Nuevo acceso"
        subtitle="Pega el link de la herramienta"
        onClose={close}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={saving} onClick={() => void save()}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Link">
            <TextInput
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void save()}
              placeholder="https://…"
            />
          </Field>
          <Field label="Nombre" hint="Si lo dejas vacío se usa el del dominio">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void save()}
              placeholder={url ? nameFromUrl(url) : "Ej. Supabase"}
            />
          </Field>
        </div>
      </Drawer>
    </Page>
  );
}
