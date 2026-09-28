import http from "http";
import https from "https";

const MAX_REDIRECTS = 5;

type DownloadResult = {
  buffer: Buffer;
  contentType: string;
};

/** Download binary data with Node http/https so Next.js does not cache the body. */
export function downloadBinary(
  url: string,
  maxBytes: number
): Promise<DownloadResult> {
  return downloadOnce(url, maxBytes, 0);
}

function downloadOnce(
  url: string,
  maxBytes: number,
  redirects: number
): Promise<DownloadResult> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error("Invalid video URL."));
      return;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      reject(new Error("Video URL must be HTTP(S)."));
      return;
    }

    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.get(
      parsed,
      {
        headers: {
          Accept: "video/*,application/octet-stream,*/*",
          "User-Agent": "ZimaAdmin/1.0",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location) {
          res.resume();
          if (redirects >= MAX_REDIRECTS) {
            reject(new Error("Too many redirects downloading the video."));
            return;
          }
          const nextUrl = new URL(location, parsed).toString();
          downloadOnce(nextUrl, maxBytes, redirects + 1).then(resolve, reject);
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`Could not download the video (${status}).`));
          return;
        }

        const length = Number(res.headers["content-length"] || 0);
        if (length > maxBytes) {
          res.destroy();
          reject(new Error("Generated video is larger than 200 MB."));
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > maxBytes) {
            res.destroy();
            reject(new Error("Generated video is larger than 200 MB."));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          const contentType = (
            res.headers["content-type"] || "video/mp4"
          )
            .split(";")[0]!
            .trim()
            .toLowerCase();
          resolve({ buffer: Buffer.concat(chunks), contentType });
        });
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(90_000, () => {
      req.destroy(new Error("Timed out downloading the video."));
    });
  });
}
