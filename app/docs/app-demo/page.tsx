export const metadata = {
  title: "App Demo · Documentación",
  description:
    "Cómo crear un video de app con código Remotion, variables y marco iPhone en Zima Admin.",
};

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-2xl bg-[var(--background)] p-4 font-mono text-[12px] leading-relaxed text-[var(--foreground-soft)]">
      {children}
    </pre>
  );
}

export default function AppDemoDocsPage() {
  return (
    <div className="space-y-8 text-[14px] leading-relaxed text-[var(--foreground-soft)]">
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
          Estudio
        </p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
          App Demo
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-[var(--muted)]">
          Crea un video de cualquier app con una composición Remotion:
          variables, código y preview en el editor.
        </p>
      </header>

      <section>
        <h2 className="text-[16px] font-semibold text-[var(--foreground)]">Dónde está</h2>
        <p className="mt-2">
          En un proyecto: <strong>Estudio → App Demo</strong>. Ves el video y
          pulsas <strong>Open editor</strong> para el estudio (variables,
          código y preview).
        </p>
      </section>

      <section>
        <h2 className="text-[16px] font-semibold text-[var(--foreground)]">
          Cómo escribir el código
        </h2>
        <p className="mt-2">
          Exporta un componente con <code className="font-mono">export default</code>.
          Solo puedes importar <code className="font-mono">remotion</code> y{" "}
          <code className="font-mono">react</code>.
        </p>
        <Code>{`import { AbsoluteFill, useCurrentFrame } from "remotion";

export const durationInFrames = 180;
export const fps = 30;
export const width = 1080;
export const height = 1920;

export default function AppDemo() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#fff" }}>
      Frame {frame}
    </AbsoluteFill>
  );
}`}</Code>
      </section>

      <section>
        <h2 className="text-[16px] font-semibold text-[var(--foreground)]">Variables</h2>
        <p className="mt-2">
          El botón <strong>Variables</strong> abre un panel al centro. Ahí
          editas tokens del preview: texto, número, sí/no, color y{" "}
          <strong>foto</strong>. Créalas con <strong>Añadir</strong> o
          decláralas en el código. Escribir{" "}
          <code className="font-mono">vars.nombre</code> no crea una variable:
          solo lee las que ya existen.
        </p>
        <p className="mt-2">Decláralas así:</p>
        <Code>{`export const variables = {
  appName: "Mi app",
  precio: 9.99,
  destacado: true,
  accent: "#6366f1",
  photo: "",
};`}</Code>
        <p className="mt-2">Úsalas así:</p>
        <Code>{`<h1>{vars.appName}</h1>
<div style={{ color: vars.accent }} />
{vars.photo ? <Img src={vars.photo} /> : null}`}</Code>
        <p className="mt-2">
          Las fotos se suben, se pegan, se arrastran o se eligen de Galería.
          En el código la variable es una URL (o data URL). Importa{" "}
          <code className="font-mono">Img</code> de remotion para mostrarlas.
          Los valores del panel no se pisan si ya los editaste a mano.
        </p>
      </section>

      <section>
        <h2 className="text-[16px] font-semibold text-[var(--foreground)]">
          Duración y tamaño
        </h2>
        <Code>{`export const durationInFrames = 180;
export const fps = 30;
export const width = 1080;
export const height = 1920;`}</Code>
      </section>

      <section>
        <h2 className="text-[16px] font-semibold text-[var(--foreground)]">
          Marco iPhone
        </h2>
        <p className="mt-2">
          Si está activo, envuelve cualquier composición en un iPhone sobre
          fondo blanco. No hace falta dibujar el marco en el código. Puedes
          apagarlo para exportar a pantalla completa.
        </p>
      </section>

      <section>
        <h2 className="text-[16px] font-semibold text-[var(--foreground)]">Guardar</h2>
        <p className="mt-2">
          Los cambios se autoguardan solos. También puedes pulsar{" "}
          <strong>Guardar</strong> o <code className="font-mono">⌘S</code> /{" "}
          <code className="font-mono">Ctrl+S</code>.
        </p>
      </section>

      <section>
        <h2 className="text-[16px] font-semibold text-[var(--foreground)]">Exportar</h2>
        <p className="mt-2">
          <strong>Exportar MP4</strong> descarga el video y lo guarda en{" "}
          <strong>Galería → App Demo</strong>. Usa Chrome o Edge. El archivo
          incluye el código y las variables actuales.
        </p>
      </section>
    </div>
  );
}
