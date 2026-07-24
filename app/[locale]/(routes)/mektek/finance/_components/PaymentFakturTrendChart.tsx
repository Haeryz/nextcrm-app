"use client";

import { useId, useMemo, useState } from "react";
import { Activity, TrendingDown, TrendingUp } from "lucide-react";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const compactRupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  notation: "compact",
  maximumFractionDigits: 1,
});

export default function PaymentFakturTrendChart({
  values,
  eyebrow = "Analitik pembayaran",
  title = "Pergerakan invoice bulanan",
  description = "Nilai invoice berdasarkan tanggal pengiriman pada sheet aktif.",
}: {
  values: number[];
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
  const gradientId = useId().replace(/:/g, "");
  const [activeIndex, setActiveIndex] = useState(() => {
    const lastValueIndex = values.findLastIndex((value) => value > 0);
    return lastValueIndex >= 0 ? lastValueIndex : 0;
  });
  const chart = useMemo(() => {
    const normalized = Array.from({ length: 12 }, (_, index) =>
      Math.max(0, Number(values[index]) || 0),
    );
    const maximum = Math.max(...normalized, 1);
    const left = 48;
    const right = 928;
    const top = 26;
    const bottom = 214;
    const step = (right - left) / 11;
    const points = normalized.map((value, index) => ({
      value,
      x: left + step * index,
      y: bottom - (value / maximum) * (bottom - top),
    }));
    const linePath = points
      .map((point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
      )
      .join(" ");
    const areaPath = `${linePath} L ${right} ${bottom} L ${left} ${bottom} Z`;
    const total = normalized.reduce((sum, value) => sum + value, 0);
    const peakIndex = normalized.indexOf(Math.max(...normalized));
    const nonZero = normalized.filter((value) => value > 0);
    const latest = nonZero.at(-1) ?? 0;
    const previous = nonZero.at(-2) ?? 0;
    const change = previous > 0 ? ((latest - previous) / previous) * 100 : 0;
    return {
      normalized,
      maximum,
      points,
      linePath,
      areaPath,
      total,
      peakIndex,
      average: nonZero.length ? total / nonZero.length : 0,
      change,
    };
  }, [values]);
  const selectedPoint = chart.points[activeIndex] ?? chart.points[0];
  const positiveTrend = chart.change >= 0;
  const TrendIcon = positiveTrend ? TrendingUp : TrendingDown;

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-col gap-4 border-b bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-5 text-white lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-indigo-200">
            <Activity className="h-4 w-4" />
            {eyebrow}
          </div>
          <h3 className="mt-2 text-lg font-semibold">
            {title}
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            {description}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Total", compactRupiah.format(chart.total)],
            ["Rata-rata", compactRupiah.format(chart.average)],
            [
              "Puncak",
              chart.total
                ? `${MONTHS[chart.peakIndex]} · ${compactRupiah.format(chart.normalized[chart.peakIndex])}`
                : "Belum ada",
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 backdrop-blur"
            >
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                {label}
              </p>
              <p className="mt-1 whitespace-nowrap text-sm font-semibold">
                {value}
              </p>
            </div>
          ))}
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              Momentum
            </p>
            <p
              className={
                positiveTrend
                  ? "mt-1 flex items-center gap-1 text-sm font-semibold text-emerald-300"
                  : "mt-1 flex items-center gap-1 text-sm font-semibold text-rose-300"
              }
            >
              <TrendIcon className="h-4 w-4" />
              {Math.abs(chart.change).toLocaleString("id-ID", {
                maximumFractionDigits: 1,
              })}
              %
            </p>
          </div>
        </div>
      </div>

      <div className="relative p-3 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Arahkan kursor atau fokuskan titik untuk melihat nilai.
          </p>
          <div className="rounded-md border bg-muted/40 px-3 py-1.5 text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {MONTHS[activeIndex]}
            </p>
            <p className="text-sm font-semibold">
              {rupiah.format(selectedPoint?.value ?? 0)}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <svg
            viewBox="0 0 960 250"
            className="h-[250px] min-w-[760px] w-full"
            role="img"
            aria-labelledby={`${gradientId}-title ${gradientId}-description`}
          >
            <title id={`${gradientId}-title`}>
              Grafik pergerakan invoice bulanan
            </title>
            <desc id={`${gradientId}-description`}>
              Grafik garis dan area nilai invoice Januari sampai Desember.
            </desc>
            <defs>
              <linearGradient
                id={gradientId}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.42" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = 214 - ratio * 188;
              return (
                <g key={ratio}>
                  <line
                    x1="48"
                    x2="928"
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    className="text-border"
                    strokeDasharray="4 6"
                  />
                  <text
                    x="42"
                    y={y + 4}
                    textAnchor="end"
                    className="fill-muted-foreground text-[9px]"
                  >
                    {compactRupiah.format(chart.maximum * ratio)}
                  </text>
                </g>
              );
            })}
            <path d={chart.areaPath} fill={`url(#${gradientId})`} />
            {chart.points.map((point, index) => (
              <rect
                key={`bar-${MONTHS[index]}`}
                x={point.x - 18}
                y={point.y}
                width="36"
                height={Math.max(0, 214 - point.y)}
                rx="5"
                fill="#6366f1"
                opacity={activeIndex === index ? 0.18 : 0.07}
              />
            ))}
            <path
              d={chart.linePath}
              fill="none"
              stroke="#4f46e5"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {chart.points.map((point, index) => (
              <g
                key={MONTHS[index]}
                role="button"
                tabIndex={0}
                aria-label={`${MONTHS[index]} ${rupiah.format(point.value)}`}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    setActiveIndex(index);
                  }
                }}
                className="cursor-pointer outline-none"
              >
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={activeIndex === index ? 7 : 4.5}
                  fill={activeIndex === index ? "#4f46e5" : "#ffffff"}
                  stroke="#4f46e5"
                  strokeWidth="3"
                />
                <text
                  x={point.x}
                  y="240"
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {MONTHS[index]}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}
