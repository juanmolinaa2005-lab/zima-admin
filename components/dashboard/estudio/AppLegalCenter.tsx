"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  domainRedirects,
  fillLegalText,
  hostedLegalUrl,
  LEGAL_DOCS,
  type LegalDocId,
  type LegalNotice,
  type LegalState,
} from "@/lib/creator/app-legal";
import { LEGAL_COUNTRIES, legalCountryByName } from "@/lib/creator/legal-countries";

type MailAccount = { id: string; email: string; display_name: string | null };

type LegalResponse = LegalState & { origin: string };

const inputClass =
  "w-full rounded-xl border border-[#e6e7eb] bg-white px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none placeholder:text-[#c4c8d0] focus:border-[var(--accent)]";

export function AppLegalCenter({ projectId }: { projectId: string }) {
  const [state, setState] = useState<LegalResponse | null>(null);
  const [docId, setDocId] = useState<LegalDocId>("privacy");
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

  const draft = state?.draft;
  const origin = state?.origin || "https://vantko.com";
  const doc = draft?.docs[docId];
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

  function patchDocLabel(id: LegalDocId, value: string) {
    setState((current) => {
      if (!current) return current;
      return {
        ...current,
        draft: {
          ...current.draft,
          docs: {
            ...current.draft.docs,
            [id]: { ...current.draft.docs[id], label: value.slice(0, 40) },
          },
        },
      };
    });
  }

  function patchDoc(key: "title" | "body", value: string) {
    setState((current) => {
      if (!current) return current;
      return {
        ...current,
        draft: {
          ...current.draft,
          docs: {
            ...current.draft.docs,
            [docId]: { ...current.draft.docs[docId], [key]: value },
          },
        },
      };
    });
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

  const redirects = domainRedirects(draft.profile, origin);
  const preview = fillLegalText(doc.body, draft.profile, state.published?.publishedAt);

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)] lg:px-6">
        <div className="space-y-4">
          <section className="rounded-xl border border-[var(--border)] bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Datos de la app</h2>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void post("save")}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#5b4dff] px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                <SaveIcon />
                {busy === "save" ? "Guardando…" : "Guardar"}
              </button>
            </div>
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
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-white p-5">
            <div className="flex flex-wrap items-end gap-1 border-b border-[var(--border)]">
              {LEGAL_DOCS.map((item) => {
                const active = docId === item.id;
                const label = draft.docs[item.id].label || item.label;
                if (active && editingLabel) {
                  return (
                    <input
                      key={item.id}
                      autoFocus
                      value={label}
                      aria-label="Nombre del documento"
                      className="w-36 rounded-full border border-[var(--accent)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--foreground)] outline-none"
                      onChange={(e) => patchDocLabel(item.id, e.target.value)}
                      onBlur={(e) => {
                        const value = e.currentTarget.value.slice(0, 40).trim() || item.label;
                        const nextDraft = {
                          ...draft,
                          docs: {
                            ...draft.docs,
                            [item.id]: { ...draft.docs[item.id], label: value },
                          },
                        };
                        setState((current) =>
                          current ? { ...current, draft: nextDraft } : current
                        );
                        setEditingLabel(false);
                        void post("save", undefined, nextDraft);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEditingLabel(false);
                      }}
                    />
                  );
                }
                return (
                  <span key={item.id} className="inline-flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLabel(false);
                        setDocId(item.id);
                      }}
                      className={`-mb-px border-b-2 px-2.5 py-2 text-[13px] font-medium ${
                        active
                          ? "border-[#5b4dff] font-semibold text-[var(--foreground)]"
                          : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {label}
                    </button>
                    {active ? (
                      <button
                        type="button"
                        aria-label="Editar nombre"
                        onClick={() => setEditingLabel(true)}
                        className="grid h-7 w-7 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
                      >
                        <PencilIcon />
                      </button>
                    ) : null}
                  </span>
                );
              })}
            </div>
            <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">
              Título
              <input
                className={`${inputClass} mt-1.5 font-normal normal-case tracking-normal`}
                value={doc.title}
                onChange={(e) => patchDoc("title", e.target.value)}
              />
            </label>
            <label className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">
              Texto
              <textarea
                className={`${inputClass} mt-1.5 min-h-[280px] resize-y font-normal normal-case leading-relaxed tracking-normal`}
                value={doc.body}
                onChange={(e) => patchDoc("body", e.target.value)}
              />
            </label>
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
                className="rounded-lg bg-[#5b4dff] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
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
          <section className="rounded-xl border border-[var(--border)] bg-white p-5">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--foreground)]">
              <LinkMark />
              Enlaces públicos
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
              Pega estas URLs en la App Store y en la app.
            </p>
            <ul className="mt-3 space-y-2">
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
              <GlobeMark />
              En tu dominio
            </h2>
            {redirects.length ? (
              <>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
                  Redirige estas rutas de {draft.profile.domain} a la URL alojada.
                </p>
                <ul className="mt-3 space-y-3">
                  {redirects.map((item) => (
                    <li key={item.from} className="text-[12px] leading-relaxed">
                      <p className="font-medium text-[var(--foreground)]">{item.from.replace(/^https?:\/\//, "")}</p>
                      <p className="text-[var(--muted)]">→ {item.to.replace(/^https?:\/\//, "")}</p>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-[12px] text-[var(--muted-soft)]">
                Cuando pongas el dominio verás las rutas para redirigir /privacy, /terms, /cookies y /aviso.
              </p>
            )}
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
              className="mt-3 rounded-lg bg-[#5b4dff] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
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

          <section className="rounded-xl border border-[var(--border)] bg-[#fbfbfc] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">
              Vista previa
            </p>
            <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--foreground-soft)]">
              {preview.slice(0, 420)}
            </p>
          </section>
        </div>
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
    <svg className="h-4 w-4 text-[#5b4dff]" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function GlobeMark() {
  return (
    <svg className="h-4 w-4 text-[#5b4dff]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 12h16M12 4c2.2 2.4 2.2 13.6 0 16M12 4c-2.2 2.4-2.2 13.6 0 16" stroke="currentColor" strokeWidth="1.7" />
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
