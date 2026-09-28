"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { SocialPlatform } from "@/lib/redes/types";
import { AccountAvatar } from "./AccountAvatar";

type UnifiedAccount = {
  key: string;
  platform: SocialPlatform;
  source: "native" | "blotato";
  externalKey: string;
  label: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  connectedAt: string | null;
  hasLoginCredentials: boolean;
};

const PLATFORM_COLOR: Record<string, string> = {
  tiktok: "#111827",
  instagram: "#e1306c",
  youtube: "#ff0000",
  facebook: "#1877f2",
  x: "#111827",
};

export function AllAccountsView({
  projectId,
  onBack,
}: {
  projectId: string;
  onBack: () => void;
}) {
  const [accounts, setAccounts] = useState<UnifiedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [unlocked, setUnlocked] = useState(false);
  const [vaultPassword, setVaultPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [showVaultPw, setShowVaultPw] = useState(false);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [loginUser, setLoginUser] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingCreds, setLoadingCreds] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/redes/all-accounts`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load accounts");
      setAccounts((data.accounts ?? []) as UnifiedAccount[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  function lockVault() {
    setUnlocked(false);
    setVaultPassword("");
    setExpandedKey(null);
    setLoginUser("");
    setLoginPassword("");
    setNotes("");
    setOk("");
  }

  async function unlockVault(e: FormEvent) {
    e.preventDefault();
    if (!vaultPassword.trim()) return;
    setUnlocking(true);
    setError("");
    setOk("");
    try {
      // Probe with a noop reveal against a dummy key — better: verify endpoint.
      // Use first account if any, else a lightweight PUT that fails validation after auth.
      const probe = await fetch(
        `/api/projects/${projectId}/redes/credentials`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password: vaultPassword,
            platform: "instagram",
            source: "native",
            externalKey: "__vault_unlock_probe__",
          }),
        }
      );
      const data = await probe.json();
      if (probe.status === 403) {
        throw new Error(data.error || "Incorrect login password.");
      }
      if (!probe.ok && probe.status !== 400) {
        throw new Error(data.error || "Could not unlock vault.");
      }
      setUnlocked(true);
      setOk("Vault unlocked. Credentials stay on this page until you lock.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
      setUnlocked(false);
    } finally {
      setUnlocking(false);
    }
  }

  async function openAccount(account: UnifiedAccount) {
    if (!unlocked) {
      setError("Unlock the vault with your login password first.");
      return;
    }
    if (expandedKey === account.key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(account.key);
    setLoginUser("");
    setLoginPassword("");
    setNotes("");
    setShowLoginPw(false);
    setLoadingCreds(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/redes/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: vaultPassword,
          platform: account.platform,
          source: account.source,
          externalKey: account.externalKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load credentials");
      setLoginUser(data.credentials?.loginUser || "");
      setLoginPassword(data.credentials?.loginPassword || "");
      setNotes(data.credentials?.notes || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reveal failed");
      setExpandedKey(null);
    } finally {
      setLoadingCreds(false);
    }
  }

  async function saveCredentials(account: UnifiedAccount) {
    if (!unlocked) return;
    setSaving(true);
    setError("");
    setOk("");
    try {
      const res = await fetch(`/api/projects/${projectId}/redes/credentials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: vaultPassword,
          platform: account.platform,
          source: account.source,
          externalKey: account.externalKey,
          displayName: account.displayName || account.label,
          handle: account.username,
          loginUser,
          loginPassword,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setOk(`Credentials saved for ${account.label}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function clearCredentials(account: UnifiedAccount) {
    if (!unlocked) return;
    if (!confirm(`Delete saved login for ${account.label}?`)) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/redes/credentials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: vaultPassword,
          platform: account.platform,
          source: account.source,
          externalKey: account.externalKey,
          clear: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not clear");
      setLoginUser("");
      setLoginPassword("");
      setNotes("");
      setOk(`Credentials cleared for ${account.label}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-5 py-6 sm:px-7 sm:py-8">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-[12px] font-semibold text-[var(--accent)]"
        >
          ← Volver a Redes
        </button>
      </div>

      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
          All accounts
        </h1>
        <p className="mt-1 text-[13px] text-[var(--muted)]">
          Todas las cuentas conectadas. Las credenciales de login se guardan
          cifradas y solo se ven tras tu contraseña de Zima.
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

      <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
        {!unlocked ? (
          <form onSubmit={unlockVault} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold text-[var(--foreground)]">
                Desbloquear vault
              </h2>
              <span className="ui-tag ui-tag-muted">Locked</span>
            </div>
            <p className="text-[12px] text-[var(--muted)]">
              Escribe la misma contraseña con la que inicias sesión en Zima
              Admin.
            </p>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase text-[var(--muted-soft)]">
                Contraseña de inicio de sesión
              </span>
              <div className="relative">
                <input
                  type={showVaultPw ? "text" : "password"}
                  value={vaultPassword}
                  onChange={(e) => setVaultPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="ui-input !pr-11"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowVaultPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[var(--muted-soft)]"
                >
                  {showVaultPw ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <button
              type="submit"
              disabled={unlocking || !vaultPassword.trim()}
              className="ui-btn-primary !py-2 text-[13px]"
            >
              {unlocking ? "Verifying…" : "Unlock"}
            </button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-[var(--foreground)]">
                Vault
              </h2>
              <span className="ui-tag ui-tag-success">Unlocked</span>
            </div>
            <button
              type="button"
              onClick={lockVault}
              className="ui-btn-secondary !py-1.5 text-[12px]"
            >
              Lock
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="py-10 text-center text-[13px] text-[var(--muted-soft)]">
          Loading accounts…
        </p>
      ) : accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-5 py-14 text-center">
          <p className="text-[14px] font-medium text-[var(--foreground)]">
            No connected accounts yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--muted)]">
            Conecta Instagram, TikTok o YouTube desde Redes.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {accounts.map((account) => {
            const open = expandedKey === account.key;
            const color = PLATFORM_COLOR[account.platform] || "#6b7280";
            return (
              <li
                key={account.key}
                className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white"
              >
                <button
                  type="button"
                  onClick={() => void openAccount(account)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--background)]"
                >
                  <AccountAvatar
                    src={account.avatarUrl}
                    label={account.username || account.label}
                    color={color}
                    size={40}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[14px] font-semibold text-[var(--foreground)]">
                        {account.label}
                      </span>
                      <span className="rounded-md bg-[var(--surface-alt)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">
                        {account.platform}
                      </span>
                      {account.hasLoginCredentials ? (
                        <span className="ui-tag ui-tag-success !text-[10px]">
                          Credenciales
                        </span>
                      ) : (
                        <span className="ui-tag ui-tag-muted !text-[10px]">
                          Sin login
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-[var(--muted-soft)]">
                      {account.username ? `@${account.username}` : account.source}{" "}
                      · {account.status}
                    </span>
                  </span>
                  <span className="text-[12px] font-semibold text-[var(--accent)]">
                    {open ? "Hide" : unlocked ? "Ver / editar" : "Locked"}
                  </span>
                </button>

                {open ? (
                  <div className="space-y-3 border-t border-[var(--border)] px-4 py-4">
                    {loadingCreds ? (
                      <p className="text-[12px] text-[var(--muted-soft)]">
                        Loading credentials…
                      </p>
                    ) : (
                      <>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase text-[var(--muted-soft)]">
                            Usuario / email del perfil
                          </span>
                          <input
                            value={loginUser}
                            onChange={(e) => setLoginUser(e.target.value)}
                            className="ui-input"
                            autoComplete="off"
                            placeholder="user@email.com or @handle"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase text-[var(--muted-soft)]">
                            Contraseña del perfil
                          </span>
                          <div className="relative">
                            <input
                              type={showLoginPw ? "text" : "password"}
                              value={loginPassword}
                              onChange={(e) =>
                                setLoginPassword(e.target.value)
                              }
                              className="ui-input !pr-11"
                              autoComplete="off"
                              placeholder="••••••••"
                            />
                            <button
                              type="button"
                              onClick={() => setShowLoginPw((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[var(--muted-soft)]"
                            >
                              {showLoginPw ? "Hide" : "Show"}
                            </button>
                          </div>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase text-[var(--muted-soft)]">
                            Notas (opcional)
                          </span>
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="ui-input resize-y"
                            placeholder="2FA, recovery email…"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void saveCredentials(account)}
                            className="ui-btn-primary !py-2 text-[13px]"
                          >
                            {saving ? "Saving…" : "Guardar credenciales"}
                          </button>
                          {account.hasLoginCredentials ? (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void clearCredentials(account)}
                              className="ui-btn-secondary !py-2 text-[13px]"
                            >
                              Borrar
                            </button>
                          ) : null}
                        </div>
                      </>
                    )}
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
