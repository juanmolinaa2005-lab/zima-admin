import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Params = { params: Promise<{ code: string }> };

export async function GET(request: Request, { params }: Params) {
  const { code } = await params;
  if (!/^[a-z0-9]{4,16}$/i.test(code)) return NextResponse.redirect(new URL("/", request.url));

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data: target } = await supabase.rpc("track_marketing_link_click", { p_code: code });

  if (typeof target !== "string" || !/^https?:\/\//i.test(target)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.redirect(target, { status: 302 });
}
