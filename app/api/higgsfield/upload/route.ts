import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadHiggsfieldImage } from "@/lib/higgsfield/client";
import { getHiggsfieldCredentials } from "@/lib/higgsfield/user-key";

export const maxDuration = 60;

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const creds = await getHiggsfieldCredentials();
  if (!creds) {
    return NextResponse.json(
      {
        error: "NOT_CONNECTED",
        message: "Conecta tu API key de Higgsfield en Creator Studio.",
      },
      { status: 403 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulario inválido" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Falta el archivo de imagen" },
      { status: 400 }
    );
  }

  const type = (file.type || "").toLowerCase();
  if (!ALLOWED.has(type) && !type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Solo imágenes JPG, PNG o WEBP" },
      { status: 400 }
    );
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "La imagen debe pesar entre 1 byte y 12 MB" },
      { status: 400 }
    );
  }

  const contentType =
    type === "image/jpg" || !type ? "image/jpeg" : type;

  try {
    const buffer = await file.arrayBuffer();
    const url = await uploadHiggsfieldImage(creds, buffer, contentType);
    return NextResponse.json({ url });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo subir la imagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
