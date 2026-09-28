"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbFail, fail, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";

/** Marks the first-run wizard as finished (owner / manage_settings). */
export async function completeSetup(_prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_settings")) return fail(ctx.t("errors.permission"));
  const { error } = await ctx.supabase.from("organization_settings").update({ setup_completed_at: new Date().toISOString() }).eq("organization_id", ctx.org.id);
  if (error) return dbFail("setup.complete", error);
  revalidatePath("/", "layout");
  redirect("/setup?step=done");
}
