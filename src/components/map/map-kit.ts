"use client";

/**
 * Shared MapLibre helpers for the Live Map and the Forest Map:
 *  - base styles (satellite / map) with glyphs so we can draw vector labels
 *  - administrative boundaries (country outline → regions → municipalities)
 *    served as static GeoJSON from /geo (geoBoundaries, CC BY 4.0)
 *  - hover highlight + name chip for regions
 */
import { publicEnv } from "@/lib/env";

type MLMap = import("maplibre-gl").Map;

export type BaseKind = "satellite" | "map" | "topo";

let workerSet = false;
/**
 * Loads MapLibre and points it at the worker copied to /public by scripts/copy-maplibre-worker.mjs
 * (v6 resolves the worker via import.meta.url, which bundlers rewrite → "Worker failed to load").
 */
export async function loadMaplibre() {
  const m = await import("maplibre-gl");
  if (!workerSet) {
    m.setWorkerUrl(`${window.location.origin}/maplibre/${m.getVersion()}/maplibre-gl-worker.mjs`);
    workerSet = true;
  }
  return m;
}

export const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
export const FONT = ["Noto Sans Regular"];
export const FONT_BOLD = ["Noto Sans Bold"];
export const BOUNDARY_ATTRIBUTION = "Robežas © geoBoundaries (CC BY 4.0)";

export const isLight = () => typeof document !== "undefined" && document.documentElement.dataset.theme === "light";

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

export function regionBounds(codes: string[]): [[number, number], [number, number]] | null {
  const boxes = codes.map((c) => REGION_BOUNDS[c.toUpperCase()]).filter(Boolean);
  if (!boxes.length) return null;
  return [
    [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1]))],
    [Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))],
  ];
}

