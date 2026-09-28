"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { flush, listEvents, onQueueChange, type QueueEvent } from "./queue";

/** Queue status + automatic flushing when the connection returns. */
export function useSyncQueue(userId: string | null) {
  const router = useRouter();
  const [events, setEvents] = useState<QueueEvent[]>([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [authError, setAuthError] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId || typeof indexedDB === "undefined") return;
    try { setEvents(await listEvents(userId)); } catch { /* private mode */ }
  }, [userId]);

  const sync = useCallback(async () => {
    if (!userId) return;
    setSyncing(true);
    try {
      const r = await flush(userId);
      setAuthError(r.authError);
      if (r.synced > 0) { setLastSyncedAt(Date.now()); router.refresh(); }
    } finally {
      setSyncing(false);
      refresh();
    }
  }, [userId, refresh, router]);

  useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    refresh();
    const off = onQueueChange(refresh);
    const goOnline = () => { setOnline(true); sync(); };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const iv = setInterval(() => { if (navigator.onLine) sync(); }, 45_000);
    sync();
    return () => { off(); window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); clearInterval(iv); };
  }, [refresh, sync]);

  const pending = events.filter((e) => e.status === "pending");
  const failed = events.filter((e) => e.status === "failed");
  return { events, pending, failed, online, syncing, sync, lastSyncedAt, authError };
}
