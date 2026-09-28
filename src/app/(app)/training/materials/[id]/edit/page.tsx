import type { Metadata } from "next";
import { Eye, Sparkles, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/misc";
import { requirePermission } from "@/lib/context";
import { sp as one } from "@/lib/utils";
import { deleteMaterial } from "../../actions";
import { MaterialEditor, type EditorMaterial } from "../../editor";

export const metadata: Metadata = { title: "Rediģēt mācību materiālu" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditMaterialPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const ctx = await requirePermission("manage_safety");
  const { data } = await ctx.supabase.from("training_materials")
    .select("id, title, subtitle, summary, category, country_id, audience, reading_minutes, requires_acknowledgement, body, status, builtin_key, is_customized, version")
    .eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  if (!data) notFound();
  const material = data as EditorMaterial & { version: number };
  const countries = ctx.countries.map((c) => ({ value: c.id, label: `${c.flag ?? ""} ${c.name}`.trim() }));
  const generated = one(sp.generated);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader back={{ href: `/training/materials/${id}`, label: material.title }}
        eyebrow={<>{ctx.t("materials.title")} <Badge tone={material.status === "published" ? "ok" : "off"}>{material.status === "published" ? ctx.t("materials.published") : ctx.t("materials.draft")}</Badge> <Badge tone="forest">v{material.version}</Badge></>}
        title={ctx.t("materials.editor.title")}
        actions={<>
          <ButtonLink href={`/training/materials/${id}`} variant="secondary"><Eye className="h-4 w-4" />{ctx.t("materials.read")}</ButtonLink>
          <ActionButton action={deleteMaterial.bind(null, id)} variant="danger" size="md" confirm={ctx.t("materials.editor.deleteConfirm")}>
            <Trash2 className="h-4 w-4" />{ctx.t("materials.editor.delete")}
          </ActionButton>
        </>} />
      {(generated === "ai" || generated === "template") && (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-2xl border border-amber/35 bg-amber/[0.08] px-4 py-3 text-sm text-ink animate-fade-up">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
          <span>{generated === "ai" ? ctx.t("materials.generator.createdAi") : ctx.t("materials.generator.created")}</span>
        </div>
      )}
      <MaterialEditor material={material} countries={countries} />
    </div>
  );
}
