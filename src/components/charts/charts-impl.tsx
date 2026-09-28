"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export const PALETTE = ["#5a9866", "#e2a23b", "#7fa6c9", "#c09a6b", "#8fae6b", "#d97757", "#9d8fd1", "#6fb3a8", "#e0584f", "#b0b8b1"];

const axis = { stroke: "#5f6961", fontSize: 11, tickLine: false, axisLine: false } as const;
const grid = { stroke: "#29332d", strokeDasharray: "3 4", vertical: false } as const;

type Row = Record<string, string | number | null>;
type Series = { key: string; label: string; color?: string };

function TooltipBox({ active, payload, label, unit }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line-strong bg-surface-2/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      {label && <div className="mb-1 font-medium text-ink">{label}</div>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-ink-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted">{p.name}</span>
          <span className="ml-auto pl-3 tabular text-ink">{new Intl.NumberFormat("lv-LV", { maximumFractionDigits: 1 }).format(Number(p.value))}{unit ? ` ${unit}` : ""}</span>
        </div>
      ))}
    </div>
  );
}

export function AreaTrend({ data, x, series, unit, height = 220 }: { data: Row[]; x: string; series: Series[]; unit?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color ?? PALETTE[i]} stopOpacity={0.45} />
              <stop offset="100%" stopColor={s.color ?? PALETTE[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid {...grid} />
        <XAxis dataKey={x} {...axis} minTickGap={16} />
        <YAxis {...axis} width={48} />
        <Tooltip content={<TooltipBox unit={unit} />} cursor={{ stroke: "#37443b" }} />
        {series.map((s, i) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? PALETTE[i]} strokeWidth={2}
            fill={`url(#g-${s.key})`} animationDuration={900} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Bars({ data, x, series, unit, height = 220, stacked, horizontal }: { data: Row[]; x: string; series: Series[]; unit?: string; height?: number; stacked?: boolean; horizontal?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 8, bottom: 0, left: horizontal ? 8 : -18 }}>
        <CartesianGrid {...grid} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...axis} />
            <YAxis type="category" dataKey={x} {...axis} width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey={x} {...axis} minTickGap={8} />
            <YAxis {...axis} width={48} />
          </>
        )}
        <Tooltip content={<TooltipBox unit={unit} />} cursor={{ fill: "#ffffff08" }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: "#8e978f" }} iconType="circle" iconSize={8} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? PALETTE[i]} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            stackId={stacked ? "s" : undefined} maxBarSize={36} animationDuration={900} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Lines({ data, x, series, unit, height = 220 }: { data: Row[]; x: string; series: Series[]; unit?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid {...grid} />
        <XAxis dataKey={x} {...axis} minTickGap={16} />
        <YAxis {...axis} width={48} />
        <Tooltip content={<TooltipBox unit={unit} />} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: "#8e978f" }} iconType="circle" iconSize={8} />}
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? PALETTE[i]} strokeWidth={2} dot={false} animationDuration={900} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, unit, height = 220 }: { data: { name: string; value: number }[]; unit?: string; height?: number }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Tooltip content={<TooltipBox unit={unit} />} />
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="none" animationDuration={900}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-2xl font-bold tabular">{new Intl.NumberFormat("lv-LV", { notation: total > 99999 ? "compact" : "standard", maximumFractionDigits: 0 }).format(total)}</div>
          {unit && <div className="text-[11px] uppercase tracking-wider text-muted">{unit}</div>}
        </div>
      </div>
    </div>
  );
}

export function DonutLegend({ data, unit }: { data: { name: string; value: number }[]; unit?: string }) {
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <ul className="space-y-1.5 text-xs">
      {data.map((d, i) => (
        <li key={d.name} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
          <span className="truncate text-ink-2">{d.name}</span>
          <span className="ml-auto tabular text-muted">{Math.round((d.value / total) * 100)}%</span>
          <span className="w-24 text-right tabular text-ink">{new Intl.NumberFormat("lv-LV", { maximumFractionDigits: 0 }).format(d.value)}{unit ? ` ${unit}` : ""}</span>
        </li>
      ))}
    </ul>
  );
}
