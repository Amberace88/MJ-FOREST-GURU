"use client";

import { AlertOctagon, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { lv } from "@/i18n/lv";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <div className="mx-auto max-w-lg py-12 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-crit/15 text-crit"><AlertOctagon className="h-7 w-7" /></div>
      <h1 className="mt-5 font-display text-2xl font-bold uppercase tracking-wide">{offline ? lv.errors.offline : lv.errors.generic}</h1>
      {error.digest && <p className="mt-2 text-xs text-faint">ID: {error.digest}</p>}
      <div className="mt-6 flex justify-center gap-2">
        <button type="button" onClick={reset} className="inline-flex h-10 items-center gap-2 rounded-xl bg-forest-600 px-4 text-sm hover:bg-forest-500"><RotateCcw className="h-4 w-4" /> {lv.errors.tryAgain}</button>
        <Link href="/dashboard" className="inline-flex h-10 items-center rounded-xl border border-line px-4 text-sm hover:bg-surface-2">{lv.errors.backHome}</Link>
      </div>
    </div>
  );
}
