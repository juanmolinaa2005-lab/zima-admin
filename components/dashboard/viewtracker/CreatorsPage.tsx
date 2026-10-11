"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  influencerCoverUrl,
  influencerProgress,
  isInfluencerActive,
  type EstudioInfluencer,
} from "@/lib/creator/estudio-v1";
import { createClient } from "@/lib/supabase/client";
import {
  engagementRate,
  formatCompact,
} from "@/lib/viewtracker/format";
import { InfluencersHome } from "../estudio/InfluencersHome";
import { AvatarHover, relatedVideos, type TrackedAccount } from "./AccountsPage";
import type { TrackedVideo } from "./VideosPage";
import { EmptyTable, PageHead, SparkBars } from "./vt-ui";

type TrackedCreator = {
  id: string;
  name: string;
  email: string | null;
  labels: string | null;
  status: string;
  createdAt: string;
};

type KindFilter = "all" | "real" | "ai";

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.4 13.7 8.2 19.6 10 13.7 11.8 12 17.6 10.3 11.8 4.4 10 10.3 8.2 12 2.4Z" />
      <path d="M18.2 14.2 18.9 16.4 21.1 17.1 18.9 17.8 18.2 20 17.5 17.8 15.3 17.1 17.5 16.4 18.2 14.2Z" />
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5.5h16l-6.2 7.1V19l-3.6 1.4v-7.8L4 5.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
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

function weekdayBars(dates: string[]) {
  const buckets = Array.from({ length: 9 }, () => 0);
  const now = Date.now();
  for (const raw of dates) {
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) continue;
    const ago = Math.floor((now - t) / 86_400_000);
    if (ago >= 0 && ago < 9) buckets[8 - ago] += 1;
  }
  return buckets;
}

