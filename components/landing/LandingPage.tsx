import Image from "next/image";
import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import { STAGES } from "@/lib/launch/playbook";
import { LandingHeroForm } from "./LandingHeroForm";

const serif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

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
  measure: "Cinco métricas por semana y un tablero de feedback para decidir qué construir.",
  monetize: "Calculadora de precios, paywall y emails que convierten pruebas en clientes.",
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

function HeroMock() {
  const rows = [
    { sku: "Legal", name: "Privacidad y términos", cat: "Preparar", status: "Hecho", next: "—" },
    { sku: "Store", name: "Screenshots de tienda", cat: "Preparar", status: "En curso", next: "Hoy" },
    { sku: "PH", name: "Lanzar en Product Hunt", cat: "Lanzar", status: "Pendiente", next: "Mar 14" },
  ];
  return (
    <div className="overflow-hidden rounded-t-2xl border border-b-0 border-[#e3e8ee] bg-white shadow-[0_-8px_50px_-18px_rgba(26,40,80,0.18)]">
      <div className="flex items-center gap-3 border-b border-[#e3e8ee] px-5 py-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#111114] text-[10px] font-bold text-white">V</span>
        <p className="text-[12.5px] text-[#8792a2]">
          <span className="font-medium text-[#1a1f36]">Vantko</span>
          <span className="mx-1.5">/</span>
          MOUN
          <span className="mx-1.5">/</span>
          Lanzamiento
        </p>
        <div className="ml-auto flex gap-2">
          <span className="hidden h-8 items-center rounded-lg border border-[#e3e8ee] px-3 text-[12px] text-[#8792a2] sm:inline-flex">Buscar…</span>
          <span className="inline-flex h-8 items-center rounded-full bg-[#111114] px-3 text-[12px] font-semibold text-white">Siguiente paso</span>
        </div>
      </div>
      <div className="px-5 pb-2 pt-4">
        <p className="text-[22px] font-semibold tracking-tight text-[#1a1f36]">Ruta de lanzamiento</p>
        <p className="mt-0.5 text-[13px] text-[#8792a2]">Ya creaste tu producto. Esto es lo que sigue.</p>
      </div>
      <div className="overflow-x-auto px-2 pb-1">
        <table className="w-full min-w-[640px] text-left text-[12.5px]">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wide text-[#8792a2]">
              <th className="px-3 py-2 font-semibold">Paso</th>
              <th className="px-3 py-2 font-semibold">Qué hacer</th>
              <th className="px-3 py-2 font-semibold">Etapa</th>
              <th className="px-3 py-2 font-semibold">Estado</th>
              <th className="px-3 py-2 font-semibold">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef1f5]">
            {rows.map((r) => (
              <tr key={r.sku}>
                <td className="px-3 py-2.5 font-medium tabular-nums text-[#8792a2]">{r.sku}</td>
                <td className="px-3 py-2.5 font-medium text-[#1a1f36]">{r.name}</td>
                <td className="px-3 py-2.5 text-[#596171]">{r.cat}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      r.status === "Hecho"
                        ? "bg-[#e7f7ef] text-[#0e7a55]"
                        : r.status === "En curso"
                          ? "bg-[#eef0ff] text-[#4338ca]"
                          : "bg-[#f3f5f9] text-[#8792a2]"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[#8792a2]">{r.next}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
          <div className="hidden items-center gap-8 text-[13.5px] text-white/80 md:flex">
            <a href="#funciones" className="transition hover:text-white">Producto</a>
            <a href="#ruta" className="transition hover:text-white">Ruta</a>
            <a href="#faq" className="transition hover:text-white">Preguntas</a>
          </div>
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
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-white" />

          <div className="relative mx-auto flex min-h-[100dvh] max-w-[1120px] flex-col px-5 pt-24 sm:px-8">
            <div className="mx-auto mt-[6vh] max-w-[720px] text-center sm:mt-[7vh]">
              <h1 className={`${serif.className} text-[48px] leading-[1.05] tracking-[-0.03em] text-white sm:text-[72px]`}>
                Ya creaste tu producto.
                <br />
                ¿Qué sigue?
              </h1>
              <p className="mx-auto mt-5 max-w-[420px] text-[16px] leading-relaxed text-white/80 sm:text-[18px]">
                Vantko: el software para lanzar tu app o tu web.
              </p>
              <div className="mt-8">
                <LandingHeroForm />
              </div>
            </div>

            <div className="mx-auto mt-auto w-full max-w-[920px] pt-28">
              <HeroMock />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8 sm:py-24">
          <p className="text-[13px] font-semibold text-[#4338ca]">El problema</p>
          <h2 className={`${serif.className} mt-2 max-w-[640px] text-[36px] leading-[1.1] tracking-[-0.02em] sm:text-[44px]`}>
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

        <section id="ruta" className="scroll-mt-16 border-y border-[#e3e8ee] bg-[#f6f8fb]">
          <div className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8 sm:py-24">
            <p className="text-[13px] font-semibold text-[#4338ca]">Cómo funciona</p>
            <h2 className={`${serif.className} mt-2 max-w-[720px] text-[36px] leading-[1.1] tracking-[-0.02em] sm:text-[44px]`}>
              Una ruta de 6 etapas, del “ya está hecho” al “ya factura”.
            </h2>
            <p className="mt-4 max-w-[620px] text-[16px] leading-relaxed text-[#596171]">
              Dinos qué construiste y Vantko te marca el siguiente paso. Cada paso explica por qué importa, cómo hacerlo y te lleva a la herramienta que lo resuelve.
            </p>
            <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {STAGES.map((s, i) => (
                <li key={s.id} className="relative rounded-2xl border border-[#e3e8ee] bg-white p-6">
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

        <section id="funciones" className="mx-auto max-w-[1120px] scroll-mt-16 px-5 py-20 sm:px-8 sm:py-24">
          <p className="text-[13px] font-semibold text-[#4338ca]">Todo en un sitio</p>
          <h2 className={`${serif.className} mt-2 max-w-[720px] text-[36px] leading-[1.1] tracking-[-0.02em] sm:text-[44px]`}>
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

        <section className="mx-auto max-w-[1120px] px-5 pb-20 sm:px-8 sm:pb-24">
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

        <section id="faq" className="scroll-mt-16 border-t border-[#e3e8ee] bg-[#f6f8fb]">
          <div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="text-[13px] font-semibold text-[#4338ca]">Preguntas</p>
              <h2 className={`${serif.className} mt-2 text-[36px] leading-[1.1] tracking-[-0.02em]`}>Lo que suelen preguntarnos.</h2>
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

        <section className="px-5 py-16 sm:px-8 sm:py-20">
          <div className="relative mx-auto max-w-[1120px] overflow-hidden rounded-[28px] px-8 py-16 text-center text-white sm:py-20">
            <Image src="/hero-night.jpg" alt="" aria-hidden fill sizes="1120px" className="object-cover object-[center_30%]" />
            <div aria-hidden className="absolute inset-0 bg-[#111114]/35" />
            <h2 className={`${serif.className} relative mx-auto max-w-[640px] text-[36px] leading-[1.08] tracking-[-0.02em] sm:text-[48px]`}>
              Tu producto merece algo más que un repositorio.
            </h2>
            <p className="relative mx-auto mt-4 max-w-[480px] text-[16px] text-white/85">Empieza por el siguiente paso. Vantko se encarga de decirte cuál es.</p>
            <Link href="/login" className="relative mt-8 inline-flex h-11 items-center rounded-full bg-white px-6 text-[14px] font-semibold text-[#111114] transition hover:bg-white/90">
              Entrar en Vantko
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e3e8ee]">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-5 py-8 text-[13px] text-[#596171] sm:px-8">
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
