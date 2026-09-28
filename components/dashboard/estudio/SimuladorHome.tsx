"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CloseIcon, PlusIcon, TrashIcon } from "../icons";
import { StudioPage } from "./studio-ui";
import {
  classifyAppUrl,
  faviconForUrl,
  hostnameFromUrl,
  loadSimulator,
  newSimulatorId,
  normalizeHttpUrl,
  saveSimulator,
  type SimulatorApp,
  type SimulatorAppKind,
  type SimulatorPlatform,
} from "@/lib/creator/simulator";

type OpenView =
  | { kind: "home" }
  | { kind: "browser" }
  | { kind: "app"; id: string };

const KIND_LABEL: Record<SimulatorAppKind, string> = {
  web: "Web",
  store: "Store",
  native: "Nativa",
};

function clockNow() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

async function fileToIcon(file: File): Promise<string> {
  const raw = await file.arrayBuffer();
  const blob = new Blob([raw], { type: file.type || "image/png" });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("icon"));
      el.src = objectUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(img, 0, 0, 128, 128);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function SimuladorHome({ projectId }: { projectId: string }) {
  const [platform, setPlatform] = useState<SimulatorPlatform>("ios");
  const [apps, setApps] = useState<SimulatorApp[]>([]);
  const [open, setOpen] = useState<OpenView>({ kind: "home" });
  const [sheet, setSheet] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [icon, setIcon] = useState("");
  const [kind, setKind] = useState<SimulatorAppKind>("web");
  const [both, setBoth] = useState(true);
  const [looking, setLooking] = useState(false);
  const [quickUrl, setQuickUrl] = useState("");
  const [browserUrl, setBrowserUrl] = useState("");
  const [browserGo, setBrowserGo] = useState("");
  const [time, setTime] = useState(clockNow);
  const skipSave = useRef(true);

  useEffect(() => {
    const saved = loadSimulator(projectId);
    setPlatform(saved.platform);
    setApps(saved.apps);
    setQuickUrl(saved.lastUrl);
    setBrowserUrl(saved.lastUrl);
    setBrowserGo(saved.lastUrl);
    setOpen({ kind: "home" });
    skipSave.current = true;
  }, [projectId]);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    saveSimulator(projectId, {
      platform,
      apps,
      lastUrl: browserGo || quickUrl,
    });
  }, [projectId, platform, apps, browserGo, quickUrl]);

  useEffect(() => {
    const id = window.setInterval(() => setTime(clockNow()), 20_000);
    return () => window.clearInterval(id);
  }, []);

  const visible = useMemo(
    () => apps.filter((app) => app.platforms.includes(platform)),
    [apps, platform]
  );

  const activeApp =
    open.kind === "app" ? apps.find((app) => app.id === open.id) ?? null : null;

  function openInPhone(raw = quickUrl) {
    const href = raw.startsWith("data:") ? raw : normalizeHttpUrl(raw);
    if (!href) {
      setOpen({ kind: "browser" });
      return;
    }
    setQuickUrl(href);
    setBrowserUrl(href);
    setBrowserGo(href);
    setOpen({ kind: "browser" });
  }

  function resetSheet() {
    setSheet(false);
    setEditId(null);
    setName("");
    setUrl("");
    setIcon("");
    setKind("web");
    setBoth(true);
  }

  function startInstall(presetUrl = browserGo || quickUrl) {
    const href = presetUrl.startsWith("data:") ? "" : presetUrl;
    setEditId(null);
    setUrl(href);
    setName(hostnameFromUrl(href) || "");
    setIcon(href ? faviconForUrl(href) : "");
    setKind(href ? classifyAppUrl(href) : "web");
    setBoth(true);
    setSheet(true);
  }

  function startEdit(app: SimulatorApp) {
    setEditId(app.id);
    setName(app.name);
    setUrl(app.url);
    setIcon(app.icon);
    setKind(app.kind);
    setBoth(app.platforms.length === 2);
    setSheet(true);
  }

  async function lookup() {
    const href = normalizeHttpUrl(url);
    if (!href) return;
    setUrl(href);
    setLooking(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/creator/simulator/lookup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: href }),
        }
      );
      const data = (await res.json()) as {
        title?: string;
        icon?: string;
        kind?: SimulatorAppKind;
      };
      if (!res.ok) {
        setName((prev) => prev || hostnameFromUrl(href));
        setIcon((prev) => prev || faviconForUrl(href));
        setKind(classifyAppUrl(href));
        return;
      }
      setName((prev) => prev || data.title || hostnameFromUrl(href));
      setIcon(data.icon || faviconForUrl(href));
      setKind(data.kind || classifyAppUrl(href));
    } catch {
      setName((prev) => prev || hostnameFromUrl(href));
      setIcon((prev) => prev || faviconForUrl(href));
    } finally {
      setLooking(false);
    }
  }

  async function onIconFile(file: File | undefined) {
    if (!file) return;
    if (file.name.match(/\.(apk|ipa|aab)$/i)) {
      setKind("native");
      setName((prev) => prev || file.name.replace(/\.(apk|ipa|aab)$/i, ""));
      return;
    }
    if (
      file.type.startsWith("image/") ||
      file.name.match(/\.(png|jpe?g|webp|icns|ico)$/i)
    ) {
      setIcon(await fileToIcon(file));
      return;
    }
    if (file.type.includes("html") || file.name.endsWith(".html")) {
      const text = await file.text();
      const href = `data:text/html;charset=utf-8,${encodeURIComponent(text.slice(0, 400_000))}`;
      setUrl(href);
      setKind("web");
      setName((prev) => prev || file.name.replace(/\.html$/i, ""));
    }
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    const href = url.startsWith("data:") ? url : normalizeHttpUrl(url);
    const title = name.trim() || hostnameFromUrl(href) || "App";
    const next: SimulatorApp = {
      id: editId || newSimulatorId(),
      name: title,
      url: href,
      icon: icon || faviconForUrl(href),
      platforms: both ? ["ios", "android"] : [platform],
      kind: href ? kind : "native",
      createdAt: new Date().toISOString(),
    };
    setApps((prev) => {
      const exists = prev.some((app) => app.id === next.id);
      return exists
        ? prev.map((app) =>
            app.id === next.id ? { ...next, createdAt: app.createdAt } : app
          )
        : [next, ...prev];
    });
    resetSheet();
    setOpen({ kind: "home" });
  }

  function uninstall(id: string) {
    const app = apps.find((item) => item.id === id);
    if (!app) return;
    if (!window.confirm(`Desinstalar “${app.name}”?`)) return;
    setApps((prev) => prev.filter((item) => item.id !== id));
    if (open.kind === "app" && open.id === id) setOpen({ kind: "home" });
  }

  function goHome() {
    setOpen({ kind: "home" });
  }

  const ios = platform === "ios";

  return (
    <StudioPage
      kicker="Studio"
      title="Simulador"
      description="iPhone o Android listo para usar. Instala una web y ábrela en el teléfono."
    >
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <PlatformChip
          label="iPhone"
          active={ios}
          onClick={() => {
            setPlatform("ios");
            setOpen({ kind: "home" });
          }}
        />
        <PlatformChip
          label="Android"
          active={!ios}
          onClick={() => {
            setPlatform("android");
            setOpen({ kind: "home" });
          }}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            openInPhone();
          }}
          className="flex min-w-[220px] flex-1 items-center gap-2"
        >
          <input
            value={quickUrl.startsWith("data:") ? "" : quickUrl}
            onChange={(e) => setQuickUrl(e.target.value)}
            placeholder="URL para abrir en el teléfono"
            className="ui-input !h-9"
          />
          <button type="submit" className="ui-btn-secondary !h-9">
            Abrir
          </button>
        </form>
        <button type="button" onClick={() => startInstall()} className="ui-btn-primary">
          <PlusIcon className="h-4 w-4" />
          Instalar app
        </button>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex justify-center py-2">
          {ios ? (
            <IPhoneFrame time={time} onHome={goHome}>
              <PhoneBody
                ios
                open={open}
                apps={visible}
                activeApp={activeApp}
                browserUrl={browserUrl}
                browserGo={browserGo}
                onBrowserUrl={setBrowserUrl}
                onOpenApp={(id) => setOpen({ kind: "app", id })}
                onBrowser={() => openInPhone(browserGo || quickUrl || "https://")}
                onGoBrowser={() => openInPhone(browserUrl)}
                onInstall={() => startInstall()}
                onUninstall={uninstall}
                onEdit={startEdit}
              />
            </IPhoneFrame>
          ) : (
            <AndroidFrame time={time} onHome={goHome}>
              <PhoneBody
                ios={false}
                open={open}
                apps={visible}
                activeApp={activeApp}
                browserUrl={browserUrl}
                browserGo={browserGo}
                onBrowserUrl={setBrowserUrl}
                onOpenApp={(id) => setOpen({ kind: "app", id })}
                onBrowser={() => openInPhone(browserGo || quickUrl || "https://")}
                onGoBrowser={() => openInPhone(browserUrl)}
                onInstall={() => startInstall()}
                onUninstall={uninstall}
                onEdit={startEdit}
              />
            </AndroidFrame>
          )}
        </div>

        <aside className="space-y-3">
          <div className="studio-card">
            <p className="text-[13px] font-semibold text-[var(--foreground)]">
              {ios ? "iPhone 15 Pro" : "Pixel 8"} · {visible.length}{" "}
              {visible.length === 1 ? "app" : "apps"}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
              Pega una URL, Expo o preview. Queda en el inicio como una app.
            </p>
          </div>
          {visible.length === 0 ? (
            <div className="studio-empty text-[13px]">
              Aún no hay apps instaladas.
            </div>
          ) : (
            <ul className="space-y-2">
              {visible.map((app) => (
                <li
                  key={app.id}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
                >
                  <AppGlyph src={app.icon} name={app.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">
                      {app.name}
                    </p>
                    <p className="truncate text-[11px] text-[var(--muted-soft)]">
                      {KIND_LABEL[app.kind]}
                      {app.url ? ` · ${hostnameFromUrl(app.url) || "archivo"}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen({ kind: "app", id: app.id })}
                    className="rounded-full px-2 py-1 text-[11px] font-semibold text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
                  >
                    Abrir
                  </button>
                  <button
                    type="button"
                    onClick={() => uninstall(app.id)}
                    className="rounded-xl p-1.5 text-[var(--muted-soft)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                    aria-label={`Desinstalar ${app.name}`}
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {sheet ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-[#0a2540]/45 backdrop-blur-[2px]"
            aria-label="Cerrar"
            onClick={resetSheet}
          />
          <form
            onSubmit={handleSave}
            className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-[0_16px_48px_rgba(15,23,42,0.18)]"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[15px] font-semibold text-[var(--foreground)]">
                  {editId ? "Editar app" : "Instalar app"}
                </p>
                <p className="mt-1 text-[12px] text-[var(--muted)]">
                  Se instala en el {ios ? "iPhone" : "Android"}.
                </p>
              </div>
              <button
                type="button"
                onClick={resetSheet}
                className="rounded-full p-2 text-[var(--muted)] hover:bg-[var(--surface-alt)]"
                aria-label="Cerrar"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <label className="mb-3 block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                URL
              </span>
              <div className="flex gap-2">
                <input
                  value={url.startsWith("data:") ? "" : url}
                  onChange={(e) => setUrl(e.target.value)}
                  onBlur={() => {
                    if (url && !url.startsWith("data:")) void lookup();
                  }}
                  placeholder="https://app.com, Expo, App Store…"
                  className="ui-input"
                />
                <button
                  type="button"
                  onClick={() => void lookup()}
                  className="ui-btn-secondary shrink-0"
                  disabled={looking}
                >
                  {looking ? "…" : "Leer"}
                </button>
              </div>
            </label>

            <label className="mb-3 block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Nombre
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la app"
                className="ui-input"
              />
            </label>

            <div className="mb-3 flex items-center gap-3">
              <AppGlyph src={icon} name={name || "App"} large />
              <label className="min-w-0 flex-1 text-[12px] text-[var(--muted)]">
                Icono o archivo (.html, .ipa, .apk)
                <input
                  type="file"
                  accept="image/*,.html,.ipa,.apk,.aab"
                  className="mt-1 block w-full text-[12px]"
                  onChange={(e) => void onIconFile(e.target.files?.[0])}
                />
              </label>
            </div>

            <label className="mb-4 flex items-center gap-2 text-[13px] text-[var(--foreground-soft)]">
              <input
                type="checkbox"
                checked={both}
                onChange={(e) => setBoth(e.target.checked)}
              />
              Instalar en iPhone y Android
            </label>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetSheet} className="ui-btn-secondary">
                Cancelar
              </button>
              <button type="submit" className="ui-btn-primary">
                {editId ? "Guardar" : "Instalar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </StudioPage>
  );
}

function IPhoneFrame({
  time,
  onHome,
  children,
}: {
  time: string;
  onHome: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative w-[min(100%,360px)]">
      <div className="pointer-events-none absolute -right-[3px] top-[120px] h-16 w-[3px] rounded-r-sm bg-[#3f3f46]" />
      <div className="pointer-events-none absolute -right-[3px] top-[196px] h-16 w-[3px] rounded-r-sm bg-[#3f3f46]" />
      <div className="pointer-events-none absolute -left-[3px] top-[160px] h-10 w-[3px] rounded-l-sm bg-[#3f3f46]" />
      <div className="relative aspect-[393/852] overflow-hidden rounded-[48px] border-[11px] border-[#1c1c1e] bg-black shadow-[0_30px_80px_rgba(15,23,42,0.35),inset_0_0_0_2px_#3f3f46]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,#7c3aed_0%,transparent_40%),radial-gradient(circle_at_92%_18%,#38bdf8_0%,transparent_34%),linear-gradient(180deg,#1e1b4b_0%,#0f172a_58%,#082f49_100%)]" />
        <div className="relative z-10 flex items-center justify-between px-7 pt-[14px] text-[12px] font-semibold text-white">
          <span className="w-12">{time}</span>
          <span className="absolute left-1/2 top-[10px] h-[26px] w-[108px] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" />
          <span className="flex items-center gap-1.5">
            <SignalIos />
            <BatteryIos />
          </span>
        </div>
        <div className="absolute inset-0 top-[46px] bottom-[18px] overflow-hidden">
          {children}
        </div>
        <button
          type="button"
          onClick={onHome}
          className="absolute bottom-[7px] left-1/2 z-20 h-[5px] w-[128px] -translate-x-1/2 rounded-full bg-white/90"
          aria-label="Inicio"
        />
      </div>
    </div>
  );
}

function AndroidFrame({
  time,
  onHome,
  children,
}: {
  time: string;
  onHome: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative w-[min(100%,360px)]">
      <div className="pointer-events-none absolute -right-[3px] top-[140px] h-14 w-[3px] rounded-r-sm bg-[#27272a]" />
      <div className="relative aspect-[412/915] overflow-hidden rounded-[34px] border-[10px] border-[#111113] bg-black shadow-[0_30px_80px_rgba(15,23,42,0.35),inset_0_0_0_1px_#3f3f46]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_8%,#2dd4bf_0%,transparent_34%),linear-gradient(180deg,#042f2e_0%,#0f172a_50%,#134e4a_100%)]" />
        <div className="relative z-10 flex items-center justify-between px-5 pt-2.5 text-[11px] font-medium text-white">
          <span>{time}</span>
          <span className="absolute left-1/2 top-[9px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-black ring-[3px] ring-black/40" />
          <span className="flex items-center gap-1.5">
            <SignalIos />
            <span className="h-2.5 w-4 rounded-[2px] border border-white/80">
              <span className="ml-auto mr-px mt-px block h-1.5 w-2.5 rounded-[1px] bg-white" />
            </span>
          </span>
        </div>
        <div className="absolute inset-0 top-[36px] bottom-[16px] overflow-hidden">
          {children}
        </div>
        <div className="absolute bottom-1.5 left-0 right-0 z-20 flex items-center justify-center gap-10">
          <button
            type="button"
            onClick={onHome}
            className="h-[5px] w-[108px] rounded-full bg-white/75"
            aria-label="Inicio"
          />
        </div>
      </div>
    </div>
  );
}

function PhoneBody({
  ios,
  open,
  apps,
  activeApp,
  browserUrl,
  browserGo,
  onBrowserUrl,
  onOpenApp,
  onBrowser,
  onGoBrowser,
  onInstall,
  onUninstall,
  onEdit,
}: {
  ios: boolean;
  open: OpenView;
  apps: SimulatorApp[];
  activeApp: SimulatorApp | null;
  browserUrl: string;
  browserGo: string;
  onBrowserUrl: (value: string) => void;
  onOpenApp: (id: string) => void;
  onBrowser: () => void;
  onGoBrowser: () => void;
  onInstall: () => void;
  onUninstall: (id: string) => void;
  onEdit: (app: SimulatorApp) => void;
}) {
  if (open.kind === "browser") {
    return (
      <BrowserPane
        ios={ios}
        value={browserUrl}
        src={browserGo}
        onChange={onBrowserUrl}
        onSubmit={onGoBrowser}
        onInstall={onInstall}
      />
    );
  }
  if (activeApp) return <AppPane app={activeApp} />;
  return (
    <HomeScreen
      ios={ios}
      apps={apps}
      onOpen={onOpenApp}
      onBrowser={onBrowser}
      onInstall={onInstall}
      onUninstall={onUninstall}
      onEdit={onEdit}
    />
  );
}

function HomeScreen({
  ios,
  apps,
  onOpen,
  onBrowser,
  onInstall,
  onUninstall,
  onEdit,
}: {
  ios: boolean;
  apps: SimulatorApp[];
  onOpen: (id: string) => void;
  onBrowser: () => void;
  onInstall: () => void;
  onUninstall: (id: string) => void;
  onEdit: (app: SimulatorApp) => void;
}) {
  return (
    <div className="flex h-full flex-col px-5 pt-5 pb-1">
      <div className="grid grid-cols-4 gap-x-3 gap-y-5">
        {apps.map((app) => (
          <HomeIcon
            key={app.id}
            name={app.name}
            icon={app.icon}
            ios={ios}
            onOpen={() => onOpen(app.id)}
            onDelete={() => onUninstall(app.id)}
            onEdit={() => onEdit(app)}
          />
        ))}
        <HomeIcon name="Instalar" plus ios={ios} onOpen={onInstall} />
      </div>
      <div
        className={`mt-auto mb-2 px-2 py-2.5 ${
          ios
            ? "rounded-[30px] bg-white/22 backdrop-blur-xl"
            : "rounded-xl bg-black/25 backdrop-blur-md"
        }`}
      >
        <div className="grid grid-cols-4">
          <DockIcon
            label={ios ? "Safari" : "Chrome"}
            color={ios ? "from-[#5ac8fa] to-[#007aff]" : "from-[#fbbc05] to-[#ea4335]"}
            onClick={onBrowser}
          />
          <DockIcon label="Phone" color="from-[#32d74b] to-[#248a3d]" onClick={onBrowser} />
          <DockIcon label="Store" color="from-[#5e5ce6] to-[#3634a3]" onClick={onInstall} />
          <DockIcon label="+" color="from-[#d1d5db] to-[#6b7280]" onClick={onInstall} />
        </div>
      </div>
    </div>
  );
}

function HomeIcon({
  name,
  icon,
  plus,
  ios,
  onOpen,
  onDelete,
  onEdit,
}: {
  name: string;
  icon?: string;
  plus?: boolean;
  ios: boolean;
  onOpen: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="group relative text-center">
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className="absolute -left-1 -top-1 z-10 hidden h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-white group-hover:flex"
          aria-label={`Desinstalar ${name}`}
        >
          <TrashIcon className="h-2.5 w-2.5" />
        </button>
      ) : null}
      <button type="button" onClick={onOpen} onDoubleClick={onEdit} className="w-full">
        <span
          className={`mx-auto flex h-[58px] w-[58px] items-center justify-center overflow-hidden shadow-[0_8px_18px_rgba(0,0,0,0.22)] ${
            ios ? "rounded-[14px]" : "rounded-[16px]"
          } ${plus ? "border border-dashed border-white/55 bg-white/12" : "bg-white"}`}
        >
          {plus ? (
            <PlusIcon className="h-5 w-5 text-white" />
          ) : icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[16px] font-bold text-[var(--foreground)]">
              {name.slice(0, 1)}
            </span>
          )}
        </span>
        <span className="mt-1 block truncate text-[10px] font-medium text-white drop-shadow">
          {name}
        </span>
      </button>
    </div>
  );
}

function DockIcon({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="text-center">
      <span
        className={`mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-gradient-to-br ${color} text-[16px] font-bold text-white shadow-[0_6px_14px_rgba(0,0,0,0.2)]`}
      >
        {label === "+" ? "+" : label.slice(0, 1)}
      </span>
    </button>
  );
}

function BrowserPane({
  ios,
  value,
  src,
  onChange,
  onSubmit,
  onInstall,
}: {
  ios: boolean;
  value: string;
  src: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onInstall: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-[#f2f2f7]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex items-center gap-2 bg-white/90 px-3 pb-2 pt-1 shadow-[0_1px_0_rgba(0,0,0,0.06)]"
      >
        <input
          value={value.startsWith("data:") ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 min-w-0 flex-1 rounded-full bg-[#e5e5ea] px-3 text-[12px] text-[var(--foreground)] outline-none"
          placeholder={ios ? "Buscar o URL" : "Buscar o escribir URL"}
        />
        <button type="submit" className="text-[11px] font-semibold text-[#007aff]">
          Ir
        </button>
        <button type="button" onClick={onInstall} className="text-[11px] font-semibold text-[#007aff]">
          Instalar
        </button>
      </form>
      {src ? (
        <iframe
          title="Safari"
          src={src}
          className="min-h-0 flex-1 border-0 bg-white"
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center px-8 text-center text-[13px] text-[var(--muted)]">
          Escribe una URL para abrirla en el teléfono.
        </div>
      )}
    </div>
  );
}

function AppPane({ app }: { app: SimulatorApp }) {
  if (!app.url || app.kind === "native") {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-black px-6 text-center text-white">
        <AppGlyph src={app.icon} name={app.name} large />
        <p className="mt-3 text-[17px] font-semibold">{app.name}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-white/60">
          {app.kind === "native"
            ? "Añade la URL web o el preview para abrirla en este teléfono."
            : "Esta app no tiene URL."}
        </p>
      </div>
    );
  }

  return (
    <iframe
      title={app.name}
      src={app.url}
      className="h-full w-full border-0 bg-white"
      sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"
    />
  );
}

function PlatformChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${
        active ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-alt)] text-[var(--muted)]"
      }`}
    >
      {label}
    </button>
  );
}

function AppGlyph({
  src,
  name,
  large,
}: {
  src: string;
  name: string;
  large?: boolean;
}) {
  const size = large ? "h-12 w-12 rounded-[14px]" : "h-9 w-9 rounded-[10px]";
  const letter = name.trim().slice(0, 1).toUpperCase() || "A";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={`${size} shrink-0 bg-[var(--surface-alt)] object-cover`} />
    );
  }
  return (
    <span
      className={`${size} flex shrink-0 items-center justify-center bg-[var(--accent)] text-[13px] font-bold text-white`
      }
    >
      {letter}
    </span>
  );
}

function SignalIos() {
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" fill="none" aria-hidden>
      <rect x="0" y="6" width="2.2" height="4" rx="0.5" fill="white" />
      <rect x="3.6" y="4.2" width="2.2" height="5.8" rx="0.5" fill="white" />
      <rect x="7.2" y="2.2" width="2.2" height="7.8" rx="0.5" fill="white" />
      <rect x="10.8" y="0" width="2.2" height="10" rx="0.5" fill="white" opacity="0.45" />
    </svg>
  );
}

function BatteryIos() {
  return (
    <svg width="24" height="11" viewBox="0 0 24 11" fill="none" aria-hidden>
      <rect x="0.5" y="0.5" width="20" height="10" rx="2.2" stroke="white" />
      <rect x="2" y="2" width="14" height="7" rx="1.2" fill="white" />
      <path d="M21.5 3.6h1.2A1.3 1.3 0 0 1 24 4.9v1.2a1.3 1.3 0 0 1-1.3 1.3H21.5" fill="white" opacity="0.45" />
    </svg>
  );
}
