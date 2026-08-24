"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

interface TextAwardValue {
  cooldownSec: number;
  minMessageLength: number;
  xpMode: "RANDOM" | "FIXED";
  minXp: number;
  maxXp: number;
  fixedXp: number;
  maxXpPerMinute: number | null;
}

interface VoiceAwardValue {
  xpPerMinute: number;
  minSessionMinutes: number;
  xpMode: "PER_MINUTE" | "PER_SESSION";
}

type XPAwardSettingsProps =
  | {
      kind: "text";
      value: TextAwardValue;
      onChange: (change: Partial<TextAwardValue>) => void;
    }
  | {
      kind: "voice";
      value: VoiceAwardValue;
      onChange: (change: Partial<VoiceAwardValue>) => void;
    };

interface RailProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min: number;
  max: number;
  labels: string[];
  startLabel: string;
  endLabel: string;
  step?: number;
}

const COOLDOWN_STOPS = [0, 15, 30, 60, 90, 120, 300, 600, 1800, 3600] as const;
const MESSAGE_LENGTH_STOPS = [
  0, 5, 10, 20, 35, 50, 100, 250, 500, 1000, 2000,
] as const;
const SESSION_LENGTH_STOPS = [0, 1, 2, 5, 10, 15, 20, 30, 45, 60] as const;
const VOICE_XP_STOPS = [
  0, 1, 2, 5, 10, 15, 20, 25, 50, 100, 250, 500, 1000,
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function Rail({
  value,
  onValueChange,
  min,
  max,
  labels,
  startLabel,
  endLabel,
  step = 1,
}: RailProps) {
  return (
    <div className="pt-2">
      <SliderPrimitive.Root
        className="relative flex h-8 w-full touch-none select-none items-center"
        value={value}
        onValueChange={onValueChange}
        min={min}
        max={max}
        step={step}
      >
        <SliderPrimitive.Track className="relative h-px w-full grow bg-border">
          <SliderPrimitive.Range className="absolute h-[3px] -translate-y-px bg-foreground" />
          <span
            className="absolute inset-x-0 -top-1.5 flex justify-between"
            aria-hidden="true"
          >
            {Array.from({ length: 9 }, (_, index) => (
              <span key={index} className="h-3 w-px bg-border" />
            ))}
          </span>
        </SliderPrimitive.Track>
        {value.map((_, index) => (
          <SliderPrimitive.Thumb
            key={index}
            aria-label={labels[index]}
            className="block h-6 w-2 border border-foreground bg-background outline-none transition-[width,background-color] focus-visible:w-3 focus-visible:bg-foreground"
          />
        ))}
      </SliderPrimitive.Root>
      <div className="flex justify-between font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </div>
  );
}

function DiscreteRail({
  value,
  stops,
  onChange,
  label,
  startLabel,
  endLabel,
}: {
  value: number;
  stops: readonly number[];
  onChange: (value: number) => void;
  label: string;
  startLabel: string;
  endLabel: string;
}) {
  const closestIndex = stops.reduce(
    (closest, stop, index) =>
      Math.abs(stop - value) < Math.abs((stops[closest] ?? 0) - value)
        ? index
        : closest,
    0,
  );
  return (
    <Rail
      value={[closestIndex]}
      onValueChange={([index]) => onChange(stops[index] ?? stops[0] ?? 0)}
      min={0}
      max={stops.length - 1}
      labels={[label]}
      startLabel={startLabel}
      endLabel={endLabel}
    />
  );
}

function ExactValue({
  label,
  value,
  onChange,
  unit,
  min = 0,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="inline-flex items-baseline gap-1.5">
      <span className="sr-only">{label}</span>
      <input
        type="number"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next))
            onChange(clamp(next, min, max ?? Number.POSITIVE_INFINITY));
        }}
        className="h-9 w-16 border border-border bg-background px-2 text-right font-mono text-sm font-semibold tabular-nums text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {unit}
      </span>
    </label>
  );
}

function ModeSwitch<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-4" aria-label={label} role="group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "border-b py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
            value === option.value
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function FlowStage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-w-0 px-5 py-6 lg:px-6">
      <h4 className="mb-6 text-sm font-semibold text-foreground">{title}</h4>
      {children}
    </div>
  );
}

