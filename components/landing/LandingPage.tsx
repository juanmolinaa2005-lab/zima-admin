import Image from "next/image";
import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import { LandingHeroForm } from "./LandingHeroForm";

const serif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold ${
          light ? "bg-white text-[#111114]" : "bg-[#111114] text-white"
        }`}
      >
        V
      </span>
      <span className={`text-[15px] font-semibold tracking-tight ${light ? "text-white" : "text-[#111114]"}`}>
        Vantko
      </span>
    </span>
  );
}

const TOOLS = [
  { name: "Legal", hint: "Privacidad y términos publicados" },
  { name: "Screenshots", hint: "Ficha de App Store y Play" },
  { name: "Market", hint: "Competencia, keywords, anuncios" },
  { name: "Studio", hint: "Demos e influencers para redes" },
  { name: "Redes", hint: "Cuentas y publicación" },
  { name: "Emails", hint: "Soporte desde tu dominio" },
];

function HeroMock() {
  return (
    <div className="overflow-hidden rounded-t-2xl border border-b-0 border-[#e3e8ee] bg-white shadow-[0_-8px_50px_-18px_rgba(26,40,80,0.22)]">
      <div className="flex items-center gap-3 border-b border-[#e3e8ee] px-5 py-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#111114] text-[10px] font-bold text-white">V</span>
        <p className="text-[13px] font-medium text-[#1a1f36]">tuapp.com</p>
      </div>
      <ul>
        {TOOLS.map((t) => (
          <li key={t.name} className="flex items-baseline justify-between gap-6 border-b border-[#eef1f5] px-5 py-3.5 last:border-b-0">
            <span className="text-[14px] font-medium text-[#1a1f36]">{t.name}</span>
            <span className="truncate text-[13px] text-[#8792a2]">{t.hint}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-white text-[#1a1f36]">
      <header className="absolute inset-x-0 top-0 z-30">
        <nav className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Vantko, inicio">
            <Logo light />
          </Link>
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-full bg-white px-4 text-[13px] font-semibold text-[#111114] transition hover:bg-white/90"
          >
            Entrar
          </Link>
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="outline-none">
        <section className="relative min-h-[100dvh] overflow-hidden">
          <Image
            src="/hero-night.jpg"
            alt=""
            aria-hidden
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_40%]"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-white" />

          <div className="relative mx-auto flex min-h-[100dvh] max-w-[1120px] flex-col px-5 pt-24 sm:px-8">
            <div className="mx-auto mt-[7vh] max-w-[740px] text-center">
              <h1 className={`${serif.className} text-[48px] leading-[1.05] tracking-[-0.03em] text-white sm:text-[72px]`}>
                Ya creaste tu producto.
                <br />
                ¿Qué sigue?
              </h1>
              <p className="mx-auto mt-5 max-w-[400px] text-[16px] leading-relaxed text-white/80 sm:text-[18px]">
                Lo que necesitas después de terminar tu app.
              </p>
              <div className="mt-8">
                <LandingHeroForm />
              </div>
            </div>

            <div className="mx-auto mt-auto w-full max-w-[720px] pt-20">
              <HeroMock />
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between px-5 py-6 text-[13px] text-[#8792a2] sm:px-8">
          <Logo />
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-[#1a1f36]">Privacidad</Link>
            <Link href="/terms" className="hover:text-[#1a1f36]">Términos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
