"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactCurrency, formatCurrency, formatNumber } from "@/lib/formatting/currency";

type TrendPoint = { label: string; value: number; orders?: number; fullLabel?: string };

function ChartTooltip({
  active,
  payload,
  label,
  currency = "IDR",
}: {
  active?: boolean;
  payload?: { value?: number | string; name?: string; payload?: Record<string, unknown> }[];
  label?: string;
  currency?: string;
}) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload as TrendPoint | undefined;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__label">{data?.fullLabel ?? label}</div>
      <div className="chart-tooltip__row">
        <span>Net sales</span>
        <b>{formatCurrency(Number(payload[0]?.value ?? 0), currency)}</b>
      </div>
      {typeof data?.orders === "number" && (
        <div className="chart-tooltip__row">
          <span>Orders</span>
          <b>{formatNumber(data.orders)}</b>
        </div>
      )}
    </div>
  );
}

export function SalesAreaChart({
  data,
  currency = "IDR",
  height = 248,
  ariaLabel,
  compare,
}: {
  data: TrendPoint[];
  currency?: string;
  height?: number;
  ariaLabel: string;
  compare?: { date?: string; value: number }[];
}) {
  const merged = React.useMemo(() => {
    if (!compare?.length) return data;
    return data.map((point, index) => ({
      ...point,
      previous: compare[index]?.value ?? 0,
    }));
  }, [data, compare]);
  const gradientId = `velora-area-${React.useId().replaceAll(":", "")}`;

  return (
    <div className="chart-frame" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={merged} margin={{ top: 8, right: 6, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.2} />
              <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--chart-grid))" strokeDasharray="3 4" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "hsl(var(--ink-3))", fontSize: 10.5 }}
            interval="preserveStartEnd"
            minTickGap={24}
            dy={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "hsl(var(--ink-3))", fontSize: 10.5 }}
            tickFormatter={(value: number) => formatCompactCurrency(value, currency)}
            width={58}
          />
          <Tooltip
            content={<ChartTooltip currency={currency} />}
            cursor={{ stroke: "hsl(var(--border-strong))", strokeDasharray: "3 4" }}
          />
          {compare?.length ? (
            <Area
              type="monotone"
              dataKey="previous"
              name="Previous period"
              stroke="hsl(var(--ink-3))"
              strokeWidth={1.25}
              strokeDasharray="4 4"
              fill="transparent"
              dot={false}
              isAnimationActive={false}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="value"
            name="Net sales"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 0, fill: "hsl(var(--chart-1))" }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SalesBarChart({
  data,
  currency = "IDR",
  height = 220,
  ariaLabel,
}: {
  data: TrendPoint[];
  currency?: string;
  height?: number;
  ariaLabel: string;
}) {
  return (
    <div className="chart-frame" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -20 }} barCategoryGap="22%">
          <CartesianGrid stroke="hsl(var(--chart-grid))" strokeDasharray="3 4" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "hsl(var(--ink-3))", fontSize: 10.5 }}
            interval="preserveStartEnd"
            minTickGap={18}
            dy={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "hsl(var(--ink-3))", fontSize: 10.5 }}
            tickFormatter={(value: number) => formatCompactCurrency(value, currency)}
            width={58}
          />
          <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: "hsl(var(--surface-2))" }} />
          <Bar dataKey="value" name="Net sales" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MiniBars({
  values,
  label,
  tone = 1,
}: {
  values: number[];
  label: string;
  tone?: 1 | 2 | 3 | 4 | 5;
}) {
  const max = Math.max(...values, 1);
  return (
    <span
      role="img"
      aria-label={label}
      style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 22 }}
    >
      {values.map((value, index) => (
        <span
          key={index}
          style={{
            width: 3,
            height: `${Math.max(2, (value / max) * 22)}px`,
            borderRadius: 2,
            background: `hsl(var(--chart-${tone}))`,
            opacity: 0.35 + (index / Math.max(1, values.length - 1)) * 0.65,
          }}
        />
      ))}
    </span>
  );
}

export function PaymentMixBar({ data, currency = "IDR" }: { data: { method: string; amount: number }[]; currency?: string }) {
  const total = data.reduce((sum, item) => sum + item.amount, 0);
  if (!total) return null;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div style={{ display: "flex", height: 9, gap: 2, overflow: "hidden", borderRadius: 999 }}>
        {data.map((item, index) => (
          <span
            key={item.method}
            style={{
              width: `${(item.amount / total) * 100}%`,
              background: `hsl(var(--chart-${(index % 6) + 1}))`,
            }}
            aria-hidden="true"
          />
        ))}
      </div>
      <div className="bar-list">
        {data.map((item, index) => (
          <div className="bar-row" key={item.method}>
            <div className="bar-row__meta">
              <span className="bar-row__label" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <i
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 2,
                    background: `hsl(var(--chart-${(index % 6) + 1}))`,
                    flexShrink: 0,
                  }}
                />
                {item.method}
              </span>
              <span className="bar-row__value">
                {formatCurrency(item.amount, currency)}
                <small>{Math.round((item.amount / total) * 100)}%</small>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CategoryBars({
  data,
  currency = "IDR",
}: {
  data: { name: string; revenue: number; quantity: number }[];
  currency?: string;
}) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="bar-list">
      {data.map((item, index) => (
        <div className="bar-row" key={item.name}>
          <div className="bar-row__meta">
            <span className="bar-row__label">{item.name}</span>
            <span className="bar-row__value">
              {formatCurrency(item.revenue, currency)}
              <small>{item.quantity} sold</small>
            </span>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              data-tone={(index % 5) + 1}
              style={{ width: `${Math.max(2, (item.revenue / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A compact, axis-free trend line for KPI cards. It draws the same shape the
 * full chart does, so a card and the chart below it never disagree.
 */
export function Sparkline({
  values,
  tone = "up",
  width = 64,
  height = 40,
  ariaLabel,
}: {
  values: number[];
  tone?: "up" | "down" | "flat";
  width?: number;
  height?: number;
  ariaLabel?: string;
}) {
  const path = React.useMemo(() => {
    const points = values.filter((value) => Number.isFinite(value));
    if (points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const stepX = width / (points.length - 1);
    return points
      .map((value, index) => {
        const x = index * stepX;
        const y = height - 2 - ((value - min) / span) * (height - 4);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [values, width, height]);

  if (!path) return null;

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      role="img"
      aria-label={ariaLabel}
      data-tone={tone === "down" ? "down" : undefined}
    >
      <path d={path} stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