function AwardTimeline({
  markers,
  startLabel,
  endLabel,
  ariaLabel,
}: {
  markers: { position: number; emphasis?: "line" | "point" }[];
  startLabel: string;
  endLabel: string;
  ariaLabel: string;
}) {
  return (
    <div className="relative my-6 h-8" aria-label={ariaLabel}>
      <div className="absolute inset-x-0 top-3 h-px bg-border" />
      {markers.map((marker, index) => (
        <span
          key={index}
          className={cn(
            "absolute -translate-x-1/2 bg-foreground",
            marker.emphasis === "point"
              ? "top-2 h-2 w-2 border border-foreground bg-background"
              : "top-1.5 h-3 w-px",
          )}
          style={{ left: `${clamp(marker.position, 0, 100)}%` }}
          aria-hidden="true"
        />
      ))}
      <span className="absolute bottom-0 left-0 font-mono text-[8px] uppercase text-muted-foreground">
        {startLabel}
      </span>
      <span className="absolute bottom-0 right-0 font-mono text-[8px] uppercase text-muted-foreground">
        {endLabel}
      </span>
    </div>
  );
}

function AwardHeader({
  rule,
  estimate,
  estimateCaption,
}: {
  rule: React.ReactNode;
  estimate: React.ReactNode;
  estimateCaption: string;
}) {
  const t = useTranslations("XpAwards");
  return (
    <div className="grid border-b border-border lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="px-5 py-5 lg:px-6">
        <h3 className="text-lg font-semibold text-foreground">{t("title")}</h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground [&_strong]:text-foreground">
          {rule}
        </p>
      </div>
      <div className="border-t border-border px-5 py-5 lg:border-l lg:border-t-0">
        <p className="text-xs text-muted-foreground">{estimateCaption}</p>
        <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
          {estimate}
        </p>
      </div>
    </div>
  );
}

function AwardEngine({
  ariaLabel,
  rule,
  estimate,
  estimateCaption,
  children,
  footer,
  alert,
}: {
  ariaLabel: string;
  rule: React.ReactNode;
  estimate: React.ReactNode;
  estimateCaption: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  alert?: React.ReactNode;
}) {
  return (
    <section className="border border-border bg-card" aria-label={ariaLabel}>
      <AwardHeader
        rule={rule}
        estimate={estimate}
        estimateCaption={estimateCaption}
      />
      <div className="grid divide-y divide-border lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {children}
      </div>
      {footer}
      {alert}
    </section>
  );
}

function NumericAwardStage({
  title,
  fieldLabel,
  inputLabel,
  railLabel,
  value,
  onChange,
  unit,
  max,
  step,
  stops,
  startLabel,
  endLabel,
  children,
  description,
}: {
  title: string;
  fieldLabel: string;
  inputLabel: string;
  railLabel: string;
  value: number;
  onChange: (value: number) => void;
  unit: string;
  max: number;
  step?: number;
  stops: readonly number[];
  startLabel: string;
  endLabel: string;
  children?: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <FlowStage title={title}>
      <div className="flex items-end justify-between gap-4">
        <span className="text-sm text-muted-foreground">{fieldLabel}</span>
        <ExactValue
          label={inputLabel}
          value={value}
          onChange={onChange}
          unit={unit}
          max={max}
          step={step}
        />
      </div>
      {children}
      <DiscreteRail
        value={value}
        stops={stops}
        onChange={onChange}
        label={railLabel}
        startLabel={startLabel}
        endLabel={endLabel}
      />
      {description && (
        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      )}
    </FlowStage>
  );
}

