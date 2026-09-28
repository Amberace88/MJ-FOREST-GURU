import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MJ Forest Guru",
    short_name: "MJ Forest Guru",
    description: "Privāta mežsaimniecības operāciju platforma",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0f0d",
    theme_color: "#0b0f0d",
    lang: "lv",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Sākt darbu", url: "/work", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Pieteikt remontu", url: "/report?type=repair", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Degviela", url: "/report?type=fuel", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
