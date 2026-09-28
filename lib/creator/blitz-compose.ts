import { cacheBlitzImage, cachedBlitzSrc } from "@/lib/creator/blitz-image-cache";

export type BlitzOverlayY = "top" | "center" | "bottom";
export type BlitzTextStyle = "box" | "outline";

function loadImage(src: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = src;
  });
}

async function loadSlideImage(url: string): Promise<HTMLImageElement> {
  const cached = cachedBlitzSrc(url);
  if (cached) return loadImage(cached, false);
  const warmed = await cacheBlitzImage(url);
  if (warmed) return loadImage(warmed, false);
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    return loadImage(objectUrl, false);
  } catch {
    return loadImage(url, true);
  }
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 4
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}

/** Flatten the Blitz overlay onto the photo, matching the in-app preview. */
export async function composeBlitzSlide(opts: {
  imageUrl: string;
  overlay: string;
  overlayY?: BlitzOverlayY;
  textStyle?: BlitzTextStyle;
}): Promise<Blob> {
  const img = await loadSlideImage(opts.imageUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error("Imagen vacía");

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el canvas");
  ctx.drawImage(img, 0, 0, w, h);

  const text = opts.overlay.trim();
  if (!text) {
    return canvasToJpeg(canvas);
  }

  const overlayY = opts.overlayY === "center" || opts.overlayY === "bottom"
    ? opts.overlayY
    : "top";
  const textStyle = opts.textStyle === "outline" ? "outline" : "box";
  const fontSize = Math.max(22, Math.round(Math.min(w / 15, h / 20)));
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `700 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;

  const maxTextW = w * 0.72;
  const lines = wrapLines(ctx, text, maxTextW);
  const lineH = fontSize * 1.28;
  const blockH = lines.length * lineH;
  const y0 =
    overlayY === "bottom"
      ? h * 0.84 - blockH
      : overlayY === "center"
        ? h * 0.26
        : h * 0.12;
  const cx = w / 2;

  if (textStyle === "box") {
    const padX = fontSize * 0.45;
    const padY = fontSize * 0.28;
    let boxW = 0;
    for (const line of lines) {
      boxW = Math.max(boxW, ctx.measureText(line).width);
    }
    boxW = Math.min(maxTextW, boxW) + padX * 2;
    const boxH = blockH + padY * 2;
    const boxX = cx - boxW / 2;
    const boxY = y0 - padY;
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    roundRect(ctx, boxX, boxY, boxW, boxH, Math.max(6, fontSize * 0.22));
    ctx.fill();
    ctx.fillStyle = "#111827";
    lines.forEach((line, i) => {
      ctx.fillText(line, cx, y0 + i * lineH, maxTextW);
    });
  } else {
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.lineWidth = Math.max(6, fontSize * 0.22);
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#111827";
    lines.forEach((line, i) => {
      const y = y0 + i * lineH;
      ctx.strokeText(line, cx, y, maxTextW);
      ctx.fillText(line, cx, y, maxTextW);
    });
  }

  return canvasToJpeg(canvas);
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || !blob.size) reject(new Error("No se pudo exportar la imagen"));
        else resolve(blob);
      },
      "image/jpeg",
      0.9
    );
  });
}
