import type { Metadata } from "next";
import { FileText, GraduationCap, Plus, RefreshCcw, TriangleAlert, UserX } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { expiryBucket } from "@/components/shared/lists";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FilterBar, type FilterDef } from "@/components/ui/filter-bar";
import { ActionButton } from "@/components/ui/form";
import { EmptyState, PageHeader, Pagination, TabNav } from "@/components/ui/misc";
import { DataTable } from "@/components/ui/table";
import { requireOrg, type OrgContext } from "@/lib/context";
import { addDays, fmtDate, todayIn } from "@/lib/format";
import { getOptions } from "@/lib/queries";
import { likeTerm, searchParamsToString, sp as one } from "@/lib/utils";
import { expiryRange, signedFileUrl } from "../documents/data";
import { EditCourseDialog, EditTrainingDialog, NewCourseDialog, NewTrainingDialog, type CourseOption } from "./components";
import { restoreBuiltinMaterials } from "./materials/actions";
import { MaterialsTab } from "./materials-tab";

export const metadata: Metadata = { title: "Apmācības" };
const PAGE = 30;
const BUCKETS = ["expired", "d7", "d14", "d30", "d60", "d90", "ok"] as const;
const isUuid = (v: string | undefined): v is string => Boolean(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));

type SP = Record<string, string | string[] | undefined>;
type Course = { id: string; title: string; description: string | null; country_id: string | null; validity_months: number | null; is_required: boolean; applies_to_job_titles: string[] | null };

export default async function TrainingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;

  // Certificate links (?cert=<file id>) → short-lived signed URL (files/storage RLS decide access).
  const cert = one(sp.cert);
  if (cert && /^[0-9a-f-]{36}$/i.test(cert)) {
    const f = await signedFileUrl(ctx, cert);
    if (f) redirect(f.url);
  }

  const tabParam = one(sp.tab);
  // Old deep links (?new=1, ?expiry=, ?course= …) still open the records tab.
  const recordsParams = ["new", "expiry", "course", "employee_filter", "q", "page"].some((k) => one(sp[k]));
  const tab = tabParam === "courses" ? "courses" : tabParam === "records" || (!tabParam && recordsParams) ? "records" : "materials";
  const canRecord = ctx.canAny("manage_safety", "edit_employees");
  const canCourse = ctx.can("manage_safety");
  const [opts, coursesRes] = await Promise.all([
    getOptions(ctx),
    ctx.supabase.from("safety_training").select("id, title, description, country_id, validity_months, is_required, applies_to_job_titles").eq("organization_id", ctx.org.id).order("title"),
  ]);
  const courses = (coursesRes.data ?? []) as Course[];
  const courseOptions: CourseOption[] = courses.map((c) => ({ value: c.id, label: c.title, validityMonths: c.validity_months, required: c.is_required }));

  return (
    <>
      <PageHeader title={ctx.t("training.title")} subtitle={ctx.t("training.subtitle")}
        actions={tab === "materials" ? (canCourse && <>
          <ActionButton action={restoreBuiltinMaterials} variant="secondary" size="md" confirm={ctx.t("materials.restoreConfirm")}>
            <RefreshCcw className="h-4 w-4" />{ctx.t("materials.restoreBuiltins")}
          </ActionButton>
          <ButtonLink href="/training/materials/new"><Plus className="h-4 w-4" />{ctx.t("materials.new")}</ButtonLink>
        </>) : <>
          {canCourse && <NewCourseDialog countries={opts.countryOptions} />}
          {canRecord && <NewTrainingDialog orgId={ctx.org.id} employees={opts.employeeOptions} courses={courseOptions} defaultOpen={one(sp.new) === "1"} initialEmployee={one(sp.employee)} />}
        </>} />
      <TabNav active={tab} items={[
        { key: "materials", label: ctx.t("training.tabs.materials"), href: "/training" },
        { key: "records", label: ctx.t("training.tabs.records"), href: "/training?tab=records" },
        { key: "courses", label: ctx.t("training.tabs.courses"), href: "/training?tab=courses", count: courses.length },
      ]} />
      {tab === "materials"
        ? <MaterialsTab ctx={ctx} sp={sp} />
        : tab === "records"
          ? <RecordsTab ctx={ctx} sp={sp} courses={courses} courseOptions={courseOptions} canRecord={canRecord} />
          : <CoursesTab ctx={ctx} courses={courses} canCourse={canCourse} />}
    </>
  );
}

