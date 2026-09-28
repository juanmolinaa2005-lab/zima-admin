"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AllAccountsView } from "./AllAccountsView";
import { AccountAvatar } from "./AccountAvatar";
import { ApiMissingBanner } from "./ApiMissingBanner";
import { InspirationView } from "./InspirationView";
import { resolveSocialAvatar } from "@/lib/redes/avatar";

type NetworkId = "tiktok" | "instagram" | "youtube";

type BlotatoAccount = {
  id: string;
  platform: string;
  nickname: string | null;
  username: string | null;
  avatarUrl?: string | null;
};

type NativeAccount = {
  id: string;
  platform: string;
  displayName: string | null;
  username: string | null;
  status: string;
  avatarUrl?: string | null;
};

type Privacy =
  | "PUBLIC_TO_EVERYONE"
  | "SELF_ONLY"
  | "MUTUAL_FOLLOW_FRIENDS"
  | "FOLLOWER_OF_CREATOR";

type YoutubePrivacy = "public" | "unlisted" | "private";

const NETWORKS: {
  id: NetworkId;
  label: string;
  color: string;
  provider: "blotato" | "meta" | "youtube";
}[] = [
  { id: "tiktok", label: "TikTok", color: "#111827", provider: "blotato" },
  {
    id: "instagram",
    label: "Instagram",
    color: "#e1306c",
    provider: "meta",
  },
  { id: "youtube", label: "YouTube", color: "#ff0000", provider: "youtube" },
];

/** Meta App Roles — add Testers while the app is in Development mode. */
const META_APP_ROLES_URL =
  "https://developers.facebook.com/apps/1611683454035249/roles/roles/";

/** Google Auth Platform — add OAuth test users while the app is in Testing. */
const GOOGLE_TESTERS_URL = "https://console.cloud.google.com/auth/audience";

function blotatoLabel(a: BlotatoAccount) {
  return a.nickname || (a.username ? `@${a.username}` : `Account ${a.id}`);
}

function nativeLabel(a: NativeAccount) {
  return (
    a.displayName ||
    (a.username ? `@${a.username}` : `Account ${a.id.slice(0, 6)}`)
  );
}

function NetworkIcon({ id }: { id: NetworkId }) {
  if (id === "tiktok") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M16.5 3c.4 2.2 1.8 3.8 4 4.3v2.4c-1.4-.1-2.7-.6-3.8-1.4v6.6c0 3.4-2.7 6.1-6.1 6.1S4.5 18.3 4.5 14.9 7.2 8.8 10.6 8.8c.3 0 .7 0 1 .1v2.5c-.3-.1-.6-.1-1-.1-2 0-3.6 1.6-3.6 3.6s1.6 3.6 3.6 3.6 3.6-1.6 3.6-3.6V3h2.3Z" />
      </svg>
    );
  }
  if (id === "instagram") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect
          x="3.5"
          y="3.5"
          width="17"
          height="17"
          rx="5"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M22 7.5s-.2-1.6-.8-2.3c-.8-.8-1.7-.8-2.1-.9C16.4 4 12 4 12 4h0s-4.4 0-7.1.3c-.4.1-1.3.1-2.1.9C2.2 5.9 2 7.5 2 7.5S1.8 9.4 1.8 11.2v1.6c0 1.9.2 3.7.2 3.7s.2 1.6.8 2.3c.8.8 1.9.8 2.4.9 1.7.2 7 .3 7 .3s4.4 0 7.1-.3c.4-.1 1.3-.1 2.1-.9.6-.7.8-2.3.8-2.3s.2-1.9.2-3.7v-1.6c0-1.8-.2-3.7-.2-3.7ZM9.8 14.8V8.9l5.9 3-5.9 2.9Z" />
    </svg>
  );
}

