import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import {
  LevelCurveSettings,
  type LevelCurveValue,
} from "@/components/xp/level-curve-settings";
import { XPAwardSettings } from "@/components/xp/xp-award-settings";
import messages from "@/messages/en-US.json";

function Intl({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en-US" messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

describe("XP settings", () => {
  it("edits the text award strategy and reflects it in the live rule", () => {
    function Example() {
      const [value, setValue] = useState({
        cooldownSec: 60,
        minMessageLength: 5,
        xpMode: "RANDOM" as "RANDOM" | "FIXED",
        minXp: 10,
        maxXp: 20,
        fixedXp: 15,
        maxXpPerMinute: null as number | null,
      });

      return (
        <XPAwardSettings
          kind="text"
          value={value}
          onChange={(change) =>
            setValue((current) => ({ ...current, ...change }))
          }
        />
      );
    }

    render(<Intl><Example /></Intl>);
    expect(screen.getAllByText(/10–20 XP/)).not.toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Exact" }));
    expect(screen.getAllByText(/15 XP/)).not.toHaveLength(0);

    expect(screen.getByLabelText("Fixed XP")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Fixed XP"), {
      target: { value: "16" },
    });
    expect(screen.getByLabelText("Fixed XP")).toHaveValue(16);
    expect(
      screen.getByText(/Estimated maximum in 10 active minutes/),
    ).toBeInTheDocument();
  });

  it("edits voice awards through the shared award controls", () => {
    function Example() {
      const [value, setValue] = useState({
        xpPerMinute: 5,
        minSessionMinutes: 1,
        xpMode: "PER_MINUTE" as "PER_MINUTE" | "PER_SESSION",
      });

      return (
        <XPAwardSettings
          kind="voice"
          value={value}
          onChange={(change) =>
            setValue((current) => ({ ...current, ...change }))
          }
        />
      );
    }

    render(<Intl><Example /></Intl>);

    expect(screen.getByLabelText("Voice XP award engine")).toBeInTheDocument();
    expect(screen.getByLabelText("Session duration")).toHaveValue(1);
    const sessionSlider = screen.getByRole("slider", {
      name: "Minimum voice session",
    });
    expect(sessionSlider).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: "Voice XP per minute" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(sessionSlider, { key: "ArrowRight" });
    expect(screen.getByLabelText("Session duration")).toHaveValue(2);

    fireEvent.change(screen.getByLabelText("Earning rate"), {
      target: { value: "8" },
    });
    expect(screen.getByText("240 XP")).toBeInTheDocument();
    expect(
      screen.getByText("A 60-minute session is worth 480 XP."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "On exit" }));
    expect(screen.getByText(/when they leave/)).toBeInTheDocument();
    expect(
      screen.getByLabelText("XP is credited when the session ends"),
    ).toBeInTheDocument();
  });

  it("adds and removes explicit curve thresholds without comma-separated editing", () => {
    function Example() {
      const [value, setValue] = useState<LevelCurveValue>({
        levelCurveType: "TABLE",
        formulaBase: 5,
        formulaExponent: 2,
        formulaOffset: 50,
        tableThresholds: [100, 255],
      });

      return (
        <LevelCurveSettings
          variant="text"
          value={value}
          onChange={(change) =>
            setValue((current) => ({ ...current, ...change }))
          }
        />
      );
    }

    render(<Intl><Example /></Intl>);
    fireEvent.change(screen.getByLabelText("Level 3 total XP"), {
      target: { value: "475" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add level 3" }));
    expect(screen.getByLabelText("Level 3 XP threshold")).toHaveValue(475);

    fireEvent.click(screen.getByRole("button", { name: "Remove level 2" }));
    expect(screen.queryByDisplayValue("255")).not.toBeInTheDocument();
  });

  it("shows an interactive curve translated into member activity", () => {
    Object.defineProperties(SVGSVGElement.prototype, {
      clientWidth: { configurable: true, get: () => 1440 },
      clientHeight: { configurable: true, get: () => 288 },
    });

    function Example() {
      const [value, setValue] = useState<LevelCurveValue>({
        levelCurveType: "FORMULA",
        formulaBase: 5,
        formulaExponent: 2,
        formulaOffset: 50,
        tableThresholds: [],
      });

      return (
        <LevelCurveSettings
          variant="voice"
          value={value}
          earningRate={5}
          onChange={(change) =>
            setValue((current) => ({ ...current, ...change }))
          }
        />
      );
    }

    render(<Intl><Example /></Intl>);

    const curve = screen.getByLabelText("Interactive XP requirement curve");
    expect(curve).toBeInTheDocument();
    expect(curve).toHaveAttribute("viewBox", "0 0 1440 288");
    expect(curve).toHaveClass("overflow-hidden");
    expect(curve.parentElement).toHaveClass("overflow-hidden");
    expect(
      screen.getByRole("slider", { name: "Early progression handle" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: "Middle progression handle" }),
    ).toBeInTheDocument();
    const lateHandle = screen.getByRole("slider", {
      name: "Late progression handle",
    });
    const initialCost = Number(lateHandle.getAttribute("aria-valuenow"));
    fireEvent.keyDown(lateHandle, { key: "ArrowDown" });
    expect(
      Number(
        screen
          .getByRole("slider", { name: "Late progression handle" })
          .getAttribute("aria-valuenow"),
      ),
    ).toBeLessThan(initialCost);
    expect(screen.getByText("Level 25")).toBeInTheDocument();
    expect(screen.getByText("Level 100")).toBeInTheDocument();
    expect(screen.getAllByText(/voice hr/)).not.toHaveLength(0);

    delete (SVGSVGElement.prototype as Partial<SVGSVGElement>).clientWidth;
    delete (SVGSVGElement.prototype as Partial<SVGSVGElement>).clientHeight;
  });
});
