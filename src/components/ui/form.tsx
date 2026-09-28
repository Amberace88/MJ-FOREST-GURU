"use client";

import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createContext, useActionState, useContext, useEffect, useId, useRef, useState,
  type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Button, type ButtonSize, type ButtonVariant } from "./button";
import { toast } from "./toast";

export type ActionState = { ok: true; message?: string; data?: unknown } | { ok: false; error: string; fieldErrors?: Record<string, string> };
export type FormAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

const FormErrors = createContext<Record<string, string> | undefined>(undefined);

/* ------------------------------------------------------------------ fields */
export function Label({ htmlFor, children, optional }: { htmlFor?: string; children: ReactNode; optional?: boolean }) {
  const { t } = useT();
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted">
      {children}
      {optional && <span className="normal-case tracking-normal text-faint">({t("common.optional")})</span>}
    </label>
  );
}

function useFieldError(name?: string) {
  const errors = useContext(FormErrors);
  return name ? errors?.[name] : undefined;
}

type FieldBase = { label?: ReactNode; hint?: ReactNode; optional?: boolean; className?: string };

export function Input({ label, hint, optional, className, id, name, ...props }: FieldBase & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? auto;
  const err = useFieldError(name);
  return (
    <div className={className}>
      {label && <Label htmlFor={fid} optional={optional}>{label}</Label>}
      <input id={fid} name={name} aria-invalid={!!err} aria-describedby={err ? `${fid}-err` : undefined}
        className={cn("field", err && "border-crit/60")} {...props} />
      {err ? <p id={`${fid}-err`} className="mt-1 text-xs text-crit">{err}</p> : hint ? <p className="mt-1 text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

export function Textarea({ label, hint, optional, className, id, name, rows = 3, ...props }: FieldBase & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id ?? auto;
  const err = useFieldError(name);
  return (
    <div className={className}>
      {label && <Label htmlFor={fid} optional={optional}>{label}</Label>}
      <textarea id={fid} name={name} rows={rows} aria-invalid={!!err} className={cn("field resize-y", err && "border-crit/60")} {...props} />
      {err ? <p className="mt-1 text-xs text-crit">{err}</p> : hint ? <p className="mt-1 text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

export type Option = { value: string; label: string; group?: string };

export function Select({ label, hint, optional, className, id, name, options, placeholder, ...props }: FieldBase & SelectHTMLAttributes<HTMLSelectElement> & { options: Option[]; placeholder?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  const err = useFieldError(name);
  const { t } = useT();
  const groups = Array.from(new Set(options.map((o) => o.group).filter(Boolean))) as string[];
  return (
    <div className={className}>
      {label && <Label htmlFor={fid} optional={optional}>{label}</Label>}
      <select id={fid} name={name} aria-invalid={!!err} className={cn("field", err && "border-crit/60")} {...props}>
        {placeholder !== undefined && <option value="">{placeholder || t("common.select")}</option>}
        {groups.length > 0
          ? groups.map((g) => (
              <optgroup key={g} label={g}>
                {options.filter((o) => o.group === g).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </optgroup>
            ))
          : options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {err ? <p className="mt-1 text-xs text-crit">{err}</p> : hint ? <p className="mt-1 text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ label, name, defaultChecked, className }: { label: ReactNode; name: string; defaultChecked?: boolean; className?: string }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2.5 text-sm text-ink-2", className)}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-line-strong bg-bg-2 accent-[var(--forest-500)]" />
      {label}
    </label>
  );
}

export function SubmitButton({ children, variant = "primary", size = "md", className, name, value }: {
  children: ReactNode; variant?: ButtonVariant; size?: ButtonSize; className?: string; name?: string; value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} className={className} name={name} value={value}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}

/* ------------------------------------------------------------------ forms */
function useActionFeedback(state: ActionState, submitted: boolean, onSuccess?: (s: ActionState) => void, successMessage?: string) {
  const router = useRouter();
  const { t } = useT();
  const last = useRef<ActionState | null>(null);
  useEffect(() => {
    if (!submitted || state === last.current) return;
    last.current = state;
    if (state.ok) {
      toast(state.message ?? successMessage ?? t("common.success"), "ok");
      onSuccess?.(state);
      router.refresh();
    } else {
      toast(state.error, "error");
    }
  }, [state, submitted, onSuccess, router, successMessage, t]);
}

/** Inline form bound to a server action with toast feedback and field errors. */
export function ActionForm({ action, children, className, onSuccess, successMessage, resetOnSuccess }: {
  action: FormAction; children: ReactNode; className?: string; onSuccess?: (s: ActionState) => void; successMessage?: string; resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, { ok: true } as ActionState);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useActionFeedback(state, submitted, (s) => { if (resetOnSuccess) formRef.current?.reset(); onSuccess?.(s); }, successMessage);
  return (
    <FormErrors.Provider value={state.ok ? undefined : state.fieldErrors}>
      <form ref={formRef} action={formAction} onSubmit={() => setSubmitted(true)} className={className} noValidate={false}>
        {children}
      </form>
    </FormErrors.Provider>
  );
}

/** Modal dialog (native <dialog>) wrapping a server-action form. */
export function FormDialog({ trigger, title, description, action, children, submitLabel, size = "md", successMessage, footer, defaultOpen }: {
  /** A ReactNode (e.g. <Button>) — clicks inside it open the dialog — or a render function. */
  trigger: ReactNode | ((open: () => void) => ReactNode);
  title: ReactNode;
  description?: ReactNode;
  action: FormAction;
  children: ReactNode | ((close: () => void) => ReactNode);
  submitLabel?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  successMessage?: string;
  footer?: ReactNode;
  /** open immediately on mount (e.g. quick actions linking with ?new=1) */
  defaultOpen?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(0);
  const { t } = useT();
  const open = () => { setMounted((k) => k + 1); requestAnimationFrame(() => ref.current?.showModal()); };
  const close = () => ref.current?.close();
  useEffect(() => {
    if (defaultOpen) open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const width = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return (
    <>
      {typeof trigger === "function" ? trigger(open) : <span className="contents" onClick={open}>{trigger}</span>}
      <dialog ref={ref} className={cn("m-auto w-[calc(100%-1.5rem)] rounded-2xl border border-line-strong bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/60", width)}
        onClick={(e) => { if (e.target === ref.current) close(); }}>
        {mounted > 0 && (
          <DialogForm key={mounted} action={action} onDone={close} successMessage={successMessage}>
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <h2 className="font-display text-xl font-semibold uppercase tracking-wide">{title}</h2>
                {description && <p className="mt-1 text-sm text-muted">{description}</p>}
              </div>
              <button type="button" onClick={close} className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-ink" aria-label={t("common.close")}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{typeof children === "function" ? children(close) : children}</div>
            <div className="flex items-center justify-end gap-2 border-t border-line bg-bg-2/50 px-5 py-3">
              {footer}
              <Button variant="ghost" onClick={close}>{t("common.cancel")}</Button>
              <SubmitButton>{submitLabel ?? t("common.save")}</SubmitButton>
            </div>
          </DialogForm>
        )}
      </dialog>
    </>
  );
}

function DialogForm({ action, onDone, children, successMessage }: { action: FormAction; onDone: () => void; children: ReactNode; successMessage?: string }) {
  const [state, formAction] = useActionState(action, { ok: true } as ActionState);
  const [submitted, setSubmitted] = useState(false);
  useActionFeedback(state, submitted, () => onDone(), successMessage);
  return (
    <FormErrors.Provider value={state.ok ? undefined : state.fieldErrors}>
      <form action={formAction} onSubmit={() => setSubmitted(true)}>
        {!state.ok && submitted && (
          <div role="alert" className="mx-5 mt-4 rounded-lg border border-crit/30 bg-crit/10 px-3 py-2 text-sm text-crit">{state.error}</div>
        )}
        {children}
      </form>
    </FormErrors.Provider>
  );
}

/** One-click action button (approve, change status...) posting to a server action. */
export function ActionButton({ action, fields, children, variant = "secondary", size = "sm", confirm, className }: {
  action: FormAction; fields?: Record<string, string>; children: ReactNode; variant?: ButtonVariant; size?: ButtonSize; confirm?: string; className?: string;
}) {
  return (
    <ActionForm action={action} className="inline">
      {fields && Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <ConfirmSubmit variant={variant} size={size} confirm={confirm} className={className}>{children}</ConfirmSubmit>
    </ActionForm>
  );
}

function ConfirmSubmit({ children, confirm, ...rest }: { children: ReactNode; confirm?: string; variant: ButtonVariant; size: ButtonSize; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...rest}
      onClick={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </Button>
  );
}

export function FormGrid({ children, cols = 2, className }: { children: ReactNode; cols?: 1 | 2 | 3; className?: string }) {
  return <div className={cn("grid gap-4", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-3", className)}>{children}</div>;
}
