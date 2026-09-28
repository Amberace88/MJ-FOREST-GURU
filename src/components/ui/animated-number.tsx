"use client";

import { useEffect, useRef, useState } from "react";

/**
 * KPI counter that animates from 0 on mount and then tweens smoothly from the
 * previously shown value whenever `value` changes (respects prefers-reduced-motion).
 */
export function AnimatedNumber({ value, decimals = 0, duration = 900, format }: {
  value: number; decimals?: number; duration?: number; format?: "number" | "hours";
}) {
  const [shown, setShown] = useState(0);
  const raf = useRef<number | null>(null);
  const current = useRef(0);
  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { current.current = target; setShown(target); return; }
    const from = current.current;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (target - from) * eased;
      current.current = v;
      setShown(v);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value, duration]);
  const text = new Intl.NumberFormat("lv-LV", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(shown);
  return <span className="tabular">{format === "hours" ? `${text} h` : text}</span>;
}
