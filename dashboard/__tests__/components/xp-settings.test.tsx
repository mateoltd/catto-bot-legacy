import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import {
  LevelCurveSettings,
  type LevelCurveValue,
} from "@/components/xp/level-curve-settings";
import { XPAwardSettings } from "@/components/xp/xp-award-settings";

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

    render(<Example />);
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

    render(<Example />);
    fireEvent.change(screen.getByLabelText("Level 3 total XP"), {
      target: { value: "475" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add level 3" }));
    expect(screen.getByLabelText("Level 3 XP threshold")).toHaveValue(475);

    fireEvent.click(screen.getByRole("button", { name: "Remove level 2" }));
    expect(screen.queryByDisplayValue("255")).not.toBeInTheDocument();
  });

  it("shows an interactive curve translated into member activity", () => {
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

    render(<Example />);

    expect(
      screen.getByLabelText("Interactive XP requirement curve"),
    ).toBeInTheDocument();
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
  });
});
