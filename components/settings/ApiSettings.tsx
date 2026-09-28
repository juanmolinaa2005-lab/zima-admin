"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { API_PROVIDERS, type ApiProviderId } from "@/lib/apis/registry";
import { ExternalIcon } from "@/components/dashboard/icons";

type ApiStatus = {
  id: ApiProviderId;
  name: string;
  usedBy: string;
  description: string;
  portalUrl: string;
  portalLabel: string;
  connected: boolean;
  connectedAt: string | null;
  keyHint: string | null;
};

const SETTINGS_PATH: Record<ApiProviderId, string> = {
  meta: "/api/meta/settings",
  youtube: "/api/youtube/settings",
  blotato: "/api/blotato/settings",
  openai: "/api/openai/settings",
  "openai-api": "/api/openai/api-settings",
  superwall: "/api/superwall/settings",
  higgsfield: "/api/higgsfield/settings",
  replicate: "/api/replicate/settings",
  fal: "/api/fal/settings",
  claude: "/api/claude/settings",
};

export function ApiSettings() {
  const [apis, setApis] = useState<ApiStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<ApiProviderId | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [metaRedirectUri, setMetaRedirectUri] = useState("");
  const [youtubeRedirectUri, setYoutubeRedirectUri] = useState("");
  const [youtubeOrigin, setYoutubeOrigin] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [res, metaRes, ytRes] = await Promise.all([
        fetch("/api/apis/status"),
        fetch("/api/meta/settings"),
        fetch("/api/youtube/settings"),
      ]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setApis((data.apis ?? []) as ApiStatus[]);

      if (metaRes.ok) {
        const metaData = await metaRes.json();
        if (metaData.redirectUri) setMetaRedirectUri(metaData.redirectUri);
      }
      if (ytRes.ok) {
        const ytData = await ytRes.json();
        if (ytData.redirectUri) setYoutubeRedirectUri(ytData.redirectUri);
        if (ytData.origin) setYoutubeOrigin(ytData.origin);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-[var(--muted)]">
        All API keys live here. Tools show a yellow alert when one is missing.
      </p>

      {error ? (
        <div className="rounded-xl border border-[#fecaca] bg-[var(--danger-soft)] px-3 py-2 text-[13px] text-[var(--danger)]">
          {error}
        </div>
      ) : null}
      {ok ? (
        <div className="rounded-xl border border-[#bbf7d0] bg-[var(--success-soft)] px-3 py-2 text-[13px] text-[var(--success)]">
          {ok}
        </div>
      ) : null}

      {loading ? (
        <p className="py-8 text-center text-[13px] text-[var(--muted-soft)]">Loading…</p>
      ) : (
        <ul className="space-y-2.5">
          {apis.map((api) => {
            const meta = API_PROVIDERS.find((p) => p.id === api.id)!;
            const open = expanded === api.id;
            return (
              <li
                key={api.id}
                className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : api.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[var(--background)]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[12px] font-bold text-[var(--accent)]">
                    {api.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-semibold text-[var(--foreground)]">
                        {api.name}
                      </p>
                      <span
                        className={
                          api.connected
                            ? "ui-tag ui-tag-success"
                            : "ui-tag ui-tag-muted"
                        }
                      >
                        {api.connected
                          ? api.keyHint || "Connected"
                          : "Not connected"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                      {api.usedBy}
                    </p>
                  </div>
                  <span className="text-[11px] text-[var(--muted-soft)]">
                    {open ? "▴" : "▾"}
                  </span>
                </button>

                {open ? (
                  <div className="space-y-3 border-t border-[var(--border)] px-4 py-4">
                    <p className="text-[12px] leading-relaxed text-[var(--muted)]">
                      {api.description}
                    </p>
                    {api.id !== "youtube" ? (
                      <a
                        href={api.portalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:underline"
                      >
                        {api.portalLabel}
                        <ExternalIcon className="h-3 w-3" />
                      </a>
                    ) : null}

                    {api.id === "meta" && metaRedirectUri ? (
                      <div className="space-y-2">
                        <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3 py-2.5 text-[12px] leading-relaxed text-[#92400e]">
                          <p className="font-semibold">
                            Para que cualquier usuario pueda conectar Instagram
                          </p>
                          <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                            <li>
                              Dominios de la app:{" "}
                              <code className="text-[11px]">zima-admin.vercel.app</code>
                            </li>
                            <li>
                              Añadir plataforma Sitio web → URL{" "}
                              <code className="text-[11px]">
                                https://zima-admin.vercel.app
                              </code>
                            </li>
                            <li>
                              Política de privacidad:{" "}
                              <code className="text-[11px]">
                                https://zima-admin.vercel.app/privacy
                              </code>
                            </li>
                            <li>
                              Condiciones:{" "}
                              <code className="text-[11px]">
                                https://zima-admin.vercel.app/terms
                              </code>
                            </li>
                            <li>
                              Eliminación de datos:{" "}
                              <code className="text-[11px]">
                                https://zima-admin.vercel.app/data-deletion
                              </code>
                            </li>
                            <li>
                              Instagram → paso{" "}
                              <strong>4 · Inicio de sesión de empresa</strong> →
                              Configurar → pegar el redirect de abajo.{" "}
                              <em>No uses el paso 3 (webhooks)</em>: eso pide
                              token de verificación y no es el OAuth redirect.
                            </li>
                            <li>
                              En Settings → API pega el{" "}
                              <strong>Instagram App ID</strong> del panel del
                              producto (no el ID de la URL /apps/…)
                            </li>
                            <li>
                              App Review → pedir{" "}
                              <code className="text-[11px]">
                                instagram_business_basic
                              </code>
                              ,{" "}
                              <code className="text-[11px]">
                                instagram_business_content_publish
                              </code>{" "}
                              → publicar app (Live)
                            </li>
                          </ol>
                        </div>
                        <div className="rounded-xl bg-[var(--background)] px-3 py-2.5">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
                            OAuth redirect URI (paso 4 · Business login)
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="min-w-0 flex-1 break-all text-[11px] text-[var(--foreground-soft)]">
                              {metaRedirectUri}
                            </code>
                            <button
                              type="button"
                              className="text-[11px] font-semibold text-[var(--accent)]"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(
                                    metaRedirectUri
                                  );
                                  setOk("Redirect URI copied");
                                } catch {
                                  setError("Could not copy");
                                }
                              }}
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {api.id === "youtube" && youtubeRedirectUri ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          <a
                            href="https://console.cloud.google.com/apis/credentials/oauthclient"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:underline"
                          >
                            Crear Client ID + Secret
                            <ExternalIcon className="h-3 w-3" />
                          </a>
                          <a
                            href="https://console.cloud.google.com/apis/credentials"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:underline"
                          >
                            Ver Client ID y Secret existentes
                            <ExternalIcon className="h-3 w-3" />
                          </a>
                        </div>
                        <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3 py-2.5 text-[12px] leading-relaxed text-[#92400e]">
                          <p className="font-semibold">
                            Para conectar canales de YouTube (Data API v3)
                          </p>
                          <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                            <li>
                              Activa{" "}
                              <a
                                href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold underline underline-offset-2"
                              >
                                YouTube Data API v3
                              </a>
                            </li>
                            <li>
                              Configura el{" "}
                              <a
                                href="https://console.cloud.google.com/auth/overview"
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold underline underline-offset-2"
                              >
                                OAuth consent screen
                              </a>{" "}
                              (External). Añade scopes{" "}
                              <code className="text-[11px]">youtube.upload</code>{" "}
                              y{" "}
                              <code className="text-[11px]">
                                youtube.readonly
                              </code>
                            </li>
                            <li>
                              En Testing,{" "}
                              <a
                                href="https://console.cloud.google.com/auth/audience"
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold underline underline-offset-2"
                              >
                                añade testers
                              </a>
                            </li>
                            <li>
                              <a
                                href="https://console.cloud.google.com/apis/credentials/oauthclient"
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold underline underline-offset-2"
                              >
                                Create credentials → OAuth client ID
                              </a>{" "}
                              → tipo <strong>Web application</strong> (no uses
                              una API key). Ahí aparecen Client ID y Client
                              Secret.
                            </li>
                            <li>
                              Authorized JavaScript origins:{" "}
                              <code className="text-[11px]">
                                {youtubeOrigin || "https://zima-admin.vercel.app"}
                              </code>
                            </li>
                            <li>
                              Authorized redirect URIs: pega el redirect de
                              abajo
                            </li>
                            <li>
                              Pega Client ID + Client Secret aquí, luego en
                              Redes → YouTube → Connect
                            </li>
                          </ol>
                        </div>
                        <div className="rounded-xl bg-[var(--background)] px-3 py-2.5">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
                            OAuth redirect URI
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="min-w-0 flex-1 break-all text-[11px] text-[var(--foreground-soft)]">
                              {youtubeRedirectUri}
                            </code>
                            <button
                              type="button"
                              className="text-[11px] font-semibold text-[var(--accent)]"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(
                                    youtubeRedirectUri
                                  );
                                  setOk("Redirect URI copied");
                                } catch {
                                  setError("Could not copy");
                                }
                              }}
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <ProviderForm
                      id={api.id}
                      fields={meta.fields}
                      placeholder={meta.placeholder}
                      keyIdPlaceholder={meta.keyIdPlaceholder}
                      keySecretPlaceholder={meta.keySecretPlaceholder}
                      connected={api.connected}
                      settingsPath={SETTINGS_PATH[api.id]}
                      onDone={async (msg) => {
                        setOk(msg);
                        setError("");
                        await load();
                      }}
                      onError={(msg) => {
                        setError(msg);
                        setOk("");
                      }}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ProviderForm({
  id,
  fields,
  placeholder,
  keyIdPlaceholder,
  keySecretPlaceholder,
  connected,
  settingsPath,
  onDone,
  onError,
}: {
  id: ApiProviderId;
  fields: ("apiKey" | "keyId" | "keySecret")[];
  placeholder?: string;
  keyIdPlaceholder?: string;
  keySecretPlaceholder?: string;
  connected: boolean;
  settingsPath: string;
  onDone: (msg: string) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError("");
    try {
      let body: Record<string, string> = {};
      if (id === "higgsfield" || id === "meta" || id === "youtube") {
        body = { keyId, keySecret };
      } else {
        body = { apiKey };
      }
      const res = await fetch(settingsPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setApiKey("");
      setKeyId("");
      setKeySecret("");
      await onDone(
        id === "meta"
          ? "Meta connected."
          : id === "youtube"
            ? "YouTube connected."
            : `${id} connected.`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect and remove this API key?")) return;
    setBusy(true);
    try {
      const res = await fetch(settingsPath, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await onDone(`${id} disconnected.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-2.5">
      {fields.includes("apiKey") ? (
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={placeholder || "API key"}
          required={!connected}
          className="ui-input font-mono text-[12px]"
        />
      ) : null}
      {fields.includes("keyId") ? (
        <input
          value={keyId}
          onChange={(e) => setKeyId(e.target.value)}
          placeholder={keyIdPlaceholder || "Key ID"}
          required={id === "meta" || id === "youtube" ? true : !connected}
          className="ui-input font-mono text-[12px]"
        />
      ) : null}
      {fields.includes("keySecret") ? (
        <input
          type="password"
          value={keySecret}
          onChange={(e) => setKeySecret(e.target.value)}
          placeholder={
            connected
              ? `${keySecretPlaceholder || "Key Secret"} (leave blank to keep)`
              : keySecretPlaceholder || "Key Secret"
          }
          required={!connected}
          className="ui-input font-mono text-[12px]"
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="ui-btn-primary !py-2 text-[12px]"
        >
          {busy ? "Saving…" : connected ? "Update" : "Connect"}
        </button>
        {connected ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void disconnect()}
            className="rounded-lg px-3 py-2 text-[12px] font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)]"
          >
            Disconnect
          </button>
        ) : null}
      </div>
    </form>
  );
}
