function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function walk(node: unknown, tokens: string[]): unknown[] {
  if (tokens.length === 0) return [node];
  const [head, ...rest] = tokens;
  if (head === "*") {
    if (Array.isArray(node)) return node.flatMap((item) => walk(item, rest));
    if (isRecord(node)) return Object.values(node).flatMap((item) => walk(item, rest));
    return [];
  }
  if (Array.isArray(node)) {
    const idx = Number(head);
    if (!Number.isInteger(idx) || idx < 0 || idx >= node.length) return [];
    return walk(node[idx], rest);
  }
  if (!isRecord(node) || !(head in node)) return [];
  return walk(node[head], rest);
}

export function extractPath(data: unknown, path: string): unknown[] {
  const raw = path.trim();
  if (!raw) return [];
  const tokens = raw
    .replace(/^\$\.?/, "")
    .replace(/\[(\d+|\*)\]/g, ".$1")
    .split(".")
    .map((t) => t.trim())
    .filter(Boolean);
  return walk(data, tokens);
}

export function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function reduceNumbers(
  values: unknown[],
  reduce: "sum" | "last" | "first" | "max" = "sum"
): number {
  const nums = values.map(toNumber).filter((n) => Number.isFinite(n));
  if (nums.length === 0) return 0;
  if (reduce === "first") return nums[0] ?? 0;
  if (reduce === "last") return nums[nums.length - 1] ?? 0;
  if (reduce === "max") return Math.max(...nums);
  return nums.reduce((a, b) => a + b, 0);
}
