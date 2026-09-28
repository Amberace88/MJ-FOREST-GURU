"use client";

import { Printer } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/client";

export function PrintButton() {
  const { t } = useT();
  return (
    <Button variant="amber" onClick={() => window.print()}>
      <Printer className="h-4 w-4" /> {t("common.print")}
    </Button>
  );
}

export function MonthPicker({ value, max }: { value: string; max: string }) {
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <label className={`flex items-center gap-2 text-xs uppercase tracking-wider text-muted ${pending ? "opacity-70" : ""}`}>
      {t("reports.month")}
      <input type="month" value={value} max={max} className="field h-10 w-auto normal-case tracking-normal"
        onChange={(e) => {
          if (!/^\d{4}-\d{2}$/.test(e.target.value)) return;
          const u = new URLSearchParams(params.toString());
          u.set("month", e.target.value);
          start(() => router.replace(`${pathname}?${u}`, { scroll: false }));
        }} />
    </label>
  );
}