function TextAwardSettings({
  value,
  onChange,
}: {
  value: TextAwardValue;
  onChange: (change: Partial<TextAwardValue>) => void;
}) {
  const t = useTranslations("XpAwards");
  const formatDuration = (seconds: number) => {
    if (seconds === 0) return t("noWait");
    if (seconds < 60) return t("seconds", { count: seconds });
    if (seconds % 60 === 0) return t("minutes", { count: seconds / 60 });
    return t("minutesSecondsShort", {
      minutes: Math.floor(seconds / 60),
      seconds: seconds % 60,
    });
  };
  const awardLabel =
    value.xpMode === "RANDOM"
      ? `${value.minXp}–${value.maxXp} XP`
      : `${value.fixedXp} XP`;
  const awardMoments =
    value.cooldownSec === 0
      ? null
      : Math.max(1, Math.floor(600 / value.cooldownSec));
  const projectedMinimum =
    awardMoments === null
      ? null
      : awardMoments *
        (value.xpMode === "RANDOM" ? value.minXp : value.fixedXp);
  const projectedMaximum =
    awardMoments === null
      ? null
      : awardMoments *
        (value.xpMode === "RANDOM" ? value.maxXp : value.fixedXp);
  const payoutMax = Math.max(
    50,
    Math.ceil(Math.max(value.minXp, value.maxXp, value.fixedXp) / 10) * 10,
  );
  const timelineMoments =
    value.cooldownSec === 0
      ? 16
      : clamp(Math.floor(600 / value.cooldownSec) + 1, 2, 16);
  return (
    <AwardEngine
      ariaLabel={t("textEngine")}
      rule={
        t.rich("textRule", {
          length: value.minMessageLength || t("anyNumber"),
          award: awardLabel,
          wait: formatDuration(value.cooldownSec),
          strong: (chunks) => <strong>{chunks}</strong>,
        })
      }
      estimate={
        projectedMinimum === null
          ? t("noCooldown")
          : `${projectedMinimum === projectedMaximum ? projectedMinimum : `${projectedMinimum}–${projectedMaximum}`} XP`
      }
      estimateCaption={
        projectedMinimum === null
          ? t("awardAvailability")
          : t("estimatedTextMaximum")
      }
      footer={
        <div className="flex flex-col justify-between gap-3 border-t border-border px-5 py-3 sm:flex-row sm:items-center lg:px-6">
          <div>
            <span className="text-sm font-medium text-foreground">
              {t("burstGuard")}
            </span>
            <span className="ml-2 text-xs text-muted-foreground">
              {t("burstGuardDescription")}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <ModeSwitch
              label={t("burstGuard")}
              value={value.maxXpPerMinute === null ? "OFF" : "ON"}
              options={[
                { value: "OFF", label: t("uncapped") },
                { value: "ON", label: t("limit") },
              ]}
              onChange={(state) =>
                onChange({
                  maxXpPerMinute:
                    state === "OFF"
                      ? null
                      : Math.max(value.maxXp, value.fixedXp, 20),
                })
              }
            />
            {value.maxXpPerMinute !== null && (
              <ExactValue
                label={t("minuteCap")}
                value={value.maxXpPerMinute}
                onChange={(maxXpPerMinute) => onChange({ maxXpPerMinute })}
                unit="XP/min"
              />
            )}
          </div>
        </div>
      }
      alert={
        value.xpMode === "RANDOM" && value.minXp > value.maxXp ? (
          <p
            role="alert"
            className="border-t border-destructive/50 px-5 py-2 text-xs text-destructive"
          >
            {t("minimumHigherThanMaximum")}
          </p>
        ) : undefined
      }
    >
      <NumericAwardStage
        title={t("messageEligibility")}
        fieldLabel={t("minimumMessage")}
        inputLabel={t("messageLength")}
        railLabel={t("minimumMessageLength")}
        value={value.minMessageLength}
        onChange={(minMessageLength) => onChange({ minMessageLength })}
        unit={t("charactersShort")}
        max={2000}
        stops={MESSAGE_LENGTH_STOPS}
        startLabel={t("anything")}
        endLabel={t("longForm")}
        description={
          value.minMessageLength === 0
            ? t("everyMessagePasses")
            : value.minMessageLength <= 10
              ? t("filtersShortReplies")
              : value.minMessageLength <= 50
                ? t("rewardsSubstantiveMessages")
                : t("onlyLongerMessages")
        }
      />
      <NumericAwardStage
        title={t("awardFrequency")}
        fieldLabel={t("timeBetweenAwards")}
        inputLabel={t("cooldown")}
        railLabel={t("awardCooldown")}
        value={value.cooldownSec}
        onChange={(cooldownSec) => onChange({ cooldownSec })}
        unit={t("secondsShort")}
        max={3600}
        step={5}
        stops={COOLDOWN_STOPS}
        startLabel={t("immediate")}
        endLabel={t("oneHour")}
      >
        <AwardTimeline
          markers={Array.from({ length: timelineMoments }, (_, index) => ({
            position: (index / Math.max(timelineMoments - 1, 1)) * 100,
          }))}
          startLabel={t("now")}
          endLabel={t("tenMinutesShort")}
          ariaLabel={t("possibleAwardMoments", { count: timelineMoments })}
        />
      </NumericAwardStage>
      <FlowStage title={t("xpAmount")}>
        <div className="flex items-center justify-between gap-4">
          <ModeSwitch
            label={t("payoutStyle")}
            value={value.xpMode}
            options={[
              { value: "RANDOM", label: t("variable") },
              { value: "FIXED", label: t("exact") },
            ]}
            onChange={(xpMode) => onChange({ xpMode })}
          />
          {value.xpMode === "RANDOM" ? (
            <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
              {value.minXp}–{value.maxXp}
            </span>
          ) : (
            <ExactValue
              label={t("fixedXp")}
              value={value.fixedXp}
              onChange={(fixedXp) => onChange({ fixedXp })}
              unit="XP"
            />
          )}
        </div>
        {value.xpMode === "RANDOM" ? (
          <Rail
            value={[
              Math.min(value.minXp, value.maxXp),
              Math.max(value.minXp, value.maxXp),
            ]}
            onValueChange={([minXp, maxXp]) => onChange({ minXp, maxXp })}
            min={0}
            max={payoutMax}
            labels={[t("minimumXp"), t("maximumXp")]}
            startLabel="0 XP"
            endLabel={`${payoutMax} XP`}
          />
        ) : (
          <Rail
            value={[value.fixedXp]}
            onValueChange={([fixedXp]) => onChange({ fixedXp })}
            min={0}
            max={payoutMax}
            labels={[t("fixedXpAmount")]}
            startLabel="0 XP"
            endLabel={`${payoutMax} XP`}
          />
        )}
      </FlowStage>
    </AwardEngine>
  );
}

