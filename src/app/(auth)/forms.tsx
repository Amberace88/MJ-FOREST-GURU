"use client";

import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { forgotPasswordAction, loginAction, setPasswordAction } from "./actions";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="group mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-forest-600 font-display text-lg font-semibold uppercase tracking-[0.14em] text-ink shadow-[inset_0_1px_0_#ffffff22,0_12px_30px_-10px_#2b6139] transition hover:bg-forest-500 disabled:opacity-60">
      {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
      {children}
      {!pending && <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />}
    </button>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
      <span className="relative flex items-center">
        <span className="pointer-events-none absolute left-3.5 text-faint">{icon}</span>
        {children}
      </span>
    </label>
  );
}

const inputCls = "h-12 w-full rounded-xl border border-line bg-bg-2/80 pl-11 pr-4 text-[15px] text-ink placeholder:text-faint transition focus:border-forest-400 focus:outline-none focus:ring-4 focus:ring-forest-500/20";

function Alert({ state }: { state: ActionResult }) {
  if (state.ok && !state.message) return null;
  return (
    <div role={state.ok ? "status" : "alert"} className={cn("rounded-xl border px-3.5 py-2.5 text-sm", state.ok ? "border-ok/30 bg-ok/10 text-ok" : "border-crit/30 bg-crit/10 text-crit")}>
      {state.ok ? state.message : state.error}
    </div>
  );
}

export function LoginForm({ next, expired, notConfigured }: { next?: string; expired?: boolean; notConfigured?: boolean }) {
  const { t } = useT();
  const [state, action] = useActionState(loginAction, { ok: true } as ActionResult);
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="space-y-4">
      <div className="mb-2">
        <h1 className="font-display text-[28px] font-bold uppercase leading-none tracking-wide">MJ Forest Guru</h1>
        <p className="mt-1.5 text-sm text-muted">{t("brand.private")}</p>
      </div>
      {expired && <div role="status" className="rounded-xl border border-warn/30 bg-warn/10 px-3.5 py-2.5 text-sm text-warn">{t("auth.sessionExpired")}</div>}
      {notConfigured && <div role="alert" className="rounded-xl border border-crit/30 bg-crit/10 px-3.5 py-2.5 text-sm text-crit">{t("errors.notConfigured")}</div>}
      <Alert state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field icon={<Mail className="h-4 w-4" />} label={t("auth.email")}>
        <input name="email" type="email" autoComplete="username" required inputMode="email" className={inputCls} placeholder="vards@uznemums.lv" />
      </Field>
      <Field icon={<Lock className="h-4 w-4" />} label={t("auth.password")}>
        <input name="password" type={show ? "text" : "password"} autoComplete="current-password" required className={cn(inputCls, "pr-12")} />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 text-muted hover:text-ink" aria-label={show ? "Slēpt paroli" : "Rādīt paroli"}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </Field>
      <Submit>{t("auth.login")}</Submit>
      <div className="pt-1 text-center">
        <Link href="/forgot-password" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">{t("auth.forgot")}</Link>
      </div>
    </form>
  );
}

export function ForgotForm() {
  const { t } = useT();
  const [state, action] = useActionState(forgotPasswordAction, { ok: true } as ActionResult);
  return (
    <form action={action} className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">{t("auth.forgotTitle")}</h1>
        <p className="mt-1.5 text-sm text-muted">{t("auth.forgotText")}</p>
      </div>
      <Alert state={state} />
      <Field icon={<Mail className="h-4 w-4" />} label={t("auth.email")}>
        <input name="email" type="email" autoComplete="username" required className={inputCls} />
      </Field>
      <Submit>{t("auth.sendLink")}</Submit>
      <div className="text-center"><Link href="/login" className="text-sm text-muted hover:text-ink">{t("auth.backToLogin")}</Link></div>
    </form>
  );
}

export function SetPasswordForm({ welcome }: { welcome?: boolean }) {
  const { t } = useT();
  const [state, action] = useActionState(setPasswordAction, { ok: true } as ActionResult);
  const err = !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">{welcome ? t("auth.welcomeTitle") : t("auth.resetTitle")}</h1>
        <p className="mt-1.5 text-sm text-muted">{welcome ? t("auth.welcomeText") : t("auth.passwordRules")}</p>
      </div>
      <Alert state={state} />
      <Field icon={<Lock className="h-4 w-4" />} label={t("auth.newPassword")}>
        <input name="password" type="password" autoComplete="new-password" minLength={10} required className={cn(inputCls, err?.password && "border-crit/60")} />
      </Field>
      <Field icon={<Lock className="h-4 w-4" />} label={t("auth.confirmPassword")}>
        <input name="confirm" type="password" autoComplete="new-password" minLength={10} required className={cn(inputCls, err?.confirm && "border-crit/60")} />
      </Field>
      <Submit>{t("auth.setPassword")}</Submit>
    </form>
  );
}