export function baseStyle(kind: BaseKind) {
  const token = publicEnv.mapboxToken;
  const light = isLight();
  const sat = token
    ? `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=${token}`
    : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const satAttr = token ? "© Mapbox © OpenStreetMap" : "Tiles © Esri — Esri, Maxar, Earthstar Geographics";
  const carto = light ? "rastertiles/voyager" : "dark_all";
  return {
    version: 8 as const,
    glyphs: GLYPHS,
    sources: {
      sat: { type: "raster" as const, tiles: [sat], tileSize: 256, attribution: satAttr, maxzoom: 19 },
      carto: { type: "raster" as const, tiles: ["a", "b", "c"].map((s) => `https://${s}.basemaps.cartocdn.com/${carto}/{z}/{x}/{y}@2x.png`), tileSize: 256, attribution: "© OpenStreetMap © CARTO", maxzoom: 19 },
      labels: { type: "raster" as const, tiles: ["https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png"], tileSize: 256, maxzoom: 19 },
      osm: { type: "raster" as const, tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors", maxzoom: 19 },
    },
    layers:
      kind === "satellite"
        ? [
            { id: "base", type: "raster" as const, source: "sat", paint: { "raster-saturation": -0.25, "raster-brightness-max": light ? 0.95 : 0.78, "raster-contrast": 0.08 } },
            { id: "base-labels", type: "raster" as const, source: "labels", paint: { "raster-opacity": 0.85 } },
          ]
        : kind === "topo"
          ? [{ id: "base", type: "raster" as const, source: "osm", paint: light ? {} : { "raster-brightness-max": 0.72, "raster-saturation": -0.3 } }]
          : [{ id: "base", type: "raster" as const, source: "carto", paint: light ? {} : { "raster-saturation": -0.2, "raster-hue-rotate": 90, "raster-brightness-max": 0.9 } }],
  };
}

const LEVELS = [
  { id: "adm0", url: "/geo/adm0.json" },
  { id: "adm1", url: "/geo/adm1.json" },
  { id: "adm2", url: "/geo/adm2.json" },
] as const;

/**
 * Adds country outlines, regions (LV novadi · SE län · IS landshlutar) and municipalities
 * (LV pagasti · SE kommuner · IS sveitarfélög). Safe to call again after setStyle().
 */
export function addBoundaries(map: MLMap, opts: { municipalities?: boolean; labels?: boolean } = {}) {
  const light = isLight();
  const line = light ? "#1f3a2a" : "#f2e7c9";
  const accent = light ? "#b86e00" : "#e3b448";
  const halo = light ? "#ffffff" : "#0b0f0d";
  const labels = opts.labels !== false;

  for (const l of LEVELS) {
    if (l.id === "adm2" && opts.municipalities === false) continue;
    if (!map.getSource(l.id)) map.addSource(l.id, { type: "geojson", data: l.url, attribution: l.id === "adm0" ? BOUNDARY_ATTRIBUTION : undefined, generateId: true });
  }

  const add = (layer: Parameters<MLMap["addLayer"]>[0]) => { if (!map.getLayer(layer.id)) map.addLayer(layer); };

  // hover fill for regions (feature-state)
  add({ id: "adm1-fill", type: "fill", source: "adm1", paint: { "fill-color": accent, "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.12, 0] } });
  if (opts.municipalities !== false) {
    add({ id: "adm2-line", type: "line", source: "adm2", minzoom: 7.2, paint: { "line-color": line, "line-opacity": ["interpolate", ["linear"], ["zoom"], 7.2, 0, 8, 0.35, 11, 0.55], "line-width": 0.8, "line-dasharray": [3, 2] } });
  }
  add({ id: "adm1-line", type: "line", source: "adm1", paint: { "line-color": line, "line-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.25, 6, 0.6, 10, 0.8], "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.5, 8, 1.4, 12, 2] } });
  add({ id: "adm0-glow", type: "line", source: "adm0", paint: { "line-color": accent, "line-opacity": 0.25, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 4, 8, 9], "line-blur": 4 } });
  add({ id: "adm0-line", type: "line", source: "adm0", paint: { "line-color": accent, "line-opacity": 0.95, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.2, 8, 2.6] } });

  if (labels) {
    add({
      id: "adm1-label", type: "symbol", source: "adm1", minzoom: 5.2, maxzoom: 10,
      layout: { "text-field": ["get", "name"], "text-font": FONT_BOLD, "text-size": ["interpolate", ["linear"], ["zoom"], 5.2, 10, 9, 13], "text-transform": "uppercase", "text-letter-spacing": 0.08, "text-max-width": 8, "symbol-placement": "point" },
      paint: { "text-color": line, "text-halo-color": halo, "text-halo-width": 1.4, "text-opacity": 0.85 },
    });
    if (opts.municipalities !== false) {
      add({
        id: "adm2-label", type: "symbol", source: "adm2", minzoom: 9,
        layout: { "text-field": ["get", "name"], "text-font": FONT, "text-size": 11, "text-max-width": 8 },
        paint: { "text-color": line, "text-halo-color": halo, "text-halo-width": 1.2, "text-opacity": 0.8 },
      });
    }
  }
}

/** Highlights the region under the cursor and reports its name (for a floating chip). */
export function trackRegionHover(map: MLMap, onChange: (name: string | null) => void) {
  let hovered: string | number | undefined;
  const clear = () => {
    if (hovered !== undefined && map.getSource("adm1")) map.setFeatureState({ source: "adm1", id: hovered }, { hover: false });
    hovered = undefined;
  };
  const move = (e: import("maplibre-gl").MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) return;
    if (hovered !== f.id) {
      clear();
      hovered = f.id;
      if (hovered !== undefined) map.setFeatureState({ source: "adm1", id: hovered }, { hover: true });
    }
    const p = f.properties as { name?: string; country?: string };
    onChange(p.name ? `${p.name}` : null);
  };
  const leave = () => { clear(); onChange(null); };
  map.on("mousemove", "adm1-fill", move);
  map.on("mouseleave", "adm1-fill", leave);
  return () => { map.off("mousemove", "adm1-fill", move); map.off("mouseleave", "adm1-fill", leave); };
}
