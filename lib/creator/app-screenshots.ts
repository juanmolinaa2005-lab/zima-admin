export type StoreKind = "app-store" | "play";

export type StoreDevice = {
  id: string;
  label: string;
  store: StoreKind;
  width: number;
  height: number;
  note: string;
};

export const STORE_DEVICES: StoreDevice[] = [
  {
    id: "iphone-69",
    label: "iPhone 6.9\"",
    store: "app-store",
    width: 1320,
    height: 2868,
    note: "App Store · iPhone 16 Pro Max",
  },
  {
    id: "iphone-63",
    label: "iPhone 6.3\"",
    store: "app-store",
    width: 1206,
    height: 2622,
    note: "App Store · iPhone 16 Pro",
  },
  {
    id: "ipad-13",
    label: "iPad 13\"",
    store: "app-store",
    width: 2064,
    height: 2752,
    note: "App Store · iPad Pro",
  },
  {
    id: "play-phone",
    label: "Android teléfono",
    store: "play",
    width: 1080,
    height: 1920,
    note: "Play Store · 9:16",
  },
  {
    id: "play-tablet",
    label: "Android 10\"",
    store: "play",
    width: 1600,
    height: 2560,
    note: "Play Store · tablet",
  },
  {
    id: "play-feature",
    label: "Feature graphic",
    store: "play",
    width: 1024,
    height: 500,
    note: "Play Store · 1024×500",
  },
];

export type ScreenshotTemplateId =
  | "calm"
  | "glow"
  | "split"
  | "playful"
  | "minimal"
  | "stat"
  | "bold"
  | "feature";

export type ScreenshotTemplate = {
  id: ScreenshotTemplateId;
  name: string;
  reference: string;
  bg: string;
  fg: string;
  muted: string;
};

export const SCREENSHOT_TEMPLATES: ScreenshotTemplate[] = [
  {
    id: "calm",
    name: "Calm block",
    reference: "Headspace",
    bg: "#F6EDE4",
    fg: "#1C1917",
    muted: "#7C6F64",
  },
  {
    id: "glow",
    name: "Glow",
    reference: "Spotify",
    bg: "#0B0B0F",
    fg: "#F4F4F5",
    muted: "#A1A1AA",
  },
  {
    id: "split",
    name: "Split",
    reference: "Notion",
    bg: "#F7F6F3",
    fg: "#191919",
    muted: "#6F6E69",
  },
  {
    id: "playful",
    name: "Playful",
    reference: "Duolingo",
    bg: "#58CC02",
    fg: "#FFFFFF",
    muted: "#E8FFD1",
  },
  {
    id: "minimal",
    name: "Minimal",
    reference: "Linear",
    bg: "#FFFFFF",
    fg: "#111111",
    muted: "#8A8F98",
  },
  {
    id: "stat",
    name: "Stat hero",
    reference: "Strava",
    bg: "#111111",
    fg: "#FC4C02",
    muted: "#D4D4D8",
  },
  {
    id: "bold",
    name: "Bold type",
    reference: "Revolut",
    bg: "#0F3DDE",
    fg: "#FFFFFF",
    muted: "#C7D2FE",
  },
  {
    id: "feature",
    name: "Feature pills",
    reference: "Apple",
    bg: "#0B1220",
    fg: "#F8FAFC",
    muted: "#94A3B8",
  },
];

export type ScreenshotSlide = {
  id: string;
  templateId: ScreenshotTemplateId;
  headline: string;
  subhead: string;
  stat: string;
  caption: string;
  image: string;
  bg: string;
  fg: string;
};

export type ScreenshotStudioState = {
  deviceId: string;
  slideId: string;
  slides: ScreenshotSlide[];
};

function storageKey(projectId: string) {
  return `zima:estudio-v1:app-screenshots:${projectId}`;
}

export function deviceById(id: string) {
  return STORE_DEVICES.find((item) => item.id === id) ?? STORE_DEVICES[0];
}

export function templateById(id: string) {
  return (
    SCREENSHOT_TEMPLATES.find((item) => item.id === id) ?? SCREENSHOT_TEMPLATES[0]
  );
}

export function newSlideId() {
  return crypto.randomUUID();
}

