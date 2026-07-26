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
  variant = "default",
}: {
  values: number[];
  eyebrow?: string;
  title?: string;
  description?: string;
  variant?: "default" | "market";
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

  if (variant === "market") {
    const risingDebt = chart.change > 0;
    const marketColor = risingDebt ? "#fb7185" : "#34d399";
    const latestIndex = chart.normalized.findLastIndex((value) => value > 0);
    const latestPoint = chart.points[Math.max(latestIndex, 0)] ?? chart.points[0];
    const tooltipX = Math.min(820, Math.max(58, selectedPoint.x - 68));

    return (
      <section className="overflow-hidden rounded-xl border border-slate-800 bg-[#07110e] text-slate-100 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.9)]">
        <div className="flex flex-col gap-5 border-b border-slate-800/90 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />
                HUTANG · IDR
              </span>
              <span className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                2026
              </span>
              <span className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                BULANAN
              </span>
            </div>
            <h3 className="mt-3 text-lg font-semibold">{title}</h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">{description}</p>
          </div>
          <div className="min-w-64 rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Posisi terakhir · {MONTHS[Math.max(latestIndex, 0)]}
            </p>
            <div className="mt-1 flex items-end justify-between gap-4">
              <p className="font-mono text-xl font-semibold tabular-nums text-white">
                {compactRupiah.format(latestPoint.value)}
              </p>
              <p
                className="flex items-center gap-1 font-mono text-sm font-semibold"
                style={{ color: marketColor }}
              >
                <TrendIcon className="h-4 w-4" />
                {Math.abs(chart.change).toLocaleString("id-ID", {
                  maximumFractionDigits: 1,
                })}
                %
              </p>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {risingDebt ? "Hutang meningkat dari periode sebelumnya" : "Hutang menurun dari periode sebelumnya"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 border-b border-slate-800/90 sm:grid-cols-4">
          {[
            ["Nilai tahunan", compactRupiah.format(chart.total)],
            ["Rata-rata aktif", compactRupiah.format(chart.average)],
            [
              "Tertinggi",
              chart.total
                ? `${MONTHS[chart.peakIndex]} · ${compactRupiah.format(chart.normalized[chart.peakIndex])}`
                : "Belum ada",
            ],
            ["Titik data", `${chart.normalized.filter((value) => value > 0).length} bulan`],
          ].map(([label, value]) => (
            <div key={label} className="border-r border-slate-800/80 px-4 py-3 last:border-r-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-600">
                {label}
              </p>
              <p className="mt-1 truncate font-mono text-sm font-medium tabular-nums text-slate-200">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="px-2 pb-3 pt-4 sm:px-4">
          <div className="mb-2 flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              {eyebrow}
            </div>
            <div className="font-mono text-[11px] tabular-nums text-slate-400">
              {MONTHS[activeIndex]}{" "}
              <span className="ml-2 font-semibold text-slate-100">
                {rupiah.format(selectedPoint.value)}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <svg
              viewBox="0 0 960 258"
              className="h-[280px] w-full min-w-[760px]"
              role="img"
              aria-labelledby={`${gradientId}-market-title ${gradientId}-market-description`}
              onMouseLeave={() => setActiveIndex(Math.max(latestIndex, 0))}
            >
              <title id={`${gradientId}-market-title`}>{title}</title>
              <desc id={`${gradientId}-market-description`}>
                Grafik pasar bergaya terminal untuk nilai hutang Januari sampai Desember.
              </desc>
              <defs>
                <linearGradient id={`${gradientId}-market-area`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={marketColor} stopOpacity="0.34" />
                  <stop offset="75%" stopColor={marketColor} stopOpacity="0.05" />
                  <stop offset="100%" stopColor={marketColor} stopOpacity="0" />
                </linearGradient>
                <filter id={`${gradientId}-market-glow`}>
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {chart.points.map((point, index) => (
                <line
                  key={`vertical-${MONTHS[index]}`}
                  x1={point.x}
                  x2={point.x}
                  y1="26"
                  y2="214"
                  stroke="#1e293b"
                  strokeWidth="1"
                  opacity="0.55"
                />
              ))}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = 214 - ratio * 188;
                return (
                  <g key={ratio}>
                    <line
                      x1="48"
                      x2="928"
                      y1={y}
                      y2={y}
                      stroke="#24332e"
                      strokeWidth="1"
                      strokeDasharray="2 5"
                    />
                    <text
                      x="924"
                      y={y - 5}
                      textAnchor="end"
                      className="fill-slate-400 font-mono text-[9px]"
                    >
                      {compactRupiah.format(chart.maximum * ratio)}
                    </text>
                  </g>
                );
              })}

              <path d={chart.areaPath} fill={`url(#${gradientId}-market-area)`} />
              <path
                d={chart.linePath}
                fill="none"
                stroke={marketColor}
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#${gradientId}-market-glow)`}
              />
              <line
                x1="48"
                x2="928"
                y1={latestPoint.y}
                y2={latestPoint.y}
                stroke={marketColor}
                strokeDasharray="5 5"
                opacity="0.45"
              />
              <line
                x1={selectedPoint.x}
                x2={selectedPoint.x}
                y1="26"
                y2="214"
                stroke="#94a3b8"
                strokeDasharray="3 4"
                opacity="0.7"
              />
              <circle
                cx={selectedPoint.x}
                cy={selectedPoint.y}
                r="5"
                fill="#07110e"
                stroke={marketColor}
                strokeWidth="2.5"
              />

              <g pointerEvents="none">
                <rect
                  x={tooltipX}
                  y={Math.max(8, selectedPoint.y - 52)}
                  width="136"
                  height="38"
                  rx="5"
                  fill="#020617"
                  stroke="#334155"
                />
                <text
                  x={tooltipX + 9}
                  y={Math.max(23, selectedPoint.y - 37)}
                  className="fill-slate-500 font-mono text-[9px]"
                >
                  {MONTHS[activeIndex]} 2026
                </text>
                <text
                  x={tooltipX + 9}
                  y={Math.max(38, selectedPoint.y - 22)}
                  className="fill-slate-100 font-mono text-[11px] font-semibold"
                >
                  {compactRupiah.format(selectedPoint.value)}
                </text>
              </g>

              {chart.points.map((point, index) => (
                <g
                  key={MONTHS[index]}
                  role="button"
                  tabIndex={0}
                  aria-label={`${MONTHS[index]} ${rupiah.format(point.value)}`}
                  onClick={() => setActiveIndex(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setActiveIndex(index);
                  }}
                  className="cursor-crosshair outline-none"
                >
                  <rect x={point.x - 28} y="26" width="56" height="188" fill="transparent" />
                  <text
                    x={point.x}
                    y="239"
                    textAnchor="middle"
                    className={
                      activeIndex === index
                        ? "fill-slate-100 font-mono text-[10px]"
                        : "fill-slate-400 font-mono text-[10px]"
                    }
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
                onClick={() => setActiveIndex(index)}
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
