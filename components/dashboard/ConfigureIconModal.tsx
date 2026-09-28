"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setToolIconUrl } from "@/app/actions/projects";
import type { WorkspaceTool } from "@/lib/types";
import { CloseIcon } from "./icons";

type ConfigureIconModalProps = {
  open: boolean;
  projectId: string;
  tool: WorkspaceTool | null;
  onClose: () => void;
  onSaved: (toolId: string, iconUrl: string | null) => void;
};

const MAX_BYTES = 2 * 1024 * 1024;

export function ConfigureIconModal({
  open,
  projectId,
  tool,
  onClose,
  onSaved,
}: ConfigureIconModalProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open || !tool) return;
    setPreview(tool.iconUrl ?? null);
    setFile(null);
    setError("");
  }, [open, tool]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !tool) return null;

  function onPick(f: File | null) {
    setError("");
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Images only (PNG, JPG, WEBP, GIF, SVG).");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("Max 2 MB.");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleSave() {
    if (!tool) return;
    setLoading(true);
    setError("");
    try {
      if (!file) {
        onClose();
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const ext =
        file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
        "png";
      const path = `${user.id}/${tool.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("tool-icons")
        .upload(path, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: "3600",
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data } = supabase.storage.from("tool-icons").getPublicUrl(path);
      const iconUrl = `${data.publicUrl}?v=${Date.now()}`;
      await setToolIconUrl(projectId, tool.id, iconUrl);
      onSaved(tool.id, iconUrl);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the icon");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    if (!tool) return;
    setLoading(true);
    setError("");
    try {
      await setToolIconUrl(projectId, tool.id, null);
      onSaved(tool.id, null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove the icon");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#0a2540]/45 backdrop-blur-[2px] animate-fade-in"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-sm rounded-xl border border-[var(--border)] bg-white shadow-[0_16px_48px_rgba(15,23,42,0.18)] animate-scale-in"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 id={titleId} className="text-[15px] font-semibold text-[var(--foreground)]">
              Icono del acceso
            </h2>
            <p className="mt-0.5 text-[13px] text-[var(--muted)]">{tool.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-[var(--foreground)]"
            aria-label="Close"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[#d6dee8] bg-[var(--background)] transition hover:border-[var(--accent-border)] hover:bg-[var(--surface-alt)]"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="px-3 text-center text-[12px] text-[var(--muted)]">
                Upload image
              </span>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />

          <p className="text-center text-[12px] text-[var(--muted-soft)]">
            PNG, JPG, WEBP, or SVG · max 2 MB
          </p>

          {error ? (
            <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[#cd3d64]">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={loading || !tool.iconUrl}
              onClick={handleRemove}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-[#cd3d64] transition hover:bg-[#fff0f3] disabled:opacity-40"
            >
              Quitar
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-[var(--foreground-soft)] hover:bg-[var(--background)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || !file}
                onClick={handleSave}
                className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#5046e5] disabled:opacity-60"
              >
                {loading ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
