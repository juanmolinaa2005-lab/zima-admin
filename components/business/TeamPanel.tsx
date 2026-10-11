"use client";

import { useState, type FormEvent } from "react";
import { PlusIcon } from "@/components/dashboard/icons";
import {
  newId,
  type BusinessMember,
  type BusinessWorkspace,
  type TeamRole,
} from "@/lib/business/workspace-store";
import {
  DeleteButton,
  EmptyState,
  Field,
  FormCard,
  SectionHead,
} from "./section-ui";

type TeamPanelProps = {
  team: BusinessMember[];
  onChange: (next: (prev: BusinessWorkspace) => BusinessWorkspace) => void;
};

export function TeamPanel({ team, onChange }: TeamPanelProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("member");

  function reset() {
    setName("");
    setEmail("");
    setRole("member");
    setOpen(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onChange((prev) => ({
      ...prev,
      team: [
        {
          id: newId(),
          name: trimmed,
          email: email.trim(),
          role,
          createdAt: new Date().toISOString(),
        },
        ...prev.team,
      ],
    }));
    reset();
  }

  function remove(member: BusinessMember) {
    if (!window.confirm(`Quitar a ${member.name} del team?`)) return;
    onChange((prev) => ({
      ...prev,
      team: prev.team.filter((item) => item.id !== member.id),
    }));
  }

  return (
    <>
      <SectionHead
        kicker="My Business"
        title="Team"
        description="Quién forma parte del negocio."
        action={
          <button type="button" onClick={() => setOpen(true)} className="ui-btn-primary">
            <PlusIcon className="h-4 w-4" />
            Añadir persona
          </button>
        }
      />

      {open ? (
        <FormCard
          title="Añadir persona"
          onSubmit={handleSubmit}
          onCancel={reset}
          submitLabel="Añadir"
        >
          <Field label="Nombre">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Nombre"
              className="ui-input"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hola@…"
              className="ui-input"
            />
          </Field>
          <Field label="Rol">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as TeamRole)}
              className="ui-input"
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
          </Field>
        </FormCard>
      ) : null}

      {team.length === 0 && !open ? (
        <EmptyState
          title="Sin team"
          body="Añade a la primera persona."
          actionLabel="Añadir persona"
          onAction={() => setOpen(true)}
        />
      ) : (
        <ul className="ui-card mt-6 divide-y divide-[var(--border)] overflow-hidden">
          {team.map((member) => {
            const initials = member.name
              .split(" ")
              .map((part) => part[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <li
                key={member.id}
                className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-[var(--background)]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[image:var(--accent-metal)] text-[12px] font-bold text-white">
                  {initials || "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
                    {member.name}
                  </p>
                  <p className="truncate text-[13px] text-[var(--muted)]">
                    {member.email || "Sin email"}
                  </p>
                </div>
                <span className="ui-tag ui-tag-muted">
                  {member.role === "admin" ? "Admin" : "Member"}
                </span>
                <DeleteButton
                  label={`Quitar a ${member.name}`}
                  onClick={() => remove(member)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
