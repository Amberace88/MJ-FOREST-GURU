import type { TKey } from "@/i18n";

type DbError = { code?: string; message?: string; details?: string | null } | null | undefined;

/**
 * Maps PostgreSQL / PostgREST / Supabase errors to user-friendly Latvian
 * translation keys. Raw database errors are never shown to users; callers log
 * the technical error server-side.
 */
export function dbErrorKey(err: DbError): TKey {
  if (!err) return "errors.generic";
  const msg = `${err.message ?? ""} ${err.details ?? ""}`;
  if (/JWT|session|refresh_token|not authenticated|NOT_AUTHENTICATED/i.test(msg)) return "errors.sessionExpired";
  if (/SELF_APPROVAL|self_approval/.test(msg)) return "errors.selfApproval";
  if (/LAST_OWNER/.test(msg)) return "errors.lastOwner";
  if (/EXPENSE_INCOMPLETE/.test(msg)) return "errors.incompleteExpense";
  if (/uq_work_logs_one_active/.test(msg)) return "errors.activeShiftExists";
  if (/uq_fuel_duplicate/.test(msg)) return "errors.duplicate";
  if (/work_logs_end_after_start|end_after_start/.test(msg)) return "errors.endBeforeStart";
  if (/INVALID_DATE/.test(msg)) return "errors.invalidDate";
  if (/INVALID_PROJECT_ASSIGNMENT/.test(msg)) return "errors.closedProject";
  if (/INVALID_MACHINE_ASSIGNMENT/.test(msg)) return "errors.archivedMachine";
  if (/PERMISSION_DENIED|row-level security|permission denied/i.test(msg) || err.code === "42501") return "errors.permission";
  if (err.code === "23505") return "errors.duplicate";
  if (err.code === "23514" || err.code === "22P02" || err.code === "23502" || err.code === "22007" || err.code === "22008") return "errors.validation";
  if (err.code === "PGRST116") return "errors.notFound";
  if (/Failed to fetch|NetworkError|fetch failed/i.test(msg)) return "errors.offline";
  return "errors.generic";
}

export function logServerError(scope: string, err: unknown) {
  // Technical details stay on the server (Vercel logs); never sent to the client.
  console.error(`[mjfg:${scope}]`, err);
}
