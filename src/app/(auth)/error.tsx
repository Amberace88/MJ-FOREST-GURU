"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { lv } from "@/i18n/lv";
import { isStaleDeployError, reloadOnceForNewDeploy } from "@/lib/stale-deploy";

export default function AuthError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (isStaleDeployError(error) && reloadOnceForNewDeploy()) return;
    console.error(error);
  }, [error]);
  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-crit">{lv.errors.generic}</p>
      <button type="button" onClick={() => { reset(); window.location.reload(); }}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-forest-600 px-4 text-sm text-on-accent hover:bg-forest-500">
        <RotateCcw className="h-4 w-4" /> {lv.errors.tryAgain}
      </button>
    </div>
  );
}
