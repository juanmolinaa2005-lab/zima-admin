import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import {
  displayNameFromMeta,
  parseProfileUrl,
  type OutreachChannel,
  type OutreachStatus,
} from "@/lib/viewtracker/profile";

type Params = { params: Promise<{ id: string }> };

const STATUSES = new Set<OutreachStatus>([
  "pending",
  "approved",
  "declined",
]);

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const { data, error } = await supabase
    .from("project_outreach_requests")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: {
    channel?: OutreachChannel;
    status?: OutreachStatus;
    toEmail?: string;
    profileUrl?: string;
    recipientName?: string;
    subject?: string;
    body?: string;
    fromEmail?: string;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const channel = body.channel === "profile" ? "profile" : "email";
  const profileUrl = (body.profileUrl ?? "").trim();
  const toEmail = (body.toEmail ?? "").trim().toLowerCase();

  if (channel === "email" && !toEmail) {
    return NextResponse.json(
      { error: "Recipient email is required." },
      { status: 400 }
    );
  }
  if (channel === "profile" && !profileUrl) {
    return NextResponse.json(
      { error: "Profile URL is required." },
      { status: 400 }
    );
  }

  const meta = profileUrl ? parseProfileUrl(profileUrl) : null;
  const status: OutreachStatus =
    body.status && STATUSES.has(body.status) ? body.status : "pending";

  const { data, error } = await supabase
    .from("project_outreach_requests")
    .insert({
      project_id: projectId,
      user_id: user.id,
      channel,
      status,
      recipient_name: displayNameFromMeta(
        meta,
        body.recipientName || null
      ),
      to_email: toEmail || null,
      profile_url: meta?.normalizedUrl || profileUrl || null,
      avatar_url: meta?.avatarUrl || null,
      platform: meta?.platform || null,
      subject: (body.subject ?? "").trim() || null,
      body: typeof body.body === "string" ? body.body : null,
      from_email: (body.fromEmail ?? "").trim().toLowerCase() || null,
      notes: (body.notes ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: {
    id?: string;
    status?: OutreachStatus;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.status && STATUSES.has(body.status)) patch.status = body.status;
  if (typeof body.notes === "string") patch.notes = body.notes.trim() || null;

  const { data, error } = await supabase
    .from("project_outreach_requests")
    .update(patch)
    .eq("id", body.id)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}
