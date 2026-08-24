import { beforeEach, describe, expect, it, vi } from "vitest";

const SCRIPT_PATHS = [
  "/vendor/nsfwjs/tf.min.js",
  "/vendor/nsfwjs/model.min.js",
  "/vendor/nsfwjs/group1-shard1of1.min.js",
  "/vendor/nsfwjs/nsfwjs.min.js",
];

describe("NSFW scanner runtime", () => {
  beforeEach(() => {
    vi.resetModules();
    document.head.innerHTML = "";
    delete window.nsfwjs;
  });

  it("loads self-hosted runtime assets in dependency order", async () => {
    const model = { classify: vi.fn() };
    const runtimeLoad = vi.fn().mockResolvedValue(model);
    const appendedScripts: string[] = [];

    vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
      const script = node as HTMLScriptElement;
      const path = new URL(script.src).pathname;
      appendedScripts.push(path);

      if (path.endsWith("/nsfwjs.min.js")) {
        window.nsfwjs = { load: runtimeLoad };
      }

      queueMicrotask(() => script.dispatchEvent(new Event("load")));
      return node;
    });

    const scanner = await import("@/lib/nsfw");

    await expect(scanner.loadModel()).resolves.toBe(model);
    expect(runtimeLoad).toHaveBeenCalledWith("MobileNetV2");
    expect(appendedScripts).toEqual(SCRIPT_PATHS);
  });
});
