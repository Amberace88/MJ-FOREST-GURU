import type { Metadata } from "next";
import { MapPin, Tractor, TreePine, Users } from "lucide-react";
import Link from "next/link";
import { LiveMap } from "@/components/map";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { NoPermission, PageHeader } from "@/components/ui/misc";
import { requireOrg } from "@/lib/context";
import { fmtRelative } from "@/lib/format";
import { getMapData } from "@/lib/map-data";

export const metadata: Metadata = { title: "Live Map" };

const TONE = { active: "ok", attention: "warn", critical: "crit", offline: "off" } as const;
const ICON = { machine: Tractor, project: TreePine, employee: Users } as const;

export default async function MapPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const selected = ctx.countries.find((c) => c.code === (sp.region ?? "").toUpperCase()) ?? (sp.region === "all" ? null : ctx.country);
  const data = await getMapData(ctx, { countryId: selected?.id ?? null });
  const markers = data.markers;
  const regionCodes = selected ? [selected.code] : ctx.countries.map((c) => c.code);
  const canGps = ctx.canAny("view_gps", "view_live_gps", "view_gps_history");
  const groups = (["machine", "project", "employee"] as const).map((k) => ({ k, items: markers.filter((m) => m.kind === k) })).filter((g) => g.items.length);
  const counts = {
    active: data.markers.filter((m) => m.status === "active").length,
    attention: data.markers.filter((m) => m.status === "attention").length,
    critical: data.markers.filter((m) => m.status === "critical").length,
    offline: data.markers.filter((m) => m.status === "offline").length,
  };

  return (
    <>
      <PageHeader title={ctx.t("map.title")} subtitle={ctx.t("map.subtitle")}
        actions={<div className="flex flex-wrap gap-1.5">
          {(Object.keys(counts) as (keyof typeof counts)[]).map((k) => <Badge key={k} tone={TONE[k]} dot>{ctx.label("map.legend", k)} · {counts[k]}</Badge>)}
        </div>} />
      <nav className="mb-4 flex flex-wrap gap-2" aria-label={ctx.t("common.country")}>
        {[{ key: "all", label: `🌍 ${ctx.t("common.allCountries")}`, active: !selected }, ...ctx.countries.map((c) => ({ key: c.code, label: `${c.flag ?? ""} ${c.name}`, active: selected?.id === c.id }))].map((r) => (
          <Link key={r.key} href={`/map?region=${r.key}`} scroll={false}
            className={`rounded-xl border px-3.5 py-2 text-sm font-medium transition-all ${r.active ? "border-forest-500/60 bg-forest-700 text-ink shadow-[0_6px_18px_-10px_var(--forest-500)]" : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"}`}>
            {r.label}
          </Link>
        ))}
      </nav>
      {!canGps && <div className="mb-4"><NoPermission text={ctx.t("map.noGpsPermission")} /></div>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden p-2">
          <LiveMap key={selected?.code ?? "all"} markers={markers} regions={regionCodes} height="calc(100dvh - 290px)" maponState={data.maponState} maponLastSuccess={data.maponLastSuccess} />
        </Card>
        <div className="space-y-4 xl:max-h-[calc(100dvh-224px)] xl:overflow-y-auto">
          {groups.length === 0 && <Card><CardBody className="pt-5 text-sm text-muted">{ctx.t("map.noPosition")}</CardBody></Card>}
          {groups.map(({ k, items }) => {
            const Icon = ICON[k];
            return (
              <Card key={k}>
                <CardHeader title={ctx.t(`map.${k === "machine" ? "machines" : k === "project" ? "projects" : "employees"}`)} subtitle={String(items.length)} icon={<Icon className="h-4 w-4" />} />
                <CardBody>
                  <ul className="divide-y divide-line">
                    {items.map((m) => (
                      <li key={`${m.kind}-${m.id}`}>
                        <Link href={m.href} className="flex items-center gap-3 py-2.5 text-sm hover:text-amber">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${m.status === "active" ? "bg-ok" : m.status === "attention" ? "bg-warn" : m.status === "critical" ? "bg-crit" : "bg-off"}`} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{m.title}</span>
                            {m.subtitle && <span className="block truncate text-xs text-muted">{m.subtitle}</span>}
                          </span>
                          {m.lastUpdate && <span className={`shrink-0 text-[11px] ${m.stale ? "text-warn" : "text-faint"}`}>{fmtRelative(m.lastUpdate)}</span>}
                          {!m.lastUpdate && <MapPin className="h-3.5 w-3.5 shrink-0 text-faint" />}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
