import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { submitHiggsfieldJob } from "@/lib/higgsfield/client";
import {
  clampDurationSeconds,
  durationPayloadValue,
  fillPromptTemplate,
  getImagePreset,
  getPreset,
  isImageModelId,
} from "@/lib/higgsfield/presets";
import { getHiggsfieldCredentials } from "@/lib/higgsfield/user-key";
import { generateOpenAIImage } from "@/lib/openai/images";
import { getOpenAIApiKey } from "@/lib/openai/user-key";
import { uploadStorageObject } from "@/lib/supabase/storage-binary";

export const maxDuration = 120;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: {
    presetId?: string;
    modelId?: string;
    prompt?: string;
    product?: string;
    hook?: string;
    style?: string;
    imageUrl?: string;
    duration?: number;
    aspectRatio?: string;
    kind?: "image" | "video";
    projectId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const imagePreset = body.presetId ? getImagePreset(body.presetId) : undefined;
  const preset = body.presetId ? getPreset(body.presetId) : undefined;
  const rawModelId = (body.modelId || imagePreset?.modelId || preset?.modelId || "").trim();
  const useOpenAI =
    imagePreset?.provider === "openai" ||
    /^(dall-e-|gpt-image-)/.test(rawModelId);
  const modelId = useOpenAI
    ? (imagePreset?.modelId || rawModelId).trim()
    : rawModelId;
  if (!modelId) {
    return NextResponse.json(
      { error: "Selecciona un preset o indica un modelId" },
      { status: 400 }
    );
  }

  const asImage =
    body.kind === "image" || Boolean(imagePreset) || isImageModelId(modelId);

  const prompt =
    body.prompt?.trim() ||
    (preset
      ? fillPromptTemplate(preset.promptTemplate, {
          product: body.product ?? "",
          hook: body.hook ?? "",
          style: body.style ?? "",
        })
      : "");

  if (!prompt) {
    return NextResponse.json(
      { error: "El prompt es obligatorio" },
      { status: 400 }
    );
  }

  if (asImage && useOpenAI) {
    const apiKey = await getOpenAIApiKey();
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "NOT_CONNECTED",
          message: "Conecta tu OpenAI API key en Ajustes → API.",
        },
        { status: 403 }
      );
    }
    const projectId = (body.projectId || "").trim();
    if (!projectId) {
      return NextResponse.json(
        { error: "Falta projectId para guardar la imagen" },
        { status: 400 }
      );
    }

    const aspect_ratio =
      body.aspectRatio ?? imagePreset?.aspectRatio ?? "9:16";
    try {
      const generated = await generateOpenAIImage(apiKey, {
        model: modelId,
        prompt,
        aspectRatio: aspect_ratio,
      });
      const ext = generated.contentType.includes("jpeg") ? "jpg" : "png";
      const storagePath = `${projectId}/${crypto.randomUUID()}.${ext}`;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (supabaseUrl && anonKey && accessToken) {
        await uploadStorageObject({
          supabaseUrl,
          accessToken,
          anonKey,
          bucket: "gallery",
          path: storagePath,
          body: generated.buffer,
          contentType: generated.contentType,
        });
      } else {
        const { error: upErr } = await supabase.storage
          .from("gallery")
          .upload(storagePath, generated.buffer, {
            contentType: generated.contentType,
            upsert: false,
          });
        if (upErr) throw new Error(upErr.message);
      }

      const { data: pub } = supabase.storage
        .from("gallery")
        .getPublicUrl(storagePath);
      const requestId = `openai-${crypto.randomUUID()}`;
      return NextResponse.json({
        job: { request_id: requestId, status: "completed" },
        meta: {
          kind: "image",
          modelId,
          prompt,
          presetId: imagePreset?.id,
          aspect_ratio,
          imageUrl: pub.publicUrl,
        },
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "No se pudo crear la imagen";
      return NextResponse.json({ error: message }, { status: 500 });
    }
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

  if (asImage) {
    const aspect_ratio =
      body.aspectRatio ?? imagePreset?.aspectRatio ?? "9:16";
    const payload: Record<string, unknown> = { prompt };
    if (imagePreset?.sendAspectRatio || body.aspectRatio) {
      payload.aspect_ratio = aspect_ratio;
    }
    try {
      const job = await submitHiggsfieldJob(creds, modelId, payload, {
        allowVideoFallback: false,
      });
      return NextResponse.json({
        job,
        meta: {
          kind: "image",
          modelId,
          prompt,
          presetId: imagePreset?.id ?? null,
          aspect_ratio,
        },
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "No se pudo crear la imagen";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const needsImage = preset?.needsImage ?? Boolean(body.imageUrl);
  const imageUrl = body.imageUrl?.trim() ?? "";
  if (needsImage && !imageUrl) {
    return NextResponse.json(
      { error: "Este preset necesita una image_url (HTTPS)" },
      { status: 400 }
    );
  }

  const rawDuration = Number(body.duration);
  const durationSpec = preset?.duration;
  const durationSeconds = durationSpec
    ? clampDurationSeconds(
        Number.isFinite(rawDuration)
          ? rawDuration
          : (preset?.defaultDuration ?? 5),
        durationSpec
      )
    : Number.isFinite(rawDuration)
      ? Math.min(30, Math.max(1, Math.round(rawDuration)))
      : 5;
  const aspect_ratio =
    body.aspectRatio ?? preset?.aspectRatio ?? "16:9";

  const payload: Record<string, unknown> = {
    prompt,
  };
  if (imageUrl) {
    payload.image_url = imageUrl;
  }
  if (durationSpec) {
    payload.duration = durationPayloadValue(durationSeconds, durationSpec);
  } else if (!preset) {
    payload.duration = durationSeconds;
  }
  if (preset?.sendAspectRatio || !preset) {
    payload.aspect_ratio = aspect_ratio;
  }

  try {
    const job = await submitHiggsfieldJob(creds, modelId, payload);
    return NextResponse.json({
      job,
      meta: {
        modelId,
        prompt,
        presetId: preset?.id ?? null,
        imageUrl: imageUrl || null,
        duration: durationSeconds,
        aspect_ratio,
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo crear el video";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
