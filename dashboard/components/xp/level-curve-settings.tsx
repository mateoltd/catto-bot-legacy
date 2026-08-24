"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export interface LevelCurveValue {
  levelCurveType: "FORMULA" | "TABLE";
  formulaBase: number;
  formulaExponent: number;
  formulaOffset: number;
  tableThresholds: number[];
}

interface LevelCurveSettingsProps {
  variant: "text" | "voice";
  value: LevelCurveValue;
  onChange: (change: Partial<LevelCurveValue>) => void;
  earningRate?: number;
}

function epochMultiplier(level: number) {
  if (level <= 5) return 0.95;
  if (level <= 12) return 1.2;
  if (level <= 18) return 1.05;
  if (level <= 28) return 1.35;
  if (level <= 40) return 1.15;
  return 1.5;
}

function levelCost(value: LevelCurveValue, level: number, voice: boolean) {
  const raw =
    value.formulaBase * Math.pow(level, value.formulaExponent) +
    value.formulaOffset * level +
    100;
  return Math.max(0, Math.floor(raw * (voice ? epochMultiplier(level) : 1)));
}

function FormulaEditor({
  value,
  onChange,
  voice,
  earningRate,
}: {
  value: LevelCurveValue;
  onChange: LevelCurveSettingsProps["onChange"];
  voice: boolean;
  earningRate: number;
}) {
  const t = useTranslations("LevelCurve");
  const format = useFormatter();
  type HandleKey = "formulaOffset" | "formulaBase" | "formulaExponent";
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ key: HandleKey; scaleMax: number } | null>(null);
  const [activeHandle, setActiveHandle] = useState<HandleKey | null>(null);
  const [dragScale, setDragScale] = useState<number | null>(null);
  const [plotSize, setPlotSize] = useState({ width: 1000, height: 288 });

  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;
    const updateSize = () => {
      const width = Math.round(element.clientWidth);
      const height = Math.round(element.clientHeight);
      if (width <= 0 || height <= 0) return;
      setPlotSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    };
    updateSize();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const curve = Array.from({ length: 100 }, (_, index) => ({
    level: index + 1,
    cost: levelCost(value, index + 1, voice),
  }));
  const naturalMax = Math.max(...curve.map((point) => point.cost), 100) * 1.12;
  const scaleMax = dragScale ?? naturalMax;
  const chart = {
    left: 86,
    right: 18,
    top: 22,
    bottom: 44,
    width: plotSize.width,
    height: plotSize.height,
  };
  const chartWidth = chart.width - chart.left - chart.right;
  const chartHeight = chart.height - chart.top - chart.bottom;
  const xForLevel = (level: number) =>
    chart.left + ((level - 1) / 99) * chartWidth;
  const yForCost = (cost: number) =>
    chart.top + (1 - Math.min(cost / scaleMax, 1)) * chartHeight;
  const curvePath = curve
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${xForLevel(point.level)} ${yForCost(point.cost)}`,
    )
    .join(" ");
  const handles: Array<{ key: HandleKey; level: number; label: string }> = [
    { key: "formulaOffset", level: 10, label: t("early") },
    { key: "formulaBase", level: 50, label: t("middle") },
    { key: "formulaExponent", level: 90, label: t("late") },
  ];

  const formatActivity = (xp: number, compact = false) => {
    if (earningRate <= 0) return t("unavailable");
    const amount = Math.max(1, Math.ceil(xp / earningRate));
    const formattedAmount = format.number(amount, { maximumFractionDigits: 0 });
    if (!voice) return compact
      ? t("messagesCompact", { amount: formattedAmount })
      : t("qualifyingMessages", { amount: formattedAmount });
    if (amount < 60) return compact
      ? t("activeMinutesCompact", { amount: formattedAmount })
      : t("activeMinutes", { amount: formattedAmount });
    const hours = amount / 60;
    const formattedHours = format.number(hours, { maximumFractionDigits: hours >= 10 ? 0 : 1 });
    return compact
      ? t("voiceHoursCompact", { amount: formattedHours })
      : t("voiceHours", { amount: formattedHours });
  };

  const formatAxisActivity = (xp: number) => {
    if (earningRate <= 0) return t("unavailable");
    const amount = Math.max(1, Math.ceil(xp / earningRate));
    if (!voice) {
      const compact = format.number(amount, {
        notation: "compact",
        maximumFractionDigits: 1,
      });
      return t("axisMessages", { amount: compact });
    }
    if (amount < 60) return t("axisMinutes", { amount });
    const hours = amount / 60;
    return t("axisHours", {
      amount: format.number(hours, { maximumFractionDigits: hours >= 10 ? 0 : 1 }),
    });
  };

  const applyTarget = (key: HandleKey, targetCost: number) => {
    const handle = handles.find((item) => item.key === key);
    if (!handle) return;
    const level = handle.level;
    const multiplier = voice ? epochMultiplier(level) : 1;
    const rawTarget = Math.max(100, targetCost / multiplier);
    if (key === "formulaOffset") {
      const formulaOffset = Math.max(
        0,
        (rawTarget -
          value.formulaBase * Math.pow(level, value.formulaExponent) -
          100) /
          level,
      );
      onChange({ formulaOffset: Number(formulaOffset.toFixed(2)) });
    } else if (key === "formulaBase") {
      const formulaBase = Math.max(
        0,
        (rawTarget - value.formulaOffset * level - 100) /
          Math.pow(level, value.formulaExponent),
      );
      onChange({ formulaBase: Number(formulaBase.toFixed(3)) });
    } else {
      const base = Math.max(value.formulaBase, 0.001);
      const exponentialPart = Math.max(
        rawTarget - value.formulaOffset * level - 100,
        base,
      );
      const formulaExponent = Math.min(
        6,
        Math.max(0.1, Math.log(exponentialPart / base) / Math.log(level)),
      );
      onChange({ formulaExponent: Number(formulaExponent.toFixed(3)) });
    }
  };

  const updateFromPointer = (
    key: HandleKey,
    clientY: number,
    lockedMax: number,
  ) => {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const pointerY = ((clientY - bounds.top) / bounds.height) * chart.height;
    const position = Math.min(
      1,
      Math.max(0, (pointerY - chart.top) / chartHeight),
    );
    applyTarget(key, (1 - position) * lockedMax);
  };

  const adjustWithKeyboard = (key: HandleKey, direction: number) => {
    const handle = handles.find((item) => item.key === key);
    if (!handle) return;
    const current = levelCost(value, handle.level, voice);
    applyTarget(key, current * (direction > 0 ? 1.08 : 0.92));
  };

  return (
    <div>
      <div className="flex flex-col justify-between gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center lg:px-6">
        <p className="text-sm text-foreground">
          {t("dragHelp")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("verticalScale", {
            activity: voice ? t("voiceTimePerLevel") : t("messagesPerLevel"),
          })}
        </p>
      </div>
      <div className="h-[320px] overflow-hidden px-3 py-4 sm:px-5">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className="h-full w-full touch-none overflow-hidden text-foreground"
          role="group"
          aria-label={t("interactiveCurve")}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = chart.top + (1 - fraction) * chartHeight;
            return (
              <g key={fraction}>
                <line
                  x1={chart.left}
                  x2={chart.width - chart.right}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  opacity="0.14"
                />
                <text
                  x={chart.left - 12}
                  y={y + 4}
                  textAnchor="end"
                  fill="currentColor"
                  opacity="0.55"
                  fontSize="10"
                >
                  {fraction === 0
                    ? "0"
                    : formatAxisActivity(scaleMax * fraction)}
                </text>
              </g>
            );
          })}
          {[1, 25, 50, 75, 100].map((level) => (
            <g key={level}>
              <line
                x1={xForLevel(level)}
                x2={xForLevel(level)}
                y1={chart.top}
                y2={chart.top + chartHeight}
                stroke="currentColor"
                opacity="0.08"
              />
              <text
                x={xForLevel(level)}
                y={chart.height - 22}
                textAnchor={
                  level === 1 ? "start" : level === 100 ? "end" : "middle"
                }
                fill="currentColor"
                opacity="0.55"
                fontSize="10"
              >
                {t("level", { level })}
              </text>
            </g>
          ))}
          <path
            d={`${curvePath} L ${xForLevel(100)} ${chart.top + chartHeight} L ${xForLevel(1)} ${chart.top + chartHeight} Z`}
            fill="currentColor"
            opacity="0.035"
          />
          <path
            d={curvePath}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          {handles.map((handle) => {
            const cost = levelCost(value, handle.level, voice);
            const x = xForLevel(handle.level);
            const y = yForCost(cost);
            const active = activeHandle === handle.key;
            return (
              <g key={handle.key}>
                <line
                  x1={x}
                  x2={x}
                  y1={y}
                  y2={chart.top + chartHeight}
                  stroke="currentColor"
                  opacity="0.22"
                  strokeDasharray="4 5"
                />
                <rect
                  x={x - (active ? 9 : 7)}
                  y={y - (active ? 9 : 7)}
                  width={active ? 18 : 14}
                  height={active ? 18 : 14}
                  fill="var(--background)"
                  stroke="currentColor"
                  strokeWidth="2"
                  role="slider"
                  tabIndex={0}
                  aria-label={t("progressionHandle", { phase: handle.label })}
                  aria-valuemin={0}
                  aria-valuemax={Math.round(scaleMax)}
                  aria-valuenow={cost}
                  aria-valuetext={formatActivity(cost)}
                  className="cursor-ns-resize outline-none"
                  onPointerDown={(event) => {
                    const nextDrag = { key: handle.key, scaleMax };
                    dragRef.current = nextDrag;
                    setActiveHandle(handle.key);
                    setDragScale(scaleMax);
                    event.currentTarget.setPointerCapture(event.pointerId);
                    updateFromPointer(
                      handle.key,
                      event.clientY,
                      nextDrag.scaleMax,
                    );
                  }}
                  onPointerMove={(event) => {
                    const drag = dragRef.current;
                    if (drag?.key === handle.key)
                      updateFromPointer(
                        handle.key,
                        event.clientY,
                        drag.scaleMax,
                      );
                  }}
                  onPointerUp={(event) => {
                    dragRef.current = null;
                    setActiveHandle(null);
                    setDragScale(null);
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
                      event.preventDefault();
                      adjustWithKeyboard(handle.key, 1);
                    }
                    if (
                      event.key === "ArrowDown" ||
                      event.key === "ArrowLeft"
                    ) {
                      event.preventDefault();
                      adjustWithKeyboard(handle.key, -1);
                    }
                  }}
                />
                <text
                  x={x}
                  y={Math.max(chart.top + 12, y - 15)}
                  textAnchor="middle"
                  fill="currentColor"
                fontSize="10"
                  fontWeight="600"
                >
                  {handle.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="grid border-t border-border sm:grid-cols-3">
        {handles.map((handle, index) => {
          const cost = levelCost(value, handle.level, voice);
          return (
            <div
              key={handle.key}
              className={cn(
                "px-5 py-3",
                index > 0 && "border-t border-border sm:border-l sm:border-t-0",
              )}
            >
              <span className="text-xs text-muted-foreground">
                {t("phaseLevels", { phase: handle.label })}
              </span>
              <strong className="ml-2 text-xs font-medium text-foreground">
                {t("activityPerLevel", { activity: formatActivity(cost) })}
              </strong>
            </div>
          );
        })}
      </div>
      <details className="border-t border-border px-5 py-3 text-xs text-muted-foreground lg:px-6">
        <summary className="cursor-pointer text-xs text-foreground">
          {t("exactFormulaSettings")}
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(
            [
              ["formulaBase", t("curveWeight"), 0.1],
              ["formulaExponent", t("exponent"), 0.1],
              ["formulaOffset", t("linearOffset"), 1],
            ] as const
          ).map(([key, label, step]) => (
            <label
              key={key}
              className="flex items-center justify-between gap-3 border border-border px-3 py-2"
            >
              <span>{label}</span>
              <input
                type="number"
                min="0"
                step={step}
                value={value[key]}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next))
                    onChange({ [key]: Math.max(0, next) });
                }}
                className="w-20 bg-transparent text-right font-mono text-foreground outline-none"
                aria-label={label}
              />
            </label>
          ))}
        </div>
        <p className="mt-3">
          {t.rich("formulaDescription", {
            sup: (chunks) => <sup>{chunks}</sup>,
          })}
          {voice && ` ${t("voiceMultipliersIncluded")}`}
        </p>
      </details>
    </div>
  );
}

function ThresholdEditor({
  thresholds,
  onChange,
}: {
  thresholds: number[];
  onChange: (thresholds: number[]) => void;
}) {
  const t = useTranslations("LevelCurve");
  const [draft, setDraft] = useState("");
  const isAscending = thresholds.every(
    (threshold, index) =>
      index === 0 || threshold > (thresholds[index - 1] ?? 0),
  );
  const next = Number(draft);
  const canAdd = Number.isInteger(next) && next > (thresholds.at(-1) ?? 0);

  const addThreshold = () => {
    if (!canAdd) return;
    onChange([...thresholds, next]);
    setDraft("");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="border border-border bg-background/30">
        <div className="grid grid-cols-[54px_minmax(0,1fr)_44px] border-b border-border bg-muted/30 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>{t("levelHeading")}</span>
          <span>{t("totalXpRequired")}</span>
          <span className="sr-only">{t("remove")}</span>
        </div>
        {thresholds.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-foreground">{t("noThresholds")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("addFirstLevelHelp")}
            </p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {thresholds.map((threshold, index) => (
              <div
                key={index}
                className="grid grid-cols-[54px_minmax(0,1fr)_44px] items-center border-b border-border/70 px-3 last:border-b-0"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  L{index + 1}
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={threshold}
                  onChange={(event) => {
                    const updated = [...thresholds];
                    updated[index] =
                      Number.parseInt(event.target.value, 10) || 0;
                    onChange(updated);
                  }}
                  className="h-10 min-w-0 border-x border-border bg-transparent px-3 font-mono text-sm text-foreground outline-none focus:bg-muted/40"
                  aria-label={t("levelXpThreshold", { level: index + 1 })}
                />
                <button
                  type="button"
                  className="grid h-10 place-items-center text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  onClick={() =>
                    onChange(
                      thresholds.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  aria-label={t("removeLevel", { level: index + 1 })}
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="h-fit border border-border bg-background/30">
        <div className="border-b border-border px-3 py-2.5">
          <p className="text-sm font-medium text-foreground">{t("addNextLevel")}</p>
          <p className="text-xs text-muted-foreground">
            {t("thresholdsMustIncrease")}
          </p>
        </div>
        <div className="p-3">
          <label
            className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
            htmlFor="next-level-threshold"
          >
            {t("levelTotalXp", { level: thresholds.length + 1 })}
          </label>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_40px] border border-border">
            <input
              id="next-level-threshold"
              type="number"
              min={(thresholds.at(-1) ?? 0) + 1}
              step="1"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addThreshold();
                }
              }}
              className="h-10 min-w-0 bg-transparent px-3 font-mono text-sm text-foreground outline-none focus:bg-muted/40"
              placeholder={String((thresholds.at(-1) ?? 0) + 100)}
            />
            <button
              type="button"
              onClick={addThreshold}
              disabled={!canAdd}
              className="grid place-items-center border-l border-border text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={t("addLevel", { level: thresholds.length + 1 })}
            >
              <Plus aria-hidden="true" className="size-4" />
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("levelsConfigured", { count: thresholds.length })}
          </p>
        </div>
      </div>

      {!isAscending && (
        <p
          role="alert"
          className="border border-destructive/50 px-3 py-2 text-xs text-destructive lg:col-span-2"
        >
          {t("thresholdOrderError")}
        </p>
      )}
    </div>
  );
}

export function LevelCurveSettings({
  variant,
  value,
  onChange,
  earningRate = variant === "voice" ? 5 : 15,
}: LevelCurveSettingsProps) {
  const t = useTranslations("LevelCurve");
  return (
    <section
      className="border border-border bg-card"
      aria-label={t("designer")}
    >
      <div className="flex flex-col justify-between gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-end lg:px-6">
        <div>
          <h3 className="text-xl font-semibold text-foreground">
            {t("title")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <div
          className="flex items-center gap-5"
          role="radiogroup"
          aria-label={t("curveType")}
        >
          {(
            [
              ["FORMULA", t("guidedCurve")],
              ["TABLE", t("exactLevels")],
            ] as const
          ).map(([mode, label]) => {
            const active = value.levelCurveType === mode;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ levelCurveType: mode })}
                className={cn(
                  "border-b py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {value.levelCurveType === "FORMULA" ? (
        <FormulaEditor
          value={value}
          onChange={onChange}
          voice={variant === "voice"}
          earningRate={earningRate}
        />
      ) : (
        <div className="p-5 lg:p-6">
          <ThresholdEditor
            thresholds={value.tableThresholds}
            onChange={(tableThresholds) => onChange({ tableThresholds })}
          />
        </div>
      )}
    </section>
  );
}
