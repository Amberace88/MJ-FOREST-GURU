import { MessageSquare } from "lucide-react";
import { addComment } from "@/app/(app)/common-actions";
import { ActionForm, SubmitButton, Textarea } from "@/components/ui/form";
import { Avatar } from "@/components/ui/misc";
import type { OrgContext } from "@/lib/context";
import { fmtRelative } from "@/lib/format";

/** Contextual, traceable comments (no giant company chat — spec §43). */
export async function Comments({ ctx, entityType, entityId, path }: { ctx: OrgContext; entityType: string; entityId: string; path: string }) {
  const { data } = await ctx.supabase.from("comments").select("id, body, created_at, author_id")
    .eq("entity_type", entityType).eq("entity_id", entityId).is("deleted_at", null).order("created_at");
  const authorIds = [...new Set((data ?? []).map((c) => c.author_id))];
  const { data: profiles } = authorIds.length
    ? await ctx.supabase.from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {(data ?? []).map((c) => (
          <li key={c.id} className="flex gap-3">
            <Avatar name={names.get(c.author_id)} size={32} />
            <div className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2/60 px-3.5 py-2.5">
              <div className="mb-1 flex items-center gap-2 text-xs">
                <span className="font-medium text-ink">{names.get(c.author_id) ?? "—"}</span>
                <span className="text-faint">{fmtRelative(c.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-ink-2">{c.body}</p>
            </div>
          </li>
        ))}
        {!(data ?? []).length && (
          <li className="flex items-center gap-2 text-sm text-muted"><MessageSquare className="h-4 w-4" /> {ctx.t("common.noData")}</li>
        )}
      </ul>
      <ActionForm action={addComment.bind(null, entityType, entityId, path)} resetOnSuccess className="space-y-2">
        <Textarea name="body" rows={2} placeholder={`${ctx.t("common.comment")}…`} aria-label={ctx.t("common.comment")} required maxLength={5000} />
        <div className="flex justify-end"><SubmitButton size="sm">{ctx.t("common.send")}</SubmitButton></div>
      </ActionForm>
    </div>
  );
}
