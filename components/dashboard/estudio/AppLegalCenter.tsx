"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  fillLegalText,
  hostedLegalUrl,
  LEGAL_DOCS,
  ownSiteLinks,
  ownSiteVercelCode,
  type LegalDocId,
  type LegalHistoryItem,
  type LegalNotice,
  type LegalProfile,
  type LegalState,
} from "@/lib/creator/app-legal";
import { LEGAL_COUNTRIES, legalCountryByName } from "@/lib/creator/legal-countries";
import { LegalBlockEditor } from "./LegalBlockEditor";

type MailAccount = { id: string; email: string; display_name: string | null };

type LegalResponse = LegalState & { origin: string };

const inputClass =
  "w-full rounded-xl border border-[#e6e7eb] bg-white px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none placeholder:text-[#c4c8d0] focus:border-[var(--accent)]";

export function AppLegalCenter({ projectId }: { projectId: string }) {
  const [state, setState] = useState<LegalResponse | null>(null);
  const [docId, setDocId] = useState<string>("privacy");
  const [profileOpen, setProfileOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [audience, setAudience] = useState<number | null>(null);
  const [audienceNote, setAudienceNote] = useState("");
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [ownSiteOpen, setOwnSiteOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyVersion, setHistoryVersion] = useState<number | null>(null);
  const ownSiteRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/app-legal`);
        const data = (await res.json()) as LegalResponse & { error?: string };
        if (!res.ok) throw new Error(data.error || "No se pudo cargar");
        if (cancel) return;
        setState(data);
        const app = data.draft.profile.appName || data.projectName || "tu app";
        setSubject(`Actualizamos los documentos legales de ${app}`);
        setNote(
          `Hemos actualizado la política de privacidad, los términos y el resto de documentos legales de ${app}.`
        );
      } catch (err) {
        if (!cancel) setError(err instanceof Error ? err.message : "No se pudo cargar");
      }
    })();
    void (async () => {
      const res = await fetch(`/api/projects/${projectId}/mail/accounts`);
      const data = (await res.json().catch(() => null)) as { accounts?: MailAccount[] } | null;
      if (cancel || !res.ok) return;
      const list = data?.accounts ?? [];
      setAccounts(list);
      setAccountId(list[0]?.id || "");
    })();
    void (async () => {
      const res = await fetch(`/api/projects/${projectId}/clients`);
      const data = (await res.json().catch(() => null)) as {
        users?: { email: string | null }[];
        error?: string;
        message?: string;
      } | null;
      if (cancel) return;
      if (!res.ok) {
        setAudience(null);
        setAudienceNote(data?.message || data?.error || "Conecta Supabase en Clients para listar usuarios.");
        return;
      }
      const count = (data?.users ?? []).filter((user) => (user.email || "").includes("@")).length;
      setAudience(count);
      setAudienceNote(
        count
          ? `${count} usuarios con correo. El aviso se envía como máximo a 120.`
          : "Todavía no hay usuarios con correo."
      );
    })();
    return () => {
      cancel = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!ownSiteOpen) return;
    function onPointer(event: MouseEvent) {
      if (!ownSiteRef.current?.contains(event.target as Node)) setOwnSiteOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOwnSiteOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ownSiteOpen]);

  useEffect(() => {
    if (!historyOpen) return;
    function onPointer(event: MouseEvent) {
      if (!historyRef.current?.contains(event.target as Node)) setHistoryOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setHistoryOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [historyOpen]);

  const draft = state?.draft;
  const origin = state?.origin || "https://vantko.com";
  const builtinDoc = LEGAL_DOCS.find((item) => item.id === docId);
  const doc = builtinDoc
    ? draft?.docs[builtinDoc.id]
    : draft?.extras.find((item) => item.id === docId);
  const dirty = useMemo(() => {
    if (!state?.published || !draft) return Boolean(draft);
    return JSON.stringify(state.published.profile) !== JSON.stringify(draft.profile) ||
      JSON.stringify(state.published.docs) !== JSON.stringify(draft.docs);
  }, [draft, state?.published]);

  function patchProfile(key: keyof LegalResponse["draft"]["profile"], value: string) {
    setState((current) => {
      if (!current) return current;
      return {
        ...current,
        draft: {
          ...current.draft,
          profile: { ...current.draft.profile, [key]: value },
        },
      };
    });
  }

  function patchDocLabel(id: string, value: string) {
    setState((current) => {
      if (!current) return current;
      if (LEGAL_DOCS.some((item) => item.id === id)) {
        const docKey = id as LegalDocId;
        return {
          ...current,
          draft: {
            ...current.draft,
            docs: {
              ...current.draft.docs,
              [docKey]: { ...current.draft.docs[docKey], label: value.slice(0, 40) },
            },
          },
        };
      }
      return {
        ...current,
        draft: {
          ...current.draft,
          extras: current.draft.extras.map((item) =>
            item.id === id ? { ...item, label: value.slice(0, 40) } : item
          ),
        },
      };
    });
  }

  function patchDoc(key: "title" | "body" | "color", value: string) {
    setState((current) => {
      if (!current) return current;
      if (LEGAL_DOCS.some((item) => item.id === docId)) {
        const docKey = docId as LegalDocId;
        return {
          ...current,
          draft: {
            ...current.draft,
            docs: {
              ...current.draft.docs,
              [docKey]: { ...current.draft.docs[docKey], [key]: value },
            },
          },
        };
      }
      return {
        ...current,
        draft: {
          ...current.draft,
          extras: current.draft.extras.map((item) =>
            item.id === docId ? { ...item, [key]: value } : item
          ),
        },
      };
    });
  }

  function addExtra() {
    const id = `extra-${Math.random().toString(36).slice(2, 8)}`;
    setState((current) => {
      if (!current) return current;
      return {
        ...current,
        draft: {
          ...current.draft,
          extras: [
            ...current.draft.extras,
            { id, label: "Espacio", title: "Documento", body: "", color: "" },
          ],
        },
      };
    });
    setDocId(id);
    setEditingLabel(true);
  }

  function finishLabel(id: string, fallback: string, raw: string) {
    const label = raw.slice(0, 40).trim() || fallback;
    patchDocLabel(id, label);
    setEditingLabel(false);
    const source = state?.draft;
    if (!source) return;
    const builtin = LEGAL_DOCS.find((item) => item.id === id);
    const nextDraft = builtin
      ? {
          ...source,
          docs: {
            ...source.docs,
            [builtin.id]: { ...source.docs[builtin.id], label },
          },
        }
      : {
          ...source,
          extras: source.extras.map((item) => (item.id === id ? { ...item, label } : item)),
        };
    void post("save", undefined, nextDraft);
  }

  function removeExtra(id: string) {
    setState((current) => {
      if (!current) return current;
      return {
        ...current,
        draft: {
          ...current.draft,
          extras: current.draft.extras.filter((item) => item.id !== id),
        },
      };
    });
    if (docId === id) {
      setDocId("privacy");
      setEditingLabel(false);
    }
  }

  async function post(
    action: string,
    extra?: Record<string, unknown>,
    draftOverride?: LegalResponse["draft"]
  ) {
    if (!state) return null;
    setBusy(action);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/app-legal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          draft: draftOverride || state.draft,
          ...extra,
        }),
      });
      const data = (await res.json()) as LegalResponse & {
        error?: string;
        lastNotice?: LegalNotice;
      };
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      if (data.draft) setState(data);
      if (data.lastNotice && state) {
        setState((current) => (current ? { ...current, lastNotice: data.lastNotice ?? null } : current));
      }
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 1200);
    } catch {
      setCopied("");
    }
  }

  if (!state || !draft || !doc) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[var(--muted-soft)]">
        {error || "Cargando documentos…"}
      </div>
    );
  }

  const missingProfile = (
    [
      ["nombre", draft.profile.appName.trim()],
      ["razón social", draft.profile.legalName.trim()],
      ["dominio", draft.profile.domain.trim()],
      ["correo", draft.profile.contactEmail.includes("@") ? "ok" : ""],
      ["domicilio", draft.profile.address.trim()],
      ["país", draft.profile.region.trim()],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([label]) => label);

  const docCards = [
    ...LEGAL_DOCS.map((item) => ({
      id: item.id,
      label: draft.docs[item.id].label || item.label,
      fallback: item.label,
      custom: false,
    })),
    ...draft.extras.map((item) => ({
      id: item.id,
      label: item.label || "Espacio",
      fallback: "Espacio",
      custom: true,
    })),
  ];

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)] lg:px-6">
        <div className="space-y-4">
          <section className="rounded-xl border border-[var(--border)] bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                className={`inline-flex min-w-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-left transition duration-200 ${
                  profileOpen
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border-strong)] bg-[var(--surface-alt)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                }`}
                aria-expanded={profileOpen}
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--accent)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                  <ChevronIcon open={profileOpen} />
                </span>
                <span className="text-[14px] font-semibold text-[var(--foreground)]">Datos de la app</span>
                <span className="text-[11px] font-semibold text-[var(--muted)]">
                  {profileOpen ? "Recoger" : "Abrir"}
                </span>
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void post("save")}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                <SaveIcon />
                {busy === "save" ? "Guardando…" : "Guardar"}
              </button>
            </div>
            <div
              className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ gridTemplateRows: profileOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden" {...(profileOpen ? {} : { inert: true })}>
                <p className="mt-3 text-[12px] leading-relaxed text-[var(--muted)]">
                  El dominio y el correo se insertan solos en los documentos con {"{{dominio}}"} y {"{{email}}"}.
                  Al publicar, la misma URL pasa a mostrar la versión nueva.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label="Nombre de la app">
                    <input
                      className={inputClass}
                      value={draft.profile.appName}
                      onChange={(e) => patchProfile("appName", e.target.value)}
                      placeholder="Nova"
                    />
                  </Field>
                  <Field label="Razón social">
                    <input
                      className={inputClass}
                      value={draft.profile.legalName}
                      onChange={(e) => patchProfile("legalName", e.target.value)}
                      placeholder="Tu empresa, S.L."
                    />
                  </Field>
                  <Field label="Dominio">
                    <input
                      className={inputClass}
                      value={draft.profile.domain}
                      onChange={(e) => patchProfile("domain", e.target.value)}
                      placeholder="app.tudominio.com"
                      spellCheck={false}
                    />
                  </Field>
                  <Field label="Correo de contacto">
                    <input
                      className={inputClass}
                      value={draft.profile.contactEmail}
                      onChange={(e) => patchProfile("contactEmail", e.target.value)}
                      placeholder="legal@tudominio.com"
                      spellCheck={false}
                    />
                  </Field>
                  <Field label="Domicilio">
                    <input
                      className={inputClass}
                      value={draft.profile.address}
                      onChange={(e) => patchProfile("address", e.target.value)}
                      placeholder="Calle, ciudad, código postal"
                    />
                  </Field>
                  <Field label="País">
                    <CountryPicker
                      value={draft.profile.region}
                      onChange={(region) => patchProfile("region", region)}
                    />
                  </Field>
                </div>
              </div>
            </div>
            <div
              className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ gridTemplateRows: profileOpen ? "0fr" : "1fr" }}
            >
              <div className="overflow-hidden">
                {missingProfile.length ? (
                  <p className="pt-3 text-[13px] font-medium text-[var(--danger)]">
                    {missingProfile.length === 1
                      ? `Falta ${missingProfile[0]}`
                      : `Falta ${missingProfile.slice(0, -1).join(", ")} y ${missingProfile[missingProfile.length - 1]}`}
                  </p>
                ) : (
                  <p className="truncate pt-3 text-[13px] text-[var(--muted)]">
                    {[draft.profile.appName, draft.profile.domain, draft.profile.region].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-white p-5">
            <div className="flex flex-wrap items-center gap-1.5">
              {docCards.map((item) => {
                const active = docId === item.id;
                if (active && editingLabel) {
                  return (
                    <input
                      key={item.id}
                      autoFocus
                      value={item.label}
                      aria-label="Nombre del documento"
                      className="h-8 w-36 rounded-full border border-[var(--accent)] bg-white px-3 text-[12px] font-semibold text-[var(--foreground)] outline-none"
                      onChange={(e) => patchDocLabel(item.id, e.target.value)}
                      onBlur={(e) => finishLabel(item.id, item.fallback, e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEditingLabel(false);
                      }}
                    />
                  );
                }
                return (
                  <div
                    key={item.id}
                    className={`inline-flex h-8 items-center gap-0.5 rounded-full border pl-3 ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] pr-1"
                        : "border-[var(--border)] bg-white pr-3"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLabel(false);
                        setDocId(item.id);
                      }}
                      className={`text-[12px] font-semibold ${
                        active ? "text-[var(--foreground)]" : "text-[var(--muted)]"
                      }`}
                    >
                      {item.label}
                    </button>
                    {active ? (
                      <>
                        <button
                          type="button"
                          aria-label="Editar nombre"
                          onClick={() => setEditingLabel(true)}
                          className="grid h-6 w-6 place-items-center rounded-full text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)]"
                        >
                          <PencilIcon />
                        </button>
                        {item.custom ? (
                          <button
                            type="button"
                            onClick={() => {
                              const current = draft.extras.find((extra) => extra.id === item.id);
                              if (current?.body.trim() && !window.confirm("¿Quitar este espacio?")) return;
                              removeExtra(item.id);
                            }}
                            className="pr-1.5 text-[11px] font-semibold text-[var(--danger)]"
                          >
                            Quitar
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addExtra}
                title="Espacio personalizado"
                className="inline-flex h-8 items-center rounded-full border border-dashed border-[var(--border-strong)] bg-[var(--surface-alt)] px-3 text-[12px] font-semibold text-[var(--foreground)] hover:border-[var(--accent)]"
              >
                Más
              </button>
            </div>
            <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">
              Título
              <input
                className={`${inputClass} mt-1.5 font-normal normal-case tracking-normal`}
                value={doc.title}
                onChange={(e) => patchDoc("title", e.target.value)}
              />
            </label>
            <div className="mt-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">
                  Texto
                </span>
                <button
                  type="button"
                  onClick={() => setEditorOpen(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                >
                  <ExpandIcon />
                  Expandir
                </button>
              </div>
              <textarea
                className={`${inputClass} mt-1.5 min-h-[280px] resize-y font-normal normal-case leading-relaxed tracking-normal`}
                style={doc.color ? { color: doc.color } : undefined}
                value={doc.body}
                onChange={(e) => patchDoc("body", e.target.value)}
              />
            </div>
            <p className="mt-2 text-[12px] text-[var(--muted-soft)]">
              Una línea que empiece por # es un título. Variables: {"{{app}}"} {"{{razon}}"} {"{{dominio}}"} {"{{email}}"} {"{{direccion}}"} {"{{region}}"}.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void post("save")}
                className="rounded-full border border-[#e6e7eb] px-4 py-2 text-[13px] font-semibold text-[var(--foreground)] disabled:opacity-50"
              >
                {busy === "save" ? "Guardando…" : "Guardar borrador"}
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void post("publish")}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {busy === "publish" ? "Publicando…" : "Publicar"}
              </button>
              <span className="text-[12px] text-[var(--muted)]">
                {state.published
                  ? dirty
                    ? `Hay cambios sin publicar · versión ${state.version} en línea`
                    : `Versión ${state.version} publicada`
                  : "Todavía no está publicado"}
              </span>
            </div>
            {error ? <p className="mt-3 text-[13px] text-[var(--danger)]">{error}</p> : null}
          </section>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div ref={historyRef} className="relative">
            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-semibold text-white"
              aria-expanded={historyOpen}
            >
              Historial de versiones
            </button>
            {historyOpen ? (
              <VersionHistory
                items={versionEntries(state)}
                selected={historyVersion}
                onSelect={(version) =>
                  setHistoryVersion((current) => (current === version ? null : version))
                }
              />
            ) : null}
          </div>
          <section className="rounded-xl border border-[var(--border)] bg-white p-5">
            <div ref={ownSiteRef} className="relative flex items-center justify-between gap-3">
              <h2 className="flex min-w-0 items-center gap-2 text-[14px] font-semibold text-[var(--foreground)]">
                <LinkMark />
                Enlaces públicos
              </h2>
              <button
                type="button"
                onClick={() => setOwnSiteOpen((open) => !open)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-semibold text-white"
                aria-expanded={ownSiteOpen}
              >
                Usa tu web
              </button>
              {ownSiteOpen ? (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                  <button
                    type="button"
                    aria-label="Cerrar"
                    className="absolute inset-0 bg-black/40 backdrop-blur-md"
                    onClick={() => setOwnSiteOpen(false)}
                  />
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Usa tu web"
                    className="relative flex max-h-[min(760px,92dvh)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">
                          Tu dominio
                        </p>
                        <h3 className="text-[18px] font-semibold text-[var(--foreground)]">Usa tu web</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOwnSiteOpen(false)}
                        className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--muted)] hover:bg-[var(--surface-alt)]"
                      >
                        Cerrar
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                      <OwnSiteHelp profile={draft.profile} origin={origin} copied={copied} onCopy={copy} />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <ul className="mt-4 space-y-2">
              {LEGAL_DOCS.map((item) => {
                const url = hostedLegalUrl(origin, draft.profile, item.id);
                return (
                  <li key={item.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-[var(--foreground)]">{item.label}</p>
                      <p className="truncate text-[11px] text-[var(--muted)]">{url}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copy(url, item.id)}
                      className="shrink-0 rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-[11px] font-semibold text-[var(--foreground)]"
                    >
                      {copied === item.id ? "Copiado" : "Copiar"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-white p-5">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--foreground)]">
              <MailMark />
              Aviso a usuarios
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
              Se envía desde tu correo conectado a los usuarios de la app, con los enlaces de la versión publicada.
            </p>
            <label className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">
              Desde
              <select
                className={`${inputClass} mt-1.5`}
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.length ? null : <option value="">Sin cuenta de correo</option>}
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.display_name || account.email}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-[12px] text-[var(--muted)]">{audienceNote}</p>
            <label className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">
              Asunto
              <input
                className={`${inputClass} mt-1.5 font-normal normal-case tracking-normal`}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">
              Mensaje
              <textarea
                className={`${inputClass} mt-1.5 min-h-[88px] resize-y font-normal normal-case leading-relaxed tracking-normal`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={Boolean(busy) || !accountId || !state.published || !audience}
              onClick={() => void post("notify", { accountId, subject, note })}
              className="mt-3 rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {busy === "notify" ? "Enviando…" : "Enviar aviso"}
            </button>
            {state.lastNotice ? (
              <p className="mt-3 text-[12px] text-[var(--muted)]">
                Último aviso: {state.lastNotice.sent} enviados
                {state.lastNotice.failed ? `, ${state.lastNotice.failed} fallidos` : ""} · versión{" "}
                {state.lastNotice.version} · {new Date(state.lastNotice.at).toLocaleString("es")}
              </p>
            ) : null}
            {!accounts.length ? (
              <p className="mt-2 text-[12px] text-[var(--muted-soft)]">
                Conecta un correo en Emails para poder avisar.
              </p>
            ) : null}
          </section>
        </div>
      </div>
      <LegalBlockEditor
        open={editorOpen}
        title={doc.title}
        body={doc.body}
        color={doc.color}
        docLabel={doc.label || "Documento"}
        profile={draft.profile}
        onClose={() => setEditorOpen(false)}
        onApply={({ title: nextTitle, body: nextBody, color }) => {
          patchDoc("title", nextTitle);
          patchDoc("body", nextBody);
          patchDoc("color", color);
          setEditorOpen(false);
        }}
      />
    </div>
  );
}

function versionEntries(state: LegalState): LegalHistoryItem[] {
  const published = state.published;
  if (state.history.length) {
    return state.history.map((item) => ({
      ...item,
      snapshot:
        item.snapshot || (published && published.version === item.version ? published : null),
    }));
  }
  if (!published) return [];
  return [
    {
      version: published.version,
      publishedAt: published.publishedAt,
      snapshot: published,
    },
  ];
}

function VersionHistory({
  items,
  selected,
  onSelect,
}: {
  items: LegalHistoryItem[];
  selected: number | null;
  onSelect: (version: number) => void;
}) {
  const latest = items.reduce((max, item) => Math.max(max, item.version), 0);
  return (
    <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[min(440px,70dvh)] overflow-y-auto rounded-xl border border-[var(--border)] bg-white p-3 shadow-[0_16px_40px_rgba(0,0,0,0.16)]">
      {items.length ? (
        <ul className="space-y-1">
          {items.map((item) => {
            const open = selected === item.version;
            const when = new Date(item.publishedAt).toLocaleString("es", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <li key={item.version} className="rounded-lg">
                <button
                  type="button"
                  onClick={() => onSelect(item.version)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--surface-alt)]"
                  aria-expanded={open}
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-[var(--foreground)]">
                      Versión {item.version}
                    </span>
                    <span className="block text-[11px] text-[var(--muted)]">{when}</span>
                  </span>
                  {item.version === latest ? (
                    <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--foreground)]">
                      En línea
                    </span>
                  ) : null}
                </button>
                {open ? <VersionBody item={item} /> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-1 py-1 text-[12px] leading-relaxed text-[var(--muted)]">
          Todavía no hay versiones publicadas.
        </p>
      )}
    </div>
  );
}

function VersionBody({ item }: { item: LegalHistoryItem }) {
  if (!item.snapshot) {
    return (
      <p className="px-2 pb-2 text-[12px] leading-relaxed text-[var(--muted)]">
        Esta versión solo tiene la fecha. El texto se guarda a partir de la próxima publicación.
      </p>
    );
  }
  const snapshot = item.snapshot;
  const docs = [
    ...LEGAL_DOCS.map((meta) => ({
      id: meta.id,
      label: snapshot.docs[meta.id].label || meta.label,
      title: snapshot.docs[meta.id].title,
      body: snapshot.docs[meta.id].body,
    })),
    ...snapshot.extras,
  ];
  return (
    <div className="space-y-3 px-2 pb-2">
      {docs.map((document) => (
        <div key={document.id}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted-soft)]">
            {document.label}
          </p>
          <p className="mt-0.5 text-[13px] font-semibold text-[var(--foreground)]">
            {fillLegalText(document.title, snapshot.profile, item.publishedAt)}
          </p>
          <p className="mt-1 line-clamp-5 whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--muted)]">
            {fillLegalText(document.body, snapshot.profile, item.publishedAt)}
          </p>
        </div>
      ))}
    </div>
  );
}

function OwnSiteHelp({
  profile,
  origin,
  copied,
  onCopy,
}: {
  profile: LegalProfile;
  origin: string;
  copied: string;
  onCopy: (value: string, key: string) => void;
}) {
  const [host, setHost] = useState<"any" | "vercel" | "netlify" | "nginx">("any");
  const links = ownSiteLinks(profile, origin);
  if (!links.length) {
    return (
      <p className="text-[13px] leading-relaxed text-[var(--danger)]">
        Escribe el dominio en Datos de la app. Con eso salen direcciones como tudominio.com/privacy-policy.
      </p>
    );
  }
  const rows = links.map((link) => ({ ...link, path: new URL(link.from).pathname }));
  const snippets = {
    vercel: ownSiteVercelCode(profile, origin),
    netlify: rows
      .map(
        (link) =>
          `[[redirects]]\n  from = "${link.path}"\n  to = "${link.to}"\n  status = 200\n  force = true`
      )
      .join("\n\n"),
    nginx: rows
      .map((link) => {
        const destination = new URL(link.to);
        return `location = ${link.path} {\n  proxy_pass ${link.to};\n  proxy_ssl_server_name on;\n  proxy_set_header Host ${destination.host};\n}`;
      })
      .join("\n\n"),
  };
  const hosts = [
    ["any", "Cualquier web"],
    ["vercel", "Vercel"],
    ["netlify", "Netlify"],
    ["nginx", "Nginx"],
  ] as const;

  return (
    <div className="space-y-5">
      <p className="text-[14px] leading-relaxed text-[var(--foreground)]">
        En la App Store pega direcciones de tu dominio. Quien las abra tiene que seguir viendo tu web en la barra, y el texto es el que publicas aquí.
      </p>
      <ol className="space-y-3 text-[13px] leading-relaxed text-[var(--muted)]">
        <li>
          <span className="font-semibold text-[var(--foreground)]">1. Copia estas direcciones.</span> Son las que van en la ficha de la tienda y dentro de la app.
        </li>
        <li>
          <span className="font-semibold text-[var(--foreground)]">2. Tu web muestra esa página por debajo.</span> Cada ruta pide el documento a Vantko y lo enseña sin cambiar la dirección. Eso es un proxy, no una redirección: un 301 o un 302 mandaría al visitante a vantko.com.
        </li>
      </ol>
      <ul className="space-y-2">
        {rows.map((link) => (
          <li key={link.id} className="rounded-xl border border-[var(--border)] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] font-semibold text-[var(--foreground)]">{link.label}</p>
              <button
                type="button"
                onClick={() => onCopy(link.from, `own-${link.id}`)}
                className="shrink-0 rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-[11px] font-semibold text-[var(--foreground)]"
              >
                {copied === `own-${link.id}` ? "Copiado" : "Copiar"}
              </button>
            </div>
            <p className="mt-1 truncate text-[12px] text-[var(--foreground)]">{link.from}</p>
            <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">muestra el contenido de {link.to}</p>
          </li>
        ))}
      </ul>
      <div>
        <p className="text-[12px] font-semibold text-[var(--foreground)]">Según dónde esté alojada tu web</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {hosts.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setHost(id)}
              className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                host === id
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface-alt)] text-[var(--foreground)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {host === "any" ? (
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">
            En el panel de tu hosting, WordPress, Cloudflare o el servidor, crea un proxy de cada ruta hacia la URL de Vantko. Si solo encuentras “redirección”, no la uses: tiene que conservar tu dominio en la barra.
          </p>
        ) : (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">
                {host === "vercel" ? "vercel.json" : host === "netlify" ? "netlify.toml" : "nginx"}
              </p>
              <button
                type="button"
                onClick={() => onCopy(snippets[host], "own-code")}
                className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-[11px] font-semibold text-[var(--foreground)]"
              >
                {copied === "own-code" ? "Copiado" : "Copiar"}
              </button>
            </div>
            <pre className="mt-2 max-h-52 overflow-auto rounded-xl bg-[var(--surface-alt)] p-3 text-[11px] leading-relaxed text-[var(--foreground-soft)]">
              {snippets[host]}
            </pre>
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted)]">
              {host === "vercel"
                ? "Los rewrites de Vercel sirven la página y dejan la dirección en tu dominio."
                : host === "netlify"
                  ? "El estado 200 en Netlify es un proxy. Un 301 cambiaría la dirección."
                  : "Nginx pide la página a Vantko y la responde como si fuera tuya."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function foldCountry(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function CountryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = legalCountryByName(value);
  const folded = foldCountry(query.trim());
  const options = folded
    ? LEGAL_COUNTRIES.filter((country) => foldCountry(country.name).includes(folded))
    : LEGAL_COUNTRIES;

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setQuery("");
          setOpen((next) => !next);
        }}
        className={`${inputClass} flex items-center gap-2 text-left`}
      >
        {selected ? (
          <>
            <span aria-hidden>{selected.flag}</span>
            <span>{selected.name}</span>
          </>
        ) : (
          <span className="text-[#c4c8d0]">{value.trim() || "Selecciona un país"}</span>
        )}
      </button>
      {open ? (
        <div className="mt-1 overflow-hidden rounded-xl border border-[#e6e7eb] bg-white shadow-[0_12px_32px_rgba(17,24,39,0.08)]">
          <div className="border-b border-[#f0f1f3] p-2">
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar"
              aria-label="Buscar país"
              className="w-full rounded-lg border border-[#e6e7eb] bg-white px-2.5 py-1.5 text-[13px] outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {options.length ? (
              options.map((country) => {
                const active = selected?.code === country.code;
                return (
                  <li key={country.code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(country.name);
                        setQuery("");
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] ${
                        active ? "bg-[var(--surface-alt)] font-semibold text-[var(--foreground)]" : "text-[var(--foreground)]"
                      }`}
                    >
                      <span aria-hidden>{country.flag}</span>
                      {country.name}
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-2 text-[12px] text-[var(--muted-soft)]">Sin resultados</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ExpandIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 5.5H5.5V9M15 5.5h3.5V9M9 18.5H5.5V15M15 18.5h3.5V15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 text-white transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "rotate-90" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path d="M9 6.5 15 12 9 17.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 4.5h9.2L19.5 8.8V19.5H6V4.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M8.5 4.5V9h6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.5 19.5v-5h7v5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function LinkMark() {
  return (
    <svg className="h-4 w-4 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 13.5a4 4 0 0 0 5.7.4l2.3-2.3a4 4 0 0 0-5.7-5.7L11 7.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M14 10.5a4 4 0 0 0-5.7-.4L6 12.4a4 4 0 0 0 5.7 5.7L13 16.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MailMark() {
  return (
    <svg className="h-4 w-4 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="m5 8 7 5 7-5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4.2L19.2 9a1.8 1.8 0 0 0 0-2.5L17.5 4.8a1.8 1.8 0 0 0-2.5 0L4 15.8V20Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M13.5 6.5 17.5 10.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">
      {label}
      <div className="mt-1.5 font-normal normal-case tracking-normal">{children}</div>
    </label>
  );
}