export function RedesView({
  projectId,
  onOpenGallery,
}: {
  projectId: string;
  onOpenGallery?: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [blotatoConnected, setBlotatoConnected] = useState(false);
  const [blotatoAccounts, setBlotatoAccounts] = useState<BlotatoAccount[]>([]);
  const [igAccounts, setIgAccounts] = useState<NativeAccount[]>([]);
  const [ytAccounts, setYtAccounts] = useState<NativeAccount[]>([]);
  const [igAppConfigured, setIgAppConfigured] = useState(false);
  const [ytAppConfigured, setYtAppConfigured] = useState(false);
  const [accessTokenInput, setAccessTokenInput] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [network, setNetwork] = useState<NetworkId>("tiktok");
  const [accountId, setAccountId] = useState("");
  const [hoverNet, setHoverNet] = useState<NetworkId | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState<Privacy>("PUBLIC_TO_EVERYONE");
  const [youtubePrivacy, setYoutubePrivacy] =
    useState<YoutubePrivacy>("public");
  const [publishing, setPublishing] = useState(false);
  /** Dedicated Meta connect page (opened from Instagram hover → Connect). */
  const [igSetupOpen, setIgSetupOpen] = useState(false);
  const [ytSetupOpen, setYtSetupOpen] = useState(false);
  const [allAccountsOpen, setAllAccountsOpen] = useState(false);
  const [inspirationOpen, setInspirationOpen] = useState(false);

  const isInstagram = network === "instagram";
  const isYouTube = network === "youtube";
  const isNative = isInstagram || isYouTube;
  const showIgSetup = isInstagram && igSetupOpen && !allAccountsOpen && !inspirationOpen;
  const showYtSetup = isYouTube && ytSetupOpen && !allAccountsOpen && !inspirationOpen;
  const showNativeSetup = showIgSetup || showYtSetup;

  const loadBlotato = useCallback(async () => {
    const st = await fetch("/api/blotato/settings");
    const stData = await st.json();
    if (!st.ok) throw new Error(stData.error || "Failed to load Blotato");
    const isConnected = Boolean(stData.connected);
    setBlotatoConnected(isConnected);
    if (!isConnected) {
      setBlotatoAccounts([]);
      return;
    }
    const res = await fetch("/api/blotato/accounts");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load accounts");
    const list = ((data.accounts ?? []) as BlotatoAccount[]).filter(
      (a) => a.platform === "tiktok"
    );
    setBlotatoAccounts(list);
  }, []);

  const loadNative = useCallback(async () => {
    const [metaRes, ytRes, accRes] = await Promise.all([
      fetch("/api/meta/settings"),
      fetch("/api/youtube/settings"),
      fetch(`/api/projects/${projectId}/redes/accounts`),
    ]);
    const metaData = await metaRes.json();
    const ytData = await ytRes.json();
    const accData = await accRes.json();
    if (!metaRes.ok) throw new Error(metaData.error || "Failed to load Meta");
    if (!ytRes.ok) throw new Error(ytData.error || "Failed to load YouTube");
    if (!accRes.ok) throw new Error(accData.error || "Failed to load accounts");

    setIgAppConfigured(Boolean(metaData.connected));
    setYtAppConfigured(Boolean(ytData.connected));

    const list = (accData.accounts ?? []) as NativeAccount[];
    setIgAccounts(
      list.filter((a) => a.platform === "instagram" && a.status === "active")
    );
    setYtAccounts(
      list.filter((a) => a.platform === "youtube" && a.status === "active")
    );
  }, [projectId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadBlotato(), loadNative()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [loadBlotato, loadNative]);

  useEffect(() => {
    void load();
  }, [load]);

  // Surface OAuth errors returned via ?oauth_error=
  useEffect(() => {
    const oauthError = searchParams.get("oauth_error");
    if (!oauthError) return;
    const oauthPlatform = searchParams.get("oauth_platform");
    if (oauthPlatform === "youtube") {
      setNetwork("youtube");
      setYtSetupOpen(true);
    } else {
      setNetwork("instagram");
      setIgSetupOpen(true);
    }
    setError(oauthError);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("oauth_error");
    params.delete("oauth_platform");
    const next = params.toString();
    router.replace(next ? `?${next}` : "?", { scroll: false });
  }, [searchParams, router]);

  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      const data = ev.data as {
        type?: string;
        ok?: boolean;
        message?: string;
        platform?: string;
      } | null;
      if (data?.type === "zima-redes-oauth") {
        void loadNative().then(() => {
          if (data.ok) {
            if (data.platform === "youtube") {
              setOk("YouTube connected.");
              setYtSetupOpen(false);
              setNetwork("youtube");
            } else {
              setOk("Instagram connected via Meta.");
              setIgSetupOpen(false);
              setNetwork("instagram");
            }
          } else
            setError(
              data.message || "OAuth did not complete."
            );
        });
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [loadNative]);

  const byNetwork = useMemo(() => {
    const map: Record<
      NetworkId,
      { id: string; label: string; username?: string | null; avatarUrl?: string | null }[]
    > = {
      tiktok: [],
      instagram: [],
      youtube: [],
    };
    for (const a of blotatoAccounts) {
      if (a.platform === "tiktok") {
        map.tiktok.push({
          id: a.id,
          label: blotatoLabel(a),
          username: a.username,
          avatarUrl: resolveSocialAvatar({
            platform: "tiktok",
            username: a.username,
            avatarUrl: a.avatarUrl,
          }),
        });
      }
    }
    for (const a of igAccounts) {
      map.instagram.push({
        id: a.id,
        label: nativeLabel(a),
        username: a.username,
        avatarUrl: resolveSocialAvatar({
          platform: "instagram",
          username: a.username,
          avatarUrl: a.avatarUrl,
        }),
      });
    }
    for (const a of ytAccounts) {
      map.youtube.push({
        id: a.id,
        label: nativeLabel(a),
        username: a.username,
        avatarUrl: resolveSocialAvatar({
          platform: "youtube",
          username: a.username,
          avatarUrl: a.avatarUrl,
        }),
      });
    }
    return map;
  }, [blotatoAccounts, igAccounts, ytAccounts]);

  useEffect(() => {
    const list = byNetwork[network];
    if (!list.length) {
      setAccountId("");
      return;
    }
    if (!list.some((a) => a.id === accountId)) {
      setAccountId(list[0]!.id);
    }
  }, [network, byNetwork, accountId]);

  function connectInstagram() {
    const url = `/api/projects/${projectId}/redes/oauth/instagram/start`;
    const w = window.open(url, "zima-ig-oauth", "width=640,height=760");
    if (!w) {
      window.location.href = url;
    }
  }

  function connectYouTube() {
    const url = `/api/projects/${projectId}/redes/oauth/youtube/start`;
    const w = window.open(url, "zima-yt-oauth", "width=640,height=760");
    if (!w) {
      window.location.href = url;
    }
  }

  async function connectWithToken(e: FormEvent) {
    e.preventDefault();
    if (!accessTokenInput.trim()) return;
    setSavingToken(true);
    setError("");
    setOk("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/redes/instagram/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: accessTokenInput.trim() }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not connect token");
      setAccessTokenInput("");
      setOk(
        `Instagram connected${
          data.account?.username ? `: @${data.account.username}` : ""
        }`
      );
      await loadNative();
      if (data.account?.id) setAccountId(data.account.id);
      setIgSetupOpen(false);
      setNetwork("instagram");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Token connect failed");
    } finally {
      setSavingToken(false);
    }
  }

  async function publish(e: FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    setPublishing(true);
    setError("");
    setOk("");
    try {
      if (isNative) {
        const res = await fetch(`/api/projects/${projectId}/redes/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId,
            videoUrl,
            caption,
            ...(isYouTube ? { youtubePrivacy } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Publish failed");
        setOk(
          data.result?.message ||
            (isYouTube
              ? "Published to YouTube."
              : "Published to Instagram Reels.")
        );
        setVideoUrl("");
      } else {
        const res = await fetch("/api/blotato/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId,
            platform: network,
            text: caption,
            videoUrl,
            privacyLevel: privacy,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Publish failed");
        setOk(
          `Sent to ${NETWORKS.find((n) => n.id === network)?.label} via Blotato.`
        );
        setVideoUrl("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  const netMeta = NETWORKS.find((n) => n.id === network)!;
  const netAccounts = byNetwork[network];
  const selected = netAccounts.find((a) => a.id === accountId) ?? null;

  const showBlotatoBanner =
    !loading && network === "tiktok" && !blotatoConnected;
  const showMetaBanner =
    !loading && showIgSetup && !igAppConfigured;
  const showYoutubeBanner =
    !loading && showYtSetup && !ytAppConfigured;

  return (
    <div className="relative h-full overflow-y-auto bg-[var(--background)]">
      {showBlotatoBanner ? (
        <ApiMissingBanner
          projectId={projectId}
          providerName="Blotato"
          message="Blotato API is not connected — required for TikTok."
        />
      ) : null}
      {showMetaBanner ? (
        <ApiMissingBanner
          projectId={projectId}
          providerName="Meta"
          message="Meta API is not connected — required for Instagram."
        />
      ) : null}
      {showYoutubeBanner ? (
        <ApiMissingBanner
          projectId={projectId}
          providerName="YouTube"
          message="YouTube API is not connected — required to upload videos."
        />
      ) : null}

      {/* Top-left network switcher */}
      <div className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          {onOpenGallery ? (
            <button
              type="button"
              onClick={onOpenGallery}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-[12px] font-semibold text-[var(--foreground-soft)] transition hover:border-[var(--border-strong)]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect
                  x="3.5"
                  y="5"
                  width="17"
                  height="14"
                  rx="2.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="m3.5 15.5 4.2-3.6a1.5 1.5 0 0 1 1.9 0L14 15.5l1.8-1.5a1.5 1.5 0 0 1 1.9.1l2.8 2.4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="9"
                  cy="9.5"
                  r="1.4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
              Galería
            </button>
          ) : null}
          {NETWORKS.map((n) => {
            const list = byNetwork[n.id];
            const active =
              network === n.id &&
              !showNativeSetup &&
              !allAccountsOpen &&
              !inspirationOpen;
            const open = hoverNet === n.id;
            return (
              <div
                key={n.id}
                className="relative"
                onMouseEnter={() => setHoverNet(n.id)}
                onMouseLeave={() => setHoverNet(null)}
              >
                <button
                  type="button"
                  onClick={() => {
                    setNetwork(n.id);
                    setAllAccountsOpen(false);
                    setInspirationOpen(false);
                    if (n.id === "instagram") setIgSetupOpen(false);
                    if (n.id === "youtube") setYtSetupOpen(false);
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-semibold transition ${
                    active
                      ? "border-transparent text-white shadow-sm"
                      : "border-[var(--border)] bg-white text-[var(--foreground-soft)] hover:border-[var(--border-strong)]"
                  }`}
                  style={active ? { background: n.color } : undefined}
                >
                  <NetworkIcon id={n.id} />
                  {n.label}
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-[var(--surface-alt)] text-[var(--muted)]"
                    }`}
                  >
                    {list.length}
                  </span>
                </button>

                {open ? (
                  <div className="absolute left-0 top-full z-30 min-w-[220px] pt-1.5">
                    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white py-1 shadow-[0_12px_32px_rgba(17,24,39,0.14)]">
                      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
                        {n.label} accounts
                      </p>
                      {list.length === 0 ? (
                        <p className="px-3 py-2.5 text-[12px] text-[var(--muted-soft)]">
                          {n.provider === "meta"
                            ? "No accounts yet. Connect below."
                            : n.provider === "youtube"
                              ? "No channels yet. Connect below."
                              : "No accounts. Link one in Blotato."}
                        </p>
                      ) : (
                        list.map((a) => {
                          const selectedHere =
                            accountId === a.id &&
                            network === n.id &&
                            !showNativeSetup;
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => {
                                setNetwork(n.id);
                                setAccountId(a.id);
                                setIgSetupOpen(false);
                                setYtSetupOpen(false);
                                setHoverNet(null);
                              }}
                              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] transition ${
                                selectedHere
                                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                                  : "text-[var(--foreground)] hover:bg-[var(--background)]"
                              }`}
                            >
                              <AccountAvatar
                                src={a.avatarUrl}
                                label={a.username || a.label}
                                color={n.color}
                                size={28}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold">
                                  {a.label}
                                </span>
                                {a.username ? (
                                  <span className="block truncate text-[10px] text-[var(--muted-soft)]">
                                    @{a.username}
                                  </span>
                                ) : null}
                              </span>
                              {selectedHere ? (
                                <span className="text-[10px] font-bold">✓</span>
                              ) : null}
                            </button>
                          );
                        })
                      )}
                      {n.provider === "blotato" ? (
                        <a
                          href="https://my.blotato.com/settings"
                          target="_blank"
                          rel="noreferrer"
                          className="block border-t border-[var(--border)] px-3 py-2 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--background)]"
                        >
                          Manage in Blotato →
                        </a>
                      ) : n.provider === "youtube" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setNetwork("youtube");
                              setYtSetupOpen(true);
                              setHoverNet(null);
                            }}
                            className="block w-full border-t border-[var(--border)] px-3 py-2 text-left text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--background)]"
                          >
                            Connect YouTube →
                          </button>
                          <a
                            href={GOOGLE_TESTERS_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="block border-t border-[var(--border)] px-3 py-2 text-[11px] font-medium text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                          >
                            Agregar usuario de prueba →
                          </a>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setNetwork("instagram");
                              setIgSetupOpen(true);
                              setHoverNet(null);
                            }}
                            className="block w-full border-t border-[var(--border)] px-3 py-2 text-left text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--background)]"
                          >
                            Connect Instagram →
                          </button>
                          <a
                            href={META_APP_ROLES_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="block border-t border-[var(--border)] px-3 py-2 text-[11px] font-medium text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                          >
                            Agregar usuario de prueba →
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setInspirationOpen(true);
                setAllAccountsOpen(false);
                setIgSetupOpen(false);
                setYtSetupOpen(false);
                setHoverNet(null);
              }}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-semibold transition ${
                inspirationOpen
                  ? "border-transparent bg-[var(--accent)] text-white shadow-sm"
                  : "border-[var(--border)] bg-white text-[var(--foreground-soft)] hover:border-[var(--border-strong)]"
              }`}
            >
              Inspiration
            </button>
            <button
              type="button"
              onClick={() => {
                setAllAccountsOpen(true);
                setInspirationOpen(false);
                setIgSetupOpen(false);
                setYtSetupOpen(false);
                setHoverNet(null);
              }}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-semibold transition ${
                allAccountsOpen
                  ? "border-transparent bg-[var(--accent)] text-white shadow-sm"
                  : "border-[var(--border)] bg-white text-[var(--foreground-soft)] hover:border-[var(--border-strong)]"
              }`}
            >
              All accounts
            </button>
            {selected && !showNativeSetup && !allAccountsOpen && !inspirationOpen ? (
              <span className="hidden items-center gap-2 text-[12px] text-[var(--muted)] sm:inline-flex">
                <AccountAvatar
                  src={selected.avatarUrl}
                  label={selected.username || selected.label}
                  color={netMeta.color}
                  size={22}
                />
                Selected{" "}
                <span className="font-semibold text-[var(--foreground)]">
                  {selected.label}
                </span>
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void load()}
              className="ui-btn-secondary !py-1.5 text-[12px]"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {inspirationOpen ? (
        <InspirationView
          projectId={projectId}
          onBack={() => setInspirationOpen(false)}
        />
      ) : allAccountsOpen ? (
        <AllAccountsView
          projectId={projectId}
          onBack={() => setAllAccountsOpen(false)}
        />
      ) : (
      <div className="mx-auto max-w-3xl space-y-4 px-5 py-6 sm:px-7 sm:py-8">
        {showIgSetup ? (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIgSetupOpen(false)}
                className="text-[12px] font-semibold text-[var(--accent)]"
              >
                ← Volver a publicar
              </button>
            </div>
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
                Conectar Instagram
              </h1>
              <p className="mt-1 text-[13px] text-[var(--muted)]">
                Meta for Developers · Instagram Login. Tras conectar, publica
                Reels igual que en TikTok.
              </p>
            </div>

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

            <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[15px] font-semibold text-[var(--foreground)]">
                  Instagram via Meta
                </h2>
                <span
                  className={
                    igAppConfigured
                      ? "ui-tag ui-tag-success"
                      : "ui-tag ui-tag-muted"
                  }
                >
                  {igAppConfigured ? "API connected" : "API missing"}
                </span>
              </div>
              <p className="text-[12px] text-[var(--muted)]">
                Para usuarios externos hace falta App Review + app Live. En
                desarrollo: rol Admin/Tester + OAuth, o token manual.
              </p>

              <div className="flex flex-wrap gap-2">
                {!igAppConfigured ? (
                  <a
                    href={`/projects/${projectId}/settings/api`}
                    className="ui-btn-primary !py-2 text-[13px]"
                  >
                    Configure Meta API
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={connectInstagram}
                    className="ui-btn-primary !py-2 text-[13px]"
                  >
                    Connect Instagram (OAuth)
                  </button>
                )}
              </div>
              <a
                href={META_APP_ROLES_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-[12px] font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
              >
                Agregar usuario de prueba
              </a>
              <p className="text-[11px] text-[var(--muted-soft)]">
                Mientras la app esté en Development, cada cuenta necesita rol
                Tester/Developer en Meta.
              </p>

              <form
                onSubmit={connectWithToken}
                className="space-y-2 border-t border-[var(--border)] pt-3"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
                  Solo desarrollo · Access token
                </p>
                <textarea
                  value={accessTokenInput}
                  onChange={(e) => setAccessTokenInput(e.target.value)}
                  rows={2}
                  placeholder="Token de Graph API Explorer (opcional)"
                  className="ui-input resize-y font-mono text-[11px]"
                />
                <p className="text-[11px] leading-relaxed text-[var(--muted-soft)]">
                  Preferible: Connect OAuth. Scopes{" "}
                  <code className="text-[10px]">instagram_business_basic</code>{" "}
                  +{" "}
                  <code className="text-[10px]">
                    instagram_business_content_publish
                  </code>
                  .
                </p>
                <button
                  type="submit"
                  disabled={savingToken || !accessTokenInput.trim()}
                  className="ui-btn-secondary !py-2 text-[12px]"
                >
                  {savingToken ? "Connecting…" : "Connect with token"}
                </button>
              </form>
            </div>
          </>
        ) : showYtSetup ? (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setYtSetupOpen(false)}
                className="text-[12px] font-semibold text-[var(--accent)]"
              >
                ← Volver a publicar
              </button>
            </div>
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
                Conectar YouTube
              </h1>
              <p className="mt-1 text-[13px] text-[var(--muted)]">
                YouTube Data API v3 · OAuth de Google. Tras conectar, sube
                videos igual que en Instagram.
              </p>
            </div>

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

            <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[15px] font-semibold text-[var(--foreground)]">
                  YouTube via Google
                </h2>
                <span
                  className={
                    ytAppConfigured
                      ? "ui-tag ui-tag-success"
                      : "ui-tag ui-tag-muted"
                  }
                >
                  {ytAppConfigured ? "API connected" : "API missing"}
                </span>
              </div>
              <p className="text-[12px] text-[var(--muted)]">
                Pega el OAuth Client ID + Secret en Settings → API. En Testing,
                añade testers en Google Cloud. Luego Connect para autorizar el
                canal.
              </p>

              <div className="flex flex-wrap gap-2">
                {!ytAppConfigured ? (
                  <a
                    href={`/projects/${projectId}/settings/api`}
                    className="ui-btn-primary !py-2 text-[13px]"
                  >
                    Configure YouTube API
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={connectYouTube}
                    className="ui-btn-primary !py-2 text-[13px]"
                  >
                    Connect YouTube (OAuth)
                  </button>
                )}
              </div>
              <a
                href={GOOGLE_TESTERS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-[12px] font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
              >
                Agregar usuario de prueba
              </a>
              <p className="text-[11px] text-[var(--muted-soft)]">
                Mientras la app esté en Testing, cada cuenta de Google necesita
                estar en Test users.
              </p>
              <p className="text-[11px] text-[var(--muted-soft)]">
                Scopes: youtube.upload + youtube.readonly. No uses una API key:
                hace falta OAuth de usuario para subir videos.
              </p>
            </div>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
                Redes
              </h1>
              <p className="mt-1 text-[13px] text-[var(--muted)]">
                {isInstagram
                  ? "Publica Reels en Instagram. Hover Instagram arriba para elegir cuenta o conectar."
                  : isYouTube
                    ? "Sube videos a YouTube con la API v3. Hover YouTube arriba para elegir canal o conectar."
                    : "TikTok via Blotato. Hover a network to pick an account."}
              </p>
            </div>

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
              <p className="py-12 text-center text-[13px] text-[var(--muted-soft)]">
                Loading accounts…
              </p>
            ) : isInstagram && !igAppConfigured && !accountId ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-5 py-14 text-center">
                <p className="text-[14px] font-medium text-[var(--foreground)]">
                  Connect Meta first
                </p>
                <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--muted)]">
                  Settings → API → Meta, then hover Instagram → Connect
                  Instagram.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <a
                    href={`/projects/${projectId}/settings/api`}
                    className="ui-btn-primary !py-2 text-[13px]"
                  >
                    Configure Meta API
                  </a>
                  <button
                    type="button"
                    onClick={() => setIgSetupOpen(true)}
                    className="ui-btn-secondary !py-2 text-[13px]"
                  >
                    Connect Instagram
                  </button>
                </div>
              </div>
            ) : isYouTube && !ytAppConfigured && !accountId ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-5 py-14 text-center">
                <p className="text-[14px] font-medium text-[var(--foreground)]">
                  Connect YouTube API first
                </p>
                <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--muted)]">
                  Settings → API → YouTube (Google OAuth Client ID + Secret),
                  then hover YouTube → Connect YouTube.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <a
                    href={`/projects/${projectId}/settings/api`}
                    className="ui-btn-primary !py-2 text-[13px]"
                  >
                    Configure YouTube API
                  </a>
                  <button
                    type="button"
                    onClick={() => setYtSetupOpen(true)}
                    className="ui-btn-secondary !py-2 text-[13px]"
                  >
                    Connect YouTube
                  </button>
                </div>
              </div>
            ) : network === "tiktok" && !blotatoConnected ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-5 py-14 text-center">
                <p className="text-[14px] font-medium text-[var(--foreground)]">
                  Connect Blotato first
                </p>
                <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--muted)]">
                  Settings → API → Blotato. Then link TikTok in{" "}
                  <a
                    href="https://my.blotato.com/settings"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[var(--accent)] underline"
                  >
                    my.blotato.com
                  </a>
                  .
                </p>
              </div>
            ) : !accountId ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-5 py-14 text-center">
                <p className="text-[14px] font-medium text-[var(--foreground)]">
                  No {netMeta.label} account selected
                </p>
                <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--muted)]">
                  {isInstagram
                    ? "Hover Instagram above and choose Connect Instagram, then pick the account."
                    : isYouTube
                      ? "Hover YouTube above and choose Connect YouTube, then pick the channel."
                      : `Hover ${netMeta.label} above and choose an account, or connect one in Blotato.`}
                </p>
                {isInstagram ? (
                  <button
                    type="button"
                    onClick={() => setIgSetupOpen(true)}
                    className="ui-btn-primary mt-4 !py-2 text-[13px]"
                  >
                    Connect Instagram
                  </button>
                ) : isYouTube ? (
                  <button
                    type="button"
                    onClick={() => setYtSetupOpen(true)}
                    className="ui-btn-primary mt-4 !py-2 text-[13px]"
                  >
                    Connect YouTube
                  </button>
                ) : null}
              </div>
            ) : (
              <PublishForm
                projectId={projectId}
                label={netMeta.label}
                accountLabel={selected?.label || ""}
                videoUrl={videoUrl}
                caption={caption}
                publishing={publishing}
                onVideoUrl={setVideoUrl}
                onCaption={setCaption}
                onSubmit={publish}
                privacy={privacy}
                onPrivacy={setPrivacy}
                showPrivacy={network === "tiktok"}
                youtubePrivacy={youtubePrivacy}
                onYoutubePrivacy={setYoutubePrivacy}
                showYoutubePrivacy={isYouTube}
              />
            )}
          </>
        )}
      </div>
      )}
    </div>
  );
}

