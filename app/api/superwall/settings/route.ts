import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listSuperwallApplications,
  verifySuperwallApiKey,
} from "@/lib/superwall/admin";
import {
  clearSuperwallConnection,
  getSuperwallConnectionStatus,
  saveSuperwallConnection,
  updateSuperwallApplicationId,
} from "@/lib/superwall/user-key";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getSuperwallConnectionStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { apiKey?: string; applicationId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const apiKey = body.apiKey?.trim() ?? "";
  if (!apiKey) {
    return NextResponse.json(
      { error: "Paste your Superwall organization API key." },
      { status: 400 }
    );
  }

  try {
    const { orgs } = await verifySuperwallApiKey(apiKey);
    const orgId = String(orgs[0]!.id);
    const apps = await listSuperwallApplications(apiKey, orgId);
    const preferred =
      body.applicationId &&
      apps.some((a) => a.id === body.applicationId)
        ? body.applicationId
        : apps[0]?.id ?? null;

    await saveSuperwallConnection({
      apiKey,
      orgId,
      applicationId: preferred,
    });

    const status = await getSuperwallConnectionStatus();
    return NextResponse.json({
      ok: true,
      ...status,
      orgName: orgs[0]?.name ?? null,
      applications: apps,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not connect Superwall";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { applicationId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await updateSuperwallApplicationId(body.applicationId ?? null);
    const status = await getSuperwallConnectionStatus();
    return NextResponse.json({ ok: true, ...status });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not update";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await clearSuperwallConnection();
    return NextResponse.json({ ok: true, connected: false });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not disconnect";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
