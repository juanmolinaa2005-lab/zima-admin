const BASE = "https://api.openai.com/v1";

export type OpenAIContentPart =
  | { type: "text"; text: string }
  | {
      type: "image_url";
      image_url: { url: string; detail?: "low" | "high" | "auto" };
    };

export async function openaiChatJson<T>(
  apiKey: string,
  opts: {
    model?: string;
    system: string;
    user: string | OpenAIContentPart[];
    temperature?: number;
    maxTokens?: number;
  }
): Promise<T> {
  const model = opts.model?.trim() || "gpt-4o";
  const userContent =
    typeof opts.user === "string"
      ? opts.user
      : opts.user;
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.8,
      max_tokens: opts.maxTokens ?? 4000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: userContent },
      ],
    }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!res.ok) {
    throw new Error(
      data.error?.message || `ChatGPT no respondió (${res.status})`
    );
  }

  const raw = data.choices?.[0]?.message?.content?.trim() || "";
  const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (!jsonText) throw new Error("ChatGPT devolvió una respuesta vacía");
  try {
    return JSON.parse(jsonText) as T;
  } catch {
    throw new Error("ChatGPT no devolvió JSON válido");
  }
}
