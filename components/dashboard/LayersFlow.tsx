"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AspectFormatPicker,
  type AspectRatio,
} from "./AspectFormatPicker";

type GalleryFolder = {
  id: string;
  name: string;
  parentId: string | null;
};

type GalleryImage = {
  id: string;
  name: string;
  publicUrl: string;
};

const EXPORT_SIZE: Record<AspectRatio, [number, number]> = {
  "9:16": [1080, 1920],
  "16:9": [1920, 1080],
  "1:1": [1080, 1080],
  "4:3": [1440, 1080],
  "3:4": [1080, 1440],
};

function folderPath(folders: GalleryFolder[], id: string): string {
  const map = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  const seen = new Set<string>();
  let cur = map.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    parts.unshift(cur.name);
    cur = cur.parentId ? map.get(cur.parentId) : undefined;
  }
  return parts.join(" / ") || "Folder";
}

function sanitizeFileName(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\w.\- ()[\]]+/g, "_")
      .slice(0, 180) || "layers"
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number
) {
  const ir = img.width / img.height;
  const cr = w / h;
  let dw: number;
  let dh: number;
  let dx: number;
  let dy: number;
  if (ir > cr) {
    dh = h;
    dw = h * ir;
    dx = (w - dw) / 2;
    dy = 0;
  } else {
    dw = w;
    dh = w / ir;
    dx = 0;
    dy = (h - dh) / 2;
  }
  ctx.drawImage(img, dx, dy, dw, dh);
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 6);
}