export function emptySlides(): ScreenshotSlide[] {
  const copy: Array<Pick<ScreenshotSlide, "templateId" | "headline" | "subhead" | "stat" | "caption">> = [
    {
      templateId: "calm",
      headline: "Tu día, más claro",
      subhead: "La app que organiza lo importante sin ruido.",
      stat: "",
      caption: "01  ·  Inicio",
    },
    {
      templateId: "bold",
      headline: "Hazlo en segundos",
      subhead: "Flujos cortos. Resultados visibles.",
      stat: "",
      caption: "02  ·  Rápido",
    },
    {
      templateId: "stat",
      headline: "La gente se queda",
      subhead: "Retención real, no vanidad.",
      stat: "4.9",
      caption: "03  ·  Social proof",
    },
    {
      templateId: "minimal",
      headline: "Diseñado para foco",
      subhead: "Una pantalla. Una acción.",
      stat: "",
      caption: "04  ·  Producto",
    },
    {
      templateId: "glow",
      headline: "Empieza hoy",
      subhead: "Descárgala y abre tu primera sesión.",
      stat: "",
      caption: "05  ·  CTA",
    },
  ];
  return copy.map((item) => {
    const template = templateById(item.templateId);
    return {
      id: crypto.randomUUID(),
      image: "",
      bg: template.bg,
      fg: template.fg,
      ...item,
    };
  });
}

export function emptyScreenshotStudio(): ScreenshotStudioState {
  const slides = emptySlides();
  return {
    deviceId: STORE_DEVICES[0].id,
    slideId: slides[0]?.id ?? "",
    slides,
  };
}

export function loadScreenshotStudio(projectId: string): ScreenshotStudioState {
  if (typeof window === "undefined") return emptyScreenshotStudio();
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return emptyScreenshotStudio();
    const parsed = JSON.parse(raw) as Partial<ScreenshotStudioState>;
    const fallback = emptyScreenshotStudio();
    const slides = Array.isArray(parsed.slides) && parsed.slides.length
      ? parsed.slides.map((slide) => ({
          id: typeof slide.id === "string" ? slide.id : crypto.randomUUID(),
          templateId: templateById(String(slide.templateId)).id,
          headline: typeof slide.headline === "string" ? slide.headline : "",
          subhead: typeof slide.subhead === "string" ? slide.subhead : "",
          stat: typeof slide.stat === "string" ? slide.stat : "",
          caption: typeof slide.caption === "string" ? slide.caption : "",
          image: typeof slide.image === "string" ? slide.image : "",
          bg: typeof slide.bg === "string" ? slide.bg : templateById(String(slide.templateId)).bg,
          fg: typeof slide.fg === "string" ? slide.fg : templateById(String(slide.templateId)).fg,
        }))
      : fallback.slides;
    const deviceId = STORE_DEVICES.some((item) => item.id === parsed.deviceId)
      ? parsed.deviceId!
      : fallback.deviceId;
    const slideId = slides.some((item) => item.id === parsed.slideId)
      ? parsed.slideId!
      : slides[0].id;
    return { deviceId, slideId, slides };
  } catch {
    return emptyScreenshotStudio();
  }
}

