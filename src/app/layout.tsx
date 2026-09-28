import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MJ Forest Guru", template: "%s · MJ Forest Guru" },
  description: "Privāta mežsaimniecības operāciju platforma",
  applicationName: "MJ Forest Guru",
  // Private application: never index (authentication remains the real barrier)
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "MJ Forest Guru", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0f0d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="lv" className="dark">
      <body className="antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-amber focus:px-3 focus:py-2 focus:text-black">
          Pāriet uz saturu
        </a>
        {children}
      </body>
    </html>
  );
}