function sanitizeFileName(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\w.\- ()[\]]+/g, "_")
      .slice(0, 180) || "video"
  );
}

type GalleryVideo = {
  id: string;
  name: string;
  publicUrl: string;
  sizeBytes: number;
  createdAt: string;
};

function PublishForm({
  projectId,
  label,
  accountLabel,
  videoUrl,
  caption,
  publishing,
  onVideoUrl,
  onCaption,
  onSubmit,
  privacy,
  onPrivacy,
  showPrivacy,
  youtubePrivacy,
  onYoutubePrivacy,
  showYoutubePrivacy,
}: {
  projectId: string;
  label: string;
  accountLabel: string;
  videoUrl: string;
  caption: string;
  publishing: boolean;
  onVideoUrl: (v: string) => void;
  onCaption: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  privacy?: Privacy;
  onPrivacy?: (v: Privacy) => void;
  showPrivacy?: boolean;
  youtubePrivacy?: YoutubePrivacy;
  onYoutubePrivacy?: (v: YoutubePrivacy) => void;
  showYoutubePrivacy?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [videoName, setVideoName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerVideos, setPickerVideos] = useState<GalleryVideo[]>([]);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!videoUrl) setVideoName("");
  }, [videoUrl]);

  async function openGalleryPicker() {
    setPickerOpen(true);
    setPickerLoading(true);
    setLocalError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/gallery?all=1&kind=video`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar la galería");
      const list = ((data.assets ?? []) as {
        id: string;
        name: string;
        publicUrl: string;
        sizeBytes: number;
        createdAt: string;
      }[]).map((a) => ({
        id: a.id,
        name: a.name,
        publicUrl: a.publicUrl,
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt,
      }));
      setPickerVideos(list);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Error al cargar galería");
      setPickerVideos([]);
    } finally {
      setPickerLoading(false);
    }
  }

  async function onDeviceFile(file: File | undefined) {
    if (!file) return;
    setLocalError("");
    const mime = (file.type || "").toLowerCase();
    if (!mime.startsWith("video/")) {
      setLocalError("Selecciona un video.");
      return;
    }
    if (file.size <= 0 || file.size > 200 * 1024 * 1024) {
      setLocalError("El video debe pesar máximo 200 MB.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const safe = sanitizeFileName(file.name);
      const storagePath = `${projectId}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("gallery")
        .upload(storagePath, file, { contentType: mime, upsert: false });
      if (upErr) throw new Error(upErr.message);

      const { data: pub } = supabase.storage
        .from("gallery")
        .getPublicUrl(storagePath);

      const res = await fetch(`/api/projects/${projectId}/gallery/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [
            {
              name: safe,
              mimeType: mime,
              sizeBytes: file.size,
              storagePath,
              publicUrl: pub.publicUrl,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo registrar el video");

      onVideoUrl(pub.publicUrl);
      setVideoName(safe);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold text-[var(--foreground)]">
            Publish to {label}
          </h2>
          <span className="ui-tag ui-tag-muted">{accountLabel}</span>
        </div>

        <div>
          <span className="mb-1.5 block text-[11px] font-semibold uppercase text-[var(--muted-soft)]">
            Video
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={uploading || publishing}
              onClick={() => fileRef.current?.click()}
              className="ui-btn-secondary !py-3 text-[12px]"
            >
              {uploading ? "Subiendo…" : "Desde el dispositivo"}
            </button>
            <button
              type="button"
              disabled={uploading || publishing}
              onClick={() => void openGalleryPicker()}
              className="ui-btn-secondary !py-3 text-[12px]"
            >
              Desde galería
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => void onDeviceFile(e.target.files?.[0])}
          />
          {videoUrl ? (
            <div className="mt-2 flex items-start justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[var(--foreground)]">
                  {videoName || "Video seleccionado"}
                </p>
                <p className="truncate text-[11px] text-[var(--muted-soft)]">{videoUrl}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onVideoUrl("");
                  setVideoName("");
                }}
                className="shrink-0 text-[11px] font-semibold text-[var(--danger)]"
              >
                Quitar
              </button>
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-[var(--muted-soft)]">
              Elige un video del dispositivo o de la galería.
            </p>
          )}
          {localError ? (
            <p className="mt-2 text-[12px] text-[var(--danger)]">{localError}</p>
          ) : null}
        </div>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase text-[var(--muted-soft)]">
            {showYoutubePrivacy ? "Title / description" : "Caption / title"}
          </span>
          <textarea
            value={caption}
            onChange={(e) => onCaption(e.target.value)}
            rows={3}
            className="ui-input resize-y"
          />
        </label>
        {showYoutubePrivacy && youtubePrivacy && onYoutubePrivacy ? (
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase text-[var(--muted-soft)]">
              Visibility
            </span>
            <select
              value={youtubePrivacy}
              onChange={(e) =>
                onYoutubePrivacy(e.target.value as YoutubePrivacy)
              }
              className="ui-input"
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
          </label>
        ) : null}
        {showPrivacy && privacy && onPrivacy ? (
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase text-[var(--muted-soft)]">
              Privacy
            </span>
            <select
              value={privacy}
              onChange={(e) => onPrivacy(e.target.value as Privacy)}
              className="ui-input"
            >
              <option value="PUBLIC_TO_EVERYONE">Public</option>
              <option value="SELF_ONLY">Only me</option>
              <option value="MUTUAL_FOLLOW_FRIENDS">Friends</option>
              <option value="FOLLOWER_OF_CREATOR">Followers</option>
            </select>
          </label>
        ) : null}
        <button
          type="submit"
          disabled={publishing || uploading || !videoUrl}
          className="ui-btn-primary !py-2.5 text-[13px]"
        >
          {publishing ? "Publishing…" : `Publish to ${label}`}
        </button>
      </form>

      {pickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h3 className="text-[15px] font-semibold text-[var(--foreground)]">
                Seleccionar de galería
              </h3>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="text-[12px] font-semibold text-[var(--muted)]"
              >
                Cerrar
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {pickerLoading ? (
                <p className="py-8 text-center text-[13px] text-[var(--muted-soft)]">
                  Cargando videos…
                </p>
              ) : pickerVideos.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-[var(--muted-soft)]">
                  No hay videos en la galería.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {pickerVideos.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onVideoUrl(v.publicUrl);
                          setVideoName(v.name);
                          setPickerOpen(false);
                          setLocalError("");
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--background)]"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-[10px] font-bold text-white">
                          MP4
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-[var(--foreground)]">
                            {v.name}
                          </span>
                          <span className="block text-[11px] text-[var(--muted-soft)]">
                            {(v.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
