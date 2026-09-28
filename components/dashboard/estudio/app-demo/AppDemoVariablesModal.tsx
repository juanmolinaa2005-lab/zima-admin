"use client";

import { useEffect, useState } from "react";
import { CloseIcon } from "@/components/dashboard/icons";
import type { AppDemoVariable } from "@/lib/creator/app-demo";
import { AppDemoVariablesEditor } from "./AppDemoVariablesEditor";

export function AppDemoVariablesButton({
  variables,
  onChange,
  tone = "light",
  projectId,
}: {
  variables: AppDemoVariable[];
  onChange: (next: AppDemoVariable[]) => void;
  tone?: "light" | "dark";
  projectId?: string;
}) {
  const [open, setOpen] = useState(false);
  const count = variables.length;
  const photos = variables.filter((item) => item.type === "image" && item.value).length;
  const dark = tone === "dark";

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-white shadow-[0_6px_16px_rgba(var(--accent-rgb),0.35)] transition hover:bg-[var(--accent-hover)]"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/20 font-mono text-[11px] leading-none">
          {"{ }"}
        </span>
        Variables
        <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold leading-none">
          {count}
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-demo-vars-title"
            className={`relative z-[81] flex max-h-[min(86vh,760px)] w-full max-w-[560px] flex-col overflow-hidden rounded-xl shadow-[0_28px_90px_rgba(0,0,0,0.45)] ${
              dark
                ? "border border-white/10 bg-[#14151a] text-white"
                : "border border-[var(--border)] bg-white text-[#111827]"
            }`}
          >
            <div
              className={`flex items-start justify-between gap-3 border-b px-5 py-4 ${
                dark ? "border-white/8" : "border-[var(--border)]"
              }`}
            >
              <div>
                <p
                  id="app-demo-vars-title"
                  className="text-[17px] font-semibold tracking-tight"
                >
                  Variables
                </p>
                <p
                  className={`mt-1 text-[12px] leading-relaxed ${
                    dark ? "text-white/40" : "text-[#9ca3af]"
                  }`}
                >
                  Tokens del preview. Cambia texto, color o foto y se refleja
                  al instante · vars.nombre
                  {photos ? ` · ${photos} foto${photos === 1 ? "" : "s"}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`rounded-xl p-1.5 ${
                  dark
                    ? "text-white/45 hover:bg-white/10 hover:text-white"
                    : "text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827]"
                }`}
                aria-label="Cerrar variables"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <AppDemoVariablesEditor
                hideHeader
                tone={tone}
                projectId={projectId}
                variables={variables}
                onChange={onChange}
              />
            </div>
            <div
              className={`flex items-center justify-between gap-3 border-t px-5 py-3 ${
                dark ? "border-white/8" : "border-[var(--border)]"
              }`}
            >
              <p
                className={`text-[11px] ${dark ? "text-white/30" : "text-[#9ca3af]"}`}
              >
                Esc para cerrar
              </p>
              <button
                type="button"
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[var(--accent-hover)]"
                onClick={() => setOpen(false)}
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
