"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { TrashIcon } from "./icons";
import { isSystemGalleryFolder } from "@/lib/gallery/app-demo-folder";

type GalleryFolder = {
  id: string;
  name: string;
  parentId: string | null;
  kind?: "folder" | "carousel";
  systemKey?: string | null;
  createdAt: string;
};

type GalleryAsset = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  kind: "image" | "video" | "audio" | "other";
  folderId: string | null;
  storagePath: string;
  publicUrl: string;
  hashtag: string | null;
  sortOrder?: number;
  createdAt: string;
};

type ViewMode = "details" | "icons" | "list";
type SortKey = "name" | "date" | "type" | "size";
type SelectedItem =
  | { type: "folder"; id: string }
  | { type: "file"; id: string }
  | null;

type CtxTarget =
  | { type: "folder"; id: string }
  | { type: "file"; id: string }
  | "background";

type RowItem =
  | { type: "folder"; folder: GalleryFolder }
  | { type: "file"; asset: GalleryAsset };

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function sanitizeFileName(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\w.\- ()[\]]+/g, "_")
      .slice(0, 180) || "file"
  );
}

function typeLabel(item: RowItem) {
  if (item.type === "folder") {
    return item.folder.kind === "carousel" ? "Carrusel" : "Carpeta";
  }
  if (item.asset.kind === "image") return "Imagen";
  if (item.asset.kind === "video") return "Video";
  if (item.asset.kind === "audio") return "Audio";
  return "Archivo";
}

function uniqueName(base: string, taken: string[]) {
  const set = new Set(taken.map((n) => n.trim().toLowerCase()));
  if (!set.has(base.toLowerCase())) return base;
  for (let i = 2; i < 200; i += 1) {
    const next = `${base} (${i})`;
    if (!set.has(next.toLowerCase())) return next;
  }
  return `${base} ${Date.now()}`;
}

function readStoredView(): ViewMode {
  if (typeof window === "undefined") return "icons";
  const v = window.localStorage.getItem("zima:gallery:view");
  if (v === "details" || v === "list" || v === "icons") return v;
  return "icons";
}

function selKey(type: "folder" | "file", id: string) {
  return `${type}:${id}`;
}

function itemKey(item: RowItem) {
  return item.type === "folder"
    ? selKey("folder", item.folder.id)
    : selKey("file", item.asset.id);
}

function parseSelKey(key: string): { type: "folder" | "file"; id: string } {
  const i = key.indexOf(":");
  return {
    type: key.slice(0, i) as "folder" | "file",
    id: key.slice(i + 1),
  };
}

function folderFullPath(all: GalleryFolder[], id: string) {
  const parts: string[] = [];
  let cur: string | null = id;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const f = all.find((x) => x.id === cur);
    if (!f) break;
    parts.unshift(f.name);
    cur = f.parentId;
  }
  return parts.join(" / ") || "Carpeta";
}

function isUnderFolder(
  all: GalleryFolder[],
  ancestorId: string,
  folderId: string
) {
  let cur: string | null = folderId;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    if (cur === ancestorId) return true;
    seen.add(cur);
    cur = all.find((x) => x.id === cur)?.parentId ?? null;
  }
  return false;
}

function CarouselGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <rect x="5" y="4" width="11" height="15" rx="1.6" fill="#D6D3D1" />
      <rect x="7.2" y="5.5" width="11" height="15" rx="1.6" fill="#A8A29E" />
      <rect x="9.5" y="5" width="11" height="15" rx="1.8" fill="#635bff" />
      <rect x="11.2" y="7.2" width="7.6" height="8.2" rx="0.8" fill="#FFEDD5" />
    </svg>
  );
}

function ContainerGlyph({
  kind,
  className = "h-4 w-4",
}: {
  kind?: "folder" | "carousel";
  className?: string;
}) {
  return kind === "carousel" ? (
    <CarouselGlyph className={className} />
  ) : (
    <FolderGlyph className={className} />
  );
}

function FolderGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#FFC83D"
        d="M3.5 7.2A1.7 1.7 0 0 1 5.2 5.5h4.1l1.5 1.7h8a1.7 1.7 0 0 1 1.7 1.7v8.4a1.7 1.7 0 0 1-1.7 1.7h-13.4a1.7 1.7 0 0 1-1.7-1.7V7.2Z"
      />
      <path
        fill="#FFE08A"
        d="M5.2 8.8h13.6a.9.9 0 0 1 .9.9v6.9a.9.9 0 0 1-.9.9H5.2a.9.9 0 0 1-.9-.9V9.7a.9.9 0 0 1 .9-.9Z"
      />
    </svg>
  );
}

function MediaThumb({
  asset,
  className = "h-full w-full object-cover",
}: {
  asset: GalleryAsset;
  className?: string;
}) {
  if (asset.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={asset.publicUrl}
        alt=""
        className={className}
        draggable={false}
      />
    );
  }
  if (asset.kind === "video") {
    return (
      <video
        src={asset.publicUrl}
        className={className}
        muted
        playsInline
        preload="metadata"
      />
    );
  }
  return (
    <span className="flex h-full w-full items-center justify-center bg-[#f3f3f3]">
      <FileGlyph kind={asset.kind} className="h-8 w-8" />
    </span>
  );
}

function FileGlyph({
  kind,
  className = "h-4 w-4",
}: {
  kind: "image" | "video" | "audio" | "other";
  className?: string;
}) {
  if (kind === "video") {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden>
        <rect x="4" y="5" width="16" height="14" rx="2" fill="#5B8DEF" />
        <path d="M10 9.2v5.6l5-2.8-5-2.8Z" fill="white" />
      </svg>
    );
  }
  if (kind === "image") {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden>
        <rect x="4" y="5" width="16" height="14" rx="2" fill="#34A853" />
        <circle cx="9" cy="10" r="1.4" fill="white" />
        <path
          d="M5.5 16.5 9.2 13l2.4 2.2 2.8-3.3 4.1 4.6H5.5Z"
          fill="white"
          opacity=".9"
        />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#90A4AE"
        d="M7 3.5h7.2L19 8.3V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5H7Z"
      />
      <path fill="#CFD8DC" d="M14.2 3.5V8H19L14.2 3.5Z" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 shrink-0 text-[#605e5c] transition ${open ? "rotate-90" : ""}`}
      viewBox="0 0 12 12"
      fill="currentColor"
      aria-hidden
    >
      <path d="M4.2 2.2 8.3 6 4.2 9.8V2.2Z" />
    </svg>
  );
}

function TreeNode({
  folder,
  allFolders,
  depth,
  currentId,
  expanded,
  dropId,
  onToggle,
  onSelect,
  onDropFolder,
  onHoverDrop,
}: {
  folder: GalleryFolder;
  allFolders: GalleryFolder[];
  depth: number;
  currentId: string | null;
  expanded: Set<string>;
  dropId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onDropFolder: (e: ReactDragEvent, id: string) => void;
  onHoverDrop: (id: string | null) => void;
}) {
  const children = allFolders.filter((f) => f.parentId === folder.id);
  const hasChildren = children.length > 0;
  const isOpen = expanded.has(folder.id);
  const active = currentId === folder.id;
  const dropping = dropId === folder.id;

  return (
    <div>
      <div
        className={`group flex items-center gap-0.5 rounded-md pr-1 text-[12px] ${
          dropping
            ? "bg-[#cce8ff] ring-1 ring-[#0078d4]"
            : active
              ? "bg-[#cce8ff] text-[#000]"
              : "text-[#201f1e] hover:bg-[#f3f3f3]"
        }`}
        style={{ paddingLeft: 4 + depth * 12 }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onHoverDrop(folder.id);
        }}
        onDragLeave={() => onHoverDrop(null)}
        onDrop={(e) => onDropFolder(e, folder.id)}
      >
        <button
          type="button"
          className="flex h-6 w-4 shrink-0 items-center justify-center"
          onClick={() => hasChildren && onToggle(folder.id)}
          aria-label={isOpen ? "Contraer" : "Expandir"}
        >
          {hasChildren ? <Chevron open={isOpen} /> : <span className="w-3" />}
        </button>
        <button
          type="button"
          onClick={() => onSelect(folder.id)}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left"
        >
          <ContainerGlyph kind={folder.kind} className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {folder.name}
            {isSystemGalleryFolder(folder) ? " · fija" : ""}
          </span>
        </button>
      </div>
      {hasChildren && isOpen
        ? children.map((child) => (
            <TreeNode
              key={child.id}
              folder={child}
              allFolders={allFolders}
              depth={depth + 1}
              currentId={currentId}
              expanded={expanded}
              dropId={dropId}
              onToggle={onToggle}
              onSelect={onSelect}
              onDropFolder={onDropFolder}
              onHoverDrop={onHoverDrop}
            />
          ))
        : null}
    </div>
  );
}

