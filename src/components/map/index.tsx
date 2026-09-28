"use client";

import dynamic from "next/dynamic";

// MapLibre (~800 kB) is loaded only when a map is actually rendered.
export const LiveMap = dynamic(() => import("./live-map").then((m) => m.LiveMap), {
  ssr: false,
  loading: () => <div className="skeleton h-full min-h-[320px] w-full rounded-[14px]" />,
});
