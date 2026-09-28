import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/request";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Pieteikšanās" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return <LoginForm next={sp.next ? safeNext(sp.next) : undefined} expired={sp.expired === "1"} notConfigured={!isSupabaseConfigured()} />;
}
