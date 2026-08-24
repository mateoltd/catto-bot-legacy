"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";

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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatSeconds(seconds: number) {
  if (seconds === 0) return "no wait";
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds % 60 === 0)
    return `${seconds / 60} ${seconds === 60 ? "minute" : "minutes"}`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
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

function TextAwardTimeline({ cooldownSec }: { cooldownSec: number }) {
  const awardMoments =
    cooldownSec === 0 ? 16 : clamp(Math.floor(600 / cooldownSec) + 1, 2, 16);
  return (
    <div
      className="relative my-6 h-8"
      aria-label={`${awardMoments} possible award moments in ten minutes`}
    >
      <div className="absolute inset-x-0 top-3 h-px bg-border" />
      {Array.from({ length: awardMoments }, (_, index) => (
        <span
          key={index}
          className="absolute top-1.5 h-3 w-px bg-foreground"
          style={{ left: `${(index / Math.max(awardMoments - 1, 1)) * 100}%` }}
          aria-hidden="true"
        />
      ))}
      <span className="absolute bottom-0 left-0 font-mono text-[8px] uppercase text-muted-foreground">
        Now
      </span>
      <span className="absolute bottom-0 right-0 font-mono text-[8px] uppercase text-muted-foreground">
        10 min
      </span>
    </div>
  );
}

