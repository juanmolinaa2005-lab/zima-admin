import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchSuperwallBillingReport,
  listSuperwallApplications,
} from "@/lib/superwall/admin";
import {
  getSuperwallApiKey,
  getSuperwallConnectionStatus,
} from "@/lib/superwall/user-key";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getSuperwallConnectionStatus();
  if (!status.connected || !status.orgId) {
    return NextResponse.json(
      { error: "Connect a Superwall API key first." },
      { status: 400 }
    );
  }

  const apiKey = await getSuperwallApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Connect a Superwall API key first." },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const days = Math.min(
    90,
    Math.max(1, Number(url.searchParams.get("days") || 7))
  );
  const applicationIdParam = url.searchParams.get("applicationId");

  try {
    const apps = await listSuperwallApplications(apiKey, status.orgId);
    const applicationId =
      applicationIdParam ||
      status.applicationId ||
      apps[0]?.id ||
      null;

    if (!applicationId) {
      return NextResponse.json({
        applications: apps,
        report: null,
        note: "No applications found in this Superwall organization.",
      });
    }

    const app = apps.find((a) => a.id === applicationId) ?? null;
    const report = await fetchSuperwallBillingReport(
      apiKey,
      applicationId,
      days,
      app?.name ?? null
    );

    return NextResponse.json({
      applications: apps,
      report,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not load Superwall analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
