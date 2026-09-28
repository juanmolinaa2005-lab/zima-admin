/** Client-safe labels for Influencers 2. Never treat progress % as completion. */

const STALE_MS = 90_000;
const MODEL_STAGES = new Set(["research", "plan", "frames", "clips"]);

export type AutopilotRunView = {
  status: string;
  stage: string;
  videoUrl?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

export function formatAutopilotElapsed(fromIso: string, toMs = Date.now()): string {
  const start = Date.parse(fromIso);
  if (!Number.isFinite(start)) return "";
  const ms = toMs - start;
  if (!Number.isFinite(ms) || ms < 0) return "";
  const s = Math.floor(ms / 1000);
  if (s < 10) return "unos segundos";
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return m === 1 ? "1 min" : `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!rest) return h === 1 ? "1 h" : `${h} h`;
  return `${h} h ${rest} min`;
}

function ageMs(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const age = now - t;
  return Number.isFinite(age) && age >= 0 ? age : null;
}

export function describeAutopilotRun(
  run: AutopilotRunView,
  now = Date.now()
): {
  title: string;
  detail: string;
  elapsed: string;
  live: boolean;
  ready: boolean;
} {
  const elapsed = formatAutopilotElapsed(run.createdAt, now);
  const updatedAge = ageMs(run.updatedAt, now);
  const stale = updatedAge !== null && updatedAge > STALE_MS;
  const hasVideo = Boolean(run.videoUrl);
  const status = (run.status || "").toLowerCase();
  const stage = (run.stage || "").toLowerCase();

  if (hasVideo) {
    const ended = run.updatedAt ? Date.parse(run.updatedAt) : NaN;
    const took = Number.isFinite(ended)
      ? formatAutopilotElapsed(run.createdAt, ended)
      : "";
    return {
      title: "Listo",
      detail: took ? `Tardó ${took}` : "Ya puedes verlo",
      elapsed: took,
      live: false,
      ready: true,
    };
  }

  if (status === "failed" || status === "cancelled") {
    return {
      title: "No se pudo terminar",
      detail: (run.error || "El estudio no pudo completar este video.").trim(),
      elapsed,
      live: false,
      ready: false,
    };
  }

  if (status === "done" || status === "completed" || stage === "done") {
    return {
      title: "No se guardó el video",
      detail: (run.error || "La generación terminó sin un archivo reproducible.").trim(),
      elapsed,
      live: false,
      ready: false,
    };
  }

  const waiting = `Lleva ${elapsed || "unos segundos"}`;

  if (status === "queued" || (status !== "running" && stage === "queued")) {
    return {
      title: "En cola",
      detail:
        (ageMs(run.createdAt, now) || 0) > 45_000
          ? `Aún no empieza la generación · ${waiting.toLowerCase()}`
          : waiting,
      elapsed,
      live: false,
      ready: false,
    };
  }

  const waitingOnModel = MODEL_STAGES.has(stage) && stale;
  const stageCopy: Record<string, { work: string; wait: string; hint: string }> = {
    validate: {
      work: "Comprobando el producto y el perfil",
      wait: "Comprobando el producto y el perfil",
      hint: waiting,
    },
    influencer: {
      work: "Cargando las fotos del perfil",
      wait: "Cargando las fotos del perfil",
      hint: waiting,
    },
    research: {
      work: "Buscando referencias",
      wait: "Esperando referencias",
      hint: waiting,
    },
    plan: {
      work: "Dirigiendo la historia",
      wait: "Preparando las escenas",
      hint: waiting,
    },
    frames: {
      work: "Generando fotogramas",
      wait: "Esperando los fotogramas del modelo",
      hint: `Suele tardar unos minutos · ${waiting.toLowerCase()}`,
    },
    clips: {
      work: "Generando el video",
      wait: "Esperando el video del modelo",
      hint: `Esto suele tardar varios minutos · ${waiting.toLowerCase()}`,
    },
    montage: {
      work: "Revisando el video",
      wait: "Revisando el video",
      hint: waiting,
    },
    queued: {
      work: "Empezando",
      wait: "En cola",
      hint: waiting,
    },
  };

  const copy = stageCopy[stage] || {
    work: "Generando el video",
    wait: "Esperando al modelo",
    hint: waiting,
  };
  const live = status === "running" && !stale && stage !== "queued";

  return {
    title: waitingOnModel ? copy.wait : copy.work,
    detail: copy.hint,
    elapsed,
    live,
    ready: false,
  };
}