function VoiceCreditTimeline({
  mode,
  threshold,
}: {
  mode: VoiceAwardValue["xpMode"];
  threshold: number;
}) {
  const gate = clamp((threshold / 60) * 100, 0, 100);
  return (
    <div
      className="relative my-6 h-9"
      aria-label={
        mode === "PER_MINUTE"
          ? "XP accrues throughout the session"
          : "XP is credited when the session ends"
      }
    >
      <div className="absolute inset-x-0 top-3 h-px bg-border" />
      <div
        className="absolute top-1 h-5 w-px bg-foreground"
        style={{ left: `${gate}%` }}
      />
      {mode === "PER_MINUTE" ? (
        Array.from({ length: 7 }, (_, index) => (
          <span
            key={index}
            className="absolute top-2 h-2 w-2 -translate-x-1/2 border border-foreground bg-background"
            style={{ left: `${gate + ((100 - gate) * index) / 6}%` }}
            aria-hidden="true"
          />
        ))
      ) : (
        <span
          className="absolute right-0 top-1 h-5 w-2 bg-foreground"
          aria-hidden="true"
        />
      )}
      <span className="absolute bottom-0 left-0 font-mono text-[8px] uppercase text-muted-foreground">
        Join
      </span>
      <span
        className="absolute bottom-0 font-mono text-[8px] uppercase text-foreground"
        style={{ left: `${gate}%`, transform: "translateX(-50%)" }}
      >
        Eligible
      </span>
      <span className="absolute bottom-0 right-0 font-mono text-[8px] uppercase text-muted-foreground">
        Exit
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
  return (
    <div className="grid border-b border-border lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="px-5 py-5 lg:px-6">
        <h3 className="text-lg font-semibold text-foreground">XP awards</h3>
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

function TextAwardSettings({
  value,
  onChange,
}: {
  value: TextAwardValue;
  onChange: (change: Partial<TextAwardValue>) => void;
}) {
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
  const lengthStops = [
    0, 5, 10, 20, 35, 50, 100, 250, 500, 1000, 2000,
  ] as const;
  return (
    <section
      className="border border-border bg-card"
      aria-label="Text XP award engine"
    >
      <AwardHeader
        rule={
          <>
            A message with{" "}
            <strong>
              {value.minMessageLength || "any number of"} characters
            </strong>{" "}
            can earn <strong>{awardLabel}</strong>, then waits{" "}
            <strong>{formatSeconds(value.cooldownSec)}</strong> before earning
            again.
          </>
        }
        estimate={
          projectedMinimum === null
            ? "No cooldown"
            : `${projectedMinimum === projectedMaximum ? projectedMinimum : `${projectedMinimum}–${projectedMaximum}`} XP`
        }
        estimateCaption={
          projectedMinimum === null
            ? "Award availability"
            : "Estimated maximum in 10 active minutes"
        }
      />
      <div className="grid divide-y divide-border lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <FlowStage title="Message eligibility">
          <div className="flex items-end justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              Minimum message
            </span>
            <ExactValue
              label="Message length"
              value={value.minMessageLength}
              onChange={(minMessageLength) => onChange({ minMessageLength })}
              unit="chars"
              max={2000}
            />
          </div>
          <DiscreteRail
            value={value.minMessageLength}
            stops={lengthStops}
            onChange={(minMessageLength) => onChange({ minMessageLength })}
            label="Minimum message length"
            startLabel="Anything"
            endLabel="Long-form"
          />
          <p className="mt-5 text-xs leading-5 text-muted-foreground">
            {value.minMessageLength === 0
              ? "Every message passes this gate."
              : value.minMessageLength <= 10
                ? "Filters out reactions and very short replies."
                : value.minMessageLength <= 50
                  ? "Rewards conversational, substantive messages."
                  : "Only longer contributions pass this gate."}
          </p>
        </FlowStage>
        <FlowStage title="Award frequency">
          <div className="flex items-end justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              Time between awards
            </span>
            <ExactValue
              label="Cooldown"
              value={value.cooldownSec}
              onChange={(cooldownSec) => onChange({ cooldownSec })}
              unit="sec"
              max={3600}
              step={5}
            />
          </div>
          <TextAwardTimeline cooldownSec={value.cooldownSec} />
          <DiscreteRail
            value={value.cooldownSec}
            stops={COOLDOWN_STOPS}
            onChange={(cooldownSec) => onChange({ cooldownSec })}
            label="Award cooldown"
            startLabel="Immediate"
            endLabel="1 hour"
          />
        </FlowStage>
        <FlowStage title="XP amount">
          <div className="flex items-center justify-between gap-4">
            <ModeSwitch
              label="Payout style"
              value={value.xpMode}
              options={[
                { value: "RANDOM", label: "Variable" },
                { value: "FIXED", label: "Exact" },
              ]}
              onChange={(xpMode) => onChange({ xpMode })}
            />
            {value.xpMode === "RANDOM" ? (
              <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                {value.minXp}–{value.maxXp}
              </span>
            ) : (
              <ExactValue
                label="Fixed XP"
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
              labels={["Minimum XP", "Maximum XP"]}
              startLabel="0 XP"
              endLabel={`${payoutMax} XP`}
            />
          ) : (
            <Rail
              value={[value.fixedXp]}
              onValueChange={([fixedXp]) => onChange({ fixedXp })}
              min={0}
              max={payoutMax}
              labels={["Fixed XP amount"]}
              startLabel="0 XP"
              endLabel={`${payoutMax} XP`}
            />
          )}
        </FlowStage>
      </div>
      <div className="flex flex-col justify-between gap-3 border-t border-border px-5 py-3 sm:flex-row sm:items-center lg:px-6">
        <div>
          <span className="text-sm font-medium text-foreground">
            Burst guard
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            Optional ceiling for unusually fast activity.
          </span>
        </div>
        <div className="flex items-center gap-4">
          <ModeSwitch
            label="Burst guard"
            value={value.maxXpPerMinute === null ? "OFF" : "ON"}
            options={[
              { value: "OFF", label: "Uncapped" },
              { value: "ON", label: "Limit" },
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
              label="Minute cap"
              value={value.maxXpPerMinute}
              onChange={(maxXpPerMinute) => onChange({ maxXpPerMinute })}
              unit="XP/min"
            />
          )}
        </div>
      </div>
      {value.xpMode === "RANDOM" && value.minXp > value.maxXp && (
        <p
          role="alert"
          className="border-t border-destructive/50 px-5 py-2 text-xs text-destructive"
        >
          Minimum XP is higher than maximum XP.
        </p>
      )}
    </section>
  );
}

function VoiceAwardSettings({
  value,
  onChange,
}: {
  value: VoiceAwardValue;
  onChange: (change: Partial<VoiceAwardValue>) => void;
}) {
  const exampleMinutes = Math.max(30, value.minSessionMinutes);
  const payoutMax = Math.max(20, Math.ceil(value.xpPerMinute / 10) * 10);
  return (
    <section
      className="border border-border bg-card"
      aria-label="Voice XP award engine"
    >
      <AwardHeader
        rule={
          <>
            After{" "}
            <strong>
              {value.minSessionMinutes || "no minimum"}{" "}
              {value.minSessionMinutes === 1 ? "minute" : "minutes"}
            </strong>{" "}
            in voice, members earn{" "}
            <strong>{value.xpPerMinute} XP per minute</strong>, credited{" "}
            <strong>
              {value.xpMode === "PER_MINUTE"
                ? "as they participate"
                : "when they leave"}
            </strong>
            .
          </>
        }
        estimate={`${exampleMinutes * value.xpPerMinute} XP`}
        estimateCaption={`Estimated reward for a ${exampleMinutes}-minute session`}
      />
      <div className="grid divide-y divide-border lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <FlowStage title="Session eligibility">
          <div className="flex items-end justify-between gap-4">
            <span className="text-sm text-muted-foreground">Session gate</span>
            <ExactValue
              label="Session duration"
              value={value.minSessionMinutes}
              onChange={(minSessionMinutes) => onChange({ minSessionMinutes })}
              unit="min"
              max={60}
            />
          </div>
          <Rail
            value={[value.minSessionMinutes]}
            onValueChange={([minSessionMinutes]) =>
              onChange({ minSessionMinutes })
            }
            min={0}
            max={60}
            labels={["Minimum voice session"]}
            startLabel="Join"
            endLabel="60 min"
          />
          <p className="mt-5 text-xs leading-5 text-muted-foreground">
            {value.minSessionMinutes === 0
              ? "Participation starts counting immediately."
              : `The first ${value.minSessionMinutes} ${value.minSessionMinutes === 1 ? "minute acts" : "minutes act"} as a quality gate.`}
          </p>
        </FlowStage>
        <FlowStage title="Credit timing">
          <ModeSwitch
            label="Credit timing"
            value={value.xpMode}
            options={[
              { value: "PER_MINUTE", label: "While active" },
              { value: "PER_SESSION", label: "On exit" },
            ]}
            onChange={(xpMode) => onChange({ xpMode })}
          />
          <VoiceCreditTimeline
            mode={value.xpMode}
            threshold={value.minSessionMinutes}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            {value.xpMode === "PER_MINUTE"
              ? "Frequent feedback makes voice activity feel immediately rewarding."
              : "One clean payout keeps updates quiet during long sessions."}
          </p>
        </FlowStage>
        <FlowStage title="XP amount">
          <div className="flex items-end justify-between gap-4">
            <span className="text-sm text-muted-foreground">Earning rate</span>
            <ExactValue
              label="Earning rate"
              value={value.xpPerMinute}
              onChange={(xpPerMinute) => onChange({ xpPerMinute })}
              unit="XP/min"
              max={1000}
            />
          </div>
          <Rail
            value={[value.xpPerMinute]}
            onValueChange={([xpPerMinute]) => onChange({ xpPerMinute })}
            min={0}
            max={payoutMax}
            labels={["Voice XP per minute"]}
            startLabel="0 XP"
            endLabel={`${payoutMax} XP`}
          />
          <p className="mt-5 text-xs text-muted-foreground">
            A 60-minute session is worth {value.xpPerMinute * 60} XP.
          </p>
        </FlowStage>
      </div>
    </section>
  );
}

export function XPAwardSettings(props: XPAwardSettingsProps) {
  return props.kind === "text" ? (
    <TextAwardSettings value={props.value} onChange={props.onChange} />
  ) : (
    <VoiceAwardSettings value={props.value} onChange={props.onChange} />
  );
}
