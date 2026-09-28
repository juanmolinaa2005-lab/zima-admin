import https from "https";
import http from "http";

function requestBuffer(
  url: string,
  options: {
    method: string;
    headers: Record<string, string>;
    body?: Buffer;
  }
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      parsed,
      {
        method: options.method,
        headers: options.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            text: Buffer.concat(chunks).toString("utf8"),
          });
        });
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(90_000, () => {
      req.destroy(new Error("Timed out uploading to Storage."));
    });
    if (options.body) req.write(options.body);
    req.end();
  });
}

/** Upload bytes to a Supabase Storage bucket without Next.js patched fetch. */
export async function uploadStorageObject(input: {
  supabaseUrl: string;
  accessToken: string;
  anonKey: string;
  bucket: string;
  path: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  const encodedPath = input.path
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  const url = `${input.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(input.bucket)}/${encodedPath}`;
  const { status, text } = await requestBuffer(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      apikey: input.anonKey,
      "Content-Type": input.contentType,
      "Content-Length": String(input.body.byteLength),
      "x-upsert": "false",
    },
    body: input.body,
  });
  if (status >= 200 && status < 300) return;

  let message = text.slice(0, 300) || `Storage upload failed (${status})`;
  try {
    const parsed = JSON.parse(text) as { message?: string; error?: string };
    message = parsed.message || parsed.error || message;
  } catch {
    /* keep raw */
  }
  throw new Error(message);
}
