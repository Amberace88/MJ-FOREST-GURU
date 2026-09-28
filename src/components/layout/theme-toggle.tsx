"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";

type Theme = "dark" | "light";

/** Day / night switch: sliding knob, sun ↔ moon morph, stars at night, soft sky by day. */
export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useT();
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    root.classList.add("theme-anim");
    root.dataset.theme = next;
    document.cookie = `mjfg_theme=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
    window.setTimeout(() => root.classList.remove("theme-anim"), 450);
    window.dispatchEvent(new CustomEvent("mjfg:theme", { detail: next }));
  };

  const light = theme === "light";
  return (
    <button type="button" role="switch" aria-checked={light} onClick={toggle}
      aria-label={light ? t("theme.toDark") : t("theme.toLight")} title={light ? t("theme.toDark") : t("theme.toLight")}
      className={cn(
        "group relative h-8 w-[60px] shrink-0 overflow-hidden rounded-full border transition-colors duration-500",
        light ? "border-[#e6d3a3] bg-gradient-to-r from-[#bfe0f5] via-[#e3f0f6] to-[#fbe7b8]" : "border-line-strong bg-gradient-to-r from-[#0b1a24] via-[#10202a] to-[#16301f]",
        className,
      )}>
      {/* stars */}
      <span aria-hidden className={cn("absolute inset-0 transition-opacity duration-500", light ? "opacity-0" : "opacity-100")}>
        <span className="absolute left-[34px] top-[7px] h-[2px] w-[2px] rounded-full bg-white/80" />
        <span className="absolute left-[44px] top-[15px] h-[1.5px] w-[1.5px] rounded-full bg-white/60" />
        <span className="absolute left-[39px] top-[21px] h-[2px] w-[2px] rounded-full bg-white/70 animate-pulse" />
        <span className="absolute left-[50px] top-[9px] h-[1px] w-[1px] rounded-full bg-white/70" />
      </span>
      {/* clouds */}
      <span aria-hidden className={cn("absolute left-[8px] top-[15px] h-[7px] w-[16px] rounded-full bg-white/90 shadow-[6px_-3px_0_-1px_rgba(255,255,255,0.9)] transition-all duration-500",
        light ? "translate-x-0 opacity-100" : "-translate-x-6 opacity-0")} />
      {/* knob */}
      <span aria-hidden className={cn(
        "absolute top-[3px] grid h-6 w-6 place-items-center rounded-full shadow-md transition-all duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]",
        light ? "left-[31px] bg-[#ffd36b] shadow-[0_0_12px_rgba(255,190,70,0.7)]" : "left-[3px] bg-[#e9e4d6] shadow-[0_0_10px_rgba(233,228,214,0.35)]",
      )}>
        <Sun className={cn("absolute h-4 w-4 text-[#b86e00] transition-all duration-500", light ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0")} />
        <Moon className={cn("absolute h-3.5 w-3.5 text-[#3b4a41] transition-all duration-500", light ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100")} />
      </span>
    </button>
  );
}
