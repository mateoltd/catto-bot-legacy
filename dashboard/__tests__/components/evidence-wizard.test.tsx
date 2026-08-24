import React from "react";
import { fireEvent, render as testingLibraryRender, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en-US.json";

const serviceMocks = vi.hoisted(() => ({
  initiateUpload: vi.fn(),
  confirmUpload: vi.fn(),
  addUrlEvidence: vi.fn(),
  previewOG: vi.fn(),
  computeSHA256: vi.fn(),
}));

vi.mock("@/lib/services/mod.service", () => serviceMocks);
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/lib/nsfw", () => ({
  isImageFile: (file: File) => file.type.startsWith("image/"),
  scanImage: vi.fn(),
}));
vi.mock("@/components/mod/tag-selector", () => ({
  TagSelector: () => <div data-testid="tag-selector" />,
}));
vi.mock("@/components/mod/og-card", () => ({ OGCard: () => null }));
vi.mock("@/components/mod/nsfw-scanner", () => ({ NsfwScanner: () => null }));

const { EvidenceWizard } = await import("@/components/mod/evidence-wizard");

function render(ui: React.ReactNode) {
  return testingLibraryRender(
    <NextIntlClientProvider locale="en-US" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("EvidenceWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.initiateUpload.mockImplementation(
      async (_guildId: string, input: { filename: string }) => ({
        evidenceId: `evidence-${input.filename}`,
        uploadUrl: `https://uploads.example/${input.filename}`,
      }),
    );
    serviceMocks.computeSHA256.mockResolvedValue("content-hash");
    serviceMocks.confirmUpload.mockResolvedValue({});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => "" }),
    );
  });

  it("accepts a mixed multi-file batch and reports each completed item", async () => {
    const onUploadComplete = vi.fn();
    const { container } = render(
      <EvidenceWizard
        guildId="guild-1"
        caseNumber={42}
        onUploadComplete={onUploadComplete}
      />,
    );
    const input = container.querySelector<HTMLInputElement>(
      'input[type="file"][multiple]',
    );
    expect(input).not.toBeNull();

    const documentFile = new File(["report"], "report.pdf", {
      type: "application/pdf",
    });
    const audioFile = new File(["audio"], "recording.mp3", {
      type: "audio/mpeg",
    });
    fireEvent.change(input!, { target: { files: [documentFile, audioFile] } });

    expect(
      screen.getByText("2 files queued. Add more if needed."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload 2 items" }));

    await waitFor(() =>
      expect(serviceMocks.confirmUpload).toHaveBeenCalledTimes(2),
    );
    expect(serviceMocks.initiateUpload).toHaveBeenCalledTimes(2);
    expect(onUploadComplete).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByRole("heading", { name: "Upload complete" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Added")).toHaveLength(2);
  });
});
