import type { Metadata } from "next";
import { Banknote, CheckCircle2, CircleDot, FileText, Gavel, History, ImageOff, Lock, MessageSquare, Receipt, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity } from "@/components/shared/activity";
import { Comments } from "@/components/shared/comments";
import { FileGallery, loadFiles } from "@/components/shared/file-gallery";
import { FileUploader } from "@/components/shared/file-uploader";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, DefinitionList } from "@/components/ui/card";
import { ActionButton } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/misc";
import { requirePermission, type OrgContext } from "@/lib/context";
import { fmtDate, fmtDateTime, fmtMoney, todayIn } from "@/lib/format";
import { getOptions } from "@/lib/queries";
import { cn, statusTone } from "@/lib/utils";
import { defaultCurrency, receiptFormOptions } from "../../receipts/options";
import { deleteExpense, markExpensePaid, submitExpense } from "../actions";
import { DecisionPanel, EditExpenseDialog } from "../components";

export const metadata: Metadata = { title: "Izdevums" };

type ReceiptRel = {
  id: string; merchant: string | null; amount: number | null; currency: string | null; receipt_date: string | null; ocr_confirmed: boolean;
  file: { id: string; bucket: string; path: string; mime_type: string | null; original_name: string | null } | null;
} | null;

export default async function ExpenseDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("create_expense", "view_finance", "approve_expense");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: e } = await ctx.supabase.from("expenses")
    .select("*, employee:employees(id, full_name), project:projects(id, code, name), machine:machines(id, name), country:countries(name, flag), receipt:receipts(id, merchant, amount, currency, receipt_date, ocr_confirmed, file:files(id, bucket, path, mime_type, original_name))")
    .eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  if (!e) notFound();

  const employee = e.employee as unknown as { id: string; full_name: string } | null;
  const project = e.project as unknown as { id: string; code: string; name: string } | null;
  const machine = e.machine as unknown as { id: string; name: string } | null;
  const country = e.country as unknown as { name: string; flag: string | null } | null;
  const receipt = e.receipt as unknown as ReceiptRel;

  const people = [e.created_by, e.decided_by].filter((x): x is string => Boolean(x));
  const [profilesRes, files, receiptUrl] = await Promise.all([
    people.length ? ctx.supabase.from("profiles").select("id, full_name").in("id", people) : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    loadFiles(ctx, "expense", id),
    receipt?.file ? ctx.supabase.storage.from(receipt.file.bucket).createSignedUrl(receipt.file.path, 60 * 60).then((r) => r.data?.signedUrl ?? null) : Promise.resolve(null),
  ]);
  const names = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name]));

  const isOwner = e.created_by === ctx.user.id || (e.employee_id != null && e.employee_id === ctx.employee?.id);
  const ownerEditable = isOwner && (e.status === "draft" || e.status === "correction_requested");
  const isApprover = ctx.canAny("approve_expense", "view_finance");
  const selfBlocked = e.created_by === ctx.user.id && !ctx.roles.includes("owner");
  const canDecide = isApprover && e.status === "submitted" && !selfBlocked;
  const canMarkPaid = ctx.can("view_finance") && e.status === "approved";
  const path = `/expenses/${id}`;

  const editProps = ownerEditable ? await (async () => {
    const [formOptions, opts] = await Promise.all([receiptFormOptions(ctx), getOptions(ctx)]);
    // keep the current (possibly completed) project / machine selectable
    if (project && !formOptions.projects.some((p) => p.value === project.id)) formOptions.projects = [{ value: project.id, label: `${project.code} · ${project.name}` }, ...formOptions.projects];
    return { formOptions, employees: ctx.can("view_finance") ? opts.employeeOptions : undefined };
  })() : null;

  const trace: { key: string; icon: React.ReactNode; title: string; who?: string | null; when: string | null; note?: string | null; tone: "ok" | "warn" | "crit" | "info" | "off" }[] = [
    { key: "created", icon: <CircleDot className="h-3.5 w-3.5" />, title: ctx.t("expenses.traceCreated"), who: names.get(e.created_by ?? "") ?? null, when: e.created_at, tone: "off" },
    ...(e.submitted_at ? [{ key: "submitted", icon: <Send className="h-3.5 w-3.5" />, title: ctx.t("expenses.traceSubmitted"), who: employee?.full_name ?? names.get(e.created_by ?? "") ?? null, when: e.submitted_at, tone: "warn" as const }] : []),
    ...(e.decided_at ? [{
      key: "decided", icon: <Gavel className="h-3.5 w-3.5" />, when: e.decided_at, note: e.decision_comment,
      title: ctx.t("expenses.traceDecided", { status: ctx.label("expenses.status", e.status === "paid" ? "approved" : e.status) }),
      who: names.get(e.decided_by ?? "") ?? null, tone: (e.status === "rejected" ? "crit" : e.status === "correction_requested" ? "info" : "ok") as "crit" | "info" | "ok",
    }] : []),
    ...(e.paid_at ? [{ key: "paid", icon: <Banknote className="h-3.5 w-3.5" />, title: ctx.t("expenses.tracePaid"), when: e.paid_at, tone: "ok" as const }] : []),
  ];
  const dot = { ok: "bg-ok", warn: "bg-warn", crit: "bg-crit", info: "bg-info", off: "bg-off" };

  return (
    <>
      <PageHeader
        back={{ href: "/expenses", label: ctx.t("expenses.title") }}
        eyebrow={<><span>{ctx.label("expenses.categories", e.category)}</span><span>·</span><span>{fmtDate(e.expense_date)}</span>{country && <span>{country.flag} {country.name}</span>}{e.is_demo && <DemoBadge />}</>}
        title={<span className="tabular">{fmtMoney(e.amount, e.currency)}</span>}
        subtitle={e.description ?? undefined}
        actions={<>
          <Badge tone={statusTone(e.status)} dot pulse={e.status === "submitted"} className="px-3 py-1 text-xs">{ctx.label("expenses.status", e.status)}</Badge>
          {ownerEditable && editProps && (
            <EditExpenseDialog orgId={ctx.org.id} options={editProps.formOptions} employees={editProps.employees} defaultCurrency={defaultCurrency(ctx)}
              today={todayIn(ctx.timezone)}
              values={{
                id: e.id, expense_date: e.expense_date, amount: e.amount, currency: e.currency, category: e.category, project_id: e.project_id,
                machine_id: e.machine_id, employee_id: e.employee_id, description: e.description, company_id: e.company_id,
                receipt: receipt ? { id: receipt.id, url: receipt.file?.mime_type?.startsWith("image/") ? receiptUrl : null, label: receipt.merchant ?? receipt.file?.original_name ?? ctx.t("expenses.receipt") } : null,
              }} />
          )}
          {ownerEditable && (
            <ActionButton action={submitExpense.bind(null, id)} variant="amber" size="md"><Send className="h-4 w-4" /> {e.status === "draft" ? ctx.t("expenses.submit") : ctx.t("expenses.resubmit")}</ActionButton>
          )}
          {isOwner && e.status === "draft" && (
            <ActionButton action={deleteExpense.bind(null, id)} variant="ghost" size="md" confirm={`${ctx.t("common.delete")}?`}><Trash2 className="h-4 w-4" /> {ctx.t("common.delete")}</ActionButton>
          )}
        </>}
      />

      {e.status === "correction_requested" && e.decision_comment && (
        <div role="status" className="mb-5 rounded-xl border border-info/30 bg-info/10 px-4 py-3 text-sm animate-fade-up">
          <p className="font-medium text-info">{ctx.t("expenses.correctionRequestedTitle")}</p>
          <p className="mt-0.5 whitespace-pre-wrap text-ink-2">{e.decision_comment}</p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={ctx.t("common.details")} />
            <CardBody>
              <DefinitionList items={[
                { label: ctx.t("common.amount"), value: <span className="font-semibold tabular">{fmtMoney(e.amount, e.currency)}</span> },
                { label: ctx.t("common.date"), value: fmtDate(e.expense_date) },
                { label: ctx.t("common.category"), value: ctx.label("expenses.categories", e.category) },
                { label: ctx.t("common.employee"), value: employee ? (ctx.can("view_all_employees") ? <Link href={`/employees/${employee.id}`} className="hover:text-amber">{employee.full_name}</Link> : employee.full_name) : null },
                { label: ctx.t("common.project"), value: project ? <Link href={`/projects/${project.id}`} className="hover:text-amber">{project.code} · {project.name}</Link> : null },
                { label: ctx.t("common.machine"), value: machine ? <Link href={`/machines/${machine.id}`} className="hover:text-amber">{machine.name}</Link> : null },
                { label: ctx.t("common.country"), value: country ? `${country.flag ?? ""} ${country.name}` : null },
                { label: ctx.t("common.status"), value: <Badge tone={statusTone(e.status)}>{ctx.label("expenses.status", e.status)}</Badge> },
              ]} />
              {e.description && <p className="mt-4 whitespace-pre-wrap rounded-xl border border-line bg-surface-2/50 p-3 text-sm text-ink-2">{e.description}</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={ctx.t("expenses.receipt")} icon={<Receipt className="h-4 w-4" />}
              subtitle={receipt ? (receipt.ocr_confirmed ? ctx.t("receipts.confirmed") : ctx.t("receipts.unconfirmed")) : ctx.t("expenses.noReceipt")}
              action={receipt && <Link href={`/receipts?receipt=${receipt.id}`} className="text-sm text-amber hover:underline">{ctx.t("common.open")}</Link>} />
            <CardBody className="space-y-4">
              {receipt && <ReceiptPreview url={receiptUrl} receipt={receipt} ctx={ctx} />}
              <FileGallery files={files} tz={ctx.timezone} empty={receipt ? undefined : ctx.t("expenses.noReceipt")} />
              {(ownerEditable || ctx.can("view_finance")) && (
                <FileUploader orgId={ctx.org.id} entityType="expense" entityId={id} bucket="receipts" kind="receipt" capture
                  accept="image/*,application/pdf" label={ctx.t("expenses.addReceiptPhoto")} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={ctx.t("common.comments")} icon={<MessageSquare className="h-4 w-4" />} />
            <CardBody><Comments ctx={ctx} entityType="expense" entityId={id} path={path} /></CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className={cn(canDecide && "ring-1 ring-amber/40")}>
            <CardHeader title={ctx.t("expenses.approval")} icon={<Gavel className="h-4 w-4" />} />
            <CardBody className="space-y-4">
              {canDecide ? (
                <DecisionPanel expenseId={id} />
              ) : isApprover && e.status === "submitted" && selfBlocked ? (
                <p className="flex items-start gap-2 text-sm text-muted"><Lock className="mt-0.5 h-4 w-4 shrink-0" /> {ctx.t("errors.selfApproval")}</p>
              ) : (
                <p className="text-sm text-muted">{ctx.label("expenses.statusHint", e.status)}</p>
              )}
              {canMarkPaid && (
                <ActionButton action={markExpensePaid.bind(null, id)} variant="primary" size="md" confirm={`${ctx.t("expenses.markPaid")}?`} className="w-full">
                  <Banknote className="h-4 w-4" /> {ctx.t("expenses.markPaid")}
                </ActionButton>
              )}
              {e.status === "paid" && <p className="flex items-center gap-2 text-sm text-ok"><CheckCircle2 className="h-4 w-4" /> {ctx.label("expenses.status", "paid")} · {fmtDateTime(e.paid_at, ctx.timezone)}</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={ctx.t("expenses.trace")} icon={<History className="h-4 w-4" />} />
            <CardBody>
              <ol className="relative space-y-4 border-l border-line pl-5">
                {trace.map((s) => (
                  <li key={s.key} className="relative">
                    <span className={cn("absolute -left-[27px] top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-bg", dot[s.tone])} aria-hidden />
                    <div className="flex items-center gap-1.5 text-sm font-medium text-ink">{s.icon} {s.title}</div>
                    <div className="text-xs text-muted">{s.who ? `${s.who} · ` : ""}{fmtDateTime(s.when, ctx.timezone)}</div>
                    {s.note && <p className="mt-1 whitespace-pre-wrap rounded-lg border border-line bg-surface-2/50 px-2.5 py-1.5 text-xs text-ink-2">{s.note}</p>}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={ctx.t("common.activity")} />
            <CardBody><Activity ctx={ctx} entity="expenses" entityId={id} limit={20} /></CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function ReceiptPreview({ url, receipt, ctx }: { url: string | null; receipt: NonNullable<ReceiptRel>; ctx: OrgContext }) {
  const isImg = receipt.file?.mime_type?.startsWith("image/") && receipt.file.mime_type !== "image/heic";
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <a href={url ?? undefined} target="_blank" rel="noopener noreferrer"
        className="block w-full shrink-0 overflow-hidden rounded-xl border border-line bg-surface-2 sm:w-56">
        {url && isImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={receipt.merchant ?? ctx.t("expenses.receipt")} className="max-h-80 w-full object-contain" />
        ) : (
          <span className="grid h-40 place-items-center text-muted">{receipt.file ? <FileText className="h-10 w-10 text-moss" /> : <ImageOff className="h-8 w-8" />}</span>
        )}
      </a>
      <DefinitionList className="flex-1 sm:grid-cols-1" items={[
        { label: ctx.t("receipts.merchant"), value: receipt.merchant },
        { label: ctx.t("common.date"), value: fmtDate(receipt.receipt_date) },
        { label: ctx.t("receipts.total"), value: receipt.amount != null && receipt.currency ? fmtMoney(receipt.amount, receipt.currency) : null },
      ]} />
    </div>
  );
}
