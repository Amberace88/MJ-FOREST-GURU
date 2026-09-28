"use client";

import { KeyRound, Loader2, PlugZap, RefreshCw, Trash2 } from "lucide-react";
import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { ActionButton, ActionForm, Input, SubmitButton, type FormAction, type Option } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { linkMaponDevice, removeMaponKey, saveMaponKey, syncMapon, testMapon } from "./actions";

export function MaponKeyForm({ hasStoredKey }: { hasStoredKey: boolean }) {
  const { t } = useT();
  return (
    <div className="space-y-3">
      <ActionForm action={saveMaponKey as FormAction} resetOnSuccess className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input name="api_key" type="password" label={hasStoredKey ? t("integrations.mapon.newKey") : t("integrations.mapon.apiKey")}
          hint={t("integrations.mapon.apiKeyHint")} autoComplete="off" spellCheck={false} required minLength={8} maxLength={200}
          className="flex-1" data-1p-ignore data-lpignore="true" />
        <SubmitButton className="sm:mb-5"><KeyRound className="h-4 w-4" /> {t("integrations.mapon.saveKey")}</SubmitButton>
      </ActionForm>
      {hasStoredKey && (
        <ActionButton action={removeMaponKey as FormAction} variant="ghost" size="sm" confirm={t("integrations.mapon.confirmRemoveKey")} className="text-crit hover:text-crit">
          <Trash2 className="h-4 w-4" /> {t("integrations.mapon.removeKey")}
        </ActionButton>
      )}
    </div>
  );
}

export function MaponActions({ disabled }: { disabled: boolean }) {
  const { t } = useT();
  if (disabled) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton action={testMapon as FormAction} variant="secondary" size="md"><PlugZap className="h-4 w-4" /> {t("integrations.mapon.test")}</ActionButton>
      <ActionButton action={syncMapon as FormAction} variant="amber" size="md"><RefreshCw className="h-4 w-4" /> {t("integrations.mapon.sync")}</ActionButton>
    </div>
  );
}

function AutoSubmitSelect({ name, defaultValue, options, ariaLabel, placeholder }: {
  name: string; defaultValue: string; options: Option[]; ariaLabel: string; placeholder: string;
}) {
  const { pending } = useFormStatus();
  const ref = useRef<HTMLSelectElement>(null);
  return (
    <span className="relative flex items-center">
      <select ref={ref} name={name} defaultValue={defaultValue} aria-label={ariaLabel} disabled={pending}
        onChange={() => ref.current?.form?.requestSubmit()} className="field h-9 min-w-[12rem] py-1 pr-8 text-sm">
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {pending && <Loader2 className="pointer-events-none absolute right-8 h-4 w-4 animate-spin text-muted" />}
    </span>
  );
}

export function LinkMachineSelect({ deviceId, machineId, machines }: { deviceId: string; machineId: string | null; machines: Option[] }) {
  const { t } = useT();
  return (
    <ActionForm action={linkMaponDevice.bind(null, deviceId) as FormAction} className="inline-flex">
      <AutoSubmitSelect name="machine_id" defaultValue={machineId ?? ""} options={machines}
        ariaLabel={t("integrations.mapon.linkMachine")} placeholder={t("integrations.mapon.notLinked")} />
    </ActionForm>
  );
}