async function RecordsTab({ ctx, sp, courses, courseOptions, canRecord }: { ctx: OrgContext; sp: SP; courses: Course[]; courseOptions: CourseOption[]; canRecord: boolean }) {
  const opts = await getOptions(ctx);
  const page = Math.max(1, Number(one(sp.page) ?? 1) || 1);
  const q = one(sp.q);
  const employeeParam = one(sp.employee_filter);
  const employee = isUuid(employeeParam) ? employeeParam : undefined;
  const courseParam = one(sp.course);
  const course = courseParam === "none" || isUuid(courseParam) ? courseParam : undefined;
  const expiry = one(sp.expiry);
  const today = todayIn(ctx.timezone);

  let query = ctx.supabase.from("employee_training")
    .select("id, employee_id, training_id, title, completed_at, expires_at, certificate_number, certificate_file_id, notes, is_demo, employee:employees(id, full_name, job_title), training:safety_training(id, is_required)", { count: "exact" })
    .eq("organization_id", ctx.org.id)
    .order("expires_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  const term = likeTerm(q);
  if (term) query = query.or(`title.ilike.${term},certificate_number.ilike.${term}`);
  if (employee) query = query.eq("employee_id", employee);
  if (course === "none") query = query.is("training_id", null);
  else if (course) query = query.eq("training_id", course);
  const range = expiryRange(expiry, today, addDays);
  if (range?.none) query = query.is("expires_at", null);
  if (range?.lt) query = query.lt("expires_at", range.lt);
  if (range?.gte) query = query.gte("expires_at", range.gte);
  if (range?.lte) query = query.lte("expires_at", range.lte);
  if (range?.gt) query = query.gt("expires_at", range.gt);

  const required = courses.filter((c) => c.is_required);
  const [listRes, expiredRes, soonRes, reqRecordsRes] = await Promise.all([
    query,
    ctx.supabase.from("employee_training").select("id", { count: "exact", head: true }).eq("organization_id", ctx.org.id).lt("expires_at", today),
    ctx.supabase.from("employee_training").select("id", { count: "exact", head: true }).eq("organization_id", ctx.org.id).gte("expires_at", today).lte("expires_at", addDays(today, 30)),
    required.length
      ? ctx.supabase.from("employee_training").select("employee_id, training_id, expires_at").eq("organization_id", ctx.org.id).in("training_id", required.map((c) => c.id)).limit(10000)
      : Promise.resolve({ data: [] as { employee_id: string; training_id: string | null; expires_at: string | null }[] }),
  ]);

  type Row = {
    id: string; employee_id: string; training_id: string | null; title: string; completed_at: string | null; expires_at: string | null; certificate_number: string | null;
    certificate_file_id: string | null; notes: string | null; is_demo: boolean; employee: { id: string; full_name: string; job_title: string | null } | null; training: { id: string; is_required: boolean } | null;
  };
  const rows = (listRes.data ?? []) as unknown as Row[];

  // Missing required training: active, visible employees that match a required course (country + job title) without a valid record.
  const valid = new Set((reqRecordsRes.data ?? []).filter((r) => !r.expires_at || r.expires_at >= today).map((r) => `${r.employee_id}:${r.training_id}`));
  const missing: { employee: { id: string; name: string }; course: string }[] = [];
  for (const e of opts.employees.filter((x) => x.status === "active")) {
    for (const c of required) {
      if (c.country_id && c.country_id !== e.country_id) continue;
      if (c.applies_to_job_titles?.length && !c.applies_to_job_titles.some((jt) => jt.toLowerCase() === (e.job_title ?? "").toLowerCase())) continue;
      if (!valid.has(`${e.id}:${c.id}`)) missing.push({ employee: { id: e.id, name: e.full_name ?? "" }, course: c.title });
    }
  }
  const missingEmployees = new Set(missing.map((m) => m.employee.id)).size;

  const filters: FilterDef[] = [
    { type: "search", name: "q" },
    ...(opts.employeeOptions.length > 1 ? [{ type: "select" as const, name: "employee_filter", label: ctx.t("common.employee"), options: opts.employeeOptions }] : []),
    { type: "select", name: "course", label: ctx.t("training.course"), options: [...courseOptions.map((c) => ({ value: c.value, label: c.label })), { value: "none", label: ctx.t("training.noCourse") }] },
    { type: "select", name: "expiry", label: ctx.t("documents.expiryFilter"), options: [
      ...BUCKETS.map((b) => ({ value: b, label: b === "ok" ? ctx.t("training.valid") : ctx.label("documents.expiring", b) })),
      { value: "none", label: ctx.t("training.noExpiry") },
    ] },
  ];

  const expiredCount = expiredRes.count ?? 0;
  const soonCount = soonRes.count ?? 0;

  return (
    <div className="space-y-5">
      {(expiredCount > 0 || soonCount > 0 || missingEmployees > 0) && (
        <div className="grid gap-3 md:grid-cols-3 animate-fade-up">
          {expiredCount > 0 && (
            <Link href={`/training${searchParamsToString({}, { expiry: "expired" })}`} className="flex items-center gap-3 rounded-xl border border-crit/30 bg-crit/10 px-4 py-3 text-sm text-crit hover:bg-crit/15">
              <TriangleAlert className="h-5 w-5 shrink-0" /><span className="font-medium">{ctx.t("training.expiredBanner", { n: expiredCount })}</span>
            </Link>
          )}
          {soonCount > 0 && (
            <Link href={`/training${searchParamsToString({}, { expiry: "d30" })}`} className="flex items-center gap-3 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn hover:bg-warn/15">
              <TriangleAlert className="h-5 w-5 shrink-0" /><span className="font-medium">{ctx.t("training.expiringBanner", { n: soonCount })}</span>
            </Link>
          )}
          {missingEmployees > 0 && (
            <a href="#missing" className="flex items-center gap-3 rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-amber hover:bg-amber/15">
              <UserX className="h-5 w-5 shrink-0" /><span className="font-medium">{ctx.t("training.missingRequiredText", { n: missingEmployees })}</span>
            </a>
          )}
        </div>
      )}

      <div>
        <FilterBar filters={filters} />
        <DataTable rows={rows} rowKey={(r) => r.id}
          empty={<EmptyState icon={<GraduationCap className="h-6 w-6" />} title={ctx.t("training.empty")} />}
          columns={[
            { key: "e", header: ctx.t("common.employee"), cell: (r) => r.employee ? <Link href={`/employees/${r.employee.id}?tab=training`} className="font-medium hover:text-amber">{r.employee.full_name}</Link> : "—" },
            { key: "t", header: ctx.t("training.course"), cell: (r) => (
              <span className="inline-flex items-center gap-2">
                <span className="line-clamp-1">{r.title}</span>
                {r.training?.is_required && <Badge tone="amber">{ctx.t("training.required")}</Badge>}
                {r.is_demo && <DemoBadge />}
              </span>
            ) },
            { key: "c", header: ctx.t("training.completed"), cell: (r) => fmtDate(r.completed_at), hideOnMobile: true },
            { key: "x", header: ctx.t("training.expires"), cell: (r) => {
              if (!r.expires_at) return <span className="text-muted">{ctx.t("training.noExpiry")}</span>;
              const b = expiryBucket(r.expires_at);
              return <span className="inline-flex items-center gap-2">{fmtDate(r.expires_at)} <Badge tone={b.tone} dot={b.tone === "crit"}>{b.key === "ok" ? ctx.t("training.valid") : ctx.label("documents.expiring", b.key)}</Badge></span>;
            } },
            { key: "n", header: ctx.t("training.certificate"), cell: (r) => r.certificate_number ?? "—", hideOnMobile: true },
            { key: "f", header: ctx.t("common.file"), cell: (r) => r.certificate_file_id
              ? <a href={`/training?cert=${r.certificate_file_id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-amber hover:underline"><FileText className="h-3.5 w-3.5" />{ctx.t("common.open")}</a>
              : "—", hideOnMobile: true },
            ...(canRecord ? [{ key: "a", header: "", align: "right" as const, cell: (r: Row) => (
              <EditTrainingDialog orgId={ctx.org.id} employees={opts.employeeOptions} courses={courseOptions}
                values={{ id: r.id, employee_id: r.employee_id, training_id: r.training_id, title: r.title, completed_at: r.completed_at, expires_at: r.expires_at, certificate_number: r.certificate_number, certificate_file_id: r.certificate_file_id, notes: r.notes }} />
            ) }] : []),
          ]} />
        <Pagination page={page} pageSize={PAGE} total={listRes.count ?? 0} hrefFor={(p) => `/training${searchParamsToString(sp, { page: String(p) })}`} />
      </div>

      {missing.length > 0 && (
        <Card id="missing">
          <CardHeader title={ctx.t("training.missingRequired")} icon={<UserX className="h-4 w-4" />} subtitle={ctx.t("training.missingRequiredText", { n: missingEmployees })} />
          <CardBody>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {missing.slice(0, 60).map((m, i) => (
                <li key={`${m.employee.id}-${i}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/40 px-3 py-2 text-sm">
                  <Link href={`/employees/${m.employee.id}?tab=training`} className="min-w-0 truncate hover:text-amber">{m.employee.name}</Link>
                  <span className="truncate text-xs text-amber">{m.course}</span>
                </li>
              ))}
            </ul>
            {missing.length > 60 && <p className="mt-2 text-xs text-muted">+{missing.length - 60}</p>}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

async function CoursesTab({ ctx, courses, canCourse }: { ctx: OrgContext; courses: Course[]; canCourse: boolean }) {
  const opts = await getOptions(ctx);
  const today = todayIn(ctx.timezone);
  const { data } = courses.length
    ? await ctx.supabase.from("employee_training").select("training_id, employee_id, expires_at").eq("organization_id", ctx.org.id).in("training_id", courses.map((c) => c.id)).limit(10000)
    : { data: [] as { training_id: string | null; employee_id: string; expires_at: string | null }[] };
  const coverage = new Map<string, Set<string>>();
  for (const r of data ?? []) {
    if (!r.training_id || (r.expires_at && r.expires_at < today)) continue;
    coverage.set(r.training_id, (coverage.get(r.training_id) ?? new Set()).add(r.employee_id));
  }
  return (
    <DataTable rows={courses} rowKey={(c) => c.id}
      empty={<EmptyState icon={<GraduationCap className="h-6 w-6" />} title={ctx.t("training.coursesEmpty")} action={canCourse ? <NewCourseDialog countries={opts.countryOptions} /> : undefined} />}
      columns={[
        { key: "t", header: ctx.t("training.titleLabel"), cell: (c) => (
          <span className="block min-w-0">
            <span className="inline-flex items-center gap-2 font-medium text-ink">{c.title}{c.is_required && <Badge tone="amber">{ctx.t("training.required")}</Badge>}</span>
            {c.description && <span className="mt-0.5 line-clamp-1 block text-xs text-muted">{c.description}</span>}
          </span>
        ) },
        { key: "c", header: ctx.t("common.country"), cell: (c) => { const k = ctx.countries.find((x) => x.id === c.country_id); return k ? `${k.flag ?? ""} ${k.name}` : ctx.t("training.allCountries"); } },
        { key: "v", header: ctx.t("training.validity"), cell: (c) => c.validity_months ? ctx.t("training.validFor", { n: c.validity_months }) : ctx.t("training.noExpiry") },
        { key: "a", header: ctx.t("training.appliesTo"), cell: (c) => c.applies_to_job_titles?.join(", ") || ctx.t("common.all"), hideOnMobile: true },
        { key: "cov", header: ctx.t("training.coverage"), cell: (c) => <Link href={`/training?course=${c.id}`} className="tabular hover:text-amber">{coverage.get(c.id)?.size ?? 0}</Link>, align: "right" },
        ...(canCourse ? [{ key: "e", header: "", align: "right" as const, cell: (c: Course) => <EditCourseDialog countries={opts.countryOptions} values={c} /> }] : []),
      ]} />
  );
}
