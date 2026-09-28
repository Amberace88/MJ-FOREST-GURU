import { SearchX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/misc";
import { lv } from "@/i18n/lv";

export default function AppNotFound() {
  return (
    <div className="py-10">
      <EmptyState icon={<SearchX className="h-6 w-6" />} title={lv.errors.pageNotFound} text={lv.errors.notFound}
        action={<Link href="/dashboard" className="inline-flex h-10 items-center rounded-xl bg-forest-600 px-4 text-sm text-on-accent hover:bg-forest-500">{lv.errors.backHome}</Link>} />
    </div>
  );
}
