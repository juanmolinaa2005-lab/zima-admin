import { NextResponse } from "next/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { requireProjectOwner } from "@/lib/mail/access";
import { isSocialPlatform } from "@/lib/redes/types";
import { verifyLoginPassword } from "@/lib/redes/verify-login";

type Params = { params: Promise<{ id: string }> };

type Body = {
  password?: string;
  platform?: string;
  source?: "native" | "blotato";
  externalKey?: string;
  displayName?: string | null;
  handle?: string | null;
  loginUser?: string;
  loginPassword?: string;
  notes?: string;
  clear?: boolean;
};

async function requirePassword(
  email: string | undefined,
  password: string | undefined
) {
  if (!email) {
    return { ok: false as const, response: NextResponse.json(
      { error: "No signed-in email found." },
      { status: 401 }
    ) };
  }
  const check = await verifyLoginPassword(email, password || "");
  if (!check.ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: check.message }, { status: 403 }),
    };
  }
  return { ok: true as const };
}

/** Reveal stored login credentials (requires Zima login password). */
export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const auth = await requirePassword(user.email, body.password);
  if (!auth.ok) return auth.response;

  const platform = (body.platform || "").trim();
  const source = body.source === "blotato" ? "blotato" : "native";
  const externalKey = (body.externalKey || "").trim();
  if (!isSocialPlatform(platform) || !externalKey) {
    return NextResponse.json(
      { error: "platform and externalKey are required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("project_account_credentials")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("platform", platform)
    .eq("source", source)
    .eq("external_key", externalKey)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      credentials: {
        loginUser: "",
        loginPassword: "",
        notes: "",
        saved: false,
      },
    });
  }

  try {
    return NextResponse.json({
      credentials: {
        loginUser: data.login_user_ciphertext
          ? decryptSecret(data.login_user_ciphertext as string)
          : "",
        loginPassword: data.login_password_ciphertext
          ? decryptSecret(data.login_password_ciphertext as string)
          : "",
        notes: data.notes_ciphertext
          ? decryptSecret(data.notes_ciphertext as string)
          : "",
        saved: true,
        updatedAt: data.updated_at,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not decrypt credentials." },
      { status: 500 }
    );
  }
}

/** Save or clear login credentials (requires Zima login password). */
export async function PUT(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const auth = await requirePassword(user.email, body.password);
  if (!auth.ok) return auth.response;

  const platform = (body.platform || "").trim();
  const source = body.source === "blotato" ? "blotato" : "native";
  const externalKey = (body.externalKey || "").trim();
  if (!isSocialPlatform(platform) || !externalKey) {
    return NextResponse.json(
      { error: "platform and externalKey are required." },
      { status: 400 }
    );
  }

  if (body.clear) {
    const { error } = await supabase
      .from("project_account_credentials")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("platform", platform)
      .eq("source", source)
      .eq("external_key", externalKey);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, cleared: true });
  }

  const loginUser = (body.loginUser || "").trim();
  const loginPassword = body.loginPassword ?? "";
  const notes = (body.notes || "").trim();

  if (!loginUser && !loginPassword) {
    return NextResponse.json(
      { error: "Provide login user and/or password." },
      { status: 400 }
    );
  }

  const payload = {
    project_id: projectId,
    user_id: user.id,
    platform,
    source,
    external_key: externalKey,
    display_name: body.displayName || null,
    handle: body.handle || null,
    login_user_ciphertext: loginUser ? encryptSecret(loginUser) : null,
    login_password_ciphertext: loginPassword
      ? encryptSecret(loginPassword)
      : null,
    notes_ciphertext: notes ? encryptSecret(notes) : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("project_account_credentials").upsert(
    payload,
    { onConflict: "project_id,user_id,platform,source,external_key" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, saved: true });
}
