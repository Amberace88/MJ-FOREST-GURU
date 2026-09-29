"use client";

import { useSyncExternalStore } from "react";

export type Recipient = { email?: string | null; phone?: string | null; whatsapp?: string | null };
export type LinkResult = { link: string; expiresAt: string | null; message?: string; to?: Recipient; emailed?: boolean };

/**
 * App-wide holder for the last generated invitation link.
 * Lives outside the page tree, so the link stays visible even when the page
 * (and the dialog that requested it) is re-rendered by a server refresh.
 */
let current: LinkResult | null = null;
const listeners = new Set<() => void>();

export function showInviteLink(r: LinkResult) {
  current = r;
  try { sessionStorage.setItem("mjfg:last-invite-link", JSON.stringify(r)); } catch { /* storage unavailable */ }
  listeners.forEach((l) => l());
}

export function clearInviteLink() {
  current = null;
  listeners.forEach((l) => l());
}

export function useInviteLink() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => current,
    () => null,
  );
}
