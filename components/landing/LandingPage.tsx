import Image from "next/image";
import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import { LandingHeroForm } from "./LandingHeroForm";
import { CountUp, type CountFormat } from "@/components/motion/CountUp";
import { RotatingWord } from "@/components/motion/RotatingWord";

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

const STATS: { label: string; value: number; format: CountFormat }[] = [
  { label: "Vistas · 7 días", value: 1_240_000, format: "compact" },
  { label: "Videos publicados", value: 63, format: "int" },
  { label: "Cuentas", value: 9, format: "int" },
  { label: "Creadores", value: 6, format: "int" },
];

const BARS = [22, 35, 28, 46, 40, 62, 55, 78, 70, 100];

const LOOP = [
  { name: "Publicación automática", hint: "9 cuentas · próximo video en 14 min" },
  { name: "Seguimiento", hint: "Vistas de cada video, actualizadas cada hora" },
  { name: "Creadores", hint: "6 activos · 3 respuestas nuevas" },
  { name: "Studio", hint: "12 videos con IA listos para revisar" },
];

function HeroMock() {
  return (
    <div className="overflow-hidden rounded-t-2xl border border-b-0 border-[#e3e8ee] bg-white shadow-[0_-8px_50px_-18px_rgba(26,40,80,0.22)]">
      <div className="flex items-center gap-3 border-b border-[#e3e8ee] px-5 py-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#111114] text-[10px] font-bold text-white">V</span>
        <p className="text-[13px] font-medium text-[#1a1f36]">Marketing</p>
        <span className="flex items-center gap-1.5 text-[12px] text-[#8792a2]">
          <span className="ui-live-dot" />
          En vivo
        </span>
        <span className="ml-auto flex h-6 items-end gap-[3px]" aria-hidden>
          {BARS.map((h, i) => (
            <span
              key={i}
              className="ui-grow-y w-1.5 rounded-sm bg-[#111114]"
              style={{ height: `${h}%`, animationDelay: `${900 + i * 60}ms`, opacity: 0.35 + (h / 100) * 0.65 }}
            />
          ))}
        </span>
      </div>
      <div className="grid grid-cols-2 border-b border-[#eef1f5] sm:grid-cols-4">
        {STATS.map((s, i) => (
          <div key={s.label} className="px-5 py-3.5">
            <p className="text-[11px] text-[#8792a2]">{s.label}</p>
            <p className="mt-0.5 text-[20px] font-semibold tracking-tight text-[#1a1f36]">
              <CountUp value={s.value} format={s.format} delay={800 + i * 120} duration={1400} />
            </p>
          </div>
        ))}
      </div>
      <ul className="ui-stagger-slow">
        {LOOP.map((t) => (
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
            className="ui-kenburns object-cover object-[center_40%]"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-white" />
          <div
            aria-hidden
            className="ui-glow pointer-events-none absolute left-1/2 top-[18%] h-[340px] w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(167,139,250,0.35),transparent)] blur-2xl"
          />

          <div className="relative mx-auto flex min-h-[100dvh] max-w-[1120px] flex-col px-5 pt-24 sm:px-8">
            <div className="mx-auto mt-[7vh] max-w-[740px] text-center">
              <h1 className={`${serif.className} text-[48px] leading-[1.05] tracking-[-0.03em] text-white sm:text-[72px]`}>
                <span className="ui-blur-rise block">El marketing de tu negocio,</span>
                <span className="ui-blur-rise block" style={{ animationDelay: "160ms" }}>
                  en automático.
                </span>
              </h1>
              <p
                className="ui-blur-rise mx-auto mt-5 max-w-[480px] text-[16px] leading-relaxed text-white/80 sm:text-[18px]"
                style={{ animationDelay: "320ms" }}
              >
                Publica solo en todas tus cuentas de{" "}
                <RotatingWord words={["TikTok", "Instagram", "YouTube"]} className="font-medium text-white" />, mide cada video y
                controla a tus creadores desde un solo sitio.
              </p>
              <div className="ui-blur-rise mt-8" style={{ animationDelay: "460ms" }}>
                <LandingHeroForm />
              </div>
            </div>

            <div className="ui-blur-rise mx-auto mt-auto w-full max-w-[720px] pt-20" style={{ animationDelay: "620ms" }}>
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
