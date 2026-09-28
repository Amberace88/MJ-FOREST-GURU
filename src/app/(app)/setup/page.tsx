import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Check, Rocket } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ActionButton, type FormAction } from "@/components/ui/form";
import { requireOrg } from "@/lib/context";
import { hasServiceRole, serverEnv } from "@/lib/env.server";
import { INVITABLE_ROLES } from "@/lib/permissions";
import { getOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { NewEmployeeDialog } from "../employees/components";
import { NewMachineDialog } from "../machines/components";
import { NewProjectDialog } from "../projects/components";
import { CompanyForm, CountryDialog, CountryToggle, WorkRulesForm, type CountryRow } from "../settings/components";
import { MaponActions, MaponKeyForm } from "../settings/integrations/components";
import { InviteDialog } from "../settings/users/components";
import { completeSetup } from "./actions";

export const metadata: Metadata = { title: "Sistēmas iestatīšana" };

export default async function SetupPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireOrg();
  if (!ctx.can("manage_settings")) redirect("/dashboard");
  const sp = await searchParams;
  const steps = ctx.list("setup.steps");
  const done = sp.step === "done";
  const step = Math.min(steps.length - 1, Math.max(0, Number(sp.step ?? 0) || 0));

  if (done) {
    return (
      <div className="relative mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center text-center">
        <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-[radial-gradient(circle_at_center,rgba(94,160,110,0.25),transparent_60%)] blur-2xl" />
        <Image src="/brand/emblem.png" alt="" width={160} height={160} className="h-32 w-32 animate-fade-up drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]" priority />
        <h1 className="mt-8 font-display text-4xl font-bold uppercase tracking-[0.12em] text-ink animate-fade-up md:text-5xl" style={{ animationDelay: "120ms" }}>{ctx.t("setup.ready")}</h1>
        <p className="mt-3 text-muted animate-fade-up" style={{ animationDelay: "220ms" }}>{ctx.t("setup.readyText")}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.3em] text-faint animate-fade-up" style={{ animationDelay: "300ms" }}>{ctx.t("brand.footer")}</p>
        <ButtonLink href="/dashboard" size="lg" className="mt-8 animate-fade-up" style={{ animationDelay: "380ms" }}><Rocket className="h-5 w-5" /> {ctx.t("setup.goDashboard")}</ButtonLink>
      </div>
    );
  }

  const sb = ctx.supabase;
  const org = ctx.org.id;
  let body: ReactNode = null;
  let summary: ReactNode = null;

  if (step === 0) {
    body = (
      <div className="grid gap-6 lg:grid-cols-2">
        <CompanyForm values={{
          name: ctx.org.name, legal_name: ctx.settings?.legal_name ?? null, registration_number: ctx.settings?.registration_number ?? null,
          default_language: ctx.settings?.default_language ?? "lv", default_timezone: ctx.settings?.default_timezone ?? "Europe/Riga", default_currency: ctx.settings?.default_currency ?? "EUR",
        }} />
        <WorkRulesForm values={{
          overtime_after_hours: Number(ctx.settings?.overtime_after_hours ?? 8), max_shift_hours: Number(ctx.settings?.max_shift_hours ?? 12),
          missing_checkout_after_hours: Number(ctx.settings?.missing_checkout_after_hours ?? 13), service_warning_hours: Number(ctx.settings?.service_warning_hours ?? 50),
        }} />
      </div>
    );
  } else if (step === 1) {
    const { data } = await sb.from("countries").select("id, code, name, flag, timezone, currency, sort_order, is_active, site_identifier_fields").eq("organization_id", org).order("sort_order");
    const rows: CountryRow[] = (data ?? []).map((c) => ({ ...c, site_identifier_fields: Array.isArray(c.site_identifier_fields) ? (c.site_identifier_fields as string[]) : [] }));
    summary = <CountryDialog />;
    body = (
      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.map((c) => (
          <li key={c.id} className={cn("flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 p-4", !c.is_active && "opacity-60")}>
            <span className="text-3xl" aria-hidden>{c.flag}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{c.name}</span>
              <span className="block text-xs text-muted">{c.timezone} · {c.currency} · {c.site_identifier_fields.map((f) => ctx.label("projects.identifierFields", f)).join(", ") || "—"}</span>
            </span>
            <CountryDialog country={c} />
            <CountryToggle id={c.id} active={c.is_active} />
          </li>
        ))}
      </ul>
    );
  } else if (step === 2 || step === 3 || step === 4) {
    const opts = await getOptions(ctx);
    const list = step === 2 ? opts.employees.map((e) => ({ id: e.id, name: e.full_name, sub: e.job_title }))
      : step === 3 ? opts.machines.map((m) => ({ id: m.id, name: m.name, sub: ctx.label("machines.categories", m.category) }))
      : opts.projects.map((p) => ({ id: p.id, name: `${p.code} · ${p.name}`, sub: ctx.label("projects.status", p.status) }));
    summary = step === 2 ? <NewEmployeeDialog countries={opts.countryOptions} teams={opts.teamOptions} stay />
      : step === 3 ? <NewMachineDialog countries={opts.countryOptions} fuelTypes={opts.fuelTypes} stay />
      : <NewProjectDialog countries={ctx.countries} stay />;
    body = list.length ? (
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((x) => (
          <li key={x.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-3.5 py-3 text-sm animate-fade-up">
            <Check className="h-4 w-4 shrink-0 text-ok" />
            <span className="min-w-0"><span className="block truncate font-medium">{x.name}</span>{x.sub && <span className="block truncate text-xs text-muted">{x.sub}</span>}</span>
          </li>
        ))}
      </ul>
    ) : <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted">{ctx.t("setup.emptyStep")}</p>;
  } else if (step === 5) {
    const { data: mapon } = await sb.from("integration_settings").select("status, has_secret, secret_hint, device_count").eq("organization_id", org).eq("provider", "mapon").maybeSingle();
    const service = hasServiceRole();
    const hasKey = Boolean(serverEnv.maponApiKey) || Boolean(mapon?.has_secret);
    body = (
      <div className="max-w-xl space-y-4">
        <p className="text-sm text-muted">{ctx.t("setup.maponText")}</p>
        <div className="flex flex-wrap gap-2">
          <Badge tone={mapon?.status === "connected" ? "ok" : hasKey ? "warn" : "off"} dot>{ctx.label("integrations.status", mapon?.status ?? "not_configured")}</Badge>
          {mapon?.secret_hint && <Badge tone="neutral">{ctx.t("integrations.mapon.apiKeySet", { hint: mapon.secret_hint })}</Badge>}
        </div>
        {service ? <MaponKeyForm hasStoredKey={Boolean(mapon?.has_secret)} /> : <p className="text-sm text-warn">{ctx.t("users.serviceKeyMissing")}</p>}
        <MaponActions disabled={!service || !hasKey} />
      </div>
    );
  } else if (step === 6) {
    const [invRes, freeRes] = await Promise.all([
      sb.from("invitations").select("id, email, role_key, expires_at, accepted_at").eq("organization_id", org).order("created_at", { ascending: false }).limit(50),
      sb.from("employees").select("id, full_name, email").eq("organization_id", org).is("user_id", null).is("deleted_at", null).order("full_name").limit(500),
    ]);
    summary = <InviteDialog roles={INVITABLE_ROLES} disabled={!hasServiceRole()} employees={(freeRes.data ?? []).map((e) => ({ id: e.id, full_name: e.full_name, email: e.email }))} />;
    body = (invRes.data ?? []).length ? (
      <ul className="divide-y divide-line rounded-xl border border-line">
        {(invRes.data ?? []).map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="truncate">{i.email}</span>
            <Badge tone={i.accepted_at ? "ok" : "warn"}>{ctx.label("users.roleNames", i.role_key)}</Badge>
          </li>
        ))}
      </ul>
    ) : <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted">{ctx.t("setup.inviteText")}</p>;
  }

  const last = step === steps.length - 1;
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 animate-fade-up">
        <div className="text-xs uppercase tracking-[0.2em] text-muted">{ctx.t("setup.title")} · {step + 1} / {steps.length}</div>
        <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-wide md:text-4xl">{steps[step]}</h1>
      </header>
      <ol className="mb-6 grid grid-cols-7 gap-1.5" aria-label={ctx.t("setup.title")}>
        {steps.map((s, i) => (
          <li key={s}>
            <Link href={`/setup?step=${i}`} title={s} aria-current={i === step ? "step" : undefined}
              className={cn("block h-1.5 rounded-full transition-colors", i < step ? "bg-forest-400" : i === step ? "bg-amber" : "bg-surface-3 hover:bg-line-strong")} />
            <span className={cn("mt-2 hidden truncate text-[11px] md:block", i === step ? "text-ink" : "text-faint")}>{s}</span>
          </li>
        ))}
      </ol>
      <Card className="topo-bg">
        <CardBody className="pt-5">
          {summary && <div className="mb-4 flex justify-end">{summary}</div>}
          {body}
        </CardBody>
      </Card>
      <nav className="mt-6 flex items-center justify-between gap-3">
        {step > 0 ? <ButtonLink href={`/setup?step=${step - 1}`} variant="ghost"><ArrowLeft className="h-4 w-4" /> {ctx.t("common.back")}</ButtonLink> : <span />}
        <div className="flex items-center gap-2">
          {!last && <ButtonLink href={`/setup?step=${step + 1}`} variant="ghost">{ctx.t("setup.skip")}</ButtonLink>}
          {last
            ? <ActionButton action={completeSetup as FormAction} variant="amber" size="lg"><Rocket className="h-4 w-4" /> {ctx.t("common.finish")}</ActionButton>
            : <ButtonLink href={`/setup?step=${step + 1}`}>{ctx.t("common.next")} <ArrowRight className="h-4 w-4" /></ButtonLink>}
        </div>
      </nav>
    </div>
  );
}
