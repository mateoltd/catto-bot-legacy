'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ColorFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
}

interface HsvColor {
  hue: number;
  saturation: number;
  brightness: number;
}

const HEX_COLOR = /^#[0-9A-F]{6}$/i;
const SWATCHES = [
  '#FFFFFF', '#A3A3A3', '#404040', '#171717', '#EF4444', '#F97316',
  '#EAB308', '#22C55E', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899',
];

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function hexToHsv(hex: string): HsvColor {
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }

  if (hue < 0) hue += 360;
  return {
    hue,
    saturation: max === 0 ? 0 : (delta / max) * 100,
    brightness: max * 100,
  };
}

function hsvToHex({ hue, saturation, brightness }: HsvColor) {
  const chroma = (brightness / 100) * (saturation / 100);
  const section = hue / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const match = brightness / 100 - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (section < 1) [red, green] = [chroma, x];
  else if (section < 2) [red, green] = [x, chroma];
  else if (section < 3) [green, blue] = [chroma, x];
  else if (section < 4) [green, blue] = [x, chroma];
  else if (section < 5) [red, blue] = [x, chroma];
  else [red, blue] = [chroma, x];

  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}

function normalizeDraft(value: string) {
  const upper = value.toUpperCase();
  return upper.startsWith('#') ? upper : `#${upper}`;
}

