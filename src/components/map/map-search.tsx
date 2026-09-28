"use client";

import { Crosshair, Loader2, LocateFixed, MapPin, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fmtLatLng, localGrid, parseCoordinates } from "@/lib/geo/coords";
import { cn } from "@/lib/utils";

export type SearchPick = { lng: number; lat: number; label: string; bbox?: [number, number, number, number] };
export type LocalPlace = { id: string; label: string; sub?: string; lng: number; lat: number };

type Result = SearchPick & { key: string; sub?: string; kind: "coords" | "local" | "address" };

const SYSTEM_LABEL = { wgs84: "WGS 84", lks92: "LKS-92", sweref99: "SWEREF 99 TM" } as const;

/**
 * Map search: GPS coordinates (decimal, DMS, LKS-92, SWEREF 99 TM), full addresses and
 * place names (OpenStreetMap Nominatim, LV/SE/IS) and the organization's own objects.
 */
export function MapSearch({ onPick, places = [], countries = ["lv", "se", "is"], className, placeholder }: {
  onPick: (p: SearchPick) => void; places?: LocalPlace[]; countries?: string[]; className?: string; placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const [locating, setLocating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);
  // parents pass fresh arrays on every render — read them through refs so the search effect only reacts to typing
  const placesRef = useRef(places);
  placesRef.current = places;
  const countriesKey = countries.join(",");

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) { setResults([]); setBusy(false); return; }
    const local: Result[] = [];
    const c = parseCoordinates(text);
    if (c) {
      const grid = localGrid(c);
      local.push({ key: "coords", kind: "coords", lng: c.lng, lat: c.lat, label: fmtLatLng(c), sub: `${SYSTEM_LABEL[c.system]} → WGS 84${grid && c.system === "wgs84" ? ` · ${grid.label}: ${grid.text}` : ""}` });
    }
    const needle = text.toLocaleLowerCase("lv");
    for (const p of placesRef.current) {
      if (local.length >= 6) break;
      if (`${p.label} ${p.sub ?? ""}`.toLocaleLowerCase("lv").includes(needle)) local.push({ key: `l-${p.id}`, kind: "local", lng: p.lng, lat: p.lat, label: p.label, sub: p.sub });
    }
    setResults(local);
    setActive(0);
    if (c || text.length < 3) { setBusy(false); return; }

    const id = ++reqId.current;
    setBusy(true);
    const timer = window.setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=0&accept-language=lv&countrycodes=${countriesKey}&q=${encodeURIComponent(text)}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const data = (await res.json()) as { place_id: number; display_name: string; lat: string; lon: string; boundingbox?: [string, string, string, string]; type?: string }[];
        if (id !== reqId.current) return;
        const addr: Result[] = data.map((d) => {
          const [first, ...rest] = d.display_name.split(", ");
          const bb = d.boundingbox?.map(Number);
          return {
            key: `n-${d.place_id}`, kind: "address" as const, lng: Number(d.lon), lat: Number(d.lat), label: first, sub: rest.slice(0, 4).join(", "),
            bbox: bb && bb.length === 4 ? [bb[2], bb[0], bb[3], bb[1]] as [number, number, number, number] : undefined,
          };
        });
        setResults((prev) => [...prev.filter((r) => r.kind !== "address"), ...addr]);
      } catch {
        /* offline / rate limited – local results stay */
      } finally {
        if (id === reqId.current) setBusy(false);
      }
    }, 650); // Nominatim usage policy: max 1 request per second
    return () => window.clearTimeout(timer);
  }, [q, countriesKey]);

  const pick = (r: Result) => {
    onPick({ lng: r.lng, lat: r.lat, label: r.label, bbox: r.bbox });
    setOpen(false);
  };

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); onPick({ lng: pos.coords.longitude, lat: pos.coords.latitude, label: "Mana atrašanās vieta" }); },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  return (
    <div ref={boxRef} className={cn("relative w-[min(420px,calc(100vw-5rem))]", className)}>
      <div className="flex items-center gap-1 rounded-xl border border-line-strong bg-bg/90 pl-3 pr-1 shadow-lg backdrop-blur transition focus-within:border-forest-500/70 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--forest-500)_25%,transparent)]">
        {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" /> : <Search className="h-4 w-4 shrink-0 text-muted" />}
        <input
          value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter" && results[active]) { e.preventDefault(); pick(results[active]); }
            else if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder ?? "Adrese, vieta vai koordinātas (56.95, 24.10 · LKS-92)"}
          className="h-9 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint" aria-label="Meklēt kartē" autoComplete="off" spellCheck={false} />
        {q && <button type="button" onClick={() => { setQ(""); setResults([]); }} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-ink" aria-label="Notīrīt"><X className="h-3.5 w-3.5" /></button>}
        <button type="button" onClick={locate} title="Mana atrašanās vieta" aria-label="Mana atrašanās vieta"
          className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink">
          {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
        </button>
      </div>
      {open && results.length > 0 && (
        <ul role="listbox" className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-80 overflow-y-auto rounded-xl border border-line-strong bg-surface/95 p-1 shadow-2xl backdrop-blur animate-fade-up">
          {results.map((r, i) => (
            <li key={r.key}>
              <button type="button" role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => pick(r)}
                className={cn("flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition", i === active ? "bg-forest-800/70 text-ink" : "text-ink-2 hover:bg-surface-2")}>
                {r.kind === "coords" ? <Crosshair className="mt-0.5 h-4 w-4 shrink-0 text-amber" /> : <MapPin className={cn("mt-0.5 h-4 w-4 shrink-0", r.kind === "local" ? "text-ok" : "text-muted")} />}
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.label}</span>
                  {r.sub && <span className="block truncate text-xs text-muted">{r.sub}</span>}
                </span>
              </button>
            </li>
          ))}
          <li className="px-2.5 pb-1 pt-1.5 text-[10px] text-faint">Adreses © OpenStreetMap (Nominatim)</li>
        </ul>
      )}
    </div>
  );
}
