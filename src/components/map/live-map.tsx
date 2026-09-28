"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { Layers, Maximize2, Satellite, Map as MapIcon, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/i18n/client";
import { publicEnv } from "@/lib/env";
import type { MapMarker } from "@/lib/map-data";
import { cn } from "@/lib/utils";

type MLMap = import("maplibre-gl").Map;
type MLMarker = import("maplibre-gl").Marker;

/** Operating regions (country code → [west, south, east, north]). */
export const REGION_BOUNDS: Record<string, [number, number, number, number]> = {
  LV: [20.9, 55.6, 28.3, 58.1],
  SE: [10.9, 55.2, 24.2, 69.1],
  IS: [-24.6, 63.2, -13.4, 66.6],
  EE: [21.7, 57.5, 28.2, 59.7],
  LT: [20.9, 53.9, 26.9, 56.5],
  FI: [20.5, 59.7, 31.6, 70.1],
  NO: [4.6, 57.9, 31.1, 71.2],
};

function regionBounds(codes: string[]): [[number, number], [number, number]] | null {
  const boxes = codes.map((c) => REGION_BOUNDS[c.toUpperCase()]).filter(Boolean);
  if (!boxes.length) return null;
  return [
    [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1]))],
    [Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))],
  ];
}

const COLORS: Record<MapMarker["status"], string> = { active: "#5fae6e", attention: "#e3b448", critical: "#e0584f", offline: "#737c75" };

function styleFor(kind: "satellite" | "dark") {
  const token = publicEnv.mapboxToken;
  const sat = token
    ? `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=${token}`
    : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const satAttr = token ? "© Mapbox © OpenStreetMap" : "Tiles © Esri — Esri, Maxar, Earthstar Geographics";
  const base = typeof document !== "undefined" && document.documentElement.dataset.theme === "light" ? "light_all" : "dark_all";
  return {
    version: 8 as const,
    sources: {
      sat: { type: "raster" as const, tiles: [sat], tileSize: 256, attribution: satAttr, maxzoom: 19 },
      dark: { type: "raster" as const, tiles: [`https://a.basemaps.cartocdn.com/${base}/{z}/{x}/{y}@2x.png`, `https://b.basemaps.cartocdn.com/${base}/{z}/{x}/{y}@2x.png`], tileSize: 256, attribution: "© OpenStreetMap © CARTO", maxzoom: 19 },
      labels: { type: "raster" as const, tiles: ["https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png"], tileSize: 256, maxzoom: 19 },
    },
    layers: kind === "satellite"
      ? [
          { id: "sat", type: "raster" as const, source: "sat", paint: { "raster-saturation": -0.35, "raster-brightness-max": 0.72, "raster-contrast": 0.1 } },
          { id: "labels", type: "raster" as const, source: "labels", paint: { "raster-opacity": 0.85 } },
        ]
      : [{ id: "dark", type: "raster" as const, source: "dark", paint: { "raster-saturation": -0.2, "raster-hue-rotate": 90, "raster-brightness-max": 0.9 } }],
  };
}

function markerEl(m: MapMarker) {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", m.title);
  el.className = "mjfg-marker";
  const c = COLORS[m.status];
  if (m.kind === "project") {
    el.innerHTML = `<span style="display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#0f1411e6;border:1.5px solid ${c};box-shadow:0 6px 16px #000a"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2"><path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z"/><path d="M12 22v-3"/></svg></span>`;
  } else if (m.kind === "employee") {
    el.innerHTML = `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${c};border:2px solid #0b0f0d;box-shadow:0 0 0 2px ${c}66"></span>`;
  } else {
    const pulse = m.status === "active" || m.status === "critical";
    el.innerHTML = `<span style="position:relative;display:grid;place-items:center;width:34px;height:34px">
      ${pulse ? `<span class="mjfg-pulse" style="position:absolute;inset:4px;border-radius:50%;background:${c}"></span>` : ""}
      <span style="position:relative;display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#0f1411;border:2.5px solid ${c};box-shadow:0 6px 16px #000b">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2"><path d="M3 4h9l1 7"/><path d="M4 11V4"/><path d="M8 10V4"/><path d="M18 5c-.6 0-1 .4-1 1v5.6"/><path d="m10 11 11 .9c.6 0 .9.5.8 1.1l-.8 5h-1"/><circle cx="7" cy="15" r=".5"/><circle cx="7" cy="15" r="5"/><path d="M16 18h-5"/><circle cx="18" cy="18" r="2"/></svg>
      </span></span>`;
  }
  return el;
}