export function ColorField({ value, onValueChange, id }: ColorFieldProps) {
  const normalized = HEX_COLOR.test(value) ? value.toUpperCase() : '#000000';
  const [draft, setDraft] = React.useState(normalized);
  const [hsv, setHsv] = React.useState<HsvColor>(() => hexToHsv(normalized));
  const [syncedValue, setSyncedValue] = React.useState(normalized);
  const errorId = React.useId();
  const instructionsId = React.useId();
  const isDraftValid = HEX_COLOR.test(draft);

  if (normalized !== syncedValue) {
    setSyncedValue(normalized);
    setDraft(normalized);
    setHsv(hexToHsv(normalized));
  }

  const commitHsv = React.useCallback(
    (next: HsvColor) => {
      const nextHex = hsvToHex(next);
      setHsv(next);
      setDraft(nextHex);
      onValueChange(nextHex);
    },
    [onValueChange]
  );

  const selectHex = React.useCallback(
    (next: string) => {
      const nextHex = next.toUpperCase();
      setDraft(nextHex);
      setHsv(hexToHsv(nextHex));
      onValueChange(nextHex);
    },
    [onValueChange]
  );

  const updateSaturationAndBrightness = React.useCallback(
    (clientX: number, clientY: number, target: HTMLElement) => {
      const bounds = target.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      commitHsv({
        ...hsv,
        saturation: clamp(((clientX - bounds.left) / bounds.width) * 100),
        brightness: clamp(100 - ((clientY - bounds.top) / bounds.height) * 100),
      });
    },
    [commitHsv, hsv]
  );

  return (
    <div className="relative flex border border-border bg-input">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="relative flex h-10 w-12 shrink-0 items-center justify-center border-0 border-r border-border focus-visible:z-10 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-3px] focus-visible:outline-foreground"
            style={{ backgroundColor: normalized }}
            aria-label={`Choose color, current value ${normalized}`}
          >
            <span
              className="h-3 w-3 border border-white/70 bg-black/25 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
              aria-hidden="true"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-72 rounded-none border-border bg-popover p-0 shadow-[8px_8px_0_rgba(0,0,0,0.28)]"
        >
          <div className="flex items-center gap-3 border-b border-border p-3">
            <span
              className="h-9 w-9 shrink-0 border border-border"
              style={{ backgroundColor: normalized }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Selected color
              </p>
              <output className="font-mono text-sm text-foreground" aria-live="polite">
                {normalized}
              </output>
            </div>
          </div>

          <div className="space-y-4 p-3">
            <div>
              <button
                type="button"
                className="relative block aspect-[8/5] w-full cursor-crosshair touch-none overflow-hidden border border-border focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                style={{ backgroundColor: `hsl(${hsv.hue} 100% 50%)` }}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  updateSaturationAndBrightness(event.clientX, event.clientY, event.currentTarget);
                }}
                onPointerMove={(event) => {
                  if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
                    updateSaturationAndBrightness(event.clientX, event.clientY, event.currentTarget);
                  }
                }}
                onKeyDown={(event) => {
                  const step = event.shiftKey ? 10 : 1;
                  let next = hsv;
                  if (event.key === 'ArrowLeft') {
                    next = { ...hsv, saturation: clamp(hsv.saturation - step) };
                  } else if (event.key === 'ArrowRight') {
                    next = { ...hsv, saturation: clamp(hsv.saturation + step) };
                  } else if (event.key === 'ArrowUp') {
                    next = { ...hsv, brightness: clamp(hsv.brightness + step) };
                  } else if (event.key === 'ArrowDown') {
                    next = { ...hsv, brightness: clamp(hsv.brightness - step) };
                  } else {
                    return;
                  }
                  event.preventDefault();
                  commitHsv(next);
                }}
                aria-label="Saturation and brightness"
                aria-describedby={instructionsId}
              >
                <span
                  className="pointer-events-none absolute inset-0"
                  style={{ background: 'linear-gradient(to right, #fff, transparent)' }}
                  aria-hidden="true"
                />
                <span
                  className="pointer-events-none absolute inset-0"
                  style={{ background: 'linear-gradient(to top, #000, transparent)' }}
                  aria-hidden="true"
                />
                <span
                  className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.8)]"
                  style={{ left: `${hsv.saturation}%`, top: `${100 - hsv.brightness}%` }}
                  aria-hidden="true"
                />
              </button>
              <p id={instructionsId} className="sr-only">
                Use left and right arrow keys for saturation. Use up and down arrow keys for
                brightness. Hold Shift to change by ten percent. Current values are{' '}
                {Math.round(hsv.saturation)}% saturation and {Math.round(hsv.brightness)}%
                brightness.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <label id={`${instructionsId}-hue`}>Hue</label>
                <span className="font-mono tabular-nums">{Math.round(hsv.hue)}°</span>
              </div>
              <SliderPrimitive.Root
                value={[hsv.hue]}
                min={0}
                max={359}
                step={1}
                onValueChange={([hue]) => commitHsv({ ...hsv, hue })}
                className="relative flex h-5 w-full touch-none select-none items-center focus-visible:outline-none"
                aria-labelledby={`${instructionsId}-hue`}
              >
                <SliderPrimitive.Track
                  className="relative h-3 w-full grow border border-border"
                  style={{
                    background:
                      'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                  }}
                >
                  <SliderPrimitive.Range className="hidden" />
                </SliderPrimitive.Track>
                <SliderPrimitive.Thumb
                  aria-label="Hue"
                  className="block h-5 w-2 border border-foreground bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.5)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                />
              </SliderPrimitive.Root>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Quick colors
              </p>
              <div className="grid grid-cols-6 gap-1.5">
                {SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    className={cn(
                      'aspect-square border border-border focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-foreground',
                      normalized === swatch && 'outline outline-1 outline-offset-2 outline-foreground'
                    )}
                    style={{ backgroundColor: swatch }}
                    onClick={() => selectHex(swatch)}
                    aria-label={`Use color ${swatch}`}
                    aria-pressed={normalized === swatch}
                  />
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Input
        id={id}
        value={draft}
        onChange={(event) => {
          const next = normalizeDraft(event.target.value).slice(0, 7);
          setDraft(next);
          if (HEX_COLOR.test(next)) selectHex(next);
        }}
        onBlur={() => {
          if (!HEX_COLOR.test(draft)) setDraft(normalized);
        }}
        maxLength={7}
        spellCheck={false}
        autoComplete="off"
        inputMode="text"
        aria-label="Hex color"
        aria-invalid={!isDraftValid}
        aria-describedby={!isDraftValid ? errorId : undefined}
        className={cn(
          'border-0 bg-transparent font-mono uppercase focus-visible:ring-0',
          !isDraftValid && 'text-destructive'
        )}
      />
      <span id={errorId} className="sr-only" aria-live="polite">
        {!isDraftValid ? 'Enter a six-digit hexadecimal color.' : ''}
      </span>
    </div>
  );
}