export function GalleryView({ projectId }: { projectId: string }) {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<GalleryFolder[]>([]);
  const [allFolders, setAllFolders] = useState<GalleryFolder[]>([]);
  const [assets, setAssets] = useState<GalleryAsset[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<GalleryFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState("");
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dropId, setDropId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredView);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [rename, setRename] = useState<{
    type: "folder" | "file";
    id: string;
    value: string;
  } | null>(null);
  const [lightbox, setLightbox] = useState<GalleryAsset | null>(null);
  const [selected, setSelected] = useState<SelectedItem>(null);
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [anchorKey, setAnchorKey] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [history, setHistory] = useState<(string | null)[]>([null]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [preview, setPreview] = useState<GalleryAsset | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    target: CtxTarget;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const navigatingRef = useRef(false);

  const goToFolder = useCallback(
    (id: string | null, opts?: { pushHistory?: boolean }) => {
      const push = opts?.pushHistory !== false;
      if (push && !navigatingRef.current) {
        setHistory((prev) => {
          const next = prev.slice(0, historyIdx + 1);
          if (next[next.length - 1] === id) return prev;
          next.push(id);
          setHistoryIdx(next.length - 1);
          return next;
        });
      }
      setFolderId(id);
      setSelected(null);
      setSelection(new Set());
      setAnchorKey(null);
      setPreview(null);
      setSearchQuery("");
      setRename(null);
      if (id) {
        setExpanded((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      }
    },
    [historyIdx]
  );

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError("");
    try {
      const q = folderId ? `?folderId=${encodeURIComponent(folderId)}` : "";
      const res = await fetch(`/api/projects/${projectId}/gallery${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar la galería");
      setFolders(data.folders ?? []);
      const nextAssets = (data.assets ?? []) as GalleryAsset[];
      setAssets(nextAssets);
      setBreadcrumbs(data.breadcrumbs ?? []);
      setAllFolders(data.allFolders ?? []);
      setPreview((prev) =>
        prev ? nextAssets.find((a) => a.id === prev.id) ?? prev : null
      );
      // Expand ancestors in tree
      const crumbs = (data.breadcrumbs ?? []) as GalleryFolder[];
      if (crumbs.length) {
        setExpanded((prev) => {
          const next = new Set(prev);
          for (const c of crumbs) next.add(c.id);
          return next;
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
      setFolders([]);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, folderId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [ctxMenu]);

  function openContextMenu(e: ReactMouseEvent, target: CtxTarget) {
    e.preventDefault();
    e.stopPropagation();
    const pad = 8;
    const menuW = 220;
    const menuH = target === "background" ? 96 : 180;
    const x = Math.min(e.clientX, window.innerWidth - menuW - pad);
    const y = Math.min(e.clientY, window.innerHeight - menuH - pad);
    if (target !== "background") {
      const key = selKey(target.type, target.id);
      setSelected(target);
      setSelection((prev) => (prev.has(key) ? prev : new Set([key])));
      if (!selection.has(key)) setAnchorKey(key);
      if (target.type === "file") {
        const asset = assets.find((a) => a.id === target.id) ?? null;
        setPreview(asset);
      } else {
        setPreview(null);
      }
    }
    setCtxMenu({ x: Math.max(pad, x), y: Math.max(pad, y), target });
  }

  const parentId =
    breadcrumbs.length > 0
      ? breadcrumbs[breadcrumbs.length - 1]?.parentId ?? null
      : null;
  const canGoUp = folderId !== null;
  const canBack = historyIdx > 0;
  const canForward = historyIdx < history.length - 1;
  const inCarousel =
    (folderId
      ? allFolders.find((f) => f.id === folderId)?.kind
      : undefined) === "carousel";

  const rows = useMemo(() => {
    const items: RowItem[] = [
      ...folders.map((folder) => ({ type: "folder" as const, folder })),
      ...assets.map((asset) => ({ type: "file" as const, asset })),
    ];
    if (inCarousel) {
      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        if (a.type === "file" && b.type === "file") {
          return (a.asset.sortOrder ?? 0) - (b.asset.sortOrder ?? 0);
        }
        if (a.type === "folder" && b.type === "folder") {
          return a.folder.name.localeCompare(b.folder.name);
        }
        return 0;
      });
      return items;
    }
    const dir = sortAsc ? 1 : -1;
    items.sort((a, b) => {
      // Folders first, like Explorer
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      if (sortKey === "name") {
        const an = a.type === "folder" ? a.folder.name : a.asset.name;
        const bn = b.type === "folder" ? b.folder.name : b.asset.name;
        return an.localeCompare(bn) * dir;
      }
      if (sortKey === "date") {
        const ad = a.type === "folder" ? a.folder.createdAt : a.asset.createdAt;
        const bd = b.type === "folder" ? b.folder.createdAt : b.asset.createdAt;
        return (new Date(ad).getTime() - new Date(bd).getTime()) * dir;
      }
      if (sortKey === "type") {
        return typeLabel(a).localeCompare(typeLabel(b)) * dir;
      }
      const as = a.type === "folder" ? -1 : a.asset.sizeBytes;
      const bs = b.type === "folder" ? -1 : b.asset.sizeBytes;
      return (as - bs) * dir;
    });
    return items;
  }, [folders, assets, sortKey, sortAsc, inCarousel]);

  const visibleRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((item) => {
      const name =
        item.type === "folder" ? item.folder.name : item.asset.name;
      const extra = item.type === "file" ? item.asset.hashtag || "" : "";
      return `${name} ${extra}`.toLowerCase().includes(q);
    });
  }, [rows, searchQuery]);

  useEffect(() => {
    window.localStorage.setItem("zima:gallery:view", viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (rename) renameRef.current?.focus();
  }, [rename]);

  function isItemSelected(item: RowItem) {
    return selection.has(itemKey(item));
  }

  function applySelection(
    next: Set<string>,
    focus: { type: "folder" | "file"; id: string },
    previewAsset?: GalleryAsset | null
  ) {
    setSelection(next);
    setSelected(focus);
    if (previewAsset !== undefined) {
      setPreview(previewAsset);
    } else if (focus.type === "file") {
      setPreview(assets.find((a) => a.id === focus.id) ?? null);
    } else {
      setPreview(null);
    }
  }

  function handleItemClick(e: ReactMouseEvent, item: RowItem) {
    e.stopPropagation();
    const type = item.type;
    const id = item.type === "folder" ? item.folder.id : item.asset.id;
    const key = selKey(type, id);
    const previewAsset = item.type === "file" ? item.asset : null;

    if (selectMode || e.metaKey || e.ctrlKey) {
      const next = new Set(selection);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setAnchorKey(key);
      applySelection(next, { type, id }, selectMode ? preview : previewAsset);
      return;
    }

    if (e.shiftKey && anchorKey) {
      const keys = visibleRows.map(itemKey);
      const a = keys.indexOf(anchorKey);
      const b = keys.indexOf(key);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        applySelection(
          new Set(keys.slice(lo, hi + 1)),
          { type, id },
          previewAsset
        );
        return;
      }
    }

    setAnchorKey(key);
    applySelection(new Set([key]), { type, id }, previewAsset);
  }

  function toggleItemChecked(item: RowItem) {
    const type = item.type;
    const id = item.type === "folder" ? item.folder.id : item.asset.id;
    const key = selKey(type, id);
    const next = new Set(selection);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setAnchorKey(key);
    applySelection(next, { type, id }, preview);
  }

  function selectAllInFolder() {
    const next = new Set(visibleRows.map(itemKey));
    setSelection(next);
    const last = visibleRows[visibleRows.length - 1];
    if (last) {
      setSelected(
        last.type === "folder"
          ? { type: "folder", id: last.folder.id }
          : { type: "file", id: last.asset.id }
      );
      setAnchorKey(itemKey(last));
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.key === "Escape" && rename) {
          e.preventDefault();
          setRename(null);
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
          return;
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAllInFolder();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
        const hasFile = [...selection].some((k) => k.startsWith("file:")) ||
          selected?.type === "file";
        if (hasFile) {
          e.preventDefault();
          void copyUrl();
        }
        return;
      }
      if (e.key === "Escape") {
        if (lightbox) {
          setLightbox(null);
          return;
        }
        if (rename) {
          setRename(null);
          return;
        }
        setSelectMode(false);
        clearSelection();
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        startRenameFromSelection();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        openSelected();
        return;
      }
      if (e.key === "Backspace" || (e.altKey && e.key === "ArrowUp")) {
        if (folderId !== null) {
          e.preventDefault();
          const up =
            breadcrumbs.length > 0
              ? breadcrumbs[breadcrumbs.length - 1]?.parentId ?? null
              : null;
          goToFolder(up);
        }
        return;
      }
      if (e.key === "Delete" && (selection.size > 0 || selected)) {
        e.preventDefault();
        void deleteSelected();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowLeft") {
        if (!visibleRows.length) return;
        e.preventDefault();
        const keys = visibleRows.map(itemKey);
        const current = selected
          ? selKey(selected.type, selected.id)
          : null;
        const idx = current ? keys.indexOf(current) : -1;
        const delta =
          e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
        const nextIdx = Math.min(
          keys.length - 1,
          Math.max(0, idx < 0 ? 0 : idx + delta)
        );
        const item = visibleRows[nextIdx];
        if (!item) return;
        const type = item.type;
        const id = item.type === "folder" ? item.folder.id : item.asset.id;
        const key = selKey(type, id);
        if (e.shiftKey && anchorKey) {
          const a = keys.indexOf(anchorKey);
          const [lo, hi] = a < nextIdx ? [a, nextIdx] : [nextIdx, a];
          applySelection(
            new Set(keys.slice(lo, hi + 1)),
            { type, id },
            item.type === "file" ? item.asset : null
          );
        } else {
          setAnchorKey(key);
          applySelection(
            new Set([key]),
            { type, id },
            item.type === "file" ? item.asset : null
          );
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    selection,
    selected,
    visibleRows,
    folderId,
    rename,
    lightbox,
    breadcrumbs,
    anchorKey,
  ]);

  function startRenameFromSelection() {
    const item = selectedItems()[0];
    if (!item) return;
    if (item.type === "folder") {
      const f = folders.find((x) => x.id === item.id);
      if (!f || isSystemGalleryFolder(f)) return;
      setRename({ type: "folder", id: f.id, value: f.name });
    } else {
      const a = assets.find((x) => x.id === item.id);
      if (a) setRename({ type: "file", id: a.id, value: a.name });
    }
  }

  function openSelected() {
    const item = selectedItems()[0];
    if (!item) return;
    if (item.type === "folder") {
      goToFolder(item.id);
      return;
    }
    const asset = assets.find((x) => x.id === item.id);
    if (asset) setLightbox(asset);
  }

  async function commitRename() {
    if (!rename) return;
    const name = rename.value.trim();
    if (!name) {
      setRename(null);
      return;
    }
    const prev =
      rename.type === "folder"
        ? folders.find((f) => f.id === rename.id)?.name
        : assets.find((a) => a.id === rename.id)?.name;
    if (prev === name) {
      setRename(null);
      return;
    }
    setError("");
    try {
      const url =
        rename.type === "folder"
          ? `/api/projects/${projectId}/gallery/folders/${rename.id}`
          : `/api/projects/${projectId}/gallery/assets/${rename.id}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo renombrar");
      if (rename.type === "folder") {
        setFolders((list) =>
          list.map((f) => (f.id === rename.id ? { ...f, name } : f))
        );
        setAllFolders((list) =>
          list.map((f) => (f.id === rename.id ? { ...f, name } : f))
        );
      } else {
        setAssets((list) =>
          list.map((a) => (a.id === rename.id ? { ...a, name } : a))
        );
        setPreview((p) => (p?.id === rename.id ? { ...p, name } : p));
      }
      setStatusMsg("Nombre actualizado");
      setRename(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo renombrar");
      setRename(null);
    }
  }

  async function createQuick(kind: "folder" | "carousel") {
    const name = uniqueName(
      kind === "carousel" ? "Nuevo carrusel" : "Nueva carpeta",
      folders.map((f) => f.name)
    );
    setCreatingFolder(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/gallery/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: folderId, kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear");
      setStatusMsg(
        kind === "carousel"
          ? `Carrusel “${data.folder.name}” creado`
          : `Carpeta “${data.folder.name}” creada`
      );
      await load({ silent: true });
      setRename({ type: "folder", id: data.folder.id, value: data.folder.name });
      applySelection(new Set([selKey("folder", data.folder.id)]), {
        type: "folder",
        id: data.folder.id,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setCreatingFolder(false);
    }
  }

  function onItemDragStart(e: ReactDragEvent, item: RowItem) {
    const type = item.type;
    const id = item.type === "folder" ? item.folder.id : item.asset.id;
    const key = selKey(type, id);
    if (!selection.has(key)) {
      applySelection(
        new Set([key]),
        { type, id },
        item.type === "file" ? item.asset : null
      );
    }
    e.dataTransfer.setData("application/x-zima-gallery", key);
    e.dataTransfer.effectAllowed = "move";
  }

  function isInternalDrag(e: ReactDragEvent) {
    return Array.from(e.dataTransfer.types).includes("application/x-zima-gallery");
  }

  async function handleDropOnFolder(
    e: ReactDragEvent,
    destId: string | null
  ) {
    e.preventDefault();
    e.stopPropagation();
    setDropId(null);
    setDragOver(false);
    if (e.dataTransfer.files?.length && !isInternalDrag(e)) {
      await uploadFiles(e.dataTransfer.files, destId);
      return;
    }
    if (isInternalDrag(e)) {
      await moveSelection(destId);
    }
  }

  async function reorderCarousel(assetId: string, dir: -1 | 1) {
    if (!folderId) return;
    const ordered = [...assets].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    );
    const i = ordered.findIndex((a) => a.id === assetId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    const next = [...ordered];
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
    setAssets(
      next.map((a, idx) => ({
        ...a,
        sortOrder: idx,
      }))
    );
    try {
      const res = await fetch(
        `/api/projects/${projectId}/gallery/assets/reorder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folderId,
            orderedIds: next.map((a) => a.id),
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo reordenar");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reordenar");
      await load();
    }
  }

  function clearSelection() {
    setSelected(null);
    setSelection(new Set());
    setAnchorKey(null);
    setPreview(null);
  }

  function selectedItems(): { type: "folder" | "file"; id: string }[] {
    if (selection.size > 0) return [...selection].map(parseSelKey);
    if (selected) return [selected];
    return [];
  }

  async function deleteSelected() {
    const items = selectedItems();
    if (!items.length) return;

    const folderItems = items.filter((x) => x.type === "folder");
    const fileItems = items.filter((x) => x.type === "file");
    const lockedFolders = folderItems.filter((item) => {
      const f =
        folders.find((x) => x.id === item.id) ??
        allFolders.find((x) => x.id === item.id);
      return isSystemGalleryFolder(f);
    });
    if (lockedFolders.length) {
      setError("Esta carpeta es fija y no se puede eliminar.");
      return;
    }
    let msg = "";
    if (items.length === 1) {
        if (items[0].type === "folder") {
        const f = folders.find((x) => x.id === items[0].id);
        msg =
          f?.kind === "carousel"
            ? `¿Eliminar el carrusel “${f.name}” y todas sus imágenes? Esto no se puede deshacer.`
            : `¿Eliminar la carpeta “${f?.name ?? "esta carpeta"}” y todo su contenido? Esto no se puede deshacer.`;
      } else {
        const asset = assets.find((x) => x.id === items[0].id);
        msg = `¿Eliminar “${asset?.name ?? "este archivo"}”?`;
      }
    } else {
      const parts: string[] = [];
      if (fileItems.length) {
        parts.push(
          `${fileItems.length} archivo${fileItems.length === 1 ? "" : "s"}`
        );
      }
      if (folderItems.length) {
        parts.push(
          `${folderItems.length} carpeta${folderItems.length === 1 ? "" : "s"} y su contenido`
        );
      }
      msg = `¿Eliminar ${parts.join(" y ")}? Esto no se puede deshacer.`;
    }
    if (!confirm(msg)) return;

    setError("");
    const errors: string[] = [];
    try {
      for (const folder of folderItems) {
        const res = await fetch(
          `/api/projects/${projectId}/gallery/folders/${folder.id}`,
          { method: "DELETE" }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) errors.push(data.error || "No se pudo eliminar una carpeta");
      }
      for (const file of fileItems) {
        const res = await fetch(
          `/api/projects/${projectId}/gallery/assets/${file.id}`,
          { method: "DELETE" }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) errors.push(data.error || "No se pudo eliminar un archivo");
      }
      const n = items.length - errors.length;
      clearSelection();
      if (errors.length) {
        setError(errors.slice(0, 3).join(" · "));
      } else {
        setStatusMsg(
          n === 1 ? "Elemento eliminado" : `${n} elementos eliminados`
        );
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function copyUrl() {
    const files = selectedItems().filter((x) => x.type === "file");
    const urls = files
      .map((x) => assets.find((a) => a.id === x.id)?.publicUrl)
      .filter((u): u is string => Boolean(u));
    if (!urls.length) return;
    try {
      await navigator.clipboard.writeText(urls.join("\n"));
      setStatusMsg(
        urls.length === 1
          ? "URL copiada al portapapeles"
          : `${urls.length} URLs copiadas`
      );
    } catch {
      setError("No se pudo copiar la URL");
    }
  }

  async function moveSelection(destFolderId: string | null) {
    const items = selectedItems();
    if (!items.length) return;

    const selectedFolderIds = new Set(
      items.filter((x) => x.type === "folder").map((x) => x.id)
    );
    if (destFolderId && selectedFolderIds.has(destFolderId)) {
      setError("No se puede mover a una carpeta seleccionada");
      return;
    }
    for (const folder of items.filter((x) => x.type === "folder")) {
      const f =
        folders.find((x) => x.id === folder.id) ??
        allFolders.find((x) => x.id === folder.id);
      if (isSystemGalleryFolder(f)) {
        setError("Esta carpeta es fija y no se puede mover.");
        return;
      }
      if (
        destFolderId &&
        isUnderFolder(allFolders, folder.id, destFolderId)
      ) {
        setError("No se puede mover una carpeta dentro de sí misma");
        return;
      }
    }

    setMoving(true);
    setError("");
    const errors: string[] = [];
    try {
      for (const item of items) {
        if (item.type === "file") {
          const asset = assets.find((a) => a.id === item.id);
          if (!asset) continue;
          const current = asset.folderId ?? null;
          if (current === destFolderId) continue;
          const res = await fetch(
            `/api/projects/${projectId}/gallery/assets/${item.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                folderId: destFolderId ?? "root",
              }),
            }
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok) errors.push(data.error || "No se pudo mover un archivo");
        } else {
          const folder = [...folders, ...allFolders].find(
            (f) => f.id === item.id
          );
          if (!folder) continue;
          const current = folder.parentId ?? null;
          if (current === destFolderId) continue;
          const res = await fetch(
            `/api/projects/${projectId}/gallery/folders/${item.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                parentId: destFolderId ?? "root",
              }),
            }
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok) errors.push(data.error || "No se pudo mover una carpeta");
        }
      }
      const n = items.length - errors.length;
      clearSelection();
      if (errors.length) {
        setError(errors.slice(0, 3).join(" · "));
      } else {
        setStatusMsg(n === 1 ? "Elemento movido" : `${n} elementos movidos`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setMoving(false);
    }
  }

  async function uploadFiles(
    fileList: FileList | File[],
    destFolderId: string | null = folderId
  ) {
    const files = Array.from(fileList);
    if (!files.length) return;

    setUploading(true);
    setError("");
    setUploadNote(`0/${files.length}`);
    setStatusMsg("Subiendo…");
    const supabase = createClient();
    const registered: {
      name: string;
      mimeType: string;
      sizeBytes: number;
      storagePath: string;
      publicUrl: string;
    }[] = [];
    const localErrors: string[] = [];

    let done = 0;
    for (const file of files) {
      done += 1;
      setUploadNote(`${done}/${files.length}`);
      const mime = (file.type || "").toLowerCase();
      if (!mime.startsWith("image/") && !mime.startsWith("video/")) {
        localErrors.push(`${file.name}: solo fotos o videos`);
        continue;
      }
      if (file.size <= 0 || file.size > 200 * 1024 * 1024) {
        localErrors.push(`${file.name}: máx 200 MB`);
        continue;
      }

      const safe = sanitizeFileName(file.name);
      const storagePath = `${projectId}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("gallery")
        .upload(storagePath, file, { contentType: mime, upsert: false });

      if (upErr) {
        localErrors.push(`${file.name}: ${upErr.message}`);
        continue;
      }

      const { data: pub } = supabase.storage
        .from("gallery")
        .getPublicUrl(storagePath);

      registered.push({
        name: safe,
        mimeType: mime,
        sizeBytes: file.size,
        storagePath,
        publicUrl: pub.publicUrl,
      });
    }

    if (registered.length) {
      try {
        const res = await fetch(`/api/projects/${projectId}/gallery/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId: destFolderId, files: registered }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo registrar");
        if (Array.isArray(data.errors) && data.errors.length) {
          localErrors.push(...data.errors);
        }
        setStatusMsg(
          `${data.assets?.length ?? registered.length} elemento(s) subido(s)`
        );
        await load({ silent: true });
      } catch (err) {
        localErrors.push(
          err instanceof Error ? err.message : "Error al registrar"
        );
      }
    }

    if (localErrors.length) {
      setError(localErrors.slice(0, 3).join(" · "));
    }
    setUploading(false);
    setUploadNote("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const addressPath = [
    "Galería",
    ...breadcrumbs.map((b) => b.name),
  ].join(" › ");

  const selectedCount = selection.size || (selected ? 1 : 0);
  const itemCount = visibleRows.length;
  const folderCount = visibleRows.filter((r) => r.type === "folder").length;
  const fileCount = visibleRows.filter((r) => r.type === "file").length;
  const selectedFolderIds = new Set(
    selectedItems()
      .filter((x) => x.type === "folder")
      .map((x) => x.id)
  );
  const movingFolders = selectedItems().some((x) => x.type === "folder");
  const moveTargets = allFolders.filter((f) => {
    if (f.id === folderId) return false;
    if (selectedFolderIds.has(f.id)) return false;
    if (movingFolders && f.kind === "carousel") return false;
    for (const id of selectedFolderIds) {
      if (isUnderFolder(allFolders, id, f.id)) return false;
    }
    return true;
  });
  const canCopyUrl = selectedItems().some((x) => x.type === "file");
  const selectedFolder =
    selected?.type === "folder"
      ? folders.find((f) => f.id === selected.id) ??
        allFolders.find((f) => f.id === selected.id) ??
        null
      : null;
  const hasLockedFolderSelected = selectedItems().some((item) => {
    if (item.type !== "folder") return false;
    const f =
      folders.find((x) => x.id === item.id) ??
      allFolders.find((x) => x.id === item.id);
    return isSystemGalleryFolder(f);
  });
  const ctxTarget =
    ctxMenu && ctxMenu.target !== "background" ? ctxMenu.target : null;
  const ctxLockedFolder = Boolean(
    ctxTarget &&
      ctxTarget.type === "folder" &&
      isSystemGalleryFolder(
        folders.find((x) => x.id === ctxTarget.id) ??
          allFolders.find((x) => x.id === ctxTarget.id)
      )
  );

  function nameNode(item: RowItem) {
    const id = item.type === "folder" ? item.folder.id : item.asset.id;
    const name = item.type === "folder" ? item.folder.name : item.asset.name;
    if (rename && rename.type === item.type && rename.id === id) {
      return (
        <input
          ref={renameRef}
          value={rename.value}
          onChange={(e) => setRename({ ...rename, value: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              void commitRename();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setRename(null);
            }
          }}
          onBlur={() => void commitRename()}
          className="w-full min-w-0 rounded border border-[#0078d4] bg-white px-1 py-0.5 text-[12px] outline-none"
        />
      );
    }
    return (
      <span className="block w-full min-w-0 truncate font-medium" title={name}>
        {name}
        {item.type === "folder" && isSystemGalleryFolder(item.folder)
          ? " · fija"
          : ""}
      </span>
    );
  }

  function bindItem(item: RowItem) {
    const id = item.type === "folder" ? item.folder.id : item.asset.id;
    return {
      draggable:
        item.type === "file" || !isSystemGalleryFolder(item.folder),
      onDragStart: (e: ReactDragEvent) => onItemDragStart(e, item),
      onDragOver:
        item.type === "folder"
          ? (e: ReactDragEvent) => {
              e.preventDefault();
              e.stopPropagation();
              setDropId(item.folder.id);
            }
          : undefined,
      onDragLeave:
        item.type === "folder" ? () => setDropId(null) : undefined,
      onDrop:
        item.type === "folder"
          ? (e: ReactDragEvent) => void handleDropOnFolder(e, item.folder.id)
          : undefined,
      onClick: (e: ReactMouseEvent) => handleItemClick(e, item),
      onContextMenu: (e: ReactMouseEvent) =>
        openContextMenu(e, { type: item.type, id }),
      onDoubleClick: () => {
        if (item.type === "folder") goToFolder(item.folder.id);
        else setLightbox(item.asset);
      },
    };
  }

  return (
    <div className="h-full bg-[#ececec] p-2.5 text-[#201f1e] sm:p-3.5">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#d0d0d0] bg-[#f3f3f3] shadow-[0_8px_28px_rgba(0,0,0,0.08)]">
      {/* Ribbon / toolbar */}
      <div className="shrink-0 rounded-t-2xl border-b border-[var(--border)] bg-white px-2 py-1.5 sm:px-3">
        <div className="flex flex-wrap items-center gap-1">
          {!inCarousel ? (
            <>
              <ToolBtn
                label={creatingFolder ? "Creando…" : "Nueva carpeta"}
                disabled={creatingFolder}
                onClick={() => void createQuick("folder")}
                icon={<FolderGlyph className="h-4 w-4" />}
              />
              <ToolBtn
                label="Nuevo carrusel"
                disabled={creatingFolder}
                onClick={() => void createQuick("carousel")}
                icon={<CarouselGlyph className="h-4 w-4" />}
              />
            </>
          ) : null}
          <ToolBtn
            label={
              uploading
                ? `Subiendo ${uploadNote || "…"}`
                : "Subir"
            }
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 16V5M12 5l-3.5 3.5M12 5l3.5 3.5M5 19h14"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
          <span className="mx-1 h-5 w-px bg-[#e5e5e5]" />
          <ToolBtn
            label="Renombrar"
            disabled={selectedCount !== 1 || hasLockedFolderSelected}
            onClick={() => startRenameFromSelection()}
          />
          <label className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-[#201f1e]">
            <span className={selectedCount && !moving ? "" : "opacity-40"}>
              Mover a
            </span>
            <select
              disabled={!selectedCount || moving || hasLockedFolderSelected}
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                void moveSelection(v === "root" ? null : v);
              }}
              className="max-w-[180px] rounded-md border border-[var(--border-strong)] bg-white px-1.5 py-0.5 text-[11px] outline-none disabled:opacity-40"
            >
              <option value="">
                {moving ? "Moviendo…" : "Elegir carpeta"}
              </option>
              {folderId !== null ? (
                <option value="root">Galería (raíz)</option>
              ) : null}
              {moveTargets.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.kind === "carousel" ? "Carrusel · " : ""}
                  {folderFullPath(allFolders, f.id)}
                </option>
              ))}
            </select>
          </label>
          <ToolBtn
            label="Copiar URL"
            disabled={!canCopyUrl}
            onClick={() => void copyUrl()}
          />
          <ToolBtn
            label="Eliminar"
            disabled={!selectedCount || hasLockedFolderSelected}
            onClick={() => void deleteSelected()}
            danger
            icon={<TrashIcon className="h-3.5 w-3.5" />}
          />
          <div className="ml-auto flex items-center gap-0.5 rounded-xl border border-[var(--border-strong)] bg-[#f9f9f9] p-0.5">
            {(
              [
                ["icons", "Iconos"],
                ["list", "Lista"],
                ["details", "Detalles"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                title={label}
                onClick={() => setViewMode(mode)}
                className={`rounded-lg px-2 py-1 text-[11px] font-medium ${
                  viewMode === mode
                    ? "bg-white text-[#0078d4] shadow-sm"
                    : "text-[#605e5c] hover:bg-white/80"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void uploadFiles(e.target.files);
            }}
          />
        </div>
      </div>

      {/* Nav + address */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-[var(--border)] bg-[#f9f9f9] px-2 py-1.5 sm:px-3">
        <NavIconBtn
          title="Atrás"
          disabled={!canBack}
          onClick={() => {
            if (!canBack) return;
            navigatingRef.current = true;
            const nextIdx = historyIdx - 1;
            setHistoryIdx(nextIdx);
            setFolderId(history[nextIdx] ?? null);
            setSelected(null);
            setTimeout(() => {
              navigatingRef.current = false;
            }, 0);
          }}
        >
          ←
        </NavIconBtn>
        <NavIconBtn
          title="Adelante"
          disabled={!canForward}
          onClick={() => {
            if (!canForward) return;
            navigatingRef.current = true;
            const nextIdx = historyIdx + 1;
            setHistoryIdx(nextIdx);
            setFolderId(history[nextIdx] ?? null);
            setSelected(null);
            setTimeout(() => {
              navigatingRef.current = false;
            }, 0);
          }}
        >
          →
        </NavIconBtn>
        <NavIconBtn
          title="Subir"
          disabled={!canGoUp}
          onClick={() => goToFolder(parentId)}
        >
          ↑
        </NavIconBtn>
        <NavIconBtn title="Actualizar" onClick={() => void load()}>
          ↻
        </NavIconBtn>

        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden rounded-lg border border-[var(--border-strong)] bg-white px-2 py-1 text-[12px]">
          <ContainerGlyph
            kind={
              folderId
                ? allFolders.find((f) => f.id === folderId)?.kind
                : "folder"
            }
            className="h-3.5 w-3.5 shrink-0"
          />
          <button
            type="button"
            onClick={() => goToFolder(null)}
            className={`shrink-0 hover:underline ${folderId === null ? "font-semibold text-[#0078d4]" : "text-[#201f1e]"}`}
          >
            Galería
          </button>
          {breadcrumbs.map((c) => (
            <span key={c.id} className="inline-flex min-w-0 items-center gap-1">
              <span className="text-[#a19f9d]">›</span>
              <button
                type="button"
                onClick={() => goToFolder(c.id)}
                className={`truncate hover:underline ${
                  folderId === c.id
                    ? "font-semibold text-[#0078d4]"
                    : "text-[#201f1e]"
                }`}
              >
                {c.name}
              </button>
            </span>
          ))}
        </div>
        <label className="relative shrink-0">
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar"
            className="w-[132px] rounded-lg border border-[var(--border-strong)] bg-white py-1 pl-2 pr-7 text-[12px] outline-none focus:border-[#0078d4] sm:w-[200px] sm:placeholder:text-[12px]"
          />
          {searchQuery ? (
            <button
              type="button"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] text-[#605e5c]"
              onClick={() => setSearchQuery("")}
            >
              ×
            </button>
          ) : null}
        </label>
      </div>

      {error ? (
        <div className="shrink-0 border-b border-[#f1aeb5] bg-[#fde7e9] px-3 py-1.5 text-[12px] text-[#a4262c]">
          {error}
        </div>
      ) : null}

      {/* Body: tree + content + details */}
      <div className="relative flex min-h-0 flex-1">
        {/* Navigation pane */}
        <aside
          className="hidden w-[240px] shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[var(--background)] p-2 sm:block"
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            if (folderId !== null) void handleDropOnFolder(e, null);
          }}
        >
          <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">
            Carpetas
          </p>
          <button
            type="button"
            onClick={() => goToFolder(null)}
            onDragOver={(e) => {
              e.preventDefault();
              setDropId("root");
            }}
            onDragLeave={() => setDropId(null)}
            onDrop={(e) => void handleDropOnFolder(e, null)}
            className={`mb-0.5 flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-[12px] ${
              dropId === "root"
                ? "bg-[#cce8ff] ring-1 ring-[#0078d4]"
                : folderId === null
                  ? "bg-[#cce8ff]"
                  : "hover:bg-[#f3f3f3]"
            }`}
          >
            <FolderGlyph className="h-3.5 w-3.5" />
            <span className="font-medium">Galería</span>
          </button>
          <div className="mt-0.5 space-y-px">
            {allFolders
              .filter((f) => f.parentId === null)
              .map((f) => (
                <TreeNode
                  key={f.id}
                  folder={f}
                  allFolders={allFolders}
                  depth={1}
                  currentId={folderId}
                  expanded={expanded}
                  dropId={dropId}
                  onToggle={(id) => {
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    });
                  }}
                  onSelect={(id) => goToFolder(id)}
                  onDropFolder={(e, id) => void handleDropOnFolder(e, id)}
                  onHoverDrop={setDropId}
                />
              ))}
          </div>
        </aside>

        {/* Main pane */}
        <div
          className={`relative flex min-w-0 flex-1 flex-col ${
            dragOver ? "bg-[#e5f3ff]" : "bg-white"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            if (!isInternalDrag(e)) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => void handleDropOnFolder(e, folderId)}
          onClick={() => {
            setCtxMenu(null);
            clearSelection();
          }}
          onContextMenu={(e) => openContextMenu(e, "background")}
        >
          {loading && (folders.length > 0 || assets.length > 0) ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-[#e5e5e5]">
              <div className="h-full w-1/3 animate-pulse bg-[#0078d4]" />
            </div>
          ) : null}
          {dragOver ? (
            <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-[#0078d4] bg-[#cce8ff]/70 text-[13px] font-semibold text-[#0078d4]">
              Suelta los archivos para subirlos aquí
            </div>
          ) : null}

          {loading && !folders.length && !assets.length ? (
            <p className="p-4 text-[12px] text-[#605e5c]">Cargando…</p>
          ) : viewMode === "details" ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
                <thead className="sticky top-0 z-[1] bg-[#f9f9f9]">
                  <tr className="border-b border-[var(--border)] text-[#605e5c]">
                    {(
                      [
                        ["name", "Nombre", "w-[42%]"],
                        ["date", "Fecha de modificación", "w-[22%]"],
                        ["type", "Tipo", "w-[16%]"],
                        ["size", "Tamaño", "w-[12%]"],
                      ] as const
                    ).map(([key, label, width]) => (
                      <th key={key} className={`${width} px-2 py-1.5 font-semibold`}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSort(key);
                          }}
                          className="inline-flex items-center gap-1 hover:text-[#201f1e]"
                        >
                          {label}
                          {sortKey === key ? (sortAsc ? " ▲" : " ▼") : null}
                        </button>
                      </th>
                    ))}
                    <th className="w-[8%] px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-12 text-center text-[12px] text-[#a19f9d]"
                      >
                        {searchQuery
                          ? "No hay coincidencias en esta carpeta."
                          : inCarousel
                          ? "Este carrusel está vacío. Sube fotos y usa las flechas para ordenarlas."
                          : "Esta carpeta está vacía. Arrastra archivos o usa Subir."}
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((item) => {
                      const id =
                        item.type === "folder" ? item.folder.id : item.asset.id;
                      const isSel = isItemSelected(item);
                      const dropping =
                        item.type === "folder" && dropId === item.folder.id;
                      const date =
                        item.type === "folder"
                          ? item.folder.createdAt
                          : item.asset.createdAt;
                      return (
                        <tr
                          key={`${item.type}-${id}`}
                          className={`border-b border-[#f3f2f1] ${
                            dropping
                              ? "bg-[#cce8ff] ring-1 ring-inset ring-[#0078d4]"
                              : isSel
                                ? "bg-[#cce8ff]"
                                : "hover:bg-[#f3f9fd]"
                          }`}
                          {...bindItem(item)}
                        >
                          <td className="max-w-0 overflow-hidden px-2 py-1">
                            <div className="flex min-w-0 items-center gap-2">
                              {item.type === "folder" ? (
                                <ContainerGlyph
                                  kind={item.folder.kind}
                                  className="h-5 w-5 shrink-0"
                                />
                              ) : item.asset.kind === "image" ||
                                item.asset.kind === "video" ? (
                                <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-[#f3f3f3]">
                                  <MediaThumb asset={item.asset} />
                                  {item.asset.kind === "video" ? (
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-[9px] text-white">
                                      ▶
                                    </span>
                                  ) : null}
                                </span>
                              ) : (
                                <FileGlyph
                                  kind={item.asset.kind}
                                  className="h-5 w-5 shrink-0"
                                />
                              )}
                              <div className="min-w-0 flex-1">{nameNode(item)}</div>
                            </div>
                          </td>
                          <td className="px-2 py-1 text-[#605e5c]">
                            {formatDate(date)}
                          </td>
                          <td className="px-2 py-1 text-[#605e5c]">
                            {typeLabel(item)}
                          </td>
                          <td className="px-2 py-1 text-[#605e5c]">
                            {item.type === "file"
                              ? formatBytes(item.asset.sizeBytes)
                              : ""}
                          </td>
                          <td className="px-2 py-1 text-right">
                            {item.type === "file" ? (
                              <span className="inline-flex items-center gap-1.5">
                                {inCarousel ? (
                                  <span className="inline-flex items-center gap-0.5">
                                    <span className="min-w-[1.1rem] text-[10px] text-[#605e5c]">
                                      {(item.asset.sortOrder ?? 0) + 1}
                                    </span>
                                    <button
                                      type="button"
                                      className="rounded px-1 text-[11px] text-[#605e5c] hover:bg-[#e5f3ff]"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void reorderCarousel(item.asset.id, -1);
                                      }}
                                    >
                                      ↑
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded px-1 text-[11px] text-[#605e5c] hover:bg-[#e5f3ff]"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void reorderCarousel(item.asset.id, 1);
                                      }}
                                    >
                                      ↓
                                    </button>
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  className="text-[11px] text-[#0078d4] hover:underline"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await navigator.clipboard.writeText(
                                        item.asset.publicUrl
                                      );
                                      setStatusMsg("URL copiada");
                                    } catch {
                                      setError("No se pudo copiar");
                                    }
                                  }}
                                >
                                  URL
                                </button>
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : viewMode === "list" ? (
            <div className="min-h-0 flex-1 overflow-auto p-2">
              {visibleRows.length === 0 ? (
                <EmptyHint inCarousel={inCarousel} search={searchQuery} />
              ) : (
                <div className="space-y-px">
                  {visibleRows.map((item) => {
                    const id =
                      item.type === "folder" ? item.folder.id : item.asset.id;
                    const isSel = isItemSelected(item);
                    const dropping =
                      item.type === "folder" && dropId === item.folder.id;
                    return (
                      <div
                        key={`${item.type}-${id}`}
                        role="button"
                        tabIndex={0}
                        {...bindItem(item)}
                        className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] ${
                          dropping
                            ? "bg-[#cce8ff] ring-1 ring-[#0078d4]"
                            : isSel
                              ? "bg-[#cce8ff]"
                              : "hover:bg-[#f3f9fd]"
                        }`}
                      >
                        {item.type === "folder" ? (
                          <ContainerGlyph kind={item.folder.kind} className="h-5 w-5" />
                        ) : item.asset.kind === "image" ||
                          item.asset.kind === "video" ? (
                          <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-[#f3f3f3]">
                            <MediaThumb asset={item.asset} />
                          </span>
                        ) : (
                          <FileGlyph kind={item.asset.kind} className="h-5 w-5" />
                        )}
                        {inCarousel && item.type === "file" ? (
                          <span className="text-[10px] text-[#605e5c]">
                            {(item.asset.sortOrder ?? 0) + 1}.
                          </span>
                        ) : null}
                        <div className="min-w-0 flex-1">{nameNode(item)}</div>
                        {item.type === "file" ? (
                          <span className="shrink-0 text-[11px] text-[#a19f9d]">
                            {formatBytes(item.asset.sizeBytes)}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {visibleRows.length === 0 ? (
                <EmptyHint inCarousel={inCarousel} search={searchQuery} />
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-2">
                  {visibleRows.map((item) => {
                    const id =
                      item.type === "folder" ? item.folder.id : item.asset.id;
                    const isSel = isItemSelected(item);
                    const dropping =
                      item.type === "folder" && dropId === item.folder.id;
                    return (
                      <div
                        key={`${item.type}-${id}`}
                        role="button"
                        tabIndex={0}
                        {...bindItem(item)}
                        className={`flex cursor-pointer flex-col items-center gap-1.5 overflow-hidden rounded-xl p-2 text-center ${
                          dropping
                            ? "bg-[#cce8ff] ring-1 ring-[#0078d4]"
                            : isSel
                              ? "bg-[#cce8ff] ring-1 ring-[#99c9ef]"
                              : "hover:bg-[#f3f9fd]"
                        }`}
                      >
                        {item.type === "folder" ? (
                          <span className="flex h-[92px] w-full items-center justify-center">
                            <ContainerGlyph
                              kind={item.folder.kind}
                              className="h-14 w-14"
                            />
                          </span>
                        ) : (
                          <span className="relative h-[92px] w-full overflow-hidden rounded-lg bg-[#f3f3f3]">
                            <MediaThumb asset={item.asset} />
                            {item.asset.kind === "video" ? (
                              <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[9px] font-semibold text-white">
                                VIDEO
                              </span>
                            ) : null}
                          </span>
                        )}
                        <div className="w-full min-w-0 overflow-hidden px-0.5 text-[11px] leading-tight">
                          {rename &&
                          rename.type === item.type &&
                          rename.id === id ? (
                            nameNode(item)
                          ) : (
                            <span
                              className="block w-full truncate text-center font-medium"
                              title={
                                item.type === "folder"
                                  ? item.folder.name
                                  : item.asset.name
                              }
                            >
                              {inCarousel && item.type === "file"
                                ? `${(item.asset.sortOrder ?? 0) + 1}. `
                                : ""}
                              {item.type === "folder"
                                ? item.folder.name
                                : item.asset.name}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

          {preview || selectedFolder ? (
            <aside
              className="z-20 flex w-full shrink-0 flex-col overflow-y-auto border-[var(--border)] bg-[#f9f9f9] p-3 max-sm:absolute max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[70%] max-sm:rounded-t-2xl max-sm:border-t max-sm:shadow-[0_-12px_32px_rgba(0,0,0,0.16)] sm:w-[280px] sm:border-l"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-start gap-2">
                <p className="min-w-0 flex-1 truncate text-[12px] font-semibold">
                  {preview?.name || selectedFolder?.name}
                </p>
                <button
                  type="button"
                  className="shrink-0 rounded-lg px-1.5 py-0.5 text-[11px] text-[#605e5c] hover:bg-white"
                  onClick={() => {
                    setPreview(null);
                    setSelected(null);
                    setSelection(new Set());
                  }}
                >
                  Cerrar
                </button>
              </div>
              {preview ? (
                <>
                  <button
                    type="button"
                    className="mb-3 overflow-hidden rounded-xl border border-[var(--border)] bg-white"
                    onClick={() => setLightbox(preview)}
                  >
                    {preview.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={preview.publicUrl}
                        alt={preview.name}
                        className="max-h-52 w-full object-contain"
                      />
                    ) : preview.kind === "video" ? (
                      <video
                        src={preview.publicUrl}
                        className="max-h-52 w-full"
                        controls
                        preload="metadata"
                      />
                    ) : (
                      <div className="flex h-28 items-center justify-center">
                        <FileGlyph kind={preview.kind} className="h-10 w-10" />
                      </div>
                    )}
                  </button>
                  <dl className="space-y-1.5 text-[11px] text-[#605e5c]">
                    <div>
                      <dt className="font-semibold text-[#201f1e]">Tipo</dt>
                      <dd>{typeLabel({ type: "file", asset: preview })}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[#201f1e]">Tamaño</dt>
                      <dd>{formatBytes(preview.sizeBytes)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[#201f1e]">Modificado</dt>
                      <dd>{formatDate(preview.createdAt)}</dd>
                    </div>
                  </dl>
                  <HashtagDetails
                    key={preview.id}
                    asset={preview}
                    onCopyMsg={(msg) => {
                      setStatusMsg(msg);
                      setError("");
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void copyUrl();
                    }}
                    className="mt-2 w-full rounded-xl border border-[var(--border-strong)] bg-white px-2 py-1.5 text-[11px] font-medium hover:bg-[#f3f3f3]"
                  >
                    Copiar URL
                  </button>
                </>
              ) : selectedFolder ? (
                <>
                  <div className="mb-3 flex h-28 items-center justify-center rounded-xl border border-[var(--border)] bg-white">
                    <ContainerGlyph
                      kind={selectedFolder.kind}
                      className="h-12 w-12"
                    />
                  </div>
                  <dl className="space-y-1.5 text-[11px] text-[#605e5c]">
                    <div>
                      <dt className="font-semibold text-[#201f1e]">Tipo</dt>
                      <dd>
                        {selectedFolder.kind === "carousel"
                          ? "Carrusel"
                          : "Carpeta"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[#201f1e]">Creada</dt>
                      <dd>{formatDate(selectedFolder.createdAt)}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => goToFolder(selectedFolder.id)}
                    className="mt-3 w-full rounded-xl border border-[var(--border-strong)] bg-white px-2 py-1.5 text-[11px] font-medium hover:bg-[#f3f3f3]"
                  >
                    Abrir
                  </button>
                </>
              ) : null}
            </aside>
          ) : null}
      </div>

      {/* Status bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 rounded-b-2xl border-t border-[var(--border)] bg-[#f3f3f3] px-3 py-1.5 text-[11px] text-[#605e5c]">
        <span>
          {selectedCount > 0
            ? `${selectedCount} seleccionado${selectedCount === 1 ? "" : "s"}`
            : [
                folderCount
                  ? `${folderCount} carpeta${folderCount === 1 ? "" : "s"}`
                  : null,
                fileCount
                  ? `${fileCount} archivo${fileCount === 1 ? "" : "s"}`
                  : itemCount === 0
                    ? "0 elementos"
                    : null,
              ]
                .filter(Boolean)
                .join(" · ")}
          {uploading && uploadNote ? ` · Subiendo ${uploadNote}` : ""}
          {statusMsg ? ` · ${statusMsg}` : ""}
        </span>
        <span className="truncate">{addressPath}</span>
      </div>
      </div>

      {ctxMenu ? (
        <div
          role="menu"
          className="fixed z-[200] min-w-[210px] overflow-hidden rounded-xl border border-[#d0d0d0] bg-white/95 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-sm"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {ctxMenu.target !== "background" ? (
            <>
              <CtxItem
                label={
                  ctxMenu.target.type === "folder" ? "Abrir" : "Vista previa"
                }
                onClick={() => {
                  const t = ctxMenu.target;
                  setCtxMenu(null);
                  if (!t || t === "background") return;
                  if (t.type === "folder") goToFolder(t.id);
                  else {
                    const asset = assets.find((a) => a.id === t.id);
                    if (asset) setLightbox(asset);
                  }
                }}
              />
              {ctxLockedFolder ? null : (
                <CtxItem
                  label="Renombrar"
                  onClick={() => {
                    setCtxMenu(null);
                    startRenameFromSelection();
                  }}
                />
              )}
              {ctxMenu.target.type === "file" ? (
                <CtxItem
                  label="Copiar URL"
                  onClick={() => {
                    setCtxMenu(null);
                    void copyUrl();
                  }}
                />
              ) : null}
              {ctxLockedFolder ? null : (
                <CtxItem
                  label="Eliminar"
                  danger
                  onClick={() => {
                    setCtxMenu(null);
                    void deleteSelected();
                  }}
                />
              )}
              <div className="my-1.5 h-px bg-[#ebebeb]" />
            </>
          ) : null}
          <CtxItem
            label="Seleccionar todo"
            onClick={() => {
              setCtxMenu(null);
              selectAllInFolder();
            }}
          />
          {inCarousel ? null : (
            <>
              <CtxItem
                label="Nueva carpeta"
                icon={<FolderGlyph className="h-3.5 w-3.5" />}
                onClick={() => {
                  setCtxMenu(null);
                  void createQuick("folder");
                }}
              />
              <CtxItem
                label="Nuevo carrusel"
                icon={<CarouselGlyph className="h-3.5 w-3.5" />}
                onClick={() => {
                  setCtxMenu(null);
                  void createQuick("carousel");
                }}
              />
            </>
          )}
          <CtxItem
            label="Subir archivo"
            icon={
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 16V5M12 5l-3.5 3.5M12 5l3.5 3.5M5 19h14"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            onClick={() => {
              setCtxMenu(null);
              fileInputRef.current?.click();
            }}
          />
        </div>
      ) : null}

      {lightbox ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/15 px-3 py-1 text-[13px] text-white hover:bg-white/25"
            onClick={() => setLightbox(null)}
          >
            Cerrar
          </button>
          <div
            className="max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            {lightbox.kind === "video" ? (
              <video
                src={lightbox.publicUrl}
                className="max-h-[90vh] max-w-[90vw] rounded-lg"
                controls
                autoPlay
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightbox.publicUrl}
                alt={lightbox.name}
                className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
              />
            )}
            <p className="mt-2 text-center text-[12px] text-white/80">
              {lightbox.name}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmptyHint({
  inCarousel,
  search,
}: {
  inCarousel?: boolean;
  search?: string;
}) {
  return (
    <p className="px-3 py-16 text-center text-[12px] text-[#a19f9d]">
      {search?.trim()
        ? "No hay coincidencias en esta carpeta."
        : inCarousel
          ? "Este carrusel está vacío. Sube fotos y ordénalas con las flechas en Detalles."
          : "Esta carpeta está vacía. Arrastra archivos aquí o usa Subir."}
    </p>
  );
}

function HashtagDetails({
  asset,
  onCopyMsg,
}: {
  asset: GalleryAsset;
  onCopyMsg: (msg: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mt-3" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="w-full rounded-xl border border-[#8a8886] bg-white px-2 py-1.5 text-[11px] font-medium hover:bg-[#f3f3f3]"
      >
        {open ? "Ocultar hashtag" : "Ver hashtag"}
      </button>
      {open ? (
        <div className="mt-2 rounded-xl border border-[var(--border)] bg-white px-2.5 py-2">
          <p className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-[#201f1e]">
            {asset.hashtag || "Sin hashtag"}
          </p>
          {asset.hashtag ? (
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await navigator.clipboard.writeText(asset.hashtag || "");
                  onCopyMsg("Hashtag copiado");
                } catch {
                  onCopyMsg("No se pudo copiar el hashtag");
                }
              }}
              className="mt-2 text-[11px] font-medium text-[#0078d4] hover:underline"
            >
              Copiar hashtag
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ToolBtn({
  label,
  onClick,
  disabled,
  danger,
  icon,
  active,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  icon?: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition disabled:opacity-40 ${
        danger
          ? "text-[#a4262c] hover:bg-[#fde7e9]"
          : active
            ? "bg-[#cce8ff] text-[#0078d4]"
            : "text-[#201f1e] hover:bg-[#e5f3ff]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function NavIconBtn({
  children,
  title,
  onClick,
  disabled,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-[13px] text-[#201f1e] hover:bg-[#e5f3ff] disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function CtxItem({
  label,
  onClick,
  danger,
  icon,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] transition ${
        danger
          ? "text-[#a4262c] hover:bg-[#fde7e9]"
          : "text-[#201f1e] hover:bg-[#e5f3ff]"
      }`}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[#605e5c]">
        {icon ?? null}
      </span>
      {label}
    </button>
  );
}