async function composeLayers(opts: {
  aspectRatio: AspectRatio;
  bgColor: string;
  bgSrc: string | null;
  text: string;
  textColor: string;
  textSize: number;
  imageSrc: string | null;
  imageScale: number;
}): Promise<Blob> {
  const [w, h] = EXPORT_SIZE[opts.aspectRatio];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas");

  ctx.fillStyle = opts.bgColor;
  ctx.fillRect(0, 0, w, h);

  if (opts.bgSrc) {
    const bg = await loadImage(opts.bgSrc);
    drawCover(ctx, bg, w, h);
  }

  const headline = opts.text.trim();
  if (headline) {
    const fontPx = Math.round((w * opts.textSize) / 100);
    ctx.font = `800 ${fontPx}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = opts.textColor;
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = Math.round(fontPx * 0.18);
    ctx.shadowOffsetY = Math.round(fontPx * 0.06);
    const lines = wrapLines(ctx, headline, w * 0.84);
    const lineH = fontPx * 1.12;
    const top = h * 0.1;
    lines.forEach((line, i) => {
      ctx.fillText(line, w / 2, top + i * lineH);
    });
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  if (opts.imageSrc) {
    const overlay = await loadImage(opts.imageSrc);
    const maxW = w * (opts.imageScale / 100);
    const maxH = h * 0.7;
    const ir = overlay.width / overlay.height;
    let dw = maxW;
    let dh = dw / ir;
    if (dh > maxH) {
      dh = maxH;
      dw = dh * ir;
    }
    const dx = (w - dw) / 2;
    const dy = h - dh - h * 0.08;
    ctx.drawImage(overlay, dx, dy, dw, dh);
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!blob) throw new Error("Could not export image");
  return blob;
}

function LayerCard({
  index,
  title,
  hint,
  children,
}: {
  index: number;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#ebe6df] bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface-alt)] text-[11px] font-bold text-[var(--accent)]">
          {index}
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a8a29e]">
          {title}
        </p>
      </div>
      <p className="mt-1 text-[12px] text-[#a8a29e]">{hint}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ImageSlot({
  preview,
  label,
  emptyLabel,
  onPickFile,
  onPickUrl,
  onClear,
  gallery,
}: {
  preview: string | null;
  label: string;
  emptyLabel: string;
  onPickFile: (file: File) => void;
  onPickUrl: (url: string) => void;
  onClear: () => void;
  gallery: GalleryImage[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [openGallery, setOpenGallery] = useState(false);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPickFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-[#d6d3d1] px-3 py-3 text-left hover:border-[#8b85ff]"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="h-14 w-14 rounded-xl object-cover"
          />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--surface-alt)] text-[18px] text-[var(--accent)]">
            +
          </span>
        )}
        <span>
          <span className="block text-[13px] font-semibold text-[#1c1917]">
            {preview ? label : emptyLabel}
          </span>
          <span className="text-[12px] text-[#a8a29e]">JPG, PNG or WEBP</span>
        </span>
      </button>
      <div className="mt-2 flex flex-wrap gap-2">
        {gallery.length ? (
          <button
            type="button"
            onClick={() => setOpenGallery((v) => !v)}
            className="ui-btn-secondary !py-1.5 !px-3 text-[12px]"
          >
            {openGallery ? "Hide gallery" : "From gallery"}
          </button>
        ) : null}
        {preview ? (
          <button
            type="button"
            onClick={onClear}
            className="ui-btn-secondary !py-1.5 !px-3 text-[12px]"
          >
            Remove
          </button>
        ) : null}
      </div>
      {openGallery ? (
        <div className="mt-2 grid grid-cols-5 gap-1.5 sm:grid-cols-6">
          {gallery.map((asset) => (
            <button
              key={asset.id}
              type="button"
              title={asset.name}
              onClick={() => {
                onPickUrl(asset.publicUrl);
                setOpenGallery(false);
              }}
              className={`overflow-hidden rounded-lg ring-offset-2 ${
                preview === asset.publicUrl
                  ? "ring-2 ring-[#5046e5]"
                  : "hover:ring-2 hover:ring-[#c9c6ff]"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.publicUrl}
                alt=""
                className="h-12 w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function LayersFlow({
  projectId,
  folders,
  onError,
}: {
  projectId: string;
  folders: GalleryFolder[];
  onError: (msg: string) => void;
}) {
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [bgColor, setBgColor] = useState("#1c1917");
  const [bgSrc, setBgSrc] = useState<string | null>(null);
  const [bgLocal, setBgLocal] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textSize, setTextSize] = useState(8);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageLocal, setImageLocal] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(72);
  const [folderId, setFolderId] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [gallery, setGallery] = useState<GalleryImage[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/gallery?all=1&kind=image`
        );
        const data = await res.json();
        if (!res.ok || cancelled) return;
        setGallery(
          ((data.assets ?? []) as GalleryImage[]).slice(0, 36).map((a) => ({
            id: a.id,
            name: a.name,
            publicUrl: a.publicUrl,
          }))
        );
      } catch {
        /* picker is optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    return () => {
      if (bgLocal) URL.revokeObjectURL(bgLocal);
    };
  }, [bgLocal]);

  useEffect(() => {
    return () => {
      if (imageLocal) URL.revokeObjectURL(imageLocal);
    };
  }, [imageLocal]);

  const pickBgFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        onError("Background must be an image.");
        return;
      }
      if (bgLocal) URL.revokeObjectURL(bgLocal);
      const url = URL.createObjectURL(file);
      setBgLocal(url);
      setBgSrc(url);
      onError("");
    },
    [bgLocal, onError]
  );

  const pickImageFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        onError("Layer image must be an image.");
        return;
      }
      if (imageLocal) URL.revokeObjectURL(imageLocal);
      const url = URL.createObjectURL(file);
      setImageLocal(url);
      setImageSrc(url);
      onError("");
    },
    [imageLocal, onError]
  );

  const previewFont = useMemo(
    () => `${Math.max(4.5, textSize * 0.42)}cqw`,
    [textSize]
  );

  async function saveToGallery() {
    onError("");
    setSavedMsg("");
    if (!folderId) {
      onError("Pick a gallery folder for the result.");
      return;
    }
    setSaving(true);
    try {
      const blob = await composeLayers({
        aspectRatio,
        bgColor,
        bgSrc,
        text,
        textColor,
        textSize,
        imageSrc,
        imageScale,
      });
      const file = new File([blob], "layers.png", { type: "image/png" });
      const supabase = createClient();
      const storagePath = `${projectId}/${crypto.randomUUID()}-layers.png`;
      const { error: upErr } = await supabase.storage
        .from("gallery")
        .upload(storagePath, file, { contentType: "image/png", upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = supabase.storage
        .from("gallery")
        .getPublicUrl(storagePath);
      const res = await fetch(`/api/projects/${projectId}/gallery/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId,
          files: [
            {
              name: sanitizeFileName(text || "layers") + ".png",
              mimeType: "image/png",
              sizeBytes: file.size,
              storagePath,
              publicUrl: pub.publicUrl,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save to gallery");
      setSavedMsg(`Saved to ${folderPath(folders, folderId)}`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-5 py-6 sm:px-7 sm:py-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.92fr)]">
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed text-[#78716c]">
          Stack three layers in this order: background, then text, then image on
          top. The right panel is the mounted result.
        </p>

        <LayerCard
          index={1}
          title="Background"
          hint="Bottom layer. Color fills the frame; an image covers it."
        >
          <div className="mb-3 flex items-center gap-3">
            <label className="flex items-center gap-2 text-[12px] font-semibold text-[#1c1917]">
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-lg border border-[#e7e5e4] bg-white p-0.5"
              />
              Color
            </label>
            <span className="font-mono text-[11px] text-[#a8a29e]">{bgColor}</span>
          </div>
          <ImageSlot
            preview={bgSrc}
            label="Background image"
            emptyLabel="Add background image"
            onPickFile={pickBgFile}
            onPickUrl={(url) => {
              if (bgLocal) URL.revokeObjectURL(bgLocal);
              setBgLocal(null);
              setBgSrc(url);
            }}
            onClear={() => {
              if (bgLocal) URL.revokeObjectURL(bgLocal);
              setBgLocal(null);
              setBgSrc(null);
            }}
            gallery={gallery}
          />
        </LayerCard>

        <LayerCard
          index={2}
          title="Text"
          hint="Middle layer. Headline sits near the top of the frame."
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Your headline"
            className="ui-input resize-y"
          />
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[12px] font-semibold text-[#1c1917]">
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-lg border border-[#e7e5e4] bg-white p-0.5"
              />
              Color
            </label>
            <label className="min-w-[160px] flex-1 text-[12px] font-semibold text-[#1c1917]">
              Size
              <input
                type="range"
                min={4}
                max={14}
                step={0.5}
                value={textSize}
                onChange={(e) => setTextSize(Number(e.target.value))}
                className="mt-1 w-full accent-[#5046e5]"
              />
            </label>
          </div>
        </LayerCard>

        <LayerCard
          index={3}
          title="Image"
          hint="Top layer. Sits over the text, scaled to fit the lower frame."
        >
          <ImageSlot
            preview={imageSrc}
            label="Foreground image"
            emptyLabel="Add image layer"
            onPickFile={pickImageFile}
            onPickUrl={(url) => {
              if (imageLocal) URL.revokeObjectURL(imageLocal);
              setImageLocal(null);
              setImageSrc(url);
            }}
            onClear={() => {
              if (imageLocal) URL.revokeObjectURL(imageLocal);
              setImageLocal(null);
              setImageSrc(null);
            }}
            gallery={gallery}
          />
          <label className="mt-3 block text-[12px] font-semibold text-[#1c1917]">
            Scale
            <input
              type="range"
              min={28}
              max={100}
              step={1}
              value={imageScale}
              onChange={(e) => setImageScale(Number(e.target.value))}
              className="mt-1 w-full accent-[#5046e5]"
            />
          </label>
        </LayerCard>
      </div>

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-xl border border-[#ebe6df] bg-white p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a8a29e]">
            Result
          </p>
          <p className="mt-1 text-[12px] text-[#a8a29e]">
            Live stack · background → text → image
          </p>

          <div className="mt-4 flex justify-center rounded-2xl bg-[#f5f5f4] p-3">
            <div
              className="relative w-full max-w-[280px] overflow-hidden rounded-2xl shadow-[0_16px_40px_rgba(28,25,23,0.18)]"
              style={{
                aspectRatio: aspectRatio.replace(":", " / "),
                containerType: "inline-size",
                backgroundColor: bgColor,
              }}
            >
              {bgSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bgSrc}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
              {text.trim() ? (
                <p
                  className="absolute inset-x-[8%] top-[10%] z-[1] text-center font-extrabold leading-[1.12] [text-shadow:0_2px_10px_rgba(0,0,0,0.45)]"
                  style={{ color: textColor, fontSize: previewFont }}
                >
                  {text.trim()}
                </p>
              ) : (
                <p className="absolute inset-x-[8%] top-[10%] z-[1] text-center text-[11px] font-medium text-white/35">
                  Text layer
                </p>
              )}
              {imageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageSrc}
                  alt=""
                  className="absolute bottom-[8%] left-1/2 z-[2] max-h-[70%] -translate-x-1/2 object-contain"
                  style={{ width: `${imageScale}%` }}
                />
              ) : (
                <div className="absolute inset-x-[16%] bottom-[18%] z-[2] flex h-[38%] items-center justify-center rounded-2xl border border-dashed border-white/25 text-[11px] text-white/35">
                  Image layer
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[12px] font-semibold text-[#1c1917]">
              Format
            </p>
            <AspectFormatPicker value={aspectRatio} onChange={setAspectRatio} />
          </div>

          <label className="mt-4 block">
            <span className="mb-1 block text-[12px] font-semibold text-[#1c1917]">
              Save to folder
            </span>
            {folders.length === 0 ? (
              <p className="rounded-xl bg-[var(--surface-alt)] px-3 py-2 text-[12px] text-[var(--accent-ink)]">
                Create a folder in Gallery first, then come back.
              </p>
            ) : (
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="ui-input"
              >
                <option value="">Select folder…</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {folderPath(folders, f.id)}
                  </option>
                ))}
              </select>
            )}
          </label>

          <button
            type="button"
            disabled={saving || !folderId}
            onClick={() => void saveToGallery()}
            className="ui-btn-primary mt-4 w-full !py-2.5 text-[13px]"
          >
            {saving ? "Saving…" : "Save result"}
          </button>
          {savedMsg ? (
            <p className="mt-2 text-center text-[12px] text-[var(--success)]">
              {savedMsg}
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