export function CreatorsPage({ projectId }: { projectId: string }) {
  const [creators, setCreators] = useState<TrackedCreator[]>([]);
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [videos, setVideos] = useState<TrackedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInfluencers, setAiInfluencers] = useState<EstudioInfluencer[]>([]);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [studioId, setStudioId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [aiName, setAiName] = useState("");
  const [aiTraits, setAiTraits] = useState("");
  const [aiLanguage, setAiLanguage] = useState<"es" | "en">("es");
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiPreview, setAiPreview] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [creatingAi, setCreatingAi] = useState(false);

  async function load() {
    const [c, a, v, inf] = await Promise.all([
      fetch(`/api/projects/${projectId}/viewtracker/creators`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/viewtracker/accounts`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/viewtracker/videos`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/creator/influencers`, { cache: "no-store" }).then((r) =>
        r.json()
      ),
    ]);
    setCreators((c.items ?? []) as TrackedCreator[]);
    setAccounts((a.items ?? []) as TrackedAccount[]);
    setVideos((v.items ?? []) as TrackedVideo[]);
    setAiInfluencers((inf.influencers ?? []) as EstudioInfluencer[]);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!aiFile) {
      setAiPreview("");
      return;
    }
    const url = URL.createObjectURL(aiFile);
    setAiPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [aiFile]);

  useEffect(() => {
    if (!filterOpen) return;
    function onPointer(event: MouseEvent) {
      if (!filterRef.current?.contains(event.target as Node)) setFilterOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setFilterOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [filterOpen]);

  const generatingAi = aiInfluencers.some((item) => influencerProgress(item).generating);
  useEffect(() => {
    if (!generatingAi || studioId) return;
    const id = window.setInterval(() => {
      void fetch(`/api/projects/${projectId}/creator/influencers`, { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.influencers)) {
            setAiInfluencers(data.influencers as EstudioInfluencer[]);
          }
        })
        .catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(id);
  }, [generatingAi, projectId, studioId]);

  function statsFor(name: string) {
    const key = name.trim().toLowerCase();
    const linked = accounts.filter((a) => (a.creatorName || "").trim().toLowerCase() === key);
    const seen = new Set<string>();
    const related = linked.flatMap((account) =>
      relatedVideos(account, videos).filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true)))
    );
    const sum = (pick: (v: TrackedVideo) => number) => related.reduce((s, v) => s + pick(v), 0);
    const views = sum((v) => v.views);
    const likes = sum((v) => v.likes);
    const comments = sum((v) => v.comments);
    const shares = sum((v) => v.shares);
    const saves = sum((v) => v.saves);
    return {
      linked,
      related,
      views,
      likes,
      comments,
      followers: linked.reduce((s, a) => s + a.followers, 0),
      eng: engagementRate({ views, likes, comments, shares, saves }),
    };
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const real = creators.filter((c) => {
      if (kind === "ai") return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.labels || "").toLowerCase().includes(q)
      );
    });
    const ai = aiInfluencers.filter((item) => {
      if (kind === "real") return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.traits.toLowerCase().includes(q)
      );
    });
    return [
      ...ai.map((influencer) => ({
        kind: "ai" as const,
        createdAt: influencer.createdAt,
        influencer,
      })),
      ...real.map((creator) => ({
        kind: "real" as const,
        createdAt: creator.createdAt,
        creator,
      })),
    ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [aiInfluencers, creators, kind, search]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Pon el nombre del creator.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/viewtracker/creators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo añadir");
      setCreators((prev) => [data.item as TrackedCreator, ...prev]);
      setName("");
      setEmail("");
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo añadir");
    } finally {
      setAdding(false);
    }
  }

  async function remove(creator: TrackedCreator) {
    setCreators((prev) => prev.filter((c) => c.id !== creator.id));
    const res = await fetch(
      `/api/projects/${projectId}/viewtracker/creators?id=${encodeURIComponent(creator.id)}`,
      { method: "DELETE" }
    );
    if (!res.ok) setCreators((prev) => [creator, ...prev]);
  }

  function closeAiForm() {
    if (creatingAi) return;
    setAiOpen(false);
    setError("");
    setAiFile(null);
  }

  async function handleCreateAi(e: FormEvent) {
    e.preventDefault();
    if (!aiName.trim() || creatingAi) return;
    if (!aiFile && aiTraits.trim().length < 12) {
      setError("Describe cómo se ve o sube una foto de referencia.");
      return;
    }
    setCreatingAi(true);
    setError("");
    try {
      let referenceImageUrl: string | undefined;
      if (aiFile) {
        const prepared = await compressReferenceImage(aiFile);
        const supabase = createClient();
        const ext = prepared.type.includes("png") ? "png" : "jpg";
        const storagePath = `${projectId}/influencers/pending/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("gallery")
          .upload(storagePath, prepared, { contentType: prepared.type, upsert: false });
        if (upErr) throw new Error(upErr.message);
        referenceImageUrl = supabase.storage.from("gallery").getPublicUrl(storagePath).data.publicUrl;
      }
      const res = await fetch(`/api/projects/${projectId}/creator/influencers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: aiName.trim(),
          traits: aiTraits.trim(),
          language: aiLanguage,
          referenceImageUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || "No se pudo crear");
      }
      const list = (data.influencers ?? []) as EstudioInfluencer[];
      setAiInfluencers(list);
      setAiName("");
      setAiTraits("");
      setAiFile(null);
      setAiOpen(false);
      setStudioId(list[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear");
    } finally {
      setCreatingAi(false);
    }
  }

  async function removeAi(item: EstudioInfluencer) {
    setAiInfluencers((prev) => prev.filter((entry) => entry.id !== item.id));
    const res = await fetch(
      `/api/projects/${projectId}/creator/influencers?influencerId=${encodeURIComponent(item.id)}`,
      { method: "DELETE" }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAiInfluencers((prev) => [item, ...prev]);
      setError(data.error || "No se pudo borrar");
      return;
    }
    setAiInfluencers((data.influencers ?? []) as EstudioInfluencer[]);
  }

  const total = creators.length + aiInfluencers.length;
  const kindLabel = kind === "all" ? "All" : kind === "real" ? "Real" : "AI";

  return (
    <>
    {studioId ? (
      <div className="fixed inset-0 z-[70] overflow-y-auto bg-[var(--background)]">
        <InfluencersHome
          projectId={projectId}
          influencers={aiInfluencers}
          onChange={setAiInfluencers}
          embedStudioId={studioId}
          onCloseStudio={() => setStudioId(null)}
        />
      </div>
    ) : null}
    <div className="space-y-4">
      <PageHead
        title="Creators"
        subtitle="Real creators and AI influencers, in one place."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setAiOpen(true);
                setFormOpen(false);
                setError("");
              }}
              className="ai-rainbow-btn inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white"
            >
              <SparkIcon className="h-3.5 w-3.5" />
              AI Influencer
            </button>
            <button
              type="button"
              onClick={() => {
                setFormOpen((v) => !v);
                setAiOpen(false);
              }}
              className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-[13px] font-semibold text-white"
            >
              + Add creator
            </button>
          </div>
        }
      />

      {formOpen ? (
        <form
          onSubmit={handleAdd}
          className="flex flex-wrap items-end gap-2 rounded-2xl border border-[var(--border)] bg-white p-4"
        >
          <label className="text-[12px] font-medium text-[var(--foreground-soft)]">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-48 rounded-xl border border-[var(--border)] px-3 py-2 text-[13px]"
            />
          </label>
          <label className="text-[12px] font-medium text-[var(--foreground-soft)]">
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-56 rounded-xl border border-[var(--border)] px-3 py-2 text-[13px]"
            />
          </label>
          <button
            type="submit"
            disabled={adding}
            className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {adding ? "Saving…" : "Save"}
          </button>
        </form>
      ) : null}

      {error && !aiOpen ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or handle"
          className="w-full max-w-xl rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-[13px] outline-none placeholder:text-[var(--muted-soft)]"
        />
        <div ref={filterRef} className="relative z-30 shrink-0">
          <button
            type="button"
            aria-label="Filter creators"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((open) => !open)}
            className={`relative flex h-[42px] w-[42px] items-center justify-center rounded-xl border bg-white text-[var(--muted)] hover:text-[var(--foreground)] ${
              kind === "all"
                ? "border-[var(--border)]"
                : "border-[var(--foreground)] text-[var(--foreground)]"
            }`}
          >
            <FilterIcon className="h-4 w-4" />
          </button>
          {filterOpen ? (
            <div className="absolute right-0 z-20 mt-1.5 w-40 rounded-xl border border-[var(--border)] bg-white p-1.5 shadow-[var(--shadow-md)]">
              <p className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-soft)]">
                Show
              </p>
              {(
                [
                  ["all", "All"],
                  ["real", "Real"],
                  ["ai", "AI"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setKind(id);
                    setFilterOpen(false);
                  }}
                  className={`flex w-full items-center rounded-lg px-2 py-1.5 text-left text-[13px] ${
                    kind === id
                      ? "bg-[var(--surface-alt)] font-semibold text-[var(--foreground)]"
                      : "text-[var(--muted)] hover:bg-[var(--surface-alt)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <EmptyTable message="Cargando…" />
      ) : filtered.length === 0 ? (
        <EmptyTable
          message={
            total === 0
              ? "Añade un creator real o un AI influencer."
              : kind === "all"
                ? "No creators match your search."
                : `No ${kindLabel.toLowerCase()} creators match.`
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white">
          <table className="min-w-[900px] w-full text-left">
            <thead className="border-b border-[var(--border)] text-[11px] font-medium uppercase tracking-wide text-[var(--muted-soft)]">
              <tr>
                <th className="px-3 py-2.5 font-medium">Creator</th>
                <th className="px-3 py-2.5 font-medium">Accounts</th>
                <th className="px-3 py-2.5 font-medium">Labels</th>
                <th className="px-3 py-2.5 font-medium">Post activity</th>
                <th className="px-3 py-2.5 font-medium">Videos</th>
                <th className="px-3 py-2.5 font-medium">Followers</th>
                <th className="px-3 py-2.5 font-medium">Views</th>
                <th className="px-3 py-2.5 font-medium">Likes</th>
                <th className="px-3 py-2.5 font-medium">Comments</th>
                <th className="px-3 py-2.5 font-medium">Eng.</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Added</th>
                <th className="px-3 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                if (row.kind === "ai") {
                  const item = row.influencer;
                  const cover = influencerCoverUrl(item);
                  const progress = influencerProgress(item);
                  const active = isInfluencerActive(item);
                  const photos = item.images.filter((shot) => shot.imageUrl).length;
                  const aiStats = statsFor(item.name);
                  return (
                    <tr key={`ai-${item.id}`} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => setStudioId(item.id)}
                          className="flex items-center gap-2.5 text-left"
                        >
                          {cover ? (
                            <AvatarHover
                              src={cover}
                              className="size-12 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--surface-alt)] text-[11px] font-semibold text-[var(--muted)]">
                              AI
                            </span>
                          )}
                          <span>
                            <span className="flex items-center gap-1.5">
                              <span className="text-[13px] font-semibold text-[var(--foreground)]">
                                {item.name}
                              </span>
                              <span className="ai-rainbow-btn rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                                AI
                              </span>
                            </span>
                            <span className="block whitespace-nowrap text-[12px] text-[var(--muted-soft)]">
                              {progress.generating
                                ? `Generando look ${progress.done}/${progress.total}`
                                : item.language === "en"
                                  ? "Speaks English"
                                  : "Habla español"}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-[var(--muted)]">
                        {aiStats.linked.length
                          ? aiStats.linked.map((a) => `@${(a.username || "").replace(/^@/, "")}`).join(" · ")
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-[var(--muted-soft)]">AI · {photos} fotos</td>
                      <td className="px-3 py-2.5">
                        <SparkBars values={weekdayBars(aiStats.related.map((v) => v.postedAt || v.createdAt))} />
                      </td>
                      <td className="px-3 py-2.5 text-[13px]">{aiStats.related.length}</td>
                      <td className="px-3 py-2.5 text-[13px]">{formatCompact(aiStats.followers)}</td>
                      <td className="px-3 py-2.5 text-[13px]">{formatCompact(aiStats.views)}</td>
                      <td className="px-3 py-2.5 text-[13px]">{formatCompact(aiStats.likes)}</td>
                      <td className="px-3 py-2.5 text-[13px]">{formatCompact(aiStats.comments)}</td>
                      <td className="px-3 py-2.5 text-[13px]">{aiStats.eng.toFixed(1)}%</td>
                      <td className="px-3 py-2.5">
                        <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                          {active ? "active" : "inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-[var(--muted)]">
                        {new Date(item.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => void removeAi(item)}
                          className="text-[12px] text-[var(--muted-soft)] hover:text-red-600"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                }
                const creator = row.creator;
                const { linked, related, views, likes, comments, followers, eng } = statsFor(creator.name);
                return (
                  <tr key={creator.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-3 py-2.5">
                      <p className="text-[13px] font-semibold text-[var(--foreground)]">
                        {creator.name}
                      </p>
                      <p className="text-[12px] text-[var(--muted-soft)]">
                        {creator.email || "—"}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-[var(--muted)]">
                      {linked.length
                        ? linked.map((a) => a.platform || "web").join(" · ")
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-[var(--muted-soft)]">
                      {creator.labels || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <SparkBars
                        values={weekdayBars(
                          related.map((v) => v.postedAt || v.createdAt)
                        )}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-[13px]">{related.length}</td>
                    <td className="px-3 py-2.5 text-[13px]">
                      {formatCompact(followers)}
                    </td>
                    <td className="px-3 py-2.5 text-[13px]">{formatCompact(views)}</td>
                    <td className="px-3 py-2.5 text-[13px]">{formatCompact(likes)}</td>
                    <td className="px-3 py-2.5 text-[13px]">
                      {formatCompact(comments)}
                    </td>
                    <td className="px-3 py-2.5 text-[13px]">{eng.toFixed(1)}%</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                        {creator.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-[var(--muted)]">
                      {new Date(creator.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => void remove(creator)}
                        className="text-[12px] text-[var(--muted-soft)] hover:text-red-600"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {aiOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[#0a2540]/45"
            aria-label="Cerrar"
            disabled={creatingAi}
            onClick={closeAiForm}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-creator-title"
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[var(--shadow-lg)]"
          >
            <div className="border-b border-[var(--border)] px-5 py-4">
              <h3 id="ai-creator-title" className="text-[16px] font-semibold text-[var(--foreground)]">
                Nuevo AI influencer
              </h3>
              <p className="mt-0.5 text-[13px] text-[var(--muted)]">
                Describe cómo se ve. El retrato se genera después.
              </p>
            </div>
            <form onSubmit={(e) => void handleCreateAi(e)} className="space-y-3 px-5 py-5">
              <label className="block text-[12px] font-medium text-[var(--foreground-soft)]">
                Nombre
                <input
                  value={aiName}
                  onChange={(e) => setAiName(e.target.value)}
                  maxLength={80}
                  required
                  disabled={creatingAi}
                  autoFocus
                  placeholder="Nombre del personaje"
                  className="mt-1 block w-full rounded-xl border border-[var(--border)] px-3 py-2 text-[13px] outline-none"
                />
              </label>
              <label className="block text-[12px] font-medium text-[var(--foreground-soft)]">
                Idioma
                <select
                  value={aiLanguage}
                  onChange={(e) => setAiLanguage(e.target.value as "es" | "en")}
                  disabled={creatingAi}
                  className="mt-1 block w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-[13px] outline-none"
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className="block text-[12px] font-medium text-[var(--foreground-soft)]">
                Cómo se ve{aiFile ? " (opcional)" : ""}
                <textarea
                  value={aiTraits}
                  onChange={(e) => setAiTraits(e.target.value)}
                  required={!aiFile}
                  minLength={aiFile ? undefined : 12}
                  maxLength={2000}
                  disabled={creatingAi}
                  placeholder="Ej.: mujer de 28 años, pelo rizado, estilo casual."
                  className="mt-1 block min-h-[110px] w-full rounded-xl border border-[var(--border)] px-3 py-2 text-[13px] outline-none"
                />
              </label>
              <label className="block text-[12px] font-medium text-[var(--foreground-soft)]">
                Foto de referencia (opcional)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={creatingAi}
                  className="mt-1 block w-full text-[13px]"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    if (!file) {
                      setAiFile(null);
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
                    setAiFile(file);
                  }}
                />
              </label>
              {aiPreview ? (
                <img src={aiPreview} alt="" className="h-16 w-14 rounded-xl object-cover" />
              ) : null}
              {error && aiOpen ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                  {error}
                </p>
              ) : null}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={creatingAi}
                  className="ai-rainbow-btn rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  {creatingAi ? "Creando…" : "Crear y generar look"}
                </button>
                <button
                  type="button"
                  disabled={creatingAi}
                  onClick={closeAiForm}
                  className="rounded-lg border border-[var(--border)] px-3.5 py-2 text-[13px] font-semibold text-[var(--foreground)]"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
    </>
  );
}
