import type { MetadataRoute } from "next";

// Private system: disallow everything, no sitemap.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
