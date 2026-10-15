import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";

type Params = { params: Promise<{ id: string }> };

/** Returns the clean value, or `undefined` to leave the column untouched. */
export type Sanitizer = (value: unknown) => unknown;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const clean = {
  text:
    (max: number, fallback?: string): Sanitizer =>
    (v) => {
      if (v === undefined) return undefined;
      const s = typeof v === "string" ? v.trim().slice(0, max) : "";
      return s || fallback || null;
    },
  oneOf:
    (allowed: readonly string[]): Sanitizer =>
    (v) =>
      typeof v === "string" && allowed.includes(v) ? v : undefined,
  number: (): Sanitizer => (v) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  },
  date: (): Sanitizer => (v) => {
    if (v === undefined) return undefined;
    return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  },
  timestamp: (): Sanitizer => (v) => {
    if (v === undefined) return undefined;
    if (typeof v !== "string" || !v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  },
  uuid: (): Sanitizer => (v) => {
    if (v === undefined) return undefined;
    return typeof v === "string" && UUID.test(v) ? v : null;
  },
  url: (): Sanitizer => (v) => {
    if (v === undefined) return undefined;
    const s = typeof v === "string" ? v.trim() : "";
    return /^https?:\/\/\S+$/i.test(s) ? s.slice(0, 2000) : null;
  },
  tags: (): Sanitizer => (v) => {
    if (v === undefined) return undefined;
    const list = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[\s,]+/) : [];
    return list
      .map((t) => String(t).trim().replace(/^#*/, ""))
      .filter(Boolean)
      .slice(0, 30)
      .map((t) => `#${t.slice(0, 60)}`);
  },
};

export function sanitize(body: Record<string, unknown>, fields: Record<string, Sanitizer>) {
  const out: Record<string, unknown> = {};
  for (const [key, fn] of Object.entries(fields)) {
    if (!(key in body)) continue;
    const value = fn(body[key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

/** Owner-scoped list/create/update/delete handlers for a project table protected by `is_project_owner` RLS. */
export function projectCrud(opts: {
  table: string;
  fields: Record<string, Sanitizer>;
  required?: string[];
  order?: { column: string; ascending: boolean };
  limit?: number;
  prepareInsert?: (row: Record<string, unknown>) => Record<string, unknown>;
}) {
  const order = opts.order ?? { column: "created_at", ascending: false };

  async function GET(_request: Request, { params }: Params) {
    const { id: projectId } = await params;
    const gate = await requireProjectOwner(projectId);
    if (!gate.ok) return gate.response;
    const { data, error } = await gate.supabase
      .from(opts.table)
      .select("*")
      .eq("project_id", projectId)
      .order(order.column, { ascending: order.ascending, nullsFirst: false })
      .limit(opts.limit ?? 1000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  }

  async function POST(request: Request, { params }: Params) {
    const { id: projectId } = await params;
    const gate = await requireProjectOwner(projectId);
    if (!gate.ok) return gate.response;
    const body = await readJson(request);
    if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

    const rawItems = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [body];
    const rows = rawItems.slice(0, 50).map((raw): Record<string, unknown> => {
      const row = sanitize(raw ?? {}, opts.fields);
      return { ...(opts.prepareInsert ? opts.prepareInsert(row) : row), project_id: projectId };
    });
    for (const row of rows) {
      const missing = (opts.required ?? []).find((key) => row[key] == null || row[key] === "");
      if (missing) return NextResponse.json({ error: `Falta el campo «${missing}».` }, { status: 400 });
    }

    const { data, error } = await gate.supabase.from(opts.table).insert(rows).select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [], item: data?.[0] ?? null }, { status: 201 });
  }

  async function PATCH(request: Request, { params }: Params) {
    const { id: projectId } = await params;
    const gate = await requireProjectOwner(projectId);
    if (!gate.ok) return gate.response;
    const body = await readJson(request);
    const id = typeof body?.id === "string" ? body.id : "";
    if (!body || !UUID.test(id)) return NextResponse.json({ error: "Falta el id" }, { status: 400 });

    const patch = sanitize(body, opts.fields);
    for (const key of opts.required ?? []) {
      if (key in patch && (patch[key] == null || patch[key] === "")) delete patch[key];
    }
    const { data, error } = await gate.supabase
      .from(opts.table)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("project_id", projectId)
      .select("*")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ item: data });
  }

  async function DELETE(request: Request, { params }: Params) {
    const { id: projectId } = await params;
    const gate = await requireProjectOwner(projectId);
    if (!gate.ok) return gate.response;
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!UUID.test(id)) return NextResponse.json({ error: "Falta el id" }, { status: 400 });
    const { error } = await gate.supabase.from(opts.table).delete().eq("id", id).eq("project_id", projectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return { GET, POST, PATCH, DELETE };
}
