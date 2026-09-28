import "server-only";
import { z } from "zod";
import { createT, getDictionary } from "@/i18n";
import { dbErrorKey, logServerError } from "@/lib/errors";

export type ActionResult<T = unknown> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const initialActionState: ActionResult = { ok: true };

const { t } = createT(getDictionary("lv"));

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function dbFail(scope: string, err: { code?: string; message?: string; details?: string | null } | null): ActionResult<never> {
  logServerError(scope, err);
  return { ok: false, error: t(dbErrorKey(err)) };
}

/** Parse FormData with a zod schema; empty strings become undefined. */
export function parseForm<S extends z.ZodTypeAny>(schema: S, fd: FormData): { ok: true; data: z.infer<S> } | { ok: false; result: ActionResult<never> } {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION")) continue;
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (k.endsWith("[]")) {
        const key = k.slice(0, -2);
        raw[key] = [...((raw[key] as string[]) ?? []), trimmed];
      } else raw[k] = trimmed === "" ? undefined : trimmed;
    }
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, result: fail(t("errors.validation"), fieldErrors) };
  }
  return { ok: true, data: parsed.data };
}

// Reusable zod field builders (messages in Latvian)
export const zf = {
  uuid: () => z.string().uuid("Nederīga vērtība"),
  optUuid: () => z.string().uuid("Nederīga vērtība").optional(),
  text: (max = 500) => z.string().max(max, `Maksimums ${max} rakstzīmes`),
  reqText: (max = 200) => z.string({ error: "Obligāts lauks" }).min(1, "Obligāts lauks").max(max, `Maksimums ${max} rakstzīmes`),
  num: (min = 0, max = 1e9) => z.coerce.number({ error: "Jābūt skaitlim" }).min(min, `Minimums ${min}`).max(max, `Maksimums ${max}`),
  optNum: (min = 0, max = 1e9) => z.coerce.number({ error: "Jābūt skaitlim" }).min(min, `Minimums ${min}`).max(max, `Maksimums ${max}`).optional(),
  posNum: (max = 1e9) => z.coerce.number({ error: "Jābūt skaitlim" }).positive("Jābūt lielākam par 0").max(max, `Maksimums ${max}`),
  date: () => z.string({ error: "Obligāts lauks" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Nederīgs datums"),
  optDate: () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Nederīgs datums").optional(),
  dateTimeLocal: () => z.string({ error: "Obligāts lauks" }).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "Nederīgs laiks"),
  optDateTimeLocal: () => z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "Nederīgs laiks").optional(),
  currency: () => z.enum(["EUR", "SEK", "ISK"]),
  bool: () => z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  email: () => z.string().email("Nederīgs e-pasts").max(200),
};
