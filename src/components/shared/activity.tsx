import { History } from "lucide-react";
import type { OrgContext } from "@/lib/context";
import { fmtDateTime } from "@/lib/format";

const HIDDEN = new Set(["organization_id", "created_by", "updated_at", "created_at", "id", "is_demo"]);

function short(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 80);
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? fmtDateTime(s) : s.slice(0, 80);
}

/** Audit trail for one record (who/what/when/old→new). Visible only with view_audit_log (RLS). */
export async function Activity({ ctx, entity, entityId, limit = 40 }: { ctx: OrgContext; entity: string; entityId: string; limit?: number }) {
  if (!ctx.can("view_audit_log")) return <p className="text-sm text-muted">{ctx.t("errors.permission")}</p>;
  const { data } = await ctx.supabase.from("audit_logs").select("id, action, actor_name, old_values, new_values, created_at, ip_address")
    .eq("entity", entity).eq("entity_id", entityId).order("created_at", { ascending: false }).limit(limit);
  if (!data?.length) return <p className="flex items-center gap-2 text-sm text-muted"><History className="h-4 w-4" /> {ctx.t("audit.empty")}</p>;
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {data.map((a) => {
        const nv = (a.new_values ?? {}) as Record<string, unknown>;
        const ov = (a.old_values ?? {}) as Record<string, unknown>;
        const keys = Object.keys(nv).filter((k) => !HIDDEN.has(k)).slice(0, 6);
        return (
          <li key={a.id} className="relative">
            <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-forest-400" />
            <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-medium text-ink">{ctx.label("audit.actions", a.action, a.action)}</span>
              <span className="text-muted">· {a.actor_name ?? "system"}</span>
              <span className="text-xs text-faint">{fmtDateTime(a.created_at, ctx.timezone)}</span>
            </div>
            {a.action !== "create" && keys.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs">
                {keys.map((k) => (
                  <li key={k} className="text-muted"><span className="text-ink-2">{k}</span>: <span className="line-through decoration-crit/60">{short(ov[k])}</span> → <span className="text-ink">{short(nv[k])}</span></li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
