"use client";

import { useId, useState } from "react";
import {
  formatAnalyticsCount,
  formatAnalyticsDayLabel,
} from "@/lib/analytics/presentation";
import type { AnalyticsTimeSeriesPointDto } from "@/lib/analytics/types";

const WIDTH = 720;
const HEIGHT = 220;
const PADDING_LEFT = 40;
const PADDING_RIGHT = 12;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 28;

type Props = {
  points: AnalyticsTimeSeriesPointDto[];
  metricLabel: string;
};

export function AnalyticsTimeSeriesChart({ points, metricLabel }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const titleId = useId();

  const values = points.map((point) => point.value);
  const maxValue = Math.max(1, ...values);
  const plotWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const xFor = (index: number) =>
    points.length <= 1
      ? PADDING_LEFT
      : PADDING_LEFT + (index / (points.length - 1)) * plotWidth;
  const yFor = (value: number) => PADDING_TOP + plotHeight - (value / maxValue) * plotHeight;

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${xFor(index)},${yFor(point.value)}`)
    .join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L${xFor(points.length - 1)},${PADDING_TOP + plotHeight} L${xFor(0)},${PADDING_TOP + plotHeight} Z`
      : "";

  const gridValues = [0, maxValue / 2, maxValue];
  const active = activeIndex !== null ? points[activeIndex] : null;

  const tickIndexes =
    points.length <= 1
      ? [0]
      : [0, Math.floor((points.length - 1) / 2), points.length - 1].filter(
          (value, index, arr) => arr.indexOf(value) === index,
        );

  return (
    <div>
      <div className="relative">
        <svg
          role="img"
          aria-labelledby={titleId}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-56 w-full"
          onMouseLeave={() => setActiveIndex(null)}
        >
          <title id={titleId}>{`${metricLabel} zaman serisi grafiği`}</title>
          {gridValues.map((value) => (
            <g key={value}>
              <line
                x1={PADDING_LEFT}
                x2={WIDTH - PADDING_RIGHT}
                y1={yFor(value)}
                y2={yFor(value)}
                stroke="#e4e4e7"
                strokeWidth={1}
              />
              <text x={4} y={yFor(value) + 3} className="fill-zinc-400 text-[9px]">
                {formatAnalyticsCount(Math.round(value))}
              </text>
            </g>
          ))}
          {areaPath && <path d={areaPath} fill="#fce7f3" opacity={0.6} />}
          {linePath && <path d={linePath} fill="none" stroke="#db2777" strokeWidth={2} />}
          {points.map((point, index) => (
            <rect
              key={point.bucketStart}
              x={xFor(index) - plotWidth / Math.max(points.length, 1) / 2}
              y={PADDING_TOP}
              width={Math.max(plotWidth / Math.max(points.length, 1), 4)}
              height={plotHeight}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${formatAnalyticsDayLabel(new Date(point.bucketStart))}: ${formatAnalyticsCount(point.value)}`}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
            />
          ))}
          {activeIndex !== null && points[activeIndex] && (
            <circle
              cx={xFor(activeIndex)}
              cy={yFor(points[activeIndex]?.value ?? 0)}
              r={3.5}
              fill="#db2777"
            />
          )}
          {tickIndexes.map((index) => {
            const point = points[index];
            if (!point) return null;
            return (
              <text
                key={index}
                x={xFor(index)}
                y={HEIGHT - 8}
                textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
                className="fill-zinc-500 text-[10px]"
              >
                {formatAnalyticsDayLabel(new Date(point.bucketStart))}
              </text>
            );
          })}
        </svg>
        {active && (
          <div className="pointer-events-none absolute right-2 top-2 rounded border border-zinc-200 bg-white px-2 py-1 text-xs shadow-sm">
            <span className="font-medium text-zinc-900">
              {formatAnalyticsDayLabel(new Date(active.bucketStart))}
            </span>{" "}
            <span className="text-zinc-600">{formatAnalyticsCount(active.value)}</span>
          </div>
        )}
      </div>
      <p className="sr-only">
        {points
          .map(
            (point) =>
              `${formatAnalyticsDayLabel(new Date(point.bucketStart))}: ${formatAnalyticsCount(point.value)}`,
          )
          .join(", ")}
      </p>
    </div>
  );
}
