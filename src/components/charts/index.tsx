"use client";

import dynamic from "next/dynamic";

const Loading = ({ height = 220 }: { height?: number }) => <div className="skeleton w-full" style={{ height }} />;

// Recharts is heavy: lazy-load on the client only.
export const AreaTrend = dynamic(() => import("./charts-impl").then((m) => m.AreaTrend), { ssr: false, loading: () => <Loading /> });
export const Bars = dynamic(() => import("./charts-impl").then((m) => m.Bars), { ssr: false, loading: () => <Loading /> });
export const Lines = dynamic(() => import("./charts-impl").then((m) => m.Lines), { ssr: false, loading: () => <Loading /> });
export const Donut = dynamic(() => import("./charts-impl").then((m) => m.Donut), { ssr: false, loading: () => <Loading /> });
export const DonutLegend = dynamic(() => import("./charts-impl").then((m) => m.DonutLegend), { ssr: false });
