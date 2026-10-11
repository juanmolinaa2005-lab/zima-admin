import {
  fillLegalText,
  LEGAL_DOCS,
  legalPublicSlug,
  type LegalDocId,
  type LegalPublication,
} from "@/lib/creator/app-legal";
import { LegalInline } from "@/components/legal/LegalInline";

export function PublicLegalDocument({
  published,
  docId,
}: {
  published: LegalPublication;
  docId: LegalDocId;
}) {
  const slug = legalPublicSlug(published.profile);
  const document = published.docs[docId];
  const title = fillLegalText(document.title, published.profile, published.publishedAt);
  const body = fillLegalText(document.body, published.profile, published.publishedAt);
  const updated = new Date(published.publishedAt).toLocaleDateString("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const blocks = body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <main id="main" tabIndex={-1} className="mx-auto min-h-dvh max-w-2xl px-5 py-12 text-[var(--foreground)] outline-none">
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-soft)]">
        {published.profile.appName || "Documento legal"}
      </p>
      <h1 className="mt-2 text-[32px] font-semibold tracking-tight" style={{ color: document.color || undefined }}>
        {title}
      </h1>
      <p className="mt-2 text-[13px] text-[var(--muted)]">
        Versión {published.version} · vigente desde el {updated}
      </p>
      <div
        className="mt-8 space-y-4 text-[15px] leading-relaxed"
        style={{ color: document.color || "var(--foreground-soft)" }}
      >
        {blocks.map((block, index) => {
          const lines = block.split("\n");
          if (lines[0]?.startsWith("# ")) {
            const rest = lines.slice(1).join("\n").trim();
            return (
              <div key={index}>
                <h2 className="pt-3 text-[17px] font-semibold" style={{ color: document.color || "var(--foreground)" }}>
                  <LegalInline text={lines[0].slice(2)} />
                </h2>
                {rest ? (
                  <p className="mt-2 whitespace-pre-wrap">
                    <LegalInline text={rest} />
                  </p>
                ) : null}
              </div>
            );
          }
          if (lines.every((line) => line.startsWith("- "))) {
            return (
              <ul key={index} className="list-disc space-y-1 pl-5">
                {lines.map((line, lineIndex) => (
                  <li key={lineIndex}>
                    <LegalInline text={line.slice(2)} />
                  </li>
                ))}
              </ul>
            );
          }
          if (lines.every((line) => /^\d+\.\s/.test(line))) {
            return (
              <ol key={index} className="list-decimal space-y-1 pl-5">
                {lines.map((line, lineIndex) => (
                  <li key={lineIndex}>
                    <LegalInline text={line.replace(/^\d+\.\s/, "")} />
                  </li>
                ))}
              </ol>
            );
          }
          return (
            <p key={index} className="whitespace-pre-wrap">
              <LegalInline text={block} />
            </p>
          );
        })}
      </div>
      <nav className="mt-12 flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--border)] pt-5 text-[13px]">
        {LEGAL_DOCS.map((item) => (
          <a
            key={item.id}
            href={slug ? `/${slug}/${item.path}` : `/legal/${item.path}`}
            className={
              item.id === docId
                ? "font-semibold text-[var(--foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }
          >
            {published.docs[item.id].label || item.label}
          </a>
        ))}
      </nav>
    </main>
  );
}
