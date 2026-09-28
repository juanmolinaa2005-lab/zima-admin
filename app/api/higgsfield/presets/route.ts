import { NextResponse } from "next/server";
import { VIDEO_PRESETS } from "@/lib/higgsfield/presets";

export async function GET() {
  return NextResponse.json({ presets: VIDEO_PRESETS });
}
