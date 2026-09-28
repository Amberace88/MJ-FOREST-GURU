"use client";

import { useEffect, useRef, useState } from "react";

/** KPI counter that animates from 0 on mount (respects prefers-reduced-motion). */
export function AnimatedNumber({ value, decimals = 0, duration = 900, format }: {
  value: number; decimals?: number; duration?: number; format?: "number" | "hours";
}) {
  const [shown, setShown] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setShown(value); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(value * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value, duration]);
  const text = new Intl.NumberFormat("lv-LV", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(shown);
  return <span className="tabular">{format === "hours" ? `${text} h` : text}</span>;
}
