import Link from "next/link";
import { STAGES } from "@/lib/launch/playbook";

const PAINS = [
  {
    title: "“¿Dónde lo lanzo?”",
    body: "Product Hunt, Reddit, TikTok, la App Store… Cada sitio tiene sus reglas y nadie te dice por dónde empezar.",
  },
  {
    title: "“Tengo usuarios, pero nadie paga”",
    body: "Precios, paywall, pruebas gratuitas, emails de fin de prueba. Monetizar es un oficio en sí mismo.",
  },
  {
    title: "“Uso 15 herramientas distintas”",
    body: "Una para legal, otra para screenshots, otra para redes, otra para métricas. Y una hoja de cálculo para unirlas.",
  },
];

const STAGE_COPY: Record<string, string> = {
  prepare: "Legal, ficha de tienda, screenshots, analítica y soporte listos antes del día D.",
  launch: "Fecha, materiales y los canales correctos para tu tipo de producto.",
  traction: "Contenido corto, creadores, comunidades y un test de anuncios con números.",
  monetize: "Calculadora de precios, paywall y emails que convierten pruebas en clientes.",
  measure: "Cinco métricas por semana y un tablero de feedback para decidir qué construir.",
  scale: "Contratos, documentos, automatización y un equipo que crece contigo.",
};

const FEATURES = [
  { title: "Ruta de lanzamiento", body: "Una guía paso a paso adaptada a tu app o web, conectada a las herramientas que resuelven cada paso.", tag: "Nuevo" },
  { title: "Canales de lanzamiento", body: "20+ sitios donde anunciarte, con consejos de cada uno y seguimiento de resultados." },
  { title: "Screenshots de tienda", body: "Capturas para App Store y Google Play que venden el beneficio, en varios idiomas." },
  { title: "Legal en minutos", body: "Privacidad, términos y cookies publicados en tu dominio, listos para las tiendas." },
  { title: "Market", body: "Competidores, rankings, keywords, reseñas y los anuncios que llevan meses funcionando." },
  { title: "Studio de contenido", body: "Influencers y demos de tu app para TikTok, Reels y Shorts, listos para publicar." },
  { title: "Marketing y redes", body: "Todas tus cuentas, publicaciones programadas y las visitas de cada video en un panel." },
  { title: "Monetización", body: "Ingresos, suscripciones, paywalls y experimentos de precio en un mismo lugar." },
  { title: "Calculadora de precios", body: "Cuánto cobrar, cuánto te queda tras comisiones y cuántos clientes necesitas." },
  { title: "Métricas y feedback", body: "Cinco números cada semana y todas las peticiones de tus usuarios priorizadas por votos." },
  { title: "Clientes y emails", body: "Tus usuarios de Supabase y el correo de soporte, sin cambiar de pestaña." },
  { title: "Tu empresa", body: "Proyectos, tareas, equipo, contratos y documentos de todo tu negocio." },
];

