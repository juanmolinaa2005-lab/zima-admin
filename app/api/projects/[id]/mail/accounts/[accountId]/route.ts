import { NextResponse } from "next/server";
import { getOwnedMailAccount } from "@/lib/mail/access";

type Params = { params: Promise<{ id: string; accountId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { id: projectId, accountId } = await params;
  const gate = await getOwnedMailAccount(projectId, accountId);
  if (!gate.ok) return gate.response;

  const { supabase, user } = gate;
  const { error } = await supabase
    .from("project_mail_accounts")
    .delete()
    .eq("id", accountId)
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
