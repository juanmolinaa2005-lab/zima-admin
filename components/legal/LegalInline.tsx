import { parseLegalInline, type InlineNode } from "@/lib/creator/legal-inline";

function nodes(parts: InlineNode[], keyPrefix: string) {
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.kind === "text") return <span key={key}>{part.text}</span>;
    if (part.kind === "token") return <span key={key}>{part.token}</span>;
    if (part.kind === "bold") return <strong key={key}>{nodes(part.children, key)}</strong>;
    if (part.kind === "italic") return <em key={key}>{nodes(part.children, key)}</em>;
    if (part.kind === "underline") return <u key={key}>{nodes(part.children, key)}</u>;
    if (part.kind === "strike") return <s key={key}>{nodes(part.children, key)}</s>;
    if (part.kind === "link") {
      return (
        <a key={key} href={part.href} className="underline" rel="noreferrer">
          {nodes(part.children, key)}
        </a>
      );
    }
    return null;
  });
}

export function LegalInline({ text }: { text: string }) {
  return <>{nodes(parseLegalInline(text), "t")}</>;
}
