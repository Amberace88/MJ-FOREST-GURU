"use client";

/**
 * After a new deployment, a page loaded from the previous build can call a server
 * action that no longer exists ("Failed to find Server Action"). Reloading once
 * fetches the new build; a sessionStorage guard prevents reload loops.
 */
export function isStaleDeployError(err: unknown) {
  const msg = err instanceof Error ? `${err.message} ${err.name}` : String(err ?? "");
  return /Server Action|failed-to-find-server-action|ChunkLoadError|Loading chunk .* failed|dynamically imported module/i.test(msg);
}

export function reloadOnceForNewDeploy(): boolean {
  try {
    const key = "mjfg:stale-reload";
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(key, String(Date.now()));
  } catch { /* storage blocked: still reload once */ }
  window.location.reload();
  return true;
}
