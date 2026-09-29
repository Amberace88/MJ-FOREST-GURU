"use client";

import { Check, Copy, Link2, Loader2, Mail, MessageCircle, Smartphone, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ActionState, FormAction } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { useT } from "@/i18n/client";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Recipient = { email?: string | null; phone?: string | null; whatsapp?: string | null };
type LinkData = { link: string | null; expiresAt: string | null; existing: boolean; to?: Recipient };

/**
 * Dialog that runs an invite action and then shows the one-time invitation link
 * with copy / WhatsApp / SMS / e-mail sharing (no e-mail server needed).
 */
export function InviteLinkDialog({ trigger, title, description, action, children, submitLabel, defaultOpen }: {
  trigger: ReactNode; title: ReactNode; description?: ReactNode; action: FormAction; children?: ReactNode; submitLabel?: ReactNode; defaultOpen?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [key, setKey] = useState(0);
  const { t } = useT();
  const open = () => { setKey((k) => k + 1); requestAnimationFrame(() => ref.current?.showModal()); };
  const close = () => ref.current?.close();
  useEffect(() => {
    if (defaultOpen) open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <span className="contents" onClick={open}>{trigger}</span>
      <dialog ref={ref} className="m-auto w-[calc(100%-1.5rem)] max-w-xl rounded-2xl border border-line-strong bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/60"
        onClick={(e) => { if (e.target === ref.current) close(); }}>
        {key > 0 && (
          <Body key={key} action={action} close={close} title={title} description={description} submitLabel={submitLabel ?? t("users.createAccount")}>
            {children}
          </Body>
        )}
      </dialog>
    </>
  );
}

function Body({ action, close, title, description, submitLabel, children }: {
  action: FormAction; close: () => void; title: ReactNode; description?: ReactNode; submitLabel: ReactNode; children?: ReactNode;
}) {
  const { t } = useT();
  const router = useRouter();
  const [state, formAction] = useActionState(action, { ok: true } as ActionState);
  const [submitted, setSubmitted] = useState(false);
  const data = submitted && state.ok ? (state.data as LinkData | undefined) : undefined;

  useEffect(() => {
    if (!submitted) return;
    if (state.ok) {
      router.refresh();
      if (!(state.data as LinkData | undefined)?.link) { toast(state.message ?? t("common.success")); close(); }
    } else toast(state.error, "error");
  }, [state, submitted, router, close, t]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-display text-xl font-semibold uppercase tracking-wide">{data?.link ? t("users.linkTitle") : title}</h2>
          {!data?.link && description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        <button type="button" onClick={close} className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-ink" aria-label={t("common.close")}>
          <X className="h-5 w-5" />
        </button>
      </div>
      {data?.link ? (
        <LinkPanel link={data.link} expiresAt={data.expiresAt} message={state.ok ? state.message : undefined} onDone={close} to={data.to} />
      ) : (
        <form action={formAction} onSubmit={() => setSubmitted(true)}>
          {!state.ok && submitted && (
            <div role="alert" className="mx-5 mt-4 rounded-lg border border-crit/30 bg-crit/10 px-3 py-2 text-sm text-crit">{state.error}</div>
          )}
          {children && <div className="max-h-[65vh] overflow-y-auto px-5 py-5">{children}</div>}
          <div className="flex items-center justify-end gap-2 border-t border-line bg-bg-2/50 px-5 py-3">
            <Button variant="ghost" type="button" onClick={close}>{t("common.cancel")}</Button>
            <Submit>{submitLabel}</Submit>
          </div>
        </form>
      )}
    </div>
  );
}

function Submit({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} {children}
    </Button>
  );
}

export function LinkPanel({ link, expiresAt, message, onDone, to }: { link: string; expiresAt: string | null; message?: string; onDone?: () => void; to?: Recipient }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const text = `${t("users.inviteMessage")} ${link}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); } catch {
      const ta = document.createElement("textarea"); ta.value = link; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    setCopied(true); toast(t("users.copied")); setTimeout(() => setCopied(false), 2500);
  };
  const share = [
    // straight to the person when their contacts are known
    { label: t("users.shareWhatsApp"), href: `https://wa.me/${(to?.whatsapp ?? "").replace(/[^\d]/g, "")}?text=${encodeURIComponent(text)}`, Icon: MessageCircle },
    { label: t("users.shareSms"), href: `sms:${to?.phone ?? ""}?&body=${encodeURIComponent(text)}`, Icon: Smartphone },
    { label: t("users.shareEmail"), href: `mailto:${to?.email ?? ""}?subject=${encodeURIComponent("Ielūgums — MJ Forest Guru")}&body=${encodeURIComponent(text)}`, Icon: Mail },
  ];
  return (
    <div className="space-y-4 px-5 py-5 animate-fade-up">
      {message && <p className="flex items-center gap-2 text-sm text-ok"><Check className="h-4 w-4" /> {message}</p>}
      {(to?.email || to?.whatsapp) && (
        <p className="text-xs text-muted">Nosūtīt: {[to.email, to.whatsapp && `WhatsApp ${to.whatsapp}`].filter(Boolean).join(" · ")}</p>
      )}
      <div className="rounded-xl border border-amber/30 bg-amber/5 p-3">
        <div className="break-all font-mono text-[13px] leading-relaxed text-ink" data-testid="invite-link">{link}</div>
      </div>
      <Button onClick={copy} size="lg" className={cn("w-full", copied && "bg-ok/80 hover:bg-ok/80")}>
        {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />} {copied ? t("users.copied") : t("users.copyLink")}
      </Button>
      <div className="grid grid-cols-3 gap-2">
        {share.map(({ label, href, Icon }) => (
          <a key={label} href={href} target="_blank" rel="noreferrer"
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line text-sm text-ink-2 hover:border-line-strong hover:bg-surface-2 hover:text-ink">
            <Icon className="h-4 w-4" /> {label}
          </a>
        ))}
      </div>
      <p className="text-xs text-muted">{t("users.linkHint")}{expiresAt ? ` (${t("users.expires")}: ${fmtDate(expiresAt)})` : ""}</p>
      {onDone && <div className="flex justify-end"><Button variant="ghost" onClick={onDone}>{t("common.close")}</Button></div>}
    </div>
  );
}
