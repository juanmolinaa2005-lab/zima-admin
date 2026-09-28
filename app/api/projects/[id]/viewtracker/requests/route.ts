import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";

type Params = { params: Promise<{ id: string }> };

const DEFAULT_SUBJECT = "Collaboration request — #name";
const DEFAULT_BODY = `Hi #name,

I'd love to collaborate with you on ViewTracker.

Looking forward to hearing from you.

Best,`;

export async function GET(_request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const { data, error } = await supabase
    .from("project_request_templates")
    .select("from_email, subject, body, updated_at")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      template: {
        fromEmail: "",
        subject: DEFAULT_SUBJECT,
        body: DEFAULT_BODY,
        exists: false,
      },
    });
  }

  return NextResponse.json({
    template: {
      fromEmail: data.from_email ?? "",
      subject: data.subject || DEFAULT_SUBJECT,
      body: data.body || DEFAULT_BODY,
      exists: true,
      updatedAt: data.updated_at,
    },
  });
}

export async function PUT(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  let body: {
    fromEmail?: string;
    subject?: string;
    body?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fromEmail = (body.fromEmail ?? "").trim().toLowerCase();
  const subject = (body.subject ?? "").trim() || DEFAULT_SUBJECT;
  const templateBody = typeof body.body === "string" ? body.body : DEFAULT_BODY;

  const { data, error } = await supabase
    .from("project_request_templates")
    .upsert(
      {
        project_id: projectId,
        user_id: user.id,
        from_email: fromEmail,
        subject,
        body: templateBody,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,user_id" }
    )
    .select("from_email, subject, body, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    template: {
      fromEmail: data.from_email ?? "",
      subject: data.subject || DEFAULT_SUBJECT,
      body: data.body || DEFAULT_BODY,
      exists: true,
      updatedAt: data.updated_at,
    },
  });
}
