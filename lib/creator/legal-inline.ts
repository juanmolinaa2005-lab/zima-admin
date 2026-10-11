export type InlineNode =
  | { kind: "text"; text: string }
  | { kind: "token"; token: string }
  | { kind: "bold" | "italic" | "underline" | "strike"; children: InlineNode[] }
  | { kind: "link"; href: string; children: InlineNode[] };

const TOKEN = /^\{\{(app|razon|dominio|email|direccion|region)\}\}/;

function earliest(source: string): { length: number; node: InlineNode } | null {
  const link = /^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/.exec(source);
  if (link) return { length: link[0].length, node: { kind: "link", href: link[2], children: parseLegalInline(link[1]) } };
  const bold = /^\*\*([\s\S]+?)\*\*/.exec(source);
  if (bold) return { length: bold[0].length, node: { kind: "bold", children: parseLegalInline(bold[1]) } };
  const underline = /^\+\+([\s\S]+?)\+\+/.exec(source);
  if (underline) {
    return { length: underline[0].length, node: { kind: "underline", children: parseLegalInline(underline[1]) } };
  }
  const strike = /^~~([\s\S]+?)~~/.exec(source);
  if (strike) return { length: strike[0].length, node: { kind: "strike", children: parseLegalInline(strike[1]) } };
  const italic = /^\*(?!\*)([^*\n]+)\*/.exec(source);
  if (italic) return { length: italic[0].length, node: { kind: "italic", children: parseLegalInline(italic[1]) } };
  const token = TOKEN.exec(source);
  if (token) return { length: token[0].length, node: { kind: "token", token: token[0] } };
  return null;
}

export function parseLegalInline(source: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let index = 0;
  while (index < source.length) {
    const match = earliest(source.slice(index));
    if (match) {
      nodes.push(match.node);
      index += match.length;
      continue;
    }
    const next = source.slice(index + 1).search(/[[*+~{]/);
    const end = next === -1 ? source.length : index + 1 + next;
    nodes.push({ kind: "text", text: source.slice(index, end) });
    index = end;
  }
  return nodes;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nodesToHtml(nodes: InlineNode[], labels: Record<string, string>): string {
  return nodes
    .map((node) => {
      if (node.kind === "text") return escapeHtml(node.text);
      if (node.kind === "token") {
        const label = labels[node.token] || node.token;
        return `<span data-token="${escapeHtml(node.token)}" contenteditable="false" style="padding:0 4px;border-radius:6px;background:#fff;border:1px solid #e4e6eb;font-weight:600">${escapeHtml(label)}</span>`;
      }
      const inner = nodesToHtml(node.children, labels);
      if (node.kind === "bold") return `<strong>${inner}</strong>`;
      if (node.kind === "italic") return `<em>${inner}</em>`;
      if (node.kind === "underline") return `<u>${inner}</u>`;
      if (node.kind === "strike") return `<s>${inner}</s>`;
      if (node.kind === "link") return `<a href="${escapeHtml(node.href)}">${inner}</a>`;
      return inner;
    })
    .join("");
}

export function inlineToHtml(source: string, labels: Record<string, string>) {
  return nodesToHtml(parseLegalInline(source), labels);
}

function sourceFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  if (!(node instanceof HTMLElement)) return "";
  if (node.dataset.token) return node.dataset.token;
  if (node.tagName === "BR") return "\n";
  const inner = Array.from(node.childNodes).map(sourceFromNode).join("");
  if (node.tagName === "STRONG" || node.tagName === "B") return `**${inner}**`;
  if (node.tagName === "EM" || node.tagName === "I") return `*${inner}*`;
  if (node.tagName === "U") return `++${inner}++`;
  if (node.tagName === "S" || node.tagName === "STRIKE" || node.tagName === "DEL") return `~~${inner}~~`;
  if (node.tagName === "A") return `[${inner}](${node.getAttribute("href") || ""})`;
  if (node.tagName === "DIV" || node.tagName === "P") return `${inner}\n`;
  return inner;
}

export function htmlToLegalSource(root: HTMLElement) {
  return Array.from(root.childNodes).map(sourceFromNode).join("").replace(/\n+$/, "");
}