function VoiceAwardSettings({
  value,
  onChange,
}: {
  value: VoiceAwardValue;
  onChange: (change: Partial<VoiceAwardValue>) => void;
}) {
  const t = useTranslations("XpAwards");
  const exampleMinutes = Math.max(30, value.minSessionMinutes);
  const gate = clamp((value.minSessionMinutes / 60) * 100, 0, 100);
  const timelineMarkers =
    value.xpMode === "PER_MINUTE"
      ? [
          { position: gate },
          ...Array.from({ length: 7 }, (_, index) => ({
            position: gate + ((100 - gate) * index) / 6,
            emphasis: "point" as const,
          })),
        ]
      : [{ position: gate }, { position: 100 }];
  return (
    <AwardEngine
      ariaLabel={t("voiceEngine")}
      rule={
        t.rich("voiceRule", {
          duration: value.minSessionMinutes
            ? t("minutes", { count: value.minSessionMinutes })
            : t("noMinimum"),
          rate: t("xpPerMinute", { count: value.xpPerMinute }),
          timing:
            value.xpMode === "PER_MINUTE"
              ? t("asTheyParticipate")
              : t("whenTheyLeave"),
          strong: (chunks) => <strong>{chunks}</strong>,
        })
      }
      estimate={`${exampleMinutes * value.xpPerMinute} XP`}
      estimateCaption={t("estimatedVoiceReward", { minutes: exampleMinutes })}
    >
      <NumericAwardStage
        title={t("sessionEligibility")}
        fieldLabel={t("sessionGate")}
        inputLabel={t("sessionDuration")}
        railLabel={t("minimumVoiceSession")}
        value={value.minSessionMinutes}
        onChange={(minSessionMinutes) => onChange({ minSessionMinutes })}
        unit="min"
        max={60}
        stops={SESSION_LENGTH_STOPS}
        startLabel={t("join")}
        endLabel={t("sixtyMinutesShort")}
        description={
          value.minSessionMinutes === 0
            ? t("participationImmediate")
            : t("qualityGate", { count: value.minSessionMinutes })
        }
      />
      <FlowStage title={t("creditTiming")}>
        <ModeSwitch
          label={t("creditTiming")}
          value={value.xpMode}
          options={[
            { value: "PER_MINUTE", label: t("whileActive") },
            { value: "PER_SESSION", label: t("onExit") },
          ]}
          onChange={(xpMode) => onChange({ xpMode })}
        />
        <AwardTimeline
          markers={timelineMarkers}
          startLabel={t("join")}
          endLabel={t("exit")}
          ariaLabel={
            value.xpMode === "PER_MINUTE"
              ? t("voiceAccrues")
              : t("voiceCreditedOnEnd")
          }
        />
        <p className="text-xs leading-5 text-muted-foreground">
          {value.xpMode === "PER_MINUTE"
            ? t("frequentFeedback")
            : t("singlePayout")}
        </p>
      </FlowStage>
      <NumericAwardStage
        title={t("xpAmount")}
        fieldLabel={t("earningRate")}
        inputLabel={t("earningRate")}
        railLabel={t("voiceXpPerMinute")}
        value={value.xpPerMinute}
        onChange={(xpPerMinute) => onChange({ xpPerMinute })}
        unit="XP/min"
        max={1000}
        stops={VOICE_XP_STOPS}
        startLabel="0 XP"
        endLabel="1,000 XP"
        description={t("sixtyMinuteWorth", { xp: value.xpPerMinute * 60 })}
      />
    </AwardEngine>
  );
}

export function XPAwardSettings(props: XPAwardSettingsProps) {
  return props.kind === "text" ? (
    <TextAwardSettings value={props.value} onChange={props.onChange} />
  ) : (
    <VoiceAwardSettings value={props.value} onChange={props.onChange} />
  );
}
