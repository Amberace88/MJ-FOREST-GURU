"use client";

import { AlertCircle, CheckCircle2, Eye, FileText, Loader2, Send, Sparkles, SquarePen } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { CategoryIcon } from "@/components/training/category-icon";
import { MaterialBlocks } from "@/components/training/material-blocks";
import { Button } from "@/components/ui/button";
import { ActionForm, Checkbox, FormGrid, Input, Label, Select, SubmitButton, Textarea, type Option } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { AUDIENCE_KEYS, CATEGORY_META, isCategory } from "@/lib/training/categories";
import { lintBody, parseBody, sectionCount } from "@/lib/training/format";
import { MATERIAL_CATEGORIES } from "@/lib/training/types";
import { cn } from "@/lib/utils";
import { generateMaterial, saveMaterial } from "./actions";

/* ------------------------------------------------------------------ shared fields */
function useCategoryOptions(): Option[] {
  const { label } = useT();
  return MATERIAL_CATEGORIES.map((c) => ({ value: c, label: label("materials.categories", c) }));
}

function AudiencePicker({ defaultValue = [] }: { defaultValue?: string[] }) {
  const { t, label } = useT();
  const [sel, setSel] = useState<string[]>(defaultValue);
  const toggle = (k: string) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">{t("materials.audience")}</legend>
      <div className="flex flex-wrap gap-2">
        {AUDIENCE_KEYS.map((k) => {
          const on = sel.includes(k);
          return (
            <label key={k} className={cn("cursor-pointer select-none rounded-full border px-3 py-1.5 text-sm transition-colors",
              on ? "border-forest-500 bg-forest-700/50 text-ink" : "border-line bg-surface-2 text-ink-2 hover:border-line-strong")}>
              <input type="checkbox" name="audience[]" value={k} checked={on} onChange={() => toggle(k)} className="sr-only" />
              {on && <CheckCircle2 className="-ml-0.5 mr-1 inline h-3.5 w-3.5 text-moss" aria-hidden />}
              {label("materials.audiences", k)}
            </label>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-faint">{t("materials.generator.audienceHint")}</p>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ generator */
function GenerateSubmit() {
  const { pending } = useFormStatus();
  const { t } = useT();
  return (
    <Button type="submit" size="lg" variant="amber" disabled={pending} className="w-full sm:w-auto">
      {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
      {pending ? t("materials.generator.working") : t("materials.generator.submit")}
    </Button>
  );
}

export function GeneratorForm({ countries }: { countries: Option[] }) {
  const { t } = useT();
  const categories = useCategoryOptions();
  return (
    <ActionForm action={generateMaterial} className="space-y-5">
      <FormGrid cols={3}>
        <Input name="title" label={t("materials.generator.name")} placeholder={t("materials.generator.namePlaceholder")} required maxLength={200} className="sm:col-span-3" />
        <Select name="category" label={t("materials.category")} options={categories} defaultValue="safety" />
        <Select name="country_id" label={t("materials.country")} options={countries} placeholder={t("materials.allCountries")} />
        <Input name="responsible" label={t("materials.generator.responsible")} placeholder={t("materials.generator.responsiblePlaceholder")} optional maxLength={200} />
      </FormGrid>
      <AudiencePicker defaultValue={["employee"]} />
      <Textarea name="purpose" label={t("materials.generator.purpose")} placeholder={t("materials.generator.purposePlaceholder")} rows={3} required maxLength={3000} />
      <Textarea name="events" label={t("materials.generator.events")} placeholder={t("materials.generator.eventsPlaceholder")} rows={5} optional maxLength={8000} />
      <FormGrid>
        <Textarea name="requirements" label={t("materials.generator.requirements")} hint={t("materials.generator.requirementsHint")} rows={6} optional maxLength={6000} />
        <Textarea name="forbidden" label={t("materials.generator.forbidden")} hint={t("materials.generator.forbiddenHint")} rows={6} optional maxLength={4000} />
      </FormGrid>
      <div className="flex flex-col-reverse items-start gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-xs text-muted">{t("materials.generator.aiNote")}</p>
        <GenerateSubmit />
      </div>
    </ActionForm>
  );
}

/* ------------------------------------------------------------------ editor */
export type EditorMaterial = {
  id: string; title: string; subtitle: string | null; summary: string | null; category: string; country_id: string | null;
  audience: string[]; reading_minutes: number | null; requires_acknowledgement: boolean; body: string; status: "draft" | "published";
  builtin_key: string | null; is_customized: boolean;
};

const CHEAT: { code: string; key: "heading" | "paragraph" | "bullet" | "step" | "do" | "dont" | "crit" | "warn" | "tip" | "table" }[] = [
  { code: "## ", key: "heading" }, { code: "", key: "paragraph" }, { code: "- ", key: "bullet" }, { code: "1. ", key: "step" },
  { code: "+ ", key: "do" }, { code: "x ", key: "dont" }, { code: "!! ", key: "crit" }, { code: "! ", key: "warn" }, { code: "? ", key: "tip" },
  { code: "| a | b |", key: "table" },
];

export function MaterialEditor({ material, countries }: { material: EditorMaterial; countries: Option[] }) {
  const { t, label } = useT();
  const categories = useCategoryOptions();
  const [body, setBody] = useState(material.body);
  const [category, setCategory] = useState(material.category);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const deferred = useDeferredValue(body);
  const blocks = useMemo(() => parseBody(deferred), [deferred]);
  const issues = useMemo(() => lintBody(deferred), [deferred]);
  const sections = sectionCount(blocks);
  const accent = isCategory(category) ? CATEGORY_META[category].color : CATEGORY_META.other.color;
  const labels = { do: t("materials.blocks.do"), dont: t("materials.blocks.dont"), crit: t("materials.blocks.crit"), warn: t("materials.blocks.warn"), tip: t("materials.blocks.tip") };

  return (
    <ActionForm action={saveMaterial.bind(null, material.id)} className="space-y-6">
      {material.builtin_key && !material.is_customized && (
        <p className="rounded-xl border border-info/30 bg-info/10 px-4 py-3 text-sm text-info">{t("materials.editor.builtinNotice")}</p>
      )}

      <section className="card space-y-5 p-5 sm:p-6">
        <FormGrid cols={3}>
          <Input name="title" label={t("materials.generator.name")} defaultValue={material.title} required maxLength={200} className="sm:col-span-3" />
          <Input name="subtitle" label={t("materials.editor.subtitle")} defaultValue={material.subtitle ?? ""} optional maxLength={400} className="sm:col-span-3" />
          <Select name="category" label={t("materials.category")} options={categories} value={category} onChange={(e) => setCategory(e.target.value)} />
          <Select name="country_id" label={t("materials.country")} options={countries} placeholder={t("materials.allCountries")} defaultValue={material.country_id ?? ""} />
          <Input name="reading_minutes" type="number" min={1} max={600} label={t("materials.editor.readingMinutes")} hint={t("materials.editor.readingAuto")} defaultValue={material.reading_minutes ?? ""} optional />
        </FormGrid>
        <Textarea name="summary" label={t("materials.editor.summary")} hint={t("materials.editor.summaryHint")} defaultValue={material.summary ?? ""} rows={2} optional maxLength={2000} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <AudiencePicker defaultValue={material.audience} />
          <Checkbox name="requires_acknowledgement" label={t("materials.editor.requiresAck")} defaultChecked={material.requires_acknowledgement} className="shrink-0" />
        </div>
      </section>

      {/* mobile: edit / preview switch */}
      <div className="flex rounded-xl border border-line bg-surface-2 p-1 lg:hidden" role="tablist">
        {(["edit", "preview"] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
            className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm transition-colors", view === v ? "bg-surface text-ink shadow" : "text-muted")}>
            {v === "edit" ? <SquarePen className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {v === "edit" ? t("materials.editor.body") : t("materials.editor.preview")}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={cn("min-w-0 space-y-3", view !== "edit" && "hidden lg:block")}>
          <Label htmlFor="material-body">{t("materials.editor.body")}</Label>
          <textarea id="material-body" name="body" value={body} onChange={(e) => setBody(e.target.value)} spellCheck lang="lv"
            className="field h-[62vh] min-h-[420px] resize-y font-mono text-[13px] leading-6" required maxLength={200000} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="text-muted">{t("materials.editor.sections", { n: sections })}</span>
            {issues.length === 0 && sections >= 3 ? (
              <span className="inline-flex items-center gap-1 text-ok"><CheckCircle2 className="h-3.5 w-3.5" />{t("materials.editor.noIssues")}</span>
            ) : null}
          </div>
          {(issues.length > 0 || sections < 3) && (
            <ul className="space-y-1 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn" aria-label={t("materials.editor.issues")}>
              {sections < 3 && <li className="flex gap-2"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t("materials.editor.tooFewSections")}</li>}
              {issues.slice(0, 8).map((i) => <li key={`${i.line}-${i.message}`} className="flex gap-2"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{i.line}: {i.message}</li>)}
            </ul>
          )}
          <details className="rounded-xl border border-line bg-surface-2/50">
            <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-ink-2">{t("materials.editor.cheatsheet")}</summary>
            <dl className="grid gap-x-4 gap-y-1.5 border-t border-line px-4 py-3 text-xs sm:grid-cols-[auto_1fr]">
              {CHEAT.map((c) => (
                <div key={c.key} className="contents">
                  <dt><code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-ink">{c.code || "Aa"}</code></dt>
                  <dd className="text-muted">{t(`materials.cheat.${c.key}`)}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>

        <div className={cn("min-w-0", view !== "preview" && "hidden lg:block")}>
          <div className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted">
            <FileText className="h-3.5 w-3.5" />{t("materials.editor.preview")}
            <span className="ml-auto inline-flex items-center gap-1.5 normal-case tracking-normal" style={{ color: accent }}>
              <CategoryIcon category={category} className="h-3.5 w-3.5" />{label("materials.categories", category)}
            </span>
          </div>
          <div className="card h-[62vh] min-h-[420px] overflow-y-auto px-5 py-6 sm:px-7">
            {blocks.length ? <MaterialBlocks blocks={blocks} labels={labels} accent={accent} /> : <p className="text-sm text-muted">{t("materials.editor.empty")}</p>}
          </div>
        </div>
      </div>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex flex-col gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-[var(--shadow)] backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:bottom-4">
        <div className="hidden space-y-0.5 text-xs text-muted sm:block">
          {material.status === "published"
            ? <><p>{t("materials.editor.publishWarning")}</p><p className="text-warn">{t("materials.editor.draftWarning")}</p></>
            : <p>{t("materials.draftNotice")}</p>}
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
          <SubmitButton variant="secondary" name="intent" value="draft">{t("materials.editor.saveDraft")}</SubmitButton>
          <SubmitButton name="intent" value="publish"><Send className="h-4 w-4" />{t("materials.editor.publish")}</SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}
