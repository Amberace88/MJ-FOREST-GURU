"use client";

/**
 * Offline-first event queue (IndexedDB).
 *
 * Every field action (check-in/out, breaks, fuel, expense, repair, incident,
 * task completion, production, photos) is written here FIRST with a
 * client-generated idempotency key, then flushed to /api/sync. The server
 * treats a repeated key as success, so retries never create duplicates.
 *
 * Events are scoped to the signed-in user id; another user on the same
 * device never flushes or sees them in the UI.
 */
export type QueueEventType =
  | "check_in" | "check_out" | "break_start" | "break_end"
  | "fuel" | "expense" | "repair" | "incident" | "task_status" | "production" | "photo";

export type QueuedFile = { field: string; name: string; type: string; blob: Blob };

export type QueueEvent = {
  id: string;                 // idempotency key (uuid)
  type: QueueEventType;
  userId: string;
  orgId: string;
  payload: Record<string, unknown>;
  files?: QueuedFile[];
  createdAt: string;          // client time (ISO, UTC)
  attempts: number;
  status: "pending" | "failed";
  lastError?: string;
};

const DB_NAME = "mjfg-offline";
const STORE = "events";
const CHANGE = "mjfg:queue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "id" });
        s.createIndex("user", "userId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function newId(): string {
  return crypto.randomUUID();
}

export async function enqueue(ev: Omit<QueueEvent, "attempts" | "status" | "createdAt"> & { createdAt?: string }) {
  const full: QueueEvent = { ...ev, createdAt: ev.createdAt ?? new Date().toISOString(), attempts: 0, status: "pending" };
  await tx("readwrite", (s) => s.put(full));
  notify();
  return full;
}

export async function listEvents(userId: string): Promise<QueueEvent[]> {
  const all = await tx<QueueEvent[]>("readonly", (s) => s.index("user").getAll(userId));
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function remove(id: string) {
  await tx("readwrite", (s) => s.delete(id));
}

async function update(ev: QueueEvent) {
  await tx("readwrite", (s) => s.put(ev));
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE));
}

export function onQueueChange(cb: () => void) {
  window.addEventListener(CHANGE, cb);
  return () => window.removeEventListener(CHANGE, cb);
}

let flushing: Promise<FlushResult> | null = null;
export type FlushResult = { synced: number; failed: number; authError: boolean };

/** Sends pending events in order. Stops on network/auth errors (kept for later). */
export function flush(userId: string): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = (async () => {
    const result: FlushResult = { synced: 0, failed: 0, authError: false };
    if (typeof navigator !== "undefined" && !navigator.onLine) return result;
    const events = await listEvents(userId);
    for (const ev of events) {
      const fd = new FormData();
      fd.set("event", JSON.stringify({ id: ev.id, type: ev.type, orgId: ev.orgId, payload: ev.payload, createdAt: ev.createdAt }));
      for (const f of ev.files ?? []) fd.append(`file:${f.field}`, new File([f.blob], f.name, { type: f.type }));
      try {
        const res = await fetch("/api/sync", { method: "POST", body: fd, credentials: "same-origin" });
        if (res.status === 401) { result.authError = true; break; }
        const body = (await res.json().catch(() => ({ retry: true }))) as { ok?: boolean; error?: string; retry?: boolean };
        if (res.redirected) { result.authError = true; break; } // session lost → login redirect
        if (res.ok && body.ok) {
          await remove(ev.id);
          result.synced++;
        } else if (body.retry || res.status >= 500) {
          await update({ ...ev, attempts: ev.attempts + 1, lastError: body.error });
          break; // transient: keep order, try later
        } else {
          // permanent validation/permission failure: keep visible to user, don't block the queue
          await update({ ...ev, attempts: ev.attempts + 1, status: "failed", lastError: body.error ?? `HTTP ${res.status}` });
          result.failed++;
        }
      } catch {
        break; // offline / network error
      }
    }
    notify();
    return result;
  })().finally(() => { flushing = null; });
  return flushing;
}

export async function discard(id: string) {
  await remove(id);
  notify();
}

/** Downscale photos before upload (keeps originals when small). */
export async function compressImage(file: File, maxSide = 2000, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/heic" || file.size < 600_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export function getPosition(timeoutMs = 8000): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    const timer = setTimeout(() => resolve(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(timer); resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); },
      () => { clearTimeout(timer); resolve(null); },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}
