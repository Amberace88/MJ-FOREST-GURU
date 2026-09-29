import { ShieldCheck } from "lucide-react";
import Image from "next/image";
import { ForestBackdrop } from "@/components/brand/forest-backdrop";
import { Toaster } from "@/components/ui/toast";
import { lv } from "@/i18n/lv";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="dark" className="relative min-h-dvh overflow-hidden bg-bg">
      <ForestBackdrop className="pointer-events-none absolute inset-0" />
      <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.1fr_440px] lg:px-10">
        <section className="hidden lg:block animate-fade-up">
          <Image src="/brand/logo-dark-bg.png" alt="MJ Forest Guru" width={1400} height={476} priority className="h-auto w-[520px] drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]" />
          <p className="mt-6 whitespace-nowrap font-display text-lg font-semibold uppercase tracking-[0.1em] text-ink-2 xl:text-xl">{lv.brand.subtitle}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.3em] text-muted">{lv.brand.footer}</p>
        </section>
        <section className="mx-auto w-full max-w-[440px] animate-fade-up" style={{ animationDelay: "80ms" }}>
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <Image src="/brand/logo-dark-bg.png" alt="MJ Forest Guru" width={1400} height={476} priority className="h-auto w-[300px]" />
            <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted">{lv.brand.subtitle}</p>
          </div>
          <div className="rounded-3xl border border-line-strong/70 bg-surface/80 p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:p-8">
            {children}
          </div>
          <p className="mt-5 flex items-center justify-center gap-2 text-center text-[11px] text-faint">
            <ShieldCheck className="h-3.5 w-3.5 text-moss" /> {lv.auth.privateNotice}
          </p>
        </section>
      </div>
      <Toaster />
    </div>
  );
}
