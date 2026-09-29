import "server-only";
import { serverEnv } from "@/lib/env.server";
import { logServerError } from "@/lib/errors";

export const canSendEmail = () => Boolean(serverEnv.resendApiKey);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Invitation e-mail via Resend (only when RESEND_API_KEY is configured). Never throws. */
export async function sendInviteEmail(opts: { to: string; name: string; link: string; orgName: string; invitedBy?: string | null; expires?: string | null }): Promise<boolean> {
  if (!canSendEmail()) return false;
  const html = `<!doctype html><html><body style="margin:0;background:#0d1310;font-family:Inter,Segoe UI,Arial,sans-serif;color:#e9e4d6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
  <table role="presentation" width="100%" style="max-width:520px;background:#151d18;border:1px solid #2a352e;border-radius:16px;overflow:hidden">
    <tr><td style="padding:28px 28px 8px"><div style="font-weight:800;letter-spacing:.06em;font-size:18px">MJ FOREST <span style="color:#8fbf6a">GURU</span></div>
      <div style="font-size:10px;letter-spacing:.2em;color:#8b948d;margin-top:4px">MANAGEMENT PLATFORM</div></td></tr>
    <tr><td style="padding:16px 28px 8px;font-size:15px;line-height:1.6">
      Sveiki, ${esc(opts.name)}!<br><br>
      ${opts.invitedBy ? `${esc(opts.invitedBy)} jūs uzaicināja` : "Jūs esat uzaicināts"} pievienoties <b>${esc(opts.orgName)}</b> platformā MJ Forest Guru.
      Nospiediet pogu, iestatiet savu paroli un sāciet darbu.</td></tr>
    <tr><td style="padding:16px 28px"><a href="${esc(opts.link)}" style="display:inline-block;background:#3a7a48;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">Pieņemt ielūgumu</a></td></tr>
    <tr><td style="padding:4px 28px 24px;font-size:12px;color:#8b948d;line-height:1.6">
      Saite ir vienreizēja${opts.expires ? ` un derīga līdz ${esc(opts.expires)}` : ""}. Ja poga nestrādā, atveriet šo adresi:<br>
      <span style="word-break:break-all;color:#c9b27c">${esc(opts.link)}</span></td></tr>
  </table></td></tr></table></body></html>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${serverEnv.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: serverEnv.emailFrom, to: [opts.to], subject: `Ielūgums — ${opts.orgName} · MJ Forest Guru`, html,
        text: `Sveiki, ${opts.name}! Jūs esat uzaicināts pievienoties ${opts.orgName} platformā MJ Forest Guru. Atveriet saiti un iestatiet paroli: ${opts.link}`,
      }),
    });
    if (!res.ok) { logServerError("mail.invite", { status: res.status, body: (await res.text()).slice(0, 300) }); return false; }
    return true;
  } catch (e) {
    logServerError("mail.invite", e);
    return false;
  }
}
