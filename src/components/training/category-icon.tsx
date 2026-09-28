import { BookOpen, ClipboardList, Leaf, ShieldCheck, Siren, Smartphone, Tractor, type LucideIcon } from "lucide-react";
import type { MaterialCategory } from "@/lib/training/types";

export const CATEGORY_ICONS: Record<MaterialCategory, LucideIcon> = {
  platform: Smartphone,
  reporting: ClipboardList,
  safety: ShieldCheck,
  machinery: Tractor,
  emergency: Siren,
  environment: Leaf,
  other: BookOpen,
};

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const Icon = CATEGORY_ICONS[category as MaterialCategory] ?? BookOpen;
  return <Icon className={className} aria-hidden />;
}
