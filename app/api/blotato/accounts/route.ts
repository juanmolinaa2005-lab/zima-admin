import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { blotatoListAccounts } from "@/lib/blotato/client";
import { getBlotatoApiKey } from "@/lib/blotato/user-key";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const apiKey = await getBlotatoApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Blotato API not connected", connected: false, accounts: [] },
      { status: 400 }
    );
  }

  const platform = new URL(request.url).searchParams.get("platform") || undefined;

  try {
    const accounts = await blotatoListAccounts(apiKey, platform || undefined);
    return NextResponse.json({ connected: true, accounts });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Failed to list accounts",
        connected: true,
        accounts: [],
      },
      { status: 502 }
    );
  }
}
