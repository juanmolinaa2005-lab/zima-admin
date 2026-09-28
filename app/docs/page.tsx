import Link from "next/link";

export const metadata = {
  title: "Documentación · Zima Admin",
  description: "Guías públicas de Zima Admin: App Demo y el resto del sistema.",
};

export default function DocsHomePage() {
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
        Zima Admin
      </p>
      <h1 className="mt-2 text-[28px] font-semibold tracking-tight">
        Documentación
      </h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
        Guías públicas del producto. No hace falta iniciar sesión para leerlas.
      </p>

      <ul className="mt-8 grid gap-3">
        <li>
          <Link
            href="/docs/app-demo"
            className="block rounded-2xl border border-[var(--border)] px-4 py-4 hover:border-[var(--border-strong)]"
          >
            <p className="text-[15px] font-semibold">App Demo</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
              Cómo escribir una composición Remotion, variables, marco iPhone y
              exportar el video.
            </p>
          </Link>
        </li>
      </ul>
    </div>
  );
}
