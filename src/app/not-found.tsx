import Link from "next/link";
import { ForestBackdrop } from "@/components/brand/forest-backdrop";
import { lv } from "@/i18n/lv";

export default function NotFound() {
  return (
    <main data-theme="dark" className="relative grid min-h-dvh place-items-center overflow-hidden bg-bg px-6">
      <ForestBackdrop className="pointer-events-none absolute inset-0" />
      <div className="relative z-10 text-center animate-fade-up">
        <p className="font-display text-[120px] font-bold leading-none tracking-wider text-amber/90">404</p>
        <h1 className="mt-2 font-display text-2xl font-semibold uppercase tracking-[0.14em]">{lv.errors.pageNotFound}</h1>
        <p className="mt-2 text-sm text-muted">{lv.errors.notFound}</p>
        <Link href="/dashboard" className="mt-8 inline-flex h-11 items-center rounded-xl bg-forest-600 px-6 text-sm font-medium text-on-accent hover:bg-forest-500">{lv.errors.backHome}</Link>
      </div>
    </main>
  );
}
