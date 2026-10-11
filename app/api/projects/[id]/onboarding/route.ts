import { NextResponse } from "next/server";
import { requireProjectOwner } from "@/lib/mail/access";
import { appDetail } from "@/lib/market/appstore";
import { cleanAnswers, NO_APP, pitchFromDescription, type BuildType } from "@/lib/onboarding/questions";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await requireProjectOwner(projectId);
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => ({}))) as { type?: string; pitch?: string; answers?: Record<string, unknown> };
  if (body.type !== "app" && body.type !== "web") {
    return NextResponse.json({ error: "Elige app o web" }, { status: 400 });
  }
  const type: BuildType = body.type;
  const raw = body.answers ?? {};
  const answers = cleanAnswers(type, raw);
  let pitch = typeof body.pitch === "string" ? body.pitch.trim().slice(0, 280) || null : null;

  if (type === "app") {
    const appId = typeof raw.appId === "string" ? raw.appId : "";
    const country = typeof raw.appCountry === "string" && /^[a-z]{2}$/.test(raw.appCountry) ? raw.appCountry : "us";
    if (/^\d{5,}$/.test(appId)) {
      const app = await appDetail(appId, country);
      if (!app) return NextResponse.json({ error: "No encontramos esa app en la App Store" }, { status: 400 });
      Object.assign(answers, {
        appId: app.id,
        appName: app.name,
        appIcon: app.icon ?? "",
        appUrl: app.url,
        appGenre: app.genre,
        appSeller: app.seller,
        appCountry: country,
      });
      if (!answers.stores) answers.stores = ["ios"];
      pitch = pitchFromDescription(app.description) || pitch;
      if (app.description) answers.appDescription = app.description.slice(0, 2000);
    } else if (appId === NO_APP) {
      answers.appId = NO_APP;
    }
  }

  const { error } = await gate.supabase.from("launch_profiles").upsert(
    {
      project_id: projectId,
      product_type: type,
      pitch,
      answers,
      onboarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
