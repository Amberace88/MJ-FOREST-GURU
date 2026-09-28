import type { Metadata } from "next";
import { CircleCheck, CircleX, ListOrdered, Scale, Sparkles, Target, TriangleAlert, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { requirePermission } from "@/lib/context";
import { GeneratorForm } from "../editor";

export const metadata: Metadata = { title: "Jauns mācību materiāls" };

export default async function NewMaterialPage() {
  const ctx = await requirePermission("manage_safety");
  const countries = ctx.countries.map((c) => ({ value: c.id, label: `${c.flag ?? ""} ${c.name}`.trim() }));
  const icons = [Target, ListOrdered, CircleCheck, CircleX, TriangleAlert, Users, Scale];
  const outline = ctx.list("materials.generator.outline").map((text, i) => ({ icon: icons[i] ?? Target, text }));
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader back={{ href: "/training", label: ctx.t("materials.back") }} eyebrow={<><Sparkles className="h-3.5 w-3.5 text-amber" />{ctx.t("materials.title")}</>}
        title={ctx.t("materials.generator.title")} subtitle={ctx.t("materials.generator.subtitle")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="card p-5 sm:p-7 animate-fade-up">
          <GeneratorForm countries={countries} />
        </section>
        <aside className="space-y-4 animate-fade-up" style={{ animationDelay: "80ms" }}>
          <div className="card topo-bg overflow-hidden p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{ctx.t("materials.generator.outlineTitle")}</div>
            <ol className="mt-3 space-y-2.5">
              {outline.map(({ icon: Icon, text }, i) => (
                <li key={text} className="flex items-center gap-3 text-sm text-ink-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-3 text-moss"><Icon className="h-3.5 w-3.5" /></span>
                  <span className="font-display text-xs font-semibold tabular text-faint">{String(i + 1).padStart(2, "0")}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
