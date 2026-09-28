import "server-only";
import { headers } from "next/headers";

export async function requestMeta() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim() || "unknown";
  return { ip, userAgent: (h.get("user-agent") ?? "").slice(0, 300), origin: h.get("origin") ?? (h.get("host") ? `https://${h.get("host")}` : null) };
}

/** Only allow same-site relative redirects (prevents open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/dashboard") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
