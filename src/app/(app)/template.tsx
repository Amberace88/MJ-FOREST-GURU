import type { ReactNode } from "react";

/** Re-mounts on every navigation inside the app → soft page-enter animation. */
export default function AppTemplate({ children }: { children: ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
