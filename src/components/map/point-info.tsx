"use client";

import { fmtDMS, fmtLatLng, localGrid, type LngLat } from "@/lib/geo/coords";
import { cn } from "@/lib/utils";

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/** Live cursor coordinates (WGS 84 + national grid). */
export function PointInfo({ point, className }: { point: LngLat; className?: string }) {
  const grid = localGrid(point);
  return (
    <div className={cn("items-center gap-3 rounded-lg border border-line-strong bg-bg/85 px-3 py-1 font-mono text-[11px] text-ink-2 backdrop-blur", className)}>
      <span>{fmtLatLng(point)}</span>
      {grid && <span className="text-muted">{grid.label} {grid.text}</span>}
    </div>
  );
}

/**
 * Popup body for a point on the map: WGS 84 decimal + DMS, LKS-92 / SWEREF 99 TM,
 * copy button and navigation links. Plain HTML (MapLibre popups live outside React).
 */
export function pointPopupHtml(p: LngLat, title?: string, extraHtml = "") {
  const grid = localGrid(p);
  const dec = fmtLatLng(p, 6);
  const row = (k: string, v: string) =>
    `<div style="display:flex;justify-content:space-between;gap:14px;font-size:12px;padding:2px 0"><span style="color:var(--muted)">${esc(k)}</span><span style="color:var(--text);font-family:ui-monospace,monospace;text-align:right">${esc(v)}</span></div>`;
  const btn = "display:inline-flex;align-items:center;gap:4px;margin-top:10px;margin-right:6px;padding:5px 9px;border-radius:8px;font-size:12px;text-decoration:none;border:1px solid var(--line-strong);color:var(--text);background:var(--surface-2);cursor:pointer";
  return `<div style="min-width:240px;font-family:inherit">
    <strong style="display:block;font-size:14px;color:var(--text);margin-bottom:6px">${esc(title ?? "Punkts kartē")}</strong>
    ${row("WGS 84", dec)}
    ${row("DMS", fmtDMS(p))}
    ${grid ? row(grid.label, grid.text) : ""}
    <div>
      <button type="button" style="${btn}" onclick="navigator.clipboard&&navigator.clipboard.writeText('${dec}');this.textContent='✓ Nokopēts'">Kopēt</button>
      <a style="${btn}" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat.toFixed(6)},${p.lng.toFixed(6)}">Navigācija →</a>
    </div>
    ${extraHtml}
  </div>`;
}
