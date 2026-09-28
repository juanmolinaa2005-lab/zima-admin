"use client";

import { useState, type FormEvent } from "react";
import { PlusIcon } from "@/components/dashboard/icons";
import {
  newId,
  type BusinessContract,
  type BusinessWorkspace,
  type ContractStatus,
} from "@/lib/business/workspace-store";
import {
  DeleteButton,
  EmptyState,
  Field,
  FormCard,
  SectionHead,
} from "./section-ui";

const STATUS_LABEL: Record<ContractStatus, string> = {
  draft: "Borrador",
  active: "Activo",
  expired: "Vencido",
};

const STATUS_CLASS: Record<ContractStatus, string> = {
  draft: "ui-tag ui-tag-muted",
  active: "ui-tag ui-tag-success",
  expired: "ui-tag ui-tag-danger",
};

type ContractsPanelProps = {
  contracts: BusinessContract[];
  onChange: (next: (prev: BusinessWorkspace) => BusinessWorkspace) => void;
};

export function ContractsPanel({ contracts, onChange }: ContractsPanelProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [party, setParty] = useState("");
  const [status, setStatus] = useState<ContractStatus>("draft");
  const [amount, setAmount] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  function reset() {
    setTitle("");
    setParty("");
    setStatus("draft");
    setAmount("");
    setStart("");
    setEnd("");
    setOpen(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onChange((prev) => ({
      ...prev,
      contracts: [
        {
          id: newId(),
          title: trimmed,
          party: party.trim(),
          status,
          amount: amount.trim(),
          start,
          end,
          createdAt: new Date().toISOString(),
        },
        ...prev.contracts,
      ],
    }));
    reset();
  }

  function remove(contract: BusinessContract) {
    if (!window.confirm(`Eliminar contrato “${contract.title}”?`)) return;
    onChange((prev) => ({
      ...prev,
      contracts: prev.contracts.filter((item) => item.id !== contract.id),
    }));
  }

  return (
    <>
      <SectionHead
        kicker="My Business"
        title="Contratos"
        description="Acuerdos y vigencia."
        action={
          <button type="button" onClick={() => setOpen(true)} className="ui-btn-primary">
            <PlusIcon className="h-4 w-4" />
            Nuevo contrato
          </button>
        }
      />

      {open ? (
        <FormCard
          title="Nuevo contrato"
          onSubmit={handleSubmit}
          onCancel={reset}
          submitLabel="Guardar"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="MSA, freelance…"
                className="ui-input"
              />
            </Field>
            <Field label="Contraparte">
              <input
                value={party}
                onChange={(e) => setParty(e.target.value)}
                placeholder="Cliente o proveedor"
                className="ui-input"
              />
            </Field>
            <Field label="Estado">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ContractStatus)}
                className="ui-input"
              >
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
                <option value="expired">Vencido</option>
              </select>
            </Field>
            <Field label="Importe">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="$0"
                className="ui-input"
              />
            </Field>
            <Field label="Inicio">
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="ui-input"
              />
            </Field>
            <Field label="Fin">
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="ui-input"
              />
            </Field>
          </div>
        </FormCard>
      ) : null}

      {contracts.length === 0 && !open ? (
        <EmptyState
          title="Sin contratos"
          body="Añade el primero para llevar el control."
          actionLabel="Nuevo contrato"
          onAction={() => setOpen(true)}
        />
      ) : (
        <ul className="mt-5 space-y-2">
          {contracts.map((contract) => (
            <li
              key={contract.id}
              className="flex items-start gap-3 rounded-xl bg-white p-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[15px] font-semibold text-[var(--foreground)]">
                    {contract.title}
                  </p>
                  <span className={STATUS_CLASS[contract.status]}>
                    {STATUS_LABEL[contract.status]}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-[var(--muted)]">
                  {contract.party || "Sin contraparte"}
                  {contract.amount ? ` · ${contract.amount}` : ""}
                </p>
                {contract.start || contract.end ? (
                  <p className="mt-1 text-[12px] text-[var(--muted-soft)]">
                    {[contract.start || "—", contract.end || "—"].join(" → ")}
                  </p>
                ) : null}
              </div>
              <DeleteButton
                label={`Eliminar ${contract.title}`}
                onClick={() => remove(contract)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
