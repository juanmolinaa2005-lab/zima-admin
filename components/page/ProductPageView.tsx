"use client";

import { useState, type FormEvent } from "react";
import { Instrument_Serif } from "next/font/google";
import type { PageUpdate, ProductPage } from "@/lib/page/types";

const serif = Instrument_Serif({ weight: "400", subsets: ["latin"], display: "swap" });

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function SubscribeForm({ slug, accent, preview }: { slug: string; accent: string; preview?: boolean }) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (preview) return;
    setStatus("sending");
    const res = await fetch("/api/public/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, email, website }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) {
      setStatus("done");
    } else {
      setStatus("error");
      setError(data.error || "No se pudo guardar. Inténtalo de nuevo.");
    }
  }

  if (status === "done") {
    return <p className="text-[15px] text-[#111114]">Listo. Te avisaremos de las novedades.</p>;
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex w-full items-center gap-1.5 rounded-full border border-black/10 bg-white p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-within:border-black/25">
        <label htmlFor={`email-${slug}`} className="sr-only">Email</label>
        <input
          id={`email-${slug}`}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          className="min-w-0 flex-1 bg-transparent px-3 text-[15px] text-[#111114] outline-none placeholder:text-black/35"
        />
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="hidden"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="h-10 shrink-0 rounded-full px-5 text-[14px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ background: accent }}
        >
          {status === "sending" ? "…" : "Avisarme"}
        </button>
      </div>
      {status === "error" ? <p className="mt-2 text-[13px] text-[#d92d20]">{error}</p> : null}
    </form>
  );
}

function StoreButton({ href, label, primary, accent }: { href: string; label: string; primary?: boolean; accent: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex h-11 items-center rounded-full px-5 text-[14px] font-medium transition hover:opacity-85 ${
        primary ? "text-white" : "border border-black/10 bg-white text-[#111114]"
      }`}
      style={primary ? { background: accent } : undefined}
    >
      {label}
    </a>
  );
}

export function ProductPageView({
  page,
  updates,
  legalSlug,
  preview,
}: {
  page: ProductPage;
  updates: PageUpdate[];
  legalSlug?: string | null;
  preview?: boolean;
}) {
  const name = page.title || "Mi app";
  const links = [
    page.ios_url ? { href: page.ios_url, label: "App Store" } : null,
    page.android_url ? { href: page.android_url, label: "Google Play" } : null,
    page.website_url ? { href: page.website_url, label: page.ios_url || page.android_url ? "Web" : "Probar gratis" } : null,
  ].filter((l): l is { href: string; label: string } => Boolean(l));

  return (
    <div className={`flex flex-col bg-white text-[#111114] ${preview ? "min-h-full" : "min-h-dvh"}`}>
      <div className={`mx-auto flex w-full max-w-[560px] flex-1 flex-col px-6 pb-10 ${preview ? "pt-12" : "pt-16 sm:pt-24"}`}>
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-[12px] text-[16px] font-semibold text-white"
            style={{ background: page.accent }}
          >
            {(name.trim()[0] || "A").toUpperCase()}
          </span>
          <span className="text-[15px] font-medium">{name}</span>
        </div>

        <h1 className={`${serif.className} mt-10 text-[44px] leading-[1.05] tracking-[-0.01em] sm:text-[56px]`}>
          {page.tagline || name}
        </h1>
        {page.description ? (
          <p className="mt-5 whitespace-pre-line text-[16px] leading-relaxed text-black/60">{page.description}</p>
        ) : null}

        {links.length > 0 ? (
          <div className="mt-8 flex flex-wrap gap-2">
            {links.map((link, i) => (
              <StoreButton key={link.label} href={link.href} label={link.label} primary={i === 0} accent={page.accent} />
            ))}
          </div>
        ) : null}

        {page.collect_emails ? (
          <div className="mt-10">
            <p className="mb-3 text-[14px] text-black/55">Recibe las novedades en tu correo.</p>
            <SubscribeForm slug={page.slug} accent={page.accent} preview={preview} />
          </div>
        ) : null}

        {updates.length > 0 ? (
          <section className="mt-16">
            <h2 className="text-[13px] font-medium text-black/45">Novedades</h2>
            <ul className="mt-4 space-y-7">
              {updates.map((update) => (
                <li key={update.id}>
                  <p className="text-[12px] text-black/40">{formatDate(update.created_at)}</p>
                  <p className="mt-1 text-[16px] font-medium">{update.title}</p>
                  {update.body ? <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-black/60">{update.body}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-20 text-[12px] text-black/40">
          {legalSlug ? (
            <>
              <a href={`/${legalSlug}/privacy`} className="hover:text-black/70">Privacidad</a>
              <a href={`/${legalSlug}/terms`} className="hover:text-black/70">Términos</a>
            </>
          ) : null}
          <a href="https://vantko.com" className="ml-auto hover:text-black/70">Hecho con Vantko</a>
        </footer>
      </div>
    </div>
  );
}
