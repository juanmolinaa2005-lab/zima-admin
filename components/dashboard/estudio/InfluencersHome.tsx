"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { ApiMissingBanner } from "../ApiMissingBanner";
import { CloseIcon, PlusIcon, TrashIcon } from "../icons";
import {
  influencerCoverUrl,
  influencerProgress,
  isInfluencerActive,
  loadInfluencers,
  saveInfluencers,
  type EstudioInfluencer,
} from "@/lib/creator/estudio-v1";
import { createClient } from "@/lib/supabase/client";
import { InfluencerStudio } from "./InfluencerStudio";
import { StudioPage } from "./studio-ui";

function filterFlag(projectId: string) {
  return `zima:estudio-v1:influencers-active-filter:${projectId}`;
}

function migrateFlag(projectId: string) {
  return `zima:estudio-v1:influencers-migrated:${projectId}`;
}

async function compressReferenceImage(file: File): Promise<File> {
  const maxBytes = 3 * 1024 * 1024;
  const maxEdge = 1600;
  if (file.size <= maxBytes && (file.type === "image/jpeg" || file.type === "image/jpg")) {
    return file;
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  let quality = 0.86;
  let blob: Blob | null = null;
  while (quality >= 0.6) {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (blob && blob.size <= maxBytes) break;
    quality -= 0.08;
  }
  if (!blob || blob.size === 0) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

async function readApiPayload(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (res.status === 413 || /request entity/i.test(text)) {
      throw new Error("La foto es demasiado grande. Usa un JPG más liviano.");
    }
    throw new Error(text.replace(/\s+/g, " ").slice(0, 180) || "No se pudo crear");
  }
}

function viewablePhotos(item: EstudioInfluencer) {
  return item.images.filter((shot) => Boolean(shot.imageUrl));
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 5 8 12l7 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m9 5 7 7-7 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ImageStackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="6.5"
        width="14"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8 17.5v1.2A1.8 1.8 0 0 0 9.8 20.5h8.4a1.8 1.8 0 0 0 1.8-1.8V10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="m6.5 14.2 2.4-2.3 2.2 2.1 1.6-1.5 3.3 3.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActiveStatusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m8.5 12.2 2.3 2.3 4.7-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InactiveStatusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M9 12h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function InfluencersHome({
  projectId,
  influencers,
  onChange,
  title = "Influencers",
  renderStudio,
}: {
  projectId: string;
  influencers: EstudioInfluencer[];
  onChange: (list: EstudioInfluencer[]) => void;
  title?: string;
  renderStudio?: (influencer: EstudioInfluencer, onBack: () => void, onOpenPhotos: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [traits, setTraits] = useState("");
  const [language, setLanguage] = useState<"es" | "en">("es");
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState("");
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openai, setOpenai] = useState<{ connected: boolean } | null>(null);
  const [photosId, setPhotosId] = useState<string | null>(null);
  const [studioId, setStudioId] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState("");
  const [listFilter, setListFilter] = useState<"active" | "inactive">("active");
  const swipeX = useRef<number | null>(null);
  const migrated = useRef(false);
  const onChangeRef = useRef(onChange);
  const referenceInput = useRef<HTMLInputElement>(null);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!referenceFile) {
      setReferencePreview("");
      return;
    }
    const url = URL.createObjectURL(referenceFile);
    setReferencePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [referenceFile]);

  const apply = useCallback(
    (list: EstudioInfluencer[]) => {
      onChangeRef.current(list);
      saveInfluencers(projectId, list);
    },
    [projectId]
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(filterFlag(projectId));
      setListFilter(saved === "inactive" ? "inactive" : "active");
    } catch {
      setListFilter("active");
    }
  }, [projectId]);

  function persistListFilter(next: "active" | "inactive") {
    setListFilter(next);
    try {
      localStorage.setItem(filterFlag(projectId), next);
    } catch {
      /* Private browsing can disable storage. */
    }
  }

  const reload = useCallback(async () => {
    const res = await fetch(
      `/api/projects/${projectId}/creator/influencers`,
      { cache: "no-store" }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudieron cargar");
    const list = (data.influencers ?? []) as EstudioInfluencer[];
    apply(list);
    setLoaded(true); setLoadError("");
    return list;
  }, [apply, projectId]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/openai/api-settings")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setOpenai({ connected: Boolean(data.connected) });
      })
      .catch(() => {
        if (!cancelled) setOpenai({ connected: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    migrated.current = false;

    const boot = async () => {
      try {
        const list = await reload();
        if (cancelled || migrated.current) return;
        migrated.current = true;
        const flag = migrateFlag(projectId);
        if (typeof window === "undefined") return;
        if (localStorage.getItem(flag)) return;
        const local = loadInfluencers(projectId);
        if (list.length > 0 || local.length === 0) {
          localStorage.setItem(flag, "1");
          return;
        }
        const res = await fetch(
          `/api/projects/${projectId}/creator/influencers`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ importInfluencers: local }),
          }
        );
        const imported = await res.json();
        if (!res.ok) return;
        localStorage.setItem(flag, "1");
        if (!cancelled) {
          apply((imported.influencers ?? []) as EstudioInfluencer[]);
        }
      } catch (cause) {
        if (!cancelled) { setLoaded(true); setLoadError(cause instanceof Error ? cause.message : "No pudimos cargar tus influencers."); }
      }
    };

    void boot();
    const id = window.setInterval(() => {
      void reload().catch(() => undefined);
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [apply, projectId, reload]);

  useEffect(() => {
    setViewerIndex(null);
  }, [photosId]);

  useEffect(() => {
    if (!photosId && !open && viewerIndex === null && !deleteId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (viewerIndex !== null) {
          setViewerIndex(null);
          return;
        }
        if (deleteId) {
          if (!deleting) setDeleteId(null);
          return;
        }
        if (photosId) {
          setPhotosId(null);
          return;
        }
        if (!busy) {
          setOpen(false);
          setError("");
          setReferenceFile(null);
        }
        return;
      }
      if (viewerIndex === null || !photosId) return;
      const item = influencers.find((entry) => entry.id === photosId);
      const photos = item ? viewablePhotos(item) : [];
      if (photos.length === 0) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setViewerIndex((index) =>
          index === null ? 0 : (index - 1 + photos.length) % photos.length
        );
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setViewerIndex((index) =>
          index === null ? 0 : (index + 1) % photos.length
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photosId, open, busy, viewerIndex, deleteId, deleting, influencers]);

  function closeCreate() {
    if (busy) return;
    setOpen(false);
    setError("");
    setReferenceFile(null);
  }

  const createModal = open ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#0a2540]/45 backdrop-blur-[2px]"
        aria-label="Cerrar"
        disabled={busy}
        onClick={closeCreate}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-inf-title"
        className="relative w-full max-w-xl overflow-hidden rounded-[24px] border border-[var(--border)] bg-white shadow-[0_16px_48px_rgba(22,24,29,0.14)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h3 id="new-inf-title" className="text-[16px] font-semibold text-[var(--foreground)]">
              Nuevo influencer
            </h3>
            <p className="mt-0.5 text-[13px] text-[var(--muted)]">
              Describe cómo se ve. El retrato se genera después.
            </p>
          </div>
          <button
            type="button"
            onClick={closeCreate}
            disabled={busy}
            className="rounded-xl p-1.5 text-[var(--muted)] hover:bg-[var(--surface-alt)] disabled:opacity-40"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={(e) => void submit(e)} className="max-h-[min(76vh,720px)] space-y-3 overflow-y-auto px-5 py-5">
          <label htmlFor="influencer-name" className="block text-sm font-medium text-slate-700">Nombre</label>
          <input id="influencer-name" maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="ui-input"
            placeholder="Nombre del personaje"
            disabled={busy}
            required
            autoFocus
          />
          <label className="block text-sm font-medium text-slate-700" htmlFor="new-influencer-language">Idioma que habla</label>
          <select id="new-influencer-language" value={language} onChange={e => setLanguage(e.target.value as "es" | "en")} disabled={busy} className="ui-input"><option value="es">Español</option><option value="en">English</option></select>
          <p className="text-xs text-slate-500">Todos sus videos usarán este idioma, sin importar cómo escribas la idea.</p>
          <label htmlFor="influencer-description" className="block text-sm font-medium text-slate-700">
            Cómo se ve{referenceFile ? " (opcional)" : ""}
          </label>
          <textarea id="influencer-description" required={!referenceFile} minLength={referenceFile ? undefined : 12} maxLength={2000}
            value={traits}
            onChange={(e) => setTraits(e.target.value)}
            className="ui-input min-h-[110px]"
            disabled={busy}
            placeholder="Ej.: mujer de 28 años, pelo rizado, estilo casual y una energía cercana. Como una creadora grabando con su móvil."
          />
          <label htmlFor="influencer-reference" className="block text-sm font-medium text-slate-700">Foto de referencia (opcional)</label>
          <div className="flex items-start gap-3">
            {referencePreview ? (
              <img src={referencePreview} alt="" className="h-16 w-14 rounded-xl object-cover" />
            ) : null}
            <div className="min-w-0 flex-1">
              <input
                ref={referenceInput}
                id="influencer-reference"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                className="ui-input text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-slate-700"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  if (!file) {
                    setReferenceFile(null);
                    return;
                  }
                  const mime = (file.type || "").toLowerCase();
                  if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(mime)) {
                    setError("La referencia debe ser JPG, PNG o WEBP.");
                    event.target.value = "";
                    return;
                  }
                  if (file.size > 8 * 1024 * 1024) {
                    setError("La foto de referencia no puede superar 8 MB.");
                    event.target.value = "";
                    return;
                  }
                  setError("");
                  setReferenceFile(file);
                }}
              />
              {referenceFile ? (
                <button
                  type="button"
                  className="mt-2 text-xs text-slate-500 underline"
                  disabled={busy}
                  onClick={() => {
                    setReferenceFile(null);
                    if (referenceInput.current) referenceInput.current.value = "";
                  }}
                >
                  Quitar foto
                </button>
              ) : (
                <p className="mt-1.5 text-[12px] text-[var(--muted-soft)]">Si subes una cara, la descripción es opcional: el retrato usa esa identidad.</p>
              )}
            </div>
          </div>
          <p className="text-[12px] text-[var(--muted-soft)]">
            El primer retrato es un close-up 4:5. El resto de poses se genera a partir de esa foto.
          </p>
          {error ? (
            <p role="alert" className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button type="submit" className="ui-btn-primary" disabled={busy}>
              {busy ? "Creando…" : "Crear y generar look"}
            </button>
            <button
              type="button"
              className="ui-btn-secondary"
              disabled={busy}
              onClick={closeCreate}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;
  const selected = influencers.find((item) => item.id === photosId) ?? null;
  const visible = influencers.filter((item) =>
    listFilter === "active" ? isInfluencerActive(item) : !isInfluencerActive(item)
  );
  const studio = influencers.find((item) => item.id === studioId) ?? null;
  const deleteTarget = influencers.find((item) => item.id === deleteId) ?? null;
  const viewable = selected ? viewablePhotos(selected) : [];
  const viewerShot =
    viewerIndex !== null && viewable[viewerIndex] ? viewable[viewerIndex] : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    if (!referenceFile && traits.trim().length < 12) {
      setError("Describe cómo se ve o sube una foto de referencia.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const endpoint = `/api/projects/${projectId}/creator/influencers`;
      let referenceImageUrl: string | undefined;
      if (referenceFile) {
        const prepared = await compressReferenceImage(referenceFile);
        const supabase = createClient();
        const ext = prepared.type.includes("png") ? "png" : "jpg";
        const storagePath = `${projectId}/influencers/pending/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("gallery")
          .upload(storagePath, prepared, { contentType: prepared.type, upsert: false });
        if (upErr) throw new Error(upErr.message);
        referenceImageUrl = supabase.storage.from("gallery").getPublicUrl(storagePath).data.publicUrl;
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          traits: traits.trim(),
          language,
          referenceImageUrl,
        }),
      });
      const data = await readApiPayload(res);
      if (!res.ok) {
        throw new Error(
          (typeof data.message === "string" && data.message) ||
            (typeof data.error === "string" && data.error) ||
            "No se pudo crear"
        );
      }
      const list = (data.influencers ?? []) as EstudioInfluencer[];
      apply(list);
      persistListFilter("active");
      setStudioId(list[0]?.id ?? null);
      setName("");
      setTraits("");
      setReferenceFile(null);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/creator/influencers?influencerId=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo borrar");
      apply((data.influencers ?? []) as EstudioInfluencer[]);
      if (photosId === id) setPhotosId(null);
      if (studioId === id) setStudioId(null);
      setViewerIndex(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar");
      return false;
    }
  }

  async function confirmRemove() {
    if (!deleteId || deleting) return;
    setDeleting(true);
    setError("");
    const ok = await remove(deleteId);
    setDeleting(false);
    if (ok) setDeleteId(null);
  }

  async function toggleActive(item: EstudioInfluencer) {
    if (togglingId || deleting || busy) return;
    const next = !isInfluencerActive(item);
    setTogglingId(item.id);
    setError("");
    apply(
      influencers.map((entry) =>
        entry.id === item.id ? { ...entry, active: next } : entry
      )
    );
    try {
      const response = await fetch(
        `/api/projects/${projectId}/creator/influencers`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ influencerId: item.id, active: next }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No se pudo cambiar el estado");
      }
      apply((data.influencers ?? []) as EstudioInfluencer[]);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo cambiar el estado"
      );
      await reload().catch(() => undefined);
    } finally {
      setTogglingId("");
    }
  }

  function stepViewer(delta: number) {
    if (!selected || viewerIndex === null) return;
    const photos = viewablePhotos(selected);
    if (photos.length === 0) return;
    setViewerIndex((viewerIndex + delta + photos.length) % photos.length);
  }

  async function changeLanguage(influencerId: string, next: "es" | "en") {
    setSavingLanguage(true); setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/creator/influencers`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({influencerId, language:next}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar el idioma.");
      apply(data.influencers || []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar el idioma."); }
    finally { setSavingLanguage(false); }
  }

  const photosModal = selected ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#0a2540]/45 backdrop-blur-[2px]"
        aria-label="Cerrar"
        onClick={() => setPhotosId(null)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inf-modal-title"
        className="relative w-full max-w-2xl rounded-[24px] border border-[var(--border)] bg-white shadow-[0_16px_48px_rgba(22,24,29,0.14)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h3
              id="inf-modal-title"
              className="text-[16px] font-semibold text-[var(--foreground)]"
            >
              {selected.name}
            </h3>
            <p className="mt-0.5 text-[13px] text-[var(--muted)]">
              {influencerProgress(selected).generating
                ? `Generando ${influencerProgress(selected).done} de ${influencerProgress(selected).total} con GPT Image 2`
                : `${selected.images.filter((s) => s.imageUrl).length} fotos de referencia`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPhotosId(null)}
            className="rounded-xl p-1.5 text-[var(--muted)] hover:bg-[var(--surface-alt)]"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-5">
          <div className="rounded-2xl bg-slate-50 p-4">
            <label htmlFor="existing-influencer-language" className="text-sm font-medium text-slate-800">Idioma que habla</label>
            <select id="existing-influencer-language" value={selected.language || "es"} disabled={savingLanguage} onChange={e => void changeLanguage(selected.id, e.target.value as "es" | "en")} className="ui-input mt-2"><option value="es">Español</option><option value="en">English</option></select>
            <p className="mt-2 text-xs leading-5 text-slate-500">Sus próximos videos usarán este idioma, aunque escribas la idea en otro.</p>
            {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {selected.images.map((shot) => (
              <li key={shot.id}>
                {shot.imageUrl ? (
                  <button
                    type="button"
                    className="block w-full cursor-zoom-in overflow-hidden rounded-xl bg-[var(--surface-alt)]"
                    aria-label={`Ver ${shot.label}`}
                    onClick={() => {
                      const photos = viewablePhotos(selected);
                      const index = photos.findIndex((entry) => entry.id === shot.id);
                      if (index >= 0) setViewerIndex(index);
                    }}
                  >
                    <img
                      src={shot.imageUrl}
                      alt={shot.label}
                      className="aspect-[3/4] w-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="flex aspect-[3/4] items-center justify-center rounded-xl bg-[var(--surface-alt)] px-2 text-center text-[11px] leading-snug text-[var(--muted-soft)]">
                    {shot.status === "failed"
                      ? shot.error || "Falló"
                      : "Generando…"}
                  </div>
                )}
                <p className="mt-1.5 text-center text-[12px] font-medium text-[var(--muted)]">
                  {shot.label}
                </p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="text-[12px] font-medium text-[var(--danger)]"
            onClick={() => {
              setError("");
              setDeleteId(selected.id);
            }}
          >
            Borrar influencer
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const photoViewer =
    viewerShot && viewerIndex !== null ? (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/80"
          aria-label="Cerrar visor"
          onClick={() => setViewerIndex(null)}
        />
        <button
          type="button"
          className="absolute right-4 top-4 z-[1] rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          aria-label="Cerrar visor"
          onClick={() => setViewerIndex(null)}
        >
          <CloseIcon className="h-5 w-5" />
        </button>
        {viewable.length > 1 ? (
          <button
            type="button"
            className="absolute left-3 top-1/2 z-[1] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:left-6"
            aria-label="Foto anterior"
            onClick={() => stepViewer(-1)}
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
        ) : null}
        {viewable.length > 1 ? (
          <button
            type="button"
            className="absolute right-3 top-1/2 z-[1] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:right-6"
            aria-label="Foto siguiente"
            onClick={() => stepViewer(1)}
          >
            <ChevronRightIcon className="h-6 w-6" />
          </button>
        ) : null}
        <figure
          className="relative z-[1] flex max-h-[90vh] max-w-[min(92vw,880px)] flex-col items-center"
          onTouchStart={(event) => {
            swipeX.current = event.changedTouches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            if (swipeX.current == null) return;
            const dx = (event.changedTouches[0]?.clientX ?? swipeX.current) - swipeX.current;
            swipeX.current = null;
            if (Math.abs(dx) < 40) return;
            stepViewer(dx > 0 ? -1 : 1);
          }}
        >
          <img
            src={viewerShot.imageUrl || undefined}
            alt={viewerShot.label}
            className="max-h-[82vh] w-auto max-w-full rounded-2xl object-contain shadow-[0_16px_48px_rgba(0,0,0,0.35)]"
          />
          <figcaption className="mt-3 text-center text-[13px] font-medium text-white/85">
            {viewerShot.label}
            <span className="ml-2 text-white/50">
              {viewerIndex + 1} / {viewable.length}
            </span>
          </figcaption>
        </figure>
      </div>
    ) : null;

  const deleteDialog = deleteTarget ? (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#0a2540]/45 backdrop-blur-[2px]"
        aria-label="Cerrar"
        disabled={deleting}
        onClick={() => {
          if (!deleting) setDeleteId(null);
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-influencer-title"
        className="relative w-full max-w-md rounded-[24px] border border-[var(--border)] bg-white shadow-[0_16px_48px_rgba(22,24,29,0.14)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h3
              id="delete-influencer-title"
              className="text-[16px] font-semibold text-[var(--foreground)]"
            >
              Eliminar influencer
            </h3>
            <p className="mt-0.5 text-[13px] text-[var(--muted)]">
              Esta acción no se puede deshacer.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!deleting) setDeleteId(null);
            }}
            disabled={deleting}
            className="rounded-xl p-1.5 text-[var(--muted)] hover:bg-[var(--surface-alt)]"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-5">
          <p className="text-[14px] leading-relaxed text-[var(--foreground-soft)]">
            ¿Eliminar a {deleteTarget.name}? Se borrarán sus fotos y no se puede deshacer.
          </p>
          {error && deleteId ? (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
          <button
            type="button"
            className="ui-btn-secondary"
            disabled={deleting}
            onClick={() => setDeleteId(null)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="ui-btn-primary"
            disabled={deleting}
            onClick={() => void confirmRemove()}
          >
            {deleting ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (studio) {
    return (
      <>
        {renderStudio ? renderStudio(studio, () => setStudioId(null), () => setPhotosId(studio.id)) : <InfluencerStudio
          projectId={projectId}
          influencer={studio}
          onBack={() => setStudioId(null)}
          onChange={apply}
          onOpenPhotos={() => setPhotosId(studio.id)}
        />}
        {photosModal}
        {photoViewer}
        {deleteDialog}
        {createModal}
      </>
    );
  }

  return (
    <StudioPage
      kicker="Hacer"
      title={title === "Influencers 2" ? "Influencers 2" : "Crear video"}
      description="Elige quién aparece. Luego unes un hook (el movimiento) con la demo de la app."
      actions={
        <>
          <div className="flex rounded-lg bg-[var(--surface-alt)] p-1 ring-1 ring-[var(--border)]">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-[13px] transition ${
                listFilter === "active"
                  ? "bg-white font-semibold text-[var(--foreground)] shadow-[var(--shadow-sm)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
              aria-pressed={listFilter === "active"}
              onClick={() => persistListFilter("active")}
            >
              Activos
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-[13px] transition ${
                listFilter === "inactive"
                  ? "bg-white font-semibold text-[var(--foreground)] shadow-[var(--shadow-sm)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
              aria-pressed={listFilter === "inactive"}
              onClick={() => persistListFilter("inactive")}
            >
              Inactivos
            </button>
          </div>
          <button
            type="button"
            className="ui-btn-primary"
            onClick={() => {
              setOpen(true);
              setError("");
            }}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Nuevo
          </button>
        </>
      }
    >
      {openai && !openai.connected ? (
        <div className="mb-5">
          <ApiMissingBanner
            projectId={projectId}
            providerName="OpenAI"
            message="Conecta OpenAI en Ajustes → API para generar el look con GPT Image 2."
          />
        </div>
      ) : null}

      {error && !open && !deleteId ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {!loaded && influencers.length === 0 ? <p className="mt-12 text-center text-sm text-slate-400">Cargando tus influencers…</p> : loadError && influencers.length === 0 ? <p role="alert" className="mt-8 rounded-xl bg-red-50 p-4 text-sm text-red-700">{loadError}</p> : influencers.length === 0 ? (
        <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--background)] px-6 py-16 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-alt)] text-[var(--accent)]">
            ⌂
          </span>
          <h3 className="mt-4 text-[18px] font-semibold text-white">
            Primero, quién aparece
          </h3>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-zinc-500">
            Crea un look con una foto o una descripción. Después unes el hook y la demo.
          </p>
          <button
            type="button"
            className="ui-btn-primary mx-auto mt-5"
            onClick={() => {
              setOpen(true);
              setError("");
            }}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Nuevo influencer
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--background)] px-6 py-16 text-center">
          <h3 className="text-[18px] font-semibold text-[var(--foreground)]">
            {listFilter === "active"
              ? "No hay influencers activos"
              : "No hay influencers inactivos"}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-[var(--muted-soft)]">
            {listFilter === "active"
              ? "Activa uno desde Inactivos, o crea uno nuevo."
              : "Desactiva uno desde Activos para verlo aquí."}
          </p>
        </div>
      ) : (
        <ul className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => {
            const cover = influencerCoverUrl(item);
            const progress = influencerProgress(item);
            const active = isInfluencerActive(item);
            return (
              <li key={item.id} className="min-w-0">
                <div className="relative overflow-hidden rounded-xl bg-[#111827] shadow-[0_16px_40px_rgba(17,24,39,0.14)]">
                  <button
                    type="button"
                    onClick={() => setStudioId(item.id)}
                    className="relative block aspect-[3/4] w-full text-left"
                    aria-label={`Abrir studio de ${item.name}`}
                  >
                    {cover ? (
                      <img
                        src={cover}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[#1f2937] text-[13px] text-white/60">
                        {progress.generating
                          ? "Generando rostro…"
                          : "Sin foto"}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-8">
                      <p className="text-[20px] font-semibold leading-tight text-white drop-shadow">
                        {item.name}
                      </p>
                      <p className="mt-2 text-xs text-white/75">{item.language === "en" ? "Habla inglés" : "Habla español"}</p>
                    </div>
                  </button>
                  {progress.generating ? (
                    <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white">
                      Generando {progress.done}/{progress.total}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setError("");
                      setDeleteId(item.id);
                    }}
                    className="absolute right-[6.25rem] top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white shadow-sm transition hover:bg-black/75"
                    aria-label={`Eliminar a ${item.name}`}
                    title="Eliminar"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggleActive(item);
                    }}
                    disabled={togglingId === item.id}
                    className={`absolute right-14 top-3 flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm transition disabled:opacity-50 ${
                      active
                        ? "bg-emerald-500 hover:bg-emerald-600"
                        : "bg-black/55 hover:bg-black/75"
                    }`}
                    aria-label={
                      active
                        ? `Desactivar a ${item.name}`
                        : `Activar a ${item.name}`
                    }
                    title={active ? "Activo" : "Inactivo"}
                  >
                    {active ? (
                      <ActiveStatusIcon className="h-4 w-4" />
                    ) : (
                      <InactiveStatusIcon className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhotosId(item.id);
                    }}
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white shadow-sm transition hover:bg-black/75"
                    aria-label="Ver fotos y generación"
                    title="Ver fotos"
                  >
                    <ImageStackIcon className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {photosModal}
      {photoViewer}
      {deleteDialog}
      {createModal}
    </StudioPage>
  );
}
