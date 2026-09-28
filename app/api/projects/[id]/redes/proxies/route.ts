import { NextResponse } from "next/server";
import { encryptSecret } from "@/lib/crypto";
import { requireProjectOwner } from "@/lib/mail/access";
import {
  parseProxyEndpoint,
  toPublicProxy,
  type ProxyRow,
} from "@/lib/redes/serialize";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const [{ data: proxies, error: pErr }, { data: accounts, error: aErr }] =
    await Promise.all([
      supabase
        .from("project_social_proxies")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("project_social_accounts")
        .select("id, proxy_id")
        .eq("project_id", projectId)
        .eq("user_id", user.id),
    ]);

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }
  if (aErr) {
    return NextResponse.json({ error: aErr.message }, { status: 500 });
  }

  const assignMap = new Map<string, string>();
  for (const a of accounts ?? []) {
    if (a.proxy_id) assignMap.set(a.proxy_id as string, a.id as string);
  }

  return NextResponse.json({
    proxies: ((proxies ?? []) as ProxyRow[]).map((row) =>
      toPublicProxy(row, assignMap.get(row.id) ?? null)
    ),
  });
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: {
    label?: string;
    endpoint?: string;
    protocol?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    country?: string;
    provider?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let protocol = (body.protocol || "http") as "http" | "https" | "socks5";
  let host = (body.host || "").trim();
  let port = Number(body.port || 0);
  let username = (body.username || "").trim() || undefined;
  let password = body.password || undefined;

  if (body.endpoint?.trim()) {
    const parsed = parseProxyEndpoint(body.endpoint);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid proxy endpoint. Use host:port or user:pass@host:port" },
        { status: 400 }
      );
    }
    protocol = parsed.protocol;
    host = parsed.host;
    port = parsed.port;
    username = parsed.username || username;
    password = parsed.password || password;
  }

  if (!host || !port) {
    return NextResponse.json(
      { error: "Proxy host and port are required." },
      { status: 400 }
    );
  }

  const label =
    (body.label || "").trim() ||
    `${host}:${port}${body.country ? ` · ${body.country}` : ""}`;

  const { data, error } = await supabase
    .from("project_social_proxies")
    .insert({
      project_id: projectId,
      user_id: user.id,
      label,
      protocol,
      host,
      port,
      username_ciphertext: username ? encryptSecret(username) : null,
      password_ciphertext: password ? encryptSecret(password) : null,
      country: (body.country || "").trim() || null,
      provider: (body.provider || "").trim() || null,
      status: "available",
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    proxy: toPublicProxy(data as ProxyRow, null),
  });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const url = new URL(request.url);
  const proxyId = url.searchParams.get("id");
  if (!proxyId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: assigned } = await supabase
    .from("project_social_accounts")
    .select("id")
    .eq("project_id", projectId)
    .eq("proxy_id", proxyId)
    .maybeSingle();

  if (assigned) {
    return NextResponse.json(
      { error: "Proxy is assigned to an account. Unassign it first." },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from("project_social_proxies")
    .delete()
    .eq("id", proxyId)
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