function popupHtml(m: MapMarker, labels: { stale: string; open: string; lastUpdate: string }) {
  const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
  const rows = m.lines.map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;padding:2px 0"><span style="color:var(--muted)">${esc(k)}</span><span style="color:var(--text);text-align:right">${esc(v)}</span></div>`).join("");
  return `<div style="min-width:220px;font-family:inherit">
    <div style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:${COLORS[m.status]}"></span>
      <strong style="font-size:14px;color:var(--text)">${esc(m.title)}</strong></div>
    ${m.subtitle ? `<div style="font-size:11px;color:var(--muted);margin:2px 0 8px 16px">${esc(m.subtitle)}</div>` : '<div style="height:6px"></div>'}
    ${rows}
    ${m.lastUpdate ? `<div style="font-size:11px;color:${m.stale ? "var(--warn)" : "var(--faint)"};margin-top:6px">${esc(labels.lastUpdate)}: ${esc(m.lastUpdate)}${m.stale ? " · " + esc(labels.stale) : ""}</div>` : ""}
    <a href="${esc(m.href)}" style="display:inline-block;margin-top:10px;font-size:12px;color:var(--amber);text-decoration:none">${esc(labels.open)} →</a>
  </div>`;
}

export function LiveMap({ markers, height = 420, className, controls = true, maponState, maponLastSuccess, regions = ["LV", "SE", "IS"] }: {
  markers: MapMarker[]; height?: number | string; className?: string; controls?: boolean; maponState?: string; maponLastSuccess?: string | null;
  /** country codes to frame when there are no markers (e.g. the selected country tab) */
  regions?: string[];
}) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerRefs = useRef<MLMarker[]>([]);
  const [style, setStyle] = useState<"satellite" | "dark">("satellite");
  const [layers, setLayers] = useState({ machine: true, project: true, employee: true });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const visible = useMemo(() => markers.filter((m) => layers[m.kind]), [markers, layers]);
  const regionsRef = useRef(regions);
  regionsRef.current = regions;
  const regionKey = regions.join(",");

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (disposed || !ref.current) return;
        const initial = regionBounds(regionsRef.current) ?? [[10.9, 55.2], [28.3, 66.6]];
        const map = new maplibre.Map({
          container: ref.current, style: styleFor("satellite"), bounds: initial, fitBoundsOptions: { padding: 30 },
          attributionControl: { compact: true }, cooperativeGestures: false, dragRotate: false,
        });
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "bottom-right");
        map.addControl(new maplibre.FullscreenControl(), "bottom-right");
        mapRef.current = map;
        const markReady = () => { if (!disposed) setReady(true); };
        map.on("load", markReady);
        map.once("idle", markReady);
        // never leave the loading veil up (slow tile servers, blocked networks)
        window.setTimeout(markReady, 4500);
        map.on("error", (e) => console.warn("[map]", e?.error?.message ?? e));
      } catch {
        setFailed(true);
      }
    })();
    return () => { disposed = true; mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (ready && mapRef.current) mapRef.current.setStyle(styleFor(style));
  }, [style, ready]);

  // day/night switch → matching basemap
  useEffect(() => {
    const onTheme = () => { if (mapRef.current) mapRef.current.setStyle(styleFor(style)); };
    window.addEventListener("mjfg:theme", onTheme);
    return () => window.removeEventListener("mjfg:theme", onTheme);
  }, [style]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let cancelled = false;
    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled) return;
      markerRefs.current.forEach((m) => m.remove());
      markerRefs.current = [];
      const bounds = new maplibre.LngLatBounds();
      for (const m of visible) {
        const popup = new maplibre.Popup({ offset: 18, closeButton: true, maxWidth: "300px" })
          .setHTML(popupHtml(m, { stale: t("map.stale"), open: t("common.open"), lastUpdate: t("map.lastUpdate") }));
        const mk = new maplibre.Marker({ element: markerEl(m) }).setLngLat([m.lng, m.lat]).setPopup(popup).addTo(map);
        markerRefs.current.push(mk);
        bounds.extend([m.lng, m.lat]);
      }
      const inRegion = regionsRef.current.length === 1
        ? visible.filter((m) => { const b = REGION_BOUNDS[regionsRef.current[0].toUpperCase()]; return !b || (m.lng >= b[0] && m.lng <= b[2] && m.lat >= b[1] && m.lat <= b[3]); })
        : visible;
      if (inRegion.length === 1) map.flyTo({ center: [inRegion[0].lng, inRegion[0].lat], zoom: 11, duration: 900 });
      else if (inRegion.length > 1) {
        const rb = new maplibre.LngLatBounds();
        inRegion.forEach((m) => rb.extend([m.lng, m.lat]));
        map.fitBounds(rb, { padding: 60, maxZoom: 12, duration: 900 });
      } else {
        const rb = regionBounds(regionsRef.current);
        if (rb) map.fitBounds(rb, { padding: 30, duration: 900 });
      }
      void bounds;
    })();
    return () => { cancelled = true; };
  }, [visible, ready, t, regionKey]);

  return (
    <div className={cn("relative overflow-hidden rounded-[14px] border border-line bg-bg-2", className)} style={{ height }}>
      {/* inline position: maplibre's unlayered CSS (.maplibregl-map { position: relative }) beats Tailwind's layered utilities */}
      <div ref={ref} style={{ position: "absolute", inset: 0 }} role="region" aria-label={t("map.title")} />
      <div className={cn("skeleton pointer-events-none absolute inset-0 rounded-none transition-opacity duration-700", ready || failed ? "opacity-0" : "opacity-100")} aria-hidden />
      {failed && <div className="absolute inset-0 grid place-items-center text-sm text-muted">{t("errors.generic")}</div>}
      {maponState === "error" && (
        <div className="absolute left-3 top-3 z-10 flex max-w-[80%] items-center gap-2 rounded-lg border border-warn/40 bg-bg/90 px-3 py-2 text-xs text-warn backdrop-blur">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          <span>{t("map.maponUnavailable")}{maponLastSuccess ? ` ${t("common.lastUpdated")}: ${maponLastSuccess}` : ""}</span>
        </div>
      )}
      {controls && (
        <>
          <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
            <div className="flex overflow-hidden rounded-lg border border-line-strong bg-bg/90 backdrop-blur">
              <button onClick={() => setStyle("satellite")} aria-pressed={style === "satellite"} title={t("map.satellite")}
                className={cn("grid h-8 w-8 place-items-center", style === "satellite" ? "bg-forest-700 text-ink" : "text-muted hover:text-ink")}><Satellite className="h-4 w-4" /></button>
              <button onClick={() => setStyle("dark")} aria-pressed={style === "dark"} title={t("map.terrain")}
                className={cn("grid h-8 w-8 place-items-center", style === "dark" ? "bg-forest-700 text-ink" : "text-muted hover:text-ink")}><MapIcon className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 rounded-lg border border-line-strong bg-bg/90 px-2 py-1 text-[11px] text-muted backdrop-blur"><Layers className="h-3.5 w-3.5" /></span>
            {(["machine", "project", "employee"] as const).map((k) => (
              <button key={k} onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))} aria-pressed={layers[k]}
                className={cn("rounded-lg border px-2 py-1 text-[11px] font-medium backdrop-blur transition",
                  layers[k] ? "border-forest-500/50 bg-forest-800/80 text-ink" : "border-line-strong bg-bg/80 text-faint")}>
                {k === "machine" ? t("map.machines") : k === "project" ? t("map.projects") : t("map.employees")}
              </button>
            ))}
          </div>
          <div className="absolute bottom-3 right-12 z-10 hidden items-center gap-3 rounded-lg border border-line-strong bg-bg/90 px-3 py-1.5 text-[11px] text-muted backdrop-blur sm:flex">
            {(["active", "attention", "critical", "offline"] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[s] }} />{t(`map.legend.${s}`)}</span>
            ))}
          </div>
        </>
      )}
      {!controls && (
        <a href="/map" className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-lg border border-line-strong bg-bg/90 text-muted backdrop-blur hover:text-ink" aria-label={t("map.title")}>
          <Maximize2 className="h-4 w-4" />
        </a>
      )}
      <style>{`.mjfg-marker{background:none;border:0;padding:0;cursor:pointer}.mjfg-pulse{animation:pulse-ring 2s cubic-bezier(.2,.7,.2,1) infinite;opacity:.6}@media (prefers-reduced-motion: reduce){.mjfg-pulse{animation:none}}`}</style>
    </div>
  );
}
