import Image from "next/image";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="grid min-h-dvh bg-background outline-none lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]"
    >
      <section className="relative m-3 hidden overflow-hidden rounded-[28px] text-white lg:flex lg:flex-col lg:p-12">
        <Image src="/hero-night.jpg" alt="" aria-hidden fill sizes="50vw" className="object-cover object-[center_35%]" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent" />

        <div className="relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[14px] font-bold text-[#111114]">
            V
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Vantko</span>
        </div>

        <div className="relative mt-auto max-w-[440px]">
          <h1 className="text-[42px] font-semibold leading-[1.05] tracking-[-0.04em]">
            El marketing de tu negocio,
            <br />
            en automático.
          </h1>
          <p className="mt-4 text-[16px] text-white/75">Publica, mide y controla todo tu marketing desde un solo sitio.</p>
        </div>
      </section>

      <section className="relative flex items-center justify-center p-5 sm:p-10">
        <div className="relative w-full max-w-[400px]">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
