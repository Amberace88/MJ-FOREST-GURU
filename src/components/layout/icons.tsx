"use client";

import {
  AlertTriangle, BarChart3, Bell, BookOpenCheck, Boxes, Building2, Calculator, ClipboardList, Clock, Cog, FileText, Fuel, GraduationCap,
  HardHat, LayoutDashboard, Map as MapIcon, Plug, Receipt, ScrollText, ShieldCheck, Siren, Tractor, TreePine, Users,
  UsersRound, Wallet, Wrench, FileBarChart, Trees, Handshake, type LucideIcon,
} from "lucide-react";

export const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, map: MapIcon, alerts: AlertTriangle, projects: TreePine, hours: Clock, tasks: ClipboardList,
  production: Boxes, employees: Users, teams: UsersRound, documents: FileText, machines: Tractor, fuel: Fuel,
  maintenance: Wrench, expenses: Wallet, receipts: Receipt, reports: FileBarChart, safety: ShieldCheck, incidents: Siren,
  training: GraduationCap, analytics: BarChart3, settings: Cog, users: HardHat, integrations: Plug, audit: ScrollText,
  notifications: Bell, company: Building2, work: BookOpenCheck, calculators: Calculator, forestMap: Trees, business: Handshake,
};