const FAQ = [
  {
    q: "¿Para quién es Vantko?",
    a: "Para solo founders y equipos pequeños que ya construyeron una app móvil o un producto web y quieren convertirlo en un negocio.",
  },
  {
    q: "¿Necesito saber de marketing?",
    a: "No. La ruta te dice qué hacer, por qué y cómo, en orden. Cada paso te lleva a la herramienta que lo resuelve.",
  },
  {
    q: "¿Sirve si mi producto es web y no app?",
    a: "Sí. Al empezar eliges app, web o ambas, y la ruta, los canales y la calculadora se adaptan.",
  },
  {
    q: "¿Puedo gestionar varios productos?",
    a: "Sí. Cada producto es un proyecto con su propia ruta, métricas, contenido y clientes.",
  },
];

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold ${
          dark ? "bg-white text-[#0b0b0e]" : "bg-[#0b0b0e] text-white"
        }`}
      >
        V
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Vantko</span>
    </span>
  );
}

function HeroMock() {
  const progress = [1, 0.6, 0.2, 0, 0, 0];
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div aria-hidden className="absolute -inset-6 rounded-[32px] bg-[radial-gradient(closest-side,rgba(99,102,241,0.35),transparent)] blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white text-[#1a1f36] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-1.5 border-b border-[#e3e8ee] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 text-[11px] text-[#8792a2]">vantko.com · Lanzamiento</span>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0">
              <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
                <circle cx="32" cy="32" r="27" stroke="#e3e8ee" strokeWidth="6" fill="none" />
                <circle cx="32" cy="32" r="27" stroke="#6366f1" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray="169.6" strokeDashoffset="110" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold">35%</span>
            </div>
            <div>
              <p className="text-[11px] text-[#596171]">Etapa actual</p>
              <p className="text-[17px] font-semibold text-[#0ea5e9]">Lanzar</p>
              <p className="text-[11px] text-[#8792a2]">Faltan 6 días para tu lanzamiento</p>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {STAGES.map((s, i) => (
              <div key={s.id}>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#f3f5f9]">
                  <div className="h-full rounded-full" style={{ width: `${progress[i] * 100}%`, background: s.color }} />
                </div>
                <p className="mt-1 truncate text-[10px] font-medium text-[#596171]">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-[linear-gradient(135deg,#eef0ff,#fff_70%)] p-4 ring-1 ring-[#e3e8ee]">
            <p className="text-[11px] font-semibold text-[#4338ca]">Siguiente paso</p>
            <p className="mt-0.5 text-[14px] font-semibold">Elige tus 5 canales de lanzamiento</p>
            <p className="mt-0.5 text-[11.5px] text-[#596171]">Lanzar en todos lados a la vez no funciona; elige donde está tu cliente.</p>
            <div className="mt-3 flex gap-2">
              <span className="rounded-lg bg-[#111114] px-3 py-1.5 text-[11px] font-semibold text-white">Ver canales</span>
              <span className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-semibold ring-1 ring-[#e3e8ee]">Ya lo hice</span>
            </div>
          </div>
          <ul className="divide-y divide-[#e3e8ee] rounded-xl ring-1 ring-[#e3e8ee]">
            {[
              ["Publica política de privacidad y términos", true],
              ["Ficha de tienda con screenshots que venden", true],
              ["Prepara los materiales: video, GIF e imágenes", false],
            ].map(([label, done]) => (
              <li key={label as string} className="flex items-center gap-2.5 px-3.5 py-2.5 text-[12px]">
                <span className={`flex h-4 w-4 items-center justify-center rounded ${done ? "bg-[#6366f1] text-white" : "ring-1 ring-[#d5dbe3]"}`}>
                  {done ? (
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  ) : null}
                </span>
                <span className={done ? "text-[#8792a2] line-through" : "font-medium"}>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-[#f6f8fb] text-[#1a1f36]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b0b0e]/85 text-white backdrop-blur-md">
        <nav className="mx-auto flex h-14 max-w-[1180px] items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Vantko, inicio">
            <Logo dark />
          </Link>
          <div className="hidden items-center gap-7 text-[13px] text-white/70 md:flex">
            <a href="#ruta" className="transition hover:text-white">Cómo funciona</a>
            <a href="#funciones" className="transition hover:text-white">Funciones</a>
            <a href="#faq" className="transition hover:text-white">Preguntas</a>
          </div>
          <Link href="/login" className="rounded-[10px] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#0b0b0e] transition hover:bg-white/90">
            Entrar
          </Link>
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="outline-none">
        {/* Hero */}
        <section className="relative overflow-hidden bg-[#0b0b0e] text-white">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <span className="login-orb -left-24 -top-24 h-[420px] w-[420px] bg-[#6366f1]" />
            <span className="login-orb right-[-120px] top-[20%] h-[380px] w-[380px] bg-[#ec4899] [animation-delay:-6s]" />
            <span className="login-orb bottom-[-200px] left-[30%] h-[420px] w-[420px] bg-[#f59e0b] opacity-25 [animation-delay:-11s]" />
            <div className="login-grid absolute inset-0" />
          </div>
          <div className="relative mx-auto grid max-w-[1180px] items-center gap-14 px-5 pb-24 pt-16 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-24">
            <div>
              <p className="ui-enter inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[12px] text-white/75 backdrop-blur">
                <span className="ui-live-dot" />
                Para solo founders y equipos pequeños
              </p>
              <h1 className="ui-enter mt-6 text-[44px] font-semibold leading-[1.02] tracking-[-0.045em] [animation-delay:60ms] sm:text-[60px]">
                Ya creaste tu producto.{" "}
                <span className="bg-[linear-gradient(90deg,#c7d2fe,#f0abfc,#fcd34d)] bg-clip-text text-transparent">¿Qué sigue?</span>
              </h1>
              <p className="ui-enter mt-6 max-w-[520px] text-[17px] leading-relaxed text-white/65 [animation-delay:120ms]">
                Vantko te dice qué hacer después —y te da las herramientas para hacerlo— para lanzar tu app o tu web, conseguir usuarios y empezar a cobrar.
              </p>
              <div className="ui-enter mt-8 flex flex-wrap gap-3 [animation-delay:180ms]">
                <Link href="/login" className="rounded-xl bg-white px-5 py-3 text-[14px] font-semibold text-[#0b0b0e] shadow-[0_10px_30px_-10px_rgba(255,255,255,0.6)] transition hover:bg-white/90">
                  Entrar en Vantko
                </Link>
                <a href="#ruta" className="rounded-xl border border-white/15 bg-white/[0.06] px-5 py-3 text-[14px] font-semibold text-white backdrop-blur transition hover:bg-white/[0.12]">
                  Ver cómo funciona
                </a>
              </div>
              <p className="ui-enter mt-6 text-[12.5px] text-white/45 [animation-delay:240ms]">Apps iOS y Android · Productos web y SaaS</p>
            </div>
            <div className="ui-enter [animation-delay:200ms]">
              <HeroMock />
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 sm:py-24">
          <p className="text-[13px] font-semibold text-[#4338ca]">El problema</p>
          <h2 className="mt-2 max-w-[640px] text-[34px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[40px]">
            Construirlo era la parte fácil.
          </h2>
          <p className="mt-4 max-w-[600px] text-[16px] leading-relaxed text-[#596171]">
            Sabes programar. Lo que nadie te enseñó es lanzar, vender y crecer. Y ahí es donde se quedan la mayoría de los productos.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PAINS.map((p) => (
              <div key={p.title} className="rounded-2xl border border-[#e3e8ee] bg-white p-6 shadow-[0_1px_2px_rgba(22,24,29,0.04)]">
                <p className="text-[16px] font-semibold tracking-tight">{p.title}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-[#596171]">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Roadmap */}
        <section id="ruta" className="scroll-mt-14 border-y border-[#e3e8ee] bg-white">
          <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 sm:py-24">
            <p className="text-[13px] font-semibold text-[#4338ca]">Cómo funciona</p>
            <h2 className="mt-2 max-w-[700px] text-[34px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[40px]">
              Una ruta de 6 etapas, del “ya está hecho” al “ya factura”.
            </h2>
            <p className="mt-4 max-w-[620px] text-[16px] leading-relaxed text-[#596171]">
              Dinos qué construiste y Vantko te marca el siguiente paso. Cada paso explica por qué importa, cómo hacerlo y te lleva a la herramienta que lo resuelve.
            </p>
            <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {STAGES.map((s, i) => (
                <li key={s.id} className="relative rounded-2xl border border-[#e3e8ee] bg-[#f6f8fb] p-6">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: s.color }}>
                    {i + 1}
                  </span>
                  <p className="mt-4 text-[18px] font-semibold tracking-tight">{s.label}</p>
                  <p className="mt-1 text-[13px] font-medium text-[#3c4257]">{s.goal}</p>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-[#596171]">{STAGE_COPY[s.id]}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="funciones" className="mx-auto max-w-[1180px] scroll-mt-14 px-5 py-20 sm:px-8 sm:py-24">
          <p className="text-[13px] font-semibold text-[#4338ca]">Todo en un sitio</p>
          <h2 className="mt-2 max-w-[700px] text-[34px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[40px]">
            Las herramientas que necesitas después de programar.
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-[#e3e8ee] bg-[#e3e8ee] sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white p-6 transition hover:bg-[#fbfcfe]">
                <p className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                  {f.title}
                  {f.tag ? <span className="rounded-full bg-[#eef0ff] px-2 py-0.5 text-[10.5px] font-semibold text-[#4338ca]">{f.tag}</span> : null}
                </p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[#596171]">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* For whom */}
        <section className="mx-auto max-w-[1180px] px-5 pb-20 sm:px-8 sm:pb-24">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                title: "Hiciste una app móvil",
                points: ["Ficha de tienda y screenshots", "Nominación para destacar en App Store", "Influencers y demos para TikTok", "Paywall y suscripciones"],
              },
              {
                title: "Hiciste un producto web o SaaS",
                points: ["Landing, SEO y directorios", "Product Hunt, Hacker News y comunidades", "Stripe, precios y plan anual", "Feedback y roadmap público"],
              },
            ].map((card) => (
              <div key={card.title} className="rounded-2xl border border-[#e3e8ee] bg-white p-7 shadow-[0_1px_2px_rgba(22,24,29,0.04)]">
                <p className="text-[20px] font-semibold tracking-tight">{card.title}</p>
                <ul className="mt-4 space-y-2.5">
                  {card.points.map((p) => (
                    <li key={p} className="flex items-center gap-2.5 text-[14px] text-[#3c4257]">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#eef0ff] text-[#4338ca]">
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                          <path d="m5 12.5 4.5 4.5L19 7.5" />
                        </svg>
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-14 border-t border-[#e3e8ee] bg-white">
          <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="text-[13px] font-semibold text-[#4338ca]">Preguntas</p>
              <h2 className="mt-2 text-[34px] font-semibold leading-[1.1] tracking-[-0.035em]">Lo que suelen preguntarnos.</h2>
            </div>
            <div className="divide-y divide-[#e3e8ee] border-y border-[#e3e8ee]">
              {FAQ.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold">
                    {item.q}
                    <span className="text-[#8792a2] transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#596171]">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 py-20 sm:px-8">
          <div className="relative mx-auto max-w-[1180px] overflow-hidden rounded-[28px] bg-[#0b0b0e] px-8 py-16 text-center text-white sm:py-20">
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <span className="login-orb left-[10%] top-[-140px] h-[320px] w-[320px] bg-[#6366f1]" />
              <span className="login-orb right-[5%] bottom-[-160px] h-[320px] w-[320px] bg-[#ec4899] [animation-delay:-8s]" />
            </div>
            <h2 className="relative mx-auto max-w-[640px] text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[44px]">
              Tu producto merece algo más que un repositorio.
            </h2>
            <p className="relative mx-auto mt-4 max-w-[520px] text-[16px] text-white/65">Empieza por el siguiente paso. Vantko se encarga de decirte cuál es.</p>
            <Link href="/login" className="relative mt-8 inline-flex rounded-xl bg-white px-6 py-3 text-[14px] font-semibold text-[#0b0b0e] transition hover:bg-white/90">
              Entrar en Vantko
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e3e8ee]">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-5 py-8 text-[13px] text-[#596171] sm:px-8">
          <Logo />
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-[#1a1f36]">Privacidad</Link>
            <Link href="/terms" className="hover:text-[#1a1f36]">Términos</Link>
            <Link href="/login" className="hover:text-[#1a1f36]">Entrar</Link>
          </div>
          <p>© {new Date().getFullYear()} Vantko</p>
        </div>
      </footer>
    </div>
  );
}
