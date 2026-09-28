"use client";

import { useState, type FormEvent } from "react";
import { PlusIcon } from "@/components/dashboard/icons";
import {
  newId,
  type BusinessTask,
  type BusinessWorkspace,
  type TaskStatus,
} from "@/lib/business/workspace-store";
import {
  DeleteButton,
  EmptyState,
  Field,
  FormCard,
  SectionHead,
} from "./section-ui";

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Pendiente",
  doing: "En curso",
  done: "Hecha",
};

const STATUS_CLASS: Record<TaskStatus, string> = {
  todo: "ui-tag ui-tag-muted",
  doing: "ui-tag ui-tag-accent",
  done: "ui-tag ui-tag-success",
};

type TasksPanelProps = {
  tasks: BusinessTask[];
  onChange: (next: (prev: BusinessWorkspace) => BusinessWorkspace) => void;
};

export function TasksPanel({ tasks, onChange }: TasksPanelProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  function reset() {
    setTitle("");
    setDue("");
    setOpen(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onChange((prev) => ({
      ...prev,
      tasks: [
        {
          id: newId(),
          title: trimmed,
          status: "todo",
          due: due || null,
          createdAt: new Date().toISOString(),
        },
        ...prev.tasks,
      ],
    }));
    reset();
  }

  function setStatus(id: string, status: TaskStatus) {
    onChange((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) =>
        task.id === id ? { ...task, status } : task
      ),
    }));
  }

  function remove(id: string) {
    onChange((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((task) => task.id !== id),
    }));
  }

  return (
    <>
      <SectionHead
        kicker="My Business"
        title="Task"
        description="Pendientes y seguimiento del negocio."
        action={
          <button type="button" onClick={() => setOpen(true)} className="ui-btn-primary">
            <PlusIcon className="h-4 w-4" />
            Nueva task
          </button>
        }
      />

      {open ? (
        <FormCard
          title="Nueva task"
          onSubmit={handleSubmit}
          onCancel={reset}
          submitLabel="Crear"
        >
          <Field label="Título">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Revisar contrato, call con cliente…"
              className="ui-input"
            />
          </Field>
          <Field label="Fecha">
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="ui-input"
            />
          </Field>
        </FormCard>
      ) : null}

      {tasks.length === 0 && !open ? (
        <EmptyState
          title="Sin tasks"
          body="Crea la primera para el equipo."
          actionLabel="Nueva task"
          onAction={() => setOpen(true)}
        />
      ) : (
        <ul className="mt-5 space-y-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-3 rounded-[18px] bg-white px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-[14px] font-semibold ${
                    task.status === "done"
                      ? "text-[var(--muted-soft)] line-through"
                      : "text-[var(--foreground)]"
                  }`}
                >
                  {task.title}
                </p>
                {task.due ? (
                  <p className="mt-0.5 text-[12px] text-[var(--muted-soft)]">{task.due}</p>
                ) : null}
              </div>
              <select
                value={task.status}
                onChange={(e) =>
                  setStatus(task.id, e.target.value as TaskStatus)
                }
                className={`${STATUS_CLASS[task.status]} cursor-pointer border-0 bg-transparent pr-1`}
              >
                {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((key) => (
                  <option key={key} value={key}>
                    {STATUS_LABEL[key]}
                  </option>
                ))}
              </select>
              <DeleteButton
                label={`Eliminar ${task.title}`}
                onClick={() => remove(task.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
