export function isFalBalanceLockError(error?: string | null): boolean {
  const t = (error || "").toLowerCase();
  return (
    t.includes("user is locked") ||
    t.includes("exhausted balance") ||
    t.includes("reason: top_up") ||
    t.includes("reason: top-up")
  );
}

export function isFalRequestMissingError(error?: string | null): boolean {
  const t = (error || "").toLowerCase();
  if (!t) return false;
  if (t.includes("no encontró este job")) return true;
  return t.includes("not found") && t.includes("/requests/");
}

/** fal.ai often shows credits in the dashboard while the API stays locked after a top-up. */
export function displayFalError(error?: string | null): string {
  const raw = (error || "").trim();
  if (!raw) return "";
  if (isFalBalanceLockError(raw)) {
    return "fal.ai tiene la cuenta bloqueada por recarga (TOP_UP). El dashboard puede mostrar créditos y la API seguir cerrada. Espera unos minutos, crea una API key nueva en fal.ai, pégala en Supabase → Secrets y reintenta. Si sigue, pídeles el desbloqueo.";
  }
  if (isFalRequestMissingError(raw)) {
    return "fal.ai ya no tiene este job. Pulsa reintentar para mandarlo otra vez.";
  }
  if (isKlingDurationError(raw)) {
    return "El video de referencia debe durar al menos 3 segundos. Recorta un tramo más largo y vuelve a generarlo.";
  }
  if (isKlingResolutionError(raw)) {
    return "El video de referencia no tenía una resolución que Kling acepte (cada lado entre 512 y 2160 px). Reintenta: ahora se reescala solo.";
  }
  return raw;
}

export function isKlingDurationError(error?: string | null): boolean {
  const t = (error || "").toLowerCase();
  return (
    t.includes("duration can not less than 3s") ||
    t.includes("duration cannot less than 3s") ||
    t.includes("duration cannot be less than 3") ||
    t.includes("video duration is not supported")
  );
}

export function isKlingResolutionError(error?: string | null): boolean {
  const t = (error || "").toLowerCase();
  return (
    t.includes("input video resolution is not supported") ||
    (t.includes("width and height must each be between") && t.includes("512"))
  );
}
