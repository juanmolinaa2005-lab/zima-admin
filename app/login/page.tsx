import { LoginForm } from "@/components/auth/LoginForm";

const FEATURES = [
  {
    title: "Una ruta, paso a paso",
    body: "Del lanzamiento a los primeros clientes de pago, adaptada a tu app o web.",
  },
  {
    title: "Lanza donde está tu cliente",
    body: "Canales, contenido, influencers y redes desde el mismo proyecto.",
  },
  {
    title: "Cobra y mide",
    body: "Precios, monetización, métricas semanales y feedback de usuarios.",
  },
];

export default function LoginPage() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="grid min-h-dvh bg-background outline-none lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]"
    >
      {/* Brand panel */}
      <section className="relative m-3 hidden overflow-hidden rounded-[28px] bg-[#0b0b0e] p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <span className="login-orb -left-24 -top-24 h-[420px] w-[420px] bg-[#6366f1]" />
          <span className="login-orb right-[-120px] top-[30%] h-[380px] w-[380px] bg-[#ec4899] [animation-delay:-6s]" />
          <span className="login-orb bottom-[-160px] left-[20%] h-[420px] w-[420px] bg-[#f59e0b] opacity-30 [animation-delay:-11s]" />
          <div className="login-grid absolute inset-0" />
        </div>

        <div className="ui-enter relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[14px] font-bold text-[#111114] shadow-[0_0_24px_rgba(255,255,255,0.35)]">
            V
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Vantko</span>
        </div>

        <div className="relative mt-auto max-w-[480px]">
          <h1 className="ui-enter text-[46px] font-semibold leading-[1.04] tracking-[-0.04em] [animation-delay:80ms]">
            Ya creaste tu producto.{" "}
            <span className="bg-[linear-gradient(90deg,#c7d2fe,#f0abfc,#fcd34d)] bg-clip-text text-transparent">
              ¿Qué sigue?
            </span>
          </h1>
          <ul className="ui-stagger mt-10 space-y-3">
            {FEATURES.map((f) => (
              <li
                key={f.title}
                className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md transition duration-300 hover:border-white/20 hover:bg-white/[0.07]"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] ring-1 ring-white/15">
                  ✓
                </span>
                <span>
                  <span className="block text-[14px] font-semibold">{f.title}</span>
                  <span className="block text-[13px] text-white/60">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-12 text-[12px] text-white/40">© Vantko</p>
      </section>

      {/* Form */}
      <section className="relative flex items-center justify-center p-5 sm:p-10">
        <div aria-hidden className="login-aurora pointer-events-none absolute inset-0 lg:hidden" />
        <div className="relative w-full max-w-[400px] animate-scale-in">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
