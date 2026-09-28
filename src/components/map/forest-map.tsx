"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { ChevronDown, Copy, ExternalLink, Info, Layers, Map as MapIcon, MapPinPlus, Mountain, Navigation, Satellite, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtDMS, fmtLatLng, localGrid } from "@/lib/geo/coords";
import { FOREST_LAYERS, type ForestLayer } from "@/lib/forest/layers";
import { LEAD_STATUS_COLOR, LEAD_STATUS_LABEL, type LeadStatus } from "@/lib/forest/leads";
import { cn } from "@/lib/utils";
import { addBoundaries, loadMaplibre, baseStyle, REGION_BOUNDS, regionBounds, trackRegionHover, type BaseKind } from "./map-kit";
import { MapSearch, type SearchPick } from "./map-search";
import { PointInfo } from "./point-info";

type MLMap = import("maplibre-gl").Map;
type MLMarker = import("maplibre-gl").Marker;

export type ForestLead = { id: string; title: string; status: LeadStatus; lat: number; lng: number; value: string | null; sub: string | null };
export type ForestProject = { id: string; code: string; name: string; lat: number; lng: number; status: string };
export type PickedPoint = { lat: number; lng: number; country: string | null; region: string | null; municipality: string | null };

/** Servers that do not send CORS headers → MapLibre cannot load their tiles (checked in the browser). */
const NO_CORS = new Set(["lv-ozols-iadt", "lv-ozols-mikroliegumi", "se-sks-skogliga-grunddata-volym"]);
const GROUPS: { key: ForestLayer["group"]; label: string }[] = [
  { key: "felling", label: "Cirtes un paziņojumi" },
  { key: "forest", label: "Mežs" },
  { key: "cadastre", label: "Kadastrs un robežas" },
  { key: "protected", label: "Aizsargājamās teritorijas" },
  { key: "change", label: "Izmaiņas (satelīts)" },
  { key: "base", label: "Pamatkartes" },
];
const COUNTRY_NAME: Record<string, string> = { LV: "Latvija", SE: "Zviedrija", IS: "Islande", GLOBAL: "Visām valstīm" };
const FLAG: Record<string, string> = { LV: "🇱🇻", SE: "🇸🇪", IS: "🇮🇸", GLOBAL: "🌍" };

const layerId = (id: string) => `fl-${id}`;

