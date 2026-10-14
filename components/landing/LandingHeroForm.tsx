"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LandingHeroForm() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.push("/login");
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-[360px]">
      <label className="flex h-12 items-center rounded-full bg-white pl-5 pr-1.5 shadow-[0_10px_40px_-12px_rgba(26,40,80,0.28)] ring-1 ring-black/[0.06]">
        <span className="sr-only">Tu negocio o correo</span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="tunegocio.com"
          autoComplete="url"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-[#1a1f36] outline-none placeholder:text-[#8792a2]"
        />
        <button
          type="submit"
          aria-label="Entrar en Vantko"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111114] text-white transition hover:bg-[#2b2b31]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </label>
      <p className="mt-3 text-center text-[12.5px] text-white/65">Entra a tu cuenta</p>
    </form>
  );
}
