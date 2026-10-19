"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CONTRACT_STATUSES,
  CURRENCIES,
  PAYMENT_TERMS,
  contractPlainText,
  contractSections,
  defaultParams,
  formatFee,
  type Contract,
  type ContractParams,
  type ContractStatus,
} from "@/lib/influencers/contract";
import type { PipelineCreator } from "@/lib/influencers/pipeline";
import { CreatorAvatar } from "./InfluencerPipelinePage";
import { Button, Dot, Drawer, Empty, Field, Header, Page, TextArea, TextInput, api, copyText, notifyError, useLoad, useRefreshOnActive } from "./ui";

type Draft = { id?: string; creatorId: string | null; params: ContractParams; status: ContractStatus };

const STATUS = Object.fromEntries(CONTRACT_STATUSES.map((s) => [s.id, s])) as Record<ContractStatus, (typeof CONTRACT_STATUSES)[number]>;

const USAGE_OPTIONS = [
  { value: 0, label: "No" },
  { value: 30, label: "30 días" },
  { value: 90, label: "90 días" },
  { value: 365, label: "1 año" },
];
const EXCLUSIVITY_OPTIONS = [
  { value: 0, label: "No" },
  { value: 7, label: "7 días" },
  { value: 30, label: "30 días" },
  { value: 90, label: "90 días" },
];
const REVISION_OPTIONS = [0, 1, 2, 3].map((n) => ({ value: n, label: String(n) }));

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function printContract(p: ContractParams) {
  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Permite las ventanas emergentes para descargar el PDF");
    return;
  }
  const sections = contractSections(p)
    .map((s, i) => `<h2>${i + 1}. ${escapeHtml(s.title)}</h2><p>${escapeHtml(s.body)}</p>`)
    .join("");
  const brand = escapeHtml(p.brandName.trim() || "La Marca");
  const creator = escapeHtml(p.creatorName.trim() || "El Creador");
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Contrato · ${creator}</title><style>
    body{font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111;max-width:680px;margin:48px auto;padding:0 24px}
    h1{font-size:20px;letter-spacing:.04em;text-align:center;margin:0 0 32px}
    h2{font-size:14px;margin:24px 0 4px}
    p{margin:0}
    .sign{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:64px}
    .sign div{border-top:1px solid #111;padding-top:8px;font-size:12px}
  </style></head><body><h1>ACUERDO DE COLABORACIÓN</h1>${sections}<div class="sign"><div>${brand}</div><div>${creator}</div></div></body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

function ContractPreview({ params }: { params: ContractParams }) {
  const sections = contractSections(params);
  return (
    <div className="max-h-[30dvh] overflow-y-auto p-6 sm:max-h-[calc(100dvh-48px)]">
      <p className="mb-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">Vista previa</p>
      <h2 className="mb-5 text-center text-[15px] font-semibold tracking-[0.04em] text-[var(--foreground)]">ACUERDO DE COLABORACIÓN</h2>
      <ol className="space-y-3.5">
        {sections.map((s, i) => (
          <li key={s.title}>
            <p className="text-[12px] font-semibold text-[var(--foreground)]">
              {i + 1}. {s.title}
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--foreground-soft)]">{s.body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-8 grid grid-cols-2 gap-6 text-[11px] text-[var(--muted)]">
        <p className="border-t border-[var(--foreground)]/60 pt-1.5">{params.brandName.trim() || "La Marca"}</p>
        <p className="border-t border-[var(--foreground)]/60 pt-1.5">{params.creatorName.trim() || "El Creador"}</p>
      </div>
    </div>
  );
}

function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label}>
      <span className="mb-1.5 block text-[12px] font-medium text-[var(--foreground-soft)]">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              className={`inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-medium transition ${
                on
                  ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                  : "border-[var(--border)] bg-white text-[var(--foreground-soft)] hover:border-[var(--border-strong)]"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ContractsPage({ projectId, projectName, active }: { projectId: string; projectName: string; active?: boolean }) {
  const base = `/api/projects/${projectId}/contracts`;
  const { data, setData, loading, reload } = useLoad<{ items: Contract[] }>(base, { items: [] });
  const creatorsLoad = useLoad<{ items: PipelineCreator[] }>(`/api/projects/${projectId}/viewtracker/creators`, { items: [] });
  useRefreshOnActive(active, reload, creatorsLoad.reload);
  const contracts = data.items;
  const creators = creatorsLoad.data.items;
  const creatorById = useMemo(() => new Map(creators.map((c) => [c.id, c])), [creators]);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const setParams = (changes: Partial<ContractParams>) => setDraft((d) => (d ? { ...d, params: { ...d.params, ...changes } } : d));

  function openNew() {
    setDraft({ creatorId: null, status: "draft", params: defaultParams({ brandName: projectName }) });
  }

  function pickCreator(id: string) {
    const c = creatorById.get(id);
    setDraft((d) =>
      d ? { ...d, creatorId: c?.id ?? null, params: { ...d.params, creatorName: c?.name ?? d.params.creatorName, creatorEmail: c?.email ?? d.params.creatorEmail } } : d,
    );
  }

  function upsertLocal(item: Contract) {
    setData((d) => ({ items: d.items.some((c) => c.id === item.id) ? d.items.map((c) => (c.id === item.id ? item : c)) : [item, ...d.items] }));
  }

  async function save() {
    if (!draft) return;
    if (!draft.params.creatorName.trim()) {
      toast.error("Pon el nombre del creador");
      return;
    }
    setSaving(true);
    try {
      const body = { creatorId: draft.creatorId, params: draft.params, status: draft.status };
      const { item } = draft.id
        ? await api<{ item: Contract }>(base, "PATCH", { id: draft.id, ...body })
        : await api<{ item: Contract }>(base, "POST", body);
      upsertLocal(item);
      toast.success("Contrato guardado");
      setDraft(null);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(c: Contract, status: ContractStatus) {
    upsertLocal({ ...c, status });
    try {
      const { item } = await api<{ item: Contract }>(base, "PATCH", { id: c.id, status });
      upsertLocal(item);
    } catch (e) {
      upsertLocal(c);
      notifyError(e);
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este contrato?")) return;
    try {
      await api(`${base}?id=${id}`, "DELETE");
      setData((d) => ({ items: d.items.filter((c) => c.id !== id) }));
      setDraft(null);
    } catch (e) {
      notifyError(e);
    }
  }

  const p = draft?.params;

  return (
    <Page>
      <Header
        kicker="Influencers"
        title="Contratos"
        subtitle="Rellena unos pocos datos y el contrato se escribe solo. Descárgalo en PDF o copia el texto para enviarlo."
        actions={
          <Button variant="primary" onClick={openNew}>
            + Nuevo contrato
          </Button>
        }
      />

      {loading ? (
        <div className="ui-skeleton h-[320px] rounded-2xl" />
      ) : contracts.length === 0 ? (
        <Empty
          title="Aún no hay contratos"
          text="Elige un creador, pon el importe y lo que publicará, y tendrás el contrato listo para firmar."
          action={
            <Button variant="primary" onClick={openNew}>
              + Nuevo contrato
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {contracts.map((c) => {
            const creator = c.creatorId ? creatorById.get(c.creatorId) : undefined;
            return (
              <li
                key={c.id}
                className="relative flex min-h-[84px] flex-wrap items-center gap-x-4 gap-y-3 overflow-hidden rounded-[24px] border border-[var(--border)] bg-white py-3.5 pl-[100px] pr-4 shadow-[var(--shadow-xs)] xl:grid xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_150px_auto]"
              >
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  onClick={() => setDraft({ id: c.id, creatorId: c.creatorId, params: c.params, status: c.status })}
                  className="absolute inset-y-0 left-0 w-[84px]"
                >
                  <CreatorAvatar creator={{ name: c.creatorName, profileUrl: creator?.profileUrl ?? null }} className="h-full w-full text-[22px]" />
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ id: c.id, creatorId: c.creatorId, params: c.params, status: c.status })}
                  className="min-w-[180px] flex-1 text-left xl:min-w-0"
                >
                  <span className="block truncate text-[14px] font-semibold text-[var(--foreground)]">{c.creatorName}</span>
                  <span className="block truncate text-[12px] text-[var(--muted-soft)]">
                    {formatFee(c.params)} · {PAYMENT_TERMS.find((t) => t.id === c.params.paymentTerms)?.label}
                  </span>
                </button>

                <p className="min-w-0 truncate text-[12px] text-[var(--muted)]" title={c.params.deliverables}>
                  {c.params.deliverables || "—"}
                  {c.params.publishBy ? (
                    <span className="block text-[11px] text-[var(--muted-soft)]">
                      Publicar antes del {new Date(`${c.params.publishBy}T12:00:00`).toLocaleDateString("es", { day: "numeric", month: "short" })}
                    </span>
                  ) : null}
                </p>

                <label className="relative inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-alt)]/60 pl-2.5 pr-7 text-[12px] font-semibold text-[var(--foreground)] hover:border-[var(--border-strong)]">
                  <Dot color={STATUS[c.status].color} />
                  {STATUS[c.status].label}
                  <span aria-hidden className="pointer-events-none absolute right-2.5 text-[10px] text-[var(--muted-soft)]">
                    ▾
                  </span>
                  <select
                    aria-label={`Estado del contrato de ${c.creatorName}`}
                    value={c.status}
                    onChange={(e) => setStatus(c, e.target.value as ContractStatus)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  >
                    {CONTRACT_STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="ml-auto flex items-center gap-1.5">
                  <Button onClick={() => copyText(contractPlainText(c.params), "Contrato copiado")}>Copiar texto</Button>
                  <Button variant="primary" onClick={() => printContract(c.params)}>
                    Descargar PDF
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Drawer
        open={draft !== null}
        title={draft?.id ? `Contrato con ${draft.params.creatorName || "creador"}` : "Nuevo contrato"}
        subtitle="Cambia los datos y el contrato se actualiza al momento"
        onClose={() => setDraft(null)}
        wide
        aside={p ? <ContractPreview params={p} /> : null}
        footer={
          <>
            {draft?.id ? (
              <Button variant="danger" onClick={() => remove(draft.id!)}>
                Eliminar
              </Button>
            ) : null}
            <span className="flex-1" />
            {p ? <Button onClick={() => printContract(p)}>Descargar PDF</Button> : null}
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
        {draft && p ? (
          <div className="space-y-5">
            <section className="space-y-3">
              <Field label="Creador">
                <select
                  value={draft.creatorId ?? ""}
                  onChange={(e) => pickCreator(e.target.value)}
                  className="ui-input text-[13px]"
                >
                  <option value="">Escribir a mano…</option>
                  {creators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nombre del creador">
                  <TextInput value={p.creatorName} onChange={(e) => setParams({ creatorName: e.target.value })} placeholder="Ej. Make Money Matt" />
                </Field>
                <Field label="Email del creador">
                  <TextInput type="email" value={p.creatorEmail} onChange={(e) => setParams({ creatorEmail: e.target.value })} placeholder="creador@email.com" />
                </Field>
              </div>
              <Field label="Marca">
                <TextInput value={p.brandName} onChange={(e) => setParams({ brandName: e.target.value })} placeholder="Nombre de tu marca o empresa" />
              </Field>
            </section>

            <section className="space-y-3">
              <Field label="Qué publicará">
                <TextArea value={p.deliverables} onChange={(e) => setParams({ deliverables: e.target.value })} placeholder="Ej. 1 video de TikTok y 3 historias de Instagram" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px_minmax(0,1fr)]">
                <Field label="Importe">
                  <TextInput
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={p.fee || ""}
                    onChange={(e) => setParams({ fee: Number(e.target.value) || 0 })}
                    placeholder="500"
                  />
                </Field>
                <Field label="Moneda">
                  <select value={p.currency} onChange={(e) => setParams({ currency: e.target.value })} className="ui-input text-[13px]">
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Publicar antes del">
                  <TextInput type="date" value={p.publishBy} onChange={(e) => setParams({ publishBy: e.target.value })} />
                </Field>
              </div>
              <Choice
                label="Cómo se paga"
                value={p.paymentTerms}
                options={PAYMENT_TERMS.map((t) => ({ value: t.id, label: t.label }))}
                onChange={(paymentTerms) => setParams({ paymentTerms })}
              />
            </section>

            <section className="space-y-3">
              <Choice label="Usar el video en anuncios" value={p.usageDays} options={USAGE_OPTIONS} onChange={(usageDays) => setParams({ usageDays })} />
              <Choice
                label="Exclusividad con la competencia"
                value={p.exclusivityDays}
                options={EXCLUSIVITY_OPTIONS}
                onChange={(exclusivityDays) => setParams({ exclusivityDays })}
              />
              <Choice label="Rondas de cambios" value={p.revisions} options={REVISION_OPTIONS} onChange={(revisions) => setParams({ revisions })} />
              <Field label="Otras condiciones" hint="Opcional. Se añade como una cláusula más.">
                <TextArea value={p.extraTerms} onChange={(e) => setParams({ extraTerms: e.target.value })} placeholder="Ej. El código de descuento ZIMA10 debe aparecer en la descripción" />
              </Field>
            </section>
          </div>
        ) : null}
      </Drawer>
    </Page>
  );
}
