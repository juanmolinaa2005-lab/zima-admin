import { lookup } from "dns/promises";

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|::1|\[::1\])/i;

function isPrivateIp(ip: string): boolean {
  if (PRIVATE_HOST.test(ip)) return true;
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

export async function assertPublicHttpsUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("URL inválida.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Solo se permiten URLs http(s).");
  }
  if (url.username || url.password) {
    throw new Error("La URL no puede incluir credenciales.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (PRIVATE_HOST.test(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Ese host no está permitido.");
  }
  try {
    const records = await lookup(host, { all: true });
    if (records.some((r) => isPrivateIp(r.address))) {
      throw new Error("Ese host no está permitido.");
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("no está permitido")) throw e;
  }
  return url;
}
