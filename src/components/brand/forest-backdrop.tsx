/**
 * Generated (not stock) backdrop: satellite-dark gradient, topographic contour
 * texture, layered spruce ridge lines and a faint forest-road curve.
 */
function ridge(seed: number, baseY: number, height: number, count: number, width = 1600) {
  let d = `M0 ${baseY}`;
  let x = 0;
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const step = width / count;
  while (x < width + step) {
    const h = height * (0.55 + rnd() * 0.6);
    const w = step * (0.7 + rnd() * 0.5);
    d += ` L${x.toFixed(1)} ${baseY} L${(x + w / 2).toFixed(1)} ${(baseY - h).toFixed(1)} L${(x + w).toFixed(1)} ${baseY}`;
    x += w * (0.55 + rnd() * 0.3);
  }
  d += ` L${width} 900 L0 900 Z`;
  return d;
}

export function ForestBackdrop({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_10%,#1c3a26_0%,#0f1d15_38%,#0a0e0c_75%)]" />
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "url(/brand/topo.svg)", backgroundSize: "900px" }} />
      <svg className="absolute inset-x-0 bottom-0 h-[62%] w-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="fog" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0b0f0d" stopOpacity="0" />
            <stop offset="1" stopColor="#0b0f0d" stopOpacity="1" />
          </linearGradient>
        </defs>
        <path d={ridge(7, 520, 170, 38)} fill="#16301f" opacity="0.55" />
        <path d={ridge(19, 620, 210, 30)} fill="#11261a" opacity="0.8" />
        <path d="M-40 900 C 380 760, 620 820, 860 700 S 1320 560, 1680 600" stroke="#8b6440" strokeOpacity="0.28" strokeWidth="26" fill="none" />
        <path d="M-40 900 C 380 760, 620 820, 860 700 S 1320 560, 1680 600" stroke="#e2a23b" strokeOpacity="0.12" strokeWidth="2" strokeDasharray="18 22" fill="none" />
        <path d={ridge(31, 760, 260, 24)} fill="#0c1a12" />
        <rect x="0" y="480" width="1600" height="420" fill="url(#fog)" />
      </svg>
      <div className="grain absolute inset-0" />
    </div>
  );
}