export function saveScreenshotStudio(projectId: string, state: ScreenshotStudioState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(state));
  } catch {
    /* quota */
  }
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 4
) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    const next = `${current} ${word}`;
    if (ctx.measureText(next).width <= maxWidth) current = next;
    else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (lines.length < maxLines) lines.push(current);
  return lines;
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
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function coverImage(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const iw = "width" in img ? Number(img.width) : w;
  const ih = "height" in img ? Number(img.height) : h;
  const scale = Math.max(w / Math.max(1, iw), h / Math.max(1, ih));
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function drawFakeApp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: string
) {
  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#0F172A";
  ctx.fillRect(x, y, w, h * 0.11);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `600 ${Math.round(h * 0.028)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText("Hoy", x + w * 0.08, y + h * 0.07);
  const cardY = y + h * 0.16;
  const cardH = h * 0.18;
  for (let i = 0; i < 3; i += 1) {
    const cy = cardY + i * (cardH + h * 0.03);
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, x + w * 0.07, cy, w * 0.86, cardH, w * 0.045);
    ctx.fill();
    ctx.fillStyle = i === 0 ? accent : "#E2E8F0";
    roundRect(ctx, x + w * 0.1, cy + cardH * 0.22, w * 0.18, cardH * 0.56, w * 0.03);
    ctx.fill();
    ctx.fillStyle = "#0F172A";
    ctx.font = `650 ${Math.round(h * 0.026)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(["Resumen", "Actividad", "Siguiente"][i], x + w * 0.33, cy + cardH * 0.42);
    ctx.fillStyle = "#94A3B8";
    ctx.font = `500 ${Math.round(h * 0.02)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText("Listo para usar", x + w * 0.33, cy + cardH * 0.68);
  }
}

function drawPhone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  android: boolean,
  image: CanvasImageSource | null,
  accent: string
) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = w * 0.12;
  ctx.shadowOffsetY = h * 0.03;
  ctx.fillStyle = android ? "#111113" : "#1C1C1E";
  roundRect(ctx, x, y, w, h, w * (android ? 0.12 : 0.16));
  ctx.fill();
  ctx.restore();

  const inset = w * 0.045;
  const screenX = x + inset;
  const screenY = y + inset * (android ? 1.6 : 1.35);
  const screenW = w - inset * 2;
  const screenH = h - inset * (android ? 3.1 : 2.8);
  ctx.fillStyle = "#0B0B0C";
  roundRect(ctx, screenX, screenY, screenW, screenH, w * 0.1);
  ctx.fill();
  ctx.save();
  roundRect(ctx, screenX, screenY, screenW, screenH, w * 0.1);
  ctx.clip();
  if (image) coverImage(ctx, image, screenX, screenY, screenW, screenH);
  else drawFakeApp(ctx, screenX, screenY, screenW, screenH, accent);
  ctx.restore();

  if (!android) {
    ctx.fillStyle = "#000";
    roundRect(
      ctx,
      x + w * 0.32,
      y + h * 0.018,
      w * 0.36,
      h * 0.028,
      h * 0.014
    );
    ctx.fill();
  } else {
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.022, w * 0.018, 0, Math.PI * 2);
    ctx.fill();
  }
}

function fillBg(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  templateId: ScreenshotTemplateId
) {
  if (templateId === "glow") {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.38, 20, w * 0.5, h * 0.4, w * 0.9);
    g.addColorStop(0, "#1DB95455");
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  if (templateId === "feature") {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#1E3A5F");
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

export function drawScreenshotSlide(
  ctx: CanvasRenderingContext2D,
  device: StoreDevice,
  template: ScreenshotTemplate,
  slide: ScreenshotSlide,
  image: CanvasImageSource | null
) {
  const w = device.width;
  const h = device.height;
  const landscape = w > h;
  const android = device.store === "play";
  const bg = slide.bg || template.bg;
  const fg = slide.fg || template.fg;
  fillBg(ctx, w, h, bg, template.id);

  const pad = Math.round(Math.min(w, h) * 0.08);
  ctx.textBaseline = "top";
  ctx.fillStyle = fg;

  if (template.id === "calm" || template.id === "bold" || template.id === "playful") {
    ctx.font = `750 ${Math.round(w * (landscape ? 0.07 : 0.11))}px ui-sans-serif, system-ui, sans-serif`;
    const lines = wrapLines(ctx, slide.headline, w - pad * 2, landscape ? 2 : 3);
    lines.forEach((line, i) => {
      ctx.fillText(line, pad, pad + i * Math.round(w * (landscape ? 0.085 : 0.13)));
    });
    ctx.fillStyle = template.muted;
    ctx.font = `500 ${Math.round(w * 0.038)}px ui-sans-serif, system-ui, sans-serif`;
    wrapLines(ctx, slide.subhead, w - pad * 2, 3).forEach((line, i) => {
      ctx.fillText(
        line,
        pad,
        pad + lines.length * Math.round(w * 0.13) + Math.round(h * 0.02) + i * Math.round(w * 0.05)
      );
    });
    const pH = landscape ? h * 0.82 : h * 0.58;
    const pW = landscape ? pH * 0.48 : w * 0.72;
    drawPhone(
      ctx,
      landscape ? w - pW - pad : (w - pW) / 2,
      landscape ? (h - pH) / 2 : h - pH - pad * 0.4,
      pW,
      pH,
      android,
      image,
      fg
    );
  } else if (template.id === "split") {
    ctx.font = `700 ${Math.round(w * 0.09)}px ui-sans-serif, system-ui, sans-serif`;
    wrapLines(ctx, slide.headline, w - pad * 2, 3).forEach((line, i) => {
      ctx.fillText(line, pad, pad * 1.1 + i * Math.round(w * 0.11));
    });
    ctx.fillStyle = template.muted;
    ctx.font = `500 ${Math.round(w * 0.036)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(slide.subhead, pad, pad * 1.1 + Math.round(h * 0.22));
    const pW = w * 0.78;
    const pH = pW * 2.05;
    drawPhone(ctx, (w - pW) / 2, h * 0.34, pW, pH, android, image, fg);
  } else if (template.id === "minimal") {
    ctx.fillStyle = template.muted;
    ctx.font = `600 ${Math.round(w * 0.028)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(slide.caption || template.reference.toUpperCase(), pad, pad);
    ctx.fillStyle = fg;
    ctx.font = `650 ${Math.round(w * 0.07)}px ui-sans-serif, system-ui, sans-serif`;
    wrapLines(ctx, slide.headline, w - pad * 2, 2).forEach((line, i) => {
      ctx.fillText(line, pad, pad + Math.round(h * 0.04) + i * Math.round(w * 0.085));
    });
    const pW = w * 0.82;
    const pH = pW * 2.02;
    drawPhone(ctx, (w - pW) / 2, h * 0.2, pW, pH, android, image, fg);
  } else if (template.id === "stat") {
    ctx.fillStyle = fg;
    ctx.font = `800 ${Math.round(w * 0.28)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(slide.stat || "4.9", pad, pad * 0.7);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `650 ${Math.round(w * 0.055)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(slide.headline, pad, pad * 0.7 + Math.round(w * 0.3));
    ctx.fillStyle = template.muted;
    ctx.font = `500 ${Math.round(w * 0.034)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(slide.subhead, pad, pad * 0.7 + Math.round(w * 0.38));
    const pW = w * 0.74;
    const pH = pW * 2.05;
    drawPhone(ctx, (w - pW) / 2, h * 0.38, pW, pH, android, image, fg);
  } else if (template.id === "feature") {
    ctx.font = `750 ${Math.round(w * 0.09)}px ui-sans-serif, system-ui, sans-serif`;
    wrapLines(ctx, slide.headline, w - pad * 2, 3).forEach((line, i) => {
      ctx.fillText(line, pad, pad + i * Math.round(w * 0.11));
    });
    const pills = (slide.subhead || "Rápido · Claro · Tuyo")
      .split(/[·|,]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3);
    let px = pad;
    const py = pad + Math.round(h * 0.22);
    ctx.font = `650 ${Math.round(w * 0.028)}px ui-sans-serif, system-ui, sans-serif`;
    for (const pill of pills) {
      const tw = ctx.measureText(pill).width + Math.round(w * 0.06);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      roundRect(ctx, px, py, tw, Math.round(h * 0.038), 999);
      ctx.fill();
      ctx.fillStyle = "#F8FAFC";
      ctx.fillText(pill, px + Math.round(w * 0.028), py + Math.round(h * 0.01));
      px += tw + Math.round(w * 0.02);
    }
    const pW = w * 0.72;
    const pH = pW * 2.05;
    drawPhone(ctx, (w - pW) / 2, h * 0.32, pW, pH, android, image, fg);
  } else {
    ctx.fillStyle = template.muted;
    ctx.font = `650 ${Math.round(w * 0.028)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText((slide.caption || "PREMIUM").toUpperCase(), pad, pad);
    const pW = landscape ? h * 0.42 : w * 0.78;
    const pH = pW * 2.05;
    drawPhone(
      ctx,
      landscape ? w * 0.52 : (w - pW) / 2,
      landscape ? (h - Math.min(pH, h * 0.86)) / 2 : h * 0.12,
      pW,
      Math.min(pH, h * 0.72),
      android,
      image,
      fg
    );
    ctx.fillStyle = fg;
    ctx.font = `750 ${Math.round(w * (landscape ? 0.055 : 0.1))}px ui-sans-serif, system-ui, sans-serif`;
    wrapLines(ctx, slide.headline, landscape ? w * 0.44 : w - pad * 2, 3).forEach((line, i) => {
      ctx.fillText(
        line,
        pad,
        (landscape ? h * 0.28 : h * 0.78) + i * Math.round(w * 0.11)
      );
    });
  }
}

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function fileToSlideImage(file: File): Promise<string> {
  const raw = await file.arrayBuffer();
  const blob = new Blob([raw], { type: file.type || "image/jpeg" });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image"));
      el.src = objectUrl;
    });
    const canvas = document.createElement("canvas");
    const max = 1600;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