export function ForestMap({ countries, leads, projects, height = "calc(100dvh - 250px)", onAddLead, focusLead }: {
  countries: string[]; leads: ForestLead[]; projects: ForestProject[]; height?: string;
  onAddLead?: (p: PickedPoint) => void; focusLead?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<MLMarker[]>([]);
  const [ready, setReady] = useState(false);
  const [base, setBase] = useState<BaseKind>("satellite");
  const [panel, setPanel] = useState(true);
  const [country, setCountry] = useState<string>(countries.includes("LV") ? "LV" : (countries[0] ?? "LV"));
  const [active, setActive] = useState<Record<string, number>>({}); // layer id → opacity
  const activeRef = useRef(active);
  activeRef.current = active;
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const [showLeads, setShowLeads] = useState(true);
  const [showProjects, setShowProjects] = useState(true);
  const [hoverRegion, setHoverRegion] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ lng: number; lat: number } | null>(null);
  const [picked, setPicked] = useState<PickedPoint | null>(null);
  const pickRef = useRef<MLMarker | null>(null);

  const catalog = useMemo(() => FOREST_LAYERS.filter((l) => !NO_CORS.has(l.id) && (l.country === country || l.country === "GLOBAL")), [country]);

  /* ------------------------------------------------------------ init */
  useEffect(() => {
    let disposed = false;
    (async () => {
      const maplibre = await loadMaplibre();
      if (disposed || !ref.current) return;
      const map = new maplibre.Map({
        container: ref.current, style: baseStyle("satellite"),
        bounds: regionBounds(countries.length ? countries : ["LV", "SE", "IS"]) ?? [[10.9, 55.2], [28.3, 66.6]], fitBoundsOptions: { padding: 30 },
        attributionControl: { compact: true }, dragRotate: false, maxZoom: 19,
      });
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "bottom-right");
      map.addControl(new maplibre.FullscreenControl(), "bottom-right");
      map.addControl(new maplibre.ScaleControl({ unit: "metric" }), "bottom-left");
      mapRef.current = map;
      map.on("style.load", () => {
        addBoundaries(map);
        for (const [id, op] of Object.entries(activeRef.current)) addForestLayer(map, id, op);
      });
      map.on("load", () => !disposed && setReady(true));
      window.setTimeout(() => !disposed && setReady(true), 4500);
      trackRegionHover(map, (n) => !disposed && setHoverRegion(n));
      map.on("mousemove", (e) => !disposed && setCursor({ lng: e.lngLat.lng, lat: e.lngLat.lat }));
      map.on("mouseout", () => !disposed && setCursor(null));
      map.on("click", async (e) => {
        if ((e.originalEvent.target as HTMLElement | null)?.closest?.(".mjfg-marker")) return;
        const at = (id: string) => (map.getLayer(id) ? map.queryRenderedFeatures(e.point, { layers: [id] })[0]?.properties as { name?: string; country?: string } | undefined : undefined);
        const r = at("adm1-fill");
        const muni = map.getSource("adm2") ? (await muniAt(map, e.lngLat.lng, e.lngLat.lat)) : null;
        const p: PickedPoint = { lat: e.lngLat.lat, lng: e.lngLat.lng, country: r?.country ?? guessCountry(e.lngLat.lng, e.lngLat.lat), region: r?.name ?? null, municipality: muni };
        setPicked(p);
        pickRef.current?.remove();
        const el = document.createElement("div");
        el.className = "mjfg-pin";
        el.innerHTML = "<span></span>";
        pickRef.current = new maplibre.Marker({ element: el, anchor: "bottom" }).setLngLat(e.lngLat).addTo(map);
      });
    })();
    return () => { disposed = true; mapRef.current?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (ready && mapRef.current) mapRef.current.setStyle(baseStyle(base)); }, [base, ready]);
  useEffect(() => {
    const onTheme = () => mapRef.current?.setStyle(baseStyle(base));
    window.addEventListener("mjfg:theme", onTheme);
    return () => window.removeEventListener("mjfg:theme", onTheme);
  }, [base]);

  /* ------------------------------------------------------------ layers */
  const toggle = (l: ForestLayer) => {
    const map = mapRef.current;
    setActive((a) => {
      const next = { ...a };
      if (l.id in next) { delete next[l.id]; if (map?.getLayer(layerId(l.id))) { map.removeLayer(layerId(l.id)); map.removeSource(layerId(l.id)); } }
      else { next[l.id] = l.defaultOpacity; if (map) addForestLayer(map, l.id, l.defaultOpacity); }
      return next;
    });
  };
  const setOpacity = (id: string, v: number) => {
    setActive((a) => ({ ...a, [id]: v }));
    const map = mapRef.current;
    if (map?.getLayer(layerId(id))) map.setPaintProperty(layerId(id), "raster-opacity", v);
  };

  const flyToCountry = (c: string) => {
    setCountry(c);
    const b = REGION_BOUNDS[c];
    if (b && mapRef.current) mapRef.current.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 30, duration: 900 });
  };

  /* ------------------------------------------------------------ markers */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let cancelled = false;
    (async () => {
      const maplibre = await loadMaplibre();
      if (cancelled) return;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
      if (showLeads) for (const l of leads) {
        const c = LEAD_STATUS_COLOR[l.status];
        const el = document.createElement("button");
        el.type = "button"; el.className = "mjfg-marker"; el.setAttribute("aria-label", l.title);
        el.innerHTML = `<span style="display:block;width:18px;height:18px;transform:rotate(45deg);border-radius:4px;background:${c};border:2.5px solid #0b0f0d;box-shadow:0 4px 14px #000a"></span>`;
        const html = `<div style="min-width:220px"><div style="display:flex;align-items:center;gap:6px;font-size:11px;color:${c};text-transform:uppercase;letter-spacing:.06em;font-weight:600">◆ ${esc(LEAD_STATUS_LABEL[l.status])}</div>
          <strong style="display:block;margin-top:3px;font-size:14px;color:var(--text)">${esc(l.title)}</strong>
          ${l.sub ? `<div style="font-size:12px;color:var(--muted);margin-top:2px">${esc(l.sub)}</div>` : ""}
          ${l.value ? `<div style="font-size:13px;color:var(--text);margin-top:6px">${esc(l.value)}</div>` : ""}
          <a href="/forest-map?tab=leads&lead=${l.id}" style="display:inline-block;margin-top:8px;font-size:12px;color:var(--amber);text-decoration:none">Atvērt iespēju →</a></div>`;
        const mk = new maplibre.Marker({ element: el }).setLngLat([l.lng, l.lat]).setPopup(new maplibre.Popup({ offset: 14, maxWidth: "300px" }).setHTML(html)).addTo(map);
        markersRef.current.push(mk);
        if (focusLead === l.id) { map.flyTo({ center: [l.lng, l.lat], zoom: 13, duration: 900 }); mk.togglePopup(); }
      }
      if (showProjects) for (const p of projects) {
        const c = p.status === "active" ? "#5fae6e" : "#9aa39c";
        const el = document.createElement("button");
        el.type = "button"; el.className = "mjfg-marker"; el.setAttribute("aria-label", p.name);
        el.innerHTML = `<span style="display:grid;place-items:center;width:26px;height:26px;border-radius:8px;background:#0f1411e6;border:1.5px solid ${c};box-shadow:0 6px 16px #000a;color:${c};font:700 9px/1 system-ui">${esc(p.code.slice(0, 6))}</span>`;
        const html = `<div style="min-width:200px"><strong style="font-size:14px;color:var(--text)">${esc(p.code)} · ${esc(p.name)}</strong><a href="/projects/${p.id}" style="display:block;margin-top:8px;font-size:12px;color:var(--amber);text-decoration:none">Atvērt darba objektu →</a></div>`;
        markersRef.current.push(new maplibre.Marker({ element: el }).setLngLat([p.lng, p.lat]).setPopup(new maplibre.Popup({ offset: 14 }).setHTML(html)).addTo(map));
      }
    })();
    return () => { cancelled = true; };
  }, [ready, leads, projects, showLeads, showProjects, focusLead]);

  const onPick = async (p: SearchPick) => {
    const map = mapRef.current;
    if (!map) return;
    if (p.bbox && p.bbox[2] - p.bbox[0] > 0.02) map.fitBounds([[p.bbox[0], p.bbox[1]], [p.bbox[2], p.bbox[3]]], { padding: 60, maxZoom: 15, duration: 1100 });
    else map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 14), duration: 1100 });
    const maplibre = await loadMaplibre();
    pickRef.current?.remove();
    const el = document.createElement("div");
    el.className = "mjfg-pin";
    el.innerHTML = "<span></span>";
    pickRef.current = new maplibre.Marker({ element: el, anchor: "bottom" }).setLngLat([p.lng, p.lat]).addTo(map);
    setPicked({ lat: p.lat, lng: p.lng, country: guessCountry(p.lng, p.lat), region: null, municipality: p.label });
  };

  const activeCount = Object.keys(active).length;
  const grid = picked ? localGrid(picked) : null;

  return (
    <div className="relative overflow-hidden rounded-[14px] border border-line bg-bg-2" style={{ height }}>
      <div ref={ref} style={{ position: "absolute", inset: 0 }} role="region" aria-label="Meža karte" />
      <div className={cn("skeleton pointer-events-none absolute inset-0 rounded-none transition-opacity duration-700", ready ? "opacity-0" : "opacity-100")} aria-hidden />

      {/* search */}
      <div className="absolute left-3 top-3 z-20">
        <MapSearch onPick={onPick} places={[
          ...leads.map((l) => ({ id: `lead-${l.id}`, label: l.title, sub: `Iespēja · ${LEAD_STATUS_LABEL[l.status]}`, lng: l.lng, lat: l.lat })),
          ...projects.map((p) => ({ id: `p-${p.id}`, label: `${p.code} · ${p.name}`, sub: "Darba objekts", lng: p.lng, lat: p.lat })),
        ]} />
      </div>

      {/* base + panel toggle */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
        <div className="flex overflow-hidden rounded-lg border border-line-strong bg-bg/90 backdrop-blur">
          {([["satellite", Satellite, "Satelīts"], ["map", MapIcon, "Karte"], ["topo", Mountain, "OpenStreetMap"]] as const).map(([k, Icon, label]) => (
            <button key={k} onClick={() => setBase(k)} aria-pressed={base === k} title={label}
              className={cn("grid h-8 w-8 place-items-center transition", base === k ? "bg-forest-700 text-ink" : "text-muted hover:text-ink")}><Icon className="h-4 w-4" /></button>
          ))}
        </div>
        <button onClick={() => setPanel((v) => !v)} aria-expanded={panel}
          className={cn("flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium backdrop-blur transition", panel ? "border-forest-500/60 bg-forest-700 text-ink" : "border-line-strong bg-bg/90 text-ink-2 hover:text-ink")}>
          <Layers className="h-4 w-4" /> Slāņi{activeCount > 0 && <span className="rounded-full bg-amber px-1.5 text-[10px] font-bold text-[var(--on-accent)]">{activeCount}</span>}
        </button>
      </div>

      {/* layer panel */}
      <aside className={cn("absolute bottom-3 right-3 top-14 z-20 flex w-[min(360px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-line-strong bg-surface/95 shadow-2xl backdrop-blur transition-all duration-300",
        panel ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[110%] opacity-0")} aria-label="Karšu slāņi">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h3 className="font-display text-base uppercase tracking-wide text-ink">Karšu slāņi</h3>
            <p className="text-[11px] text-muted">Publiskie valsts dati · ieslēdz un regulē caurspīdīgumu</p>
          </div>
          <button onClick={() => setPanel(false)} className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Aizvērt"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex gap-1 border-b border-line p-2">
          {(["LV", "SE", "IS"] as const).map((c) => (
            <button key={c} onClick={() => flyToCountry(c)}
              className={cn("flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition", country === c ? "bg-forest-700 text-ink shadow" : "text-muted hover:bg-surface-2 hover:text-ink")}>
              {FLAG[c]} {COUNTRY_NAME[c]}
            </button>
          ))}
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-3">
          {GROUPS.map((g) => {
            const items = catalog.filter((l) => l.group === g.key);
            if (!items.length) return null;
            return (
              <section key={g.key}>
                <h4 className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">{g.label}</h4>
                <ul className="space-y-1.5">
                  {items.map((l) => {
                    const on = l.id in active;
                    return (
                      <li key={l.id} className={cn("rounded-xl border px-3 py-2 transition", on ? "border-forest-500/50 bg-forest-800/40" : "border-line bg-surface-2/40 hover:border-line-strong")}>
                        <div className="flex items-start gap-2.5">
                          <button role="switch" aria-checked={on} onClick={() => toggle(l)} aria-label={l.name}
                            className={cn("relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition", on ? "border-forest-500 bg-forest-500" : "border-line-strong bg-surface-2")}>
                            <span className={cn("absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all", on ? "left-[18px]" : "left-0.5")} />
                          </button>
                          <div className="min-w-0 flex-1">
                            <button onClick={() => toggle(l)} className="block text-left text-[13px] font-medium leading-snug text-ink">{l.name}</button>
                            <span className="block truncate text-[10px] text-faint" title={l.license}>{FLAG[l.country]} {l.license.split(/[;(—]/)[0].trim()}</span>
                          </div>
                          <button onClick={() => setOpenInfo(openInfo === l.id ? null : l.id)} className="rounded p-0.5 text-muted hover:text-ink" aria-label="Par slāni" aria-expanded={openInfo === l.id}>
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {openInfo === l.id && (
                          <div className="mt-2 space-y-1.5 border-t border-line pt-2 text-[11px] leading-relaxed text-ink-2 animate-fade-in">
                            <p>{l.description}</p>
                            <p className="text-faint">Licence: {l.license}</p>
                            <p className="text-faint">{l.attribution}</p>
                            <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-amber hover:underline">Datu avots <ExternalLink className="h-3 w-3" /></a>
                          </div>
                        )}
                        {on && (
                          <label className="mt-2 flex items-center gap-2 text-[10px] text-muted">
                            <span className="w-16 shrink-0">Redzamība</span>
                            <input type="range" min={0.1} max={1} step={0.05} value={active[l.id]} onChange={(e) => setOpacity(l.id, Number(e.target.value))} className="h-1 flex-1 accent-[var(--forest-500)]" />
                            <span className="w-8 text-right tabular-nums">{Math.round(active[l.id] * 100)}%</span>
                          </label>
                        )}
                        {on && l.minzoom && l.minzoom > 6 && <p className="mt-1 text-[10px] text-warn">Redzams no tuvinājuma {l.minzoom}+</p>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          <p className="px-1 text-[10px] leading-relaxed text-faint">
            Robežas: novadi / län / landshlutar un pagasti / kommuner / sveitarfélög (geoBoundaries, CC BY 4.0). Dati tiek rādīti tieši no oficiālajiem serveriem — pieejamība atkarīga no to darbības.
          </p>
        </div>
      </aside>

      {/* hover chip + cursor coords */}
      {hoverRegion && <div className="pointer-events-none absolute left-1/2 top-3 z-10 hidden -translate-x-1/2 rounded-full border border-line-strong bg-bg/90 px-3 py-1 text-xs font-medium text-ink shadow-lg backdrop-blur md:block">{hoverRegion}</div>}
      {cursor && !picked && <PointInfo point={cursor} className="pointer-events-none absolute bottom-12 left-1/2 z-10 hidden -translate-x-1/2 lg:flex" />}

      {/* overlay toggles + legend */}
      <div className="absolute bottom-9 left-3 z-10 flex flex-wrap items-center gap-1.5">
        <button onClick={() => setShowLeads((v) => !v)} aria-pressed={showLeads}
          className={cn("rounded-lg border px-2 py-1 text-[11px] font-medium backdrop-blur transition", showLeads ? "border-amber/50 bg-amber/15 text-ink" : "border-line-strong bg-bg/80 text-faint")}>◆ Iespējas · {leads.length}</button>
        <button onClick={() => setShowProjects((v) => !v)} aria-pressed={showProjects}
          className={cn("rounded-lg border px-2 py-1 text-[11px] font-medium backdrop-blur transition", showProjects ? "border-forest-500/50 bg-forest-800/80 text-ink" : "border-line-strong bg-bg/80 text-faint")}>▣ Objekti · {projects.length}</button>
      </div>

      {/* picked point card */}
      {picked && (
        <div className="absolute bottom-10 left-1/2 z-30 w-[min(460px,calc(100%-1.5rem))] -translate-x-1/2 rounded-2xl border border-line-strong bg-surface/95 p-4 shadow-2xl backdrop-blur animate-slide-up">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber">
                {picked.country ? `${FLAG[picked.country] ?? ""} ${COUNTRY_NAME[picked.country] ?? picked.country}` : "Izvēlētais punkts"}
                {picked.region ? ` · ${picked.region}` : ""}
              </p>
              {picked.municipality && <p className="mt-0.5 truncate text-sm font-medium text-ink">{picked.municipality}</p>}
            </div>
            <button onClick={() => { setPicked(null); pickRef.current?.remove(); }} className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Aizvērt"><X className="h-4 w-4" /></button>
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 font-mono text-[12px]">
            <dt className="text-muted">WGS 84</dt><dd className="text-ink">{fmtLatLng(picked, 6)}</dd>
            <dt className="text-muted">DMS</dt><dd className="text-ink-2">{fmtDMS(picked)}</dd>
            {grid && <><dt className="text-muted">{grid.label}</dt><dd className="text-ink-2">{grid.text}</dd></>}
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            {onAddLead && (
              <button onClick={() => onAddLead(picked)} className="inline-flex items-center gap-1.5 rounded-lg bg-forest-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-forest-500">
                <MapPinPlus className="h-4 w-4" /> Pievienot iespēju šeit
              </button>
            )}
            <button onClick={() => { navigator.clipboard?.writeText(fmtLatLng(picked, 6)); }} className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-xs text-ink-2 hover:text-ink">
              <Copy className="h-3.5 w-3.5" /> Kopēt
            </button>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${picked.lat.toFixed(6)},${picked.lng.toFixed(6)}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-xs text-ink-2 hover:text-ink">
              <Navigation className="h-3.5 w-3.5" /> Navigācija
            </a>
          </div>
        </div>
      )}

      {!panel && activeCount === 0 && ready && (
        <button onClick={() => setPanel(true)} className="absolute right-3 top-14 z-10 hidden items-center gap-1 rounded-lg border border-amber/40 bg-bg/90 px-2.5 py-1.5 text-[11px] text-amber backdrop-blur md:flex animate-fade-in">
          <ChevronDown className="h-3.5 w-3.5 rotate-90" /> Ieslēdz meža, kadastra un ciršanas slāņus
        </button>
      )}

      <style>{`.mjfg-marker{background:none;border:0;padding:0;cursor:pointer}.mjfg-pin span{display:block;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--amber);border:3px solid #0b0f0d;box-shadow:0 8px 20px #000a;animation:fade-up .45s cubic-bezier(.2,.7,.2,1) both}`}</style>
    </div>
  );
}

function addForestLayer(map: MLMap, id: string, opacity: number) {
  const l = FOREST_LAYERS.find((x) => x.id === id);
  if (!l || map.getLayer(layerId(id))) return;
  if (!map.getSource(layerId(id))) {
    map.addSource(layerId(id), { type: "raster", tiles: l.tiles, tileSize: l.tileSize, minzoom: l.minzoom, maxzoom: l.maxzoom ?? 19, attribution: l.attribution });
  }
  // below the administrative boundaries so outlines & labels stay on top
  const before = map.getLayer("adm1-fill") ? "adm1-fill" : undefined;
  map.addLayer({ id: layerId(id), type: "raster", source: layerId(id), paint: { "raster-opacity": opacity, "raster-fade-duration": 200 } }, before);
}

function guessCountry(lng: number, lat: number): string | null {
  for (const c of ["LV", "IS", "SE"]) {
    const b = REGION_BOUNDS[c];
    if (lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3]) return c;
  }
  return null;
}

/** Municipality (adm2) at a point — geometry test on the loaded GeoJSON (works even when adm2 lines are hidden). */
async function muniAt(map: MLMap, lng: number, lat: number): Promise<string | null> {
  const src = map.getSource("adm2") as (import("maplibre-gl").GeoJSONSource & { _data?: unknown }) | undefined;
  if (!src) return null;
  const data = await src.getData().catch(() => null) as GeoJSON.FeatureCollection | null;
  if (!data?.features) return null;
  for (const f of data.features) {
    const g = f.geometry;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const poly of polys) if (inRing(lng, lat, poly[0] as number[][]) && !poly.slice(1).some((h) => inRing(lng, lat, h as number[][]))) return String(f.properties?.name ?? "");
  }
  return null;
}

function inRing(x: number, y: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
