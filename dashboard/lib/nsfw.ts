interface NsfwPrediction {
  className: string;
  probability: number;
}

interface NsfwModel {
  classify(image: HTMLCanvasElement): Promise<NsfwPrediction[]>;
}

interface NsfwRuntime {
  load(modelName: "MobileNetV2"): Promise<NsfwModel>;
}

declare global {
  interface Window {
    nsfwjs?: NsfwRuntime;
  }
}

let model: NsfwModel | null = null;
let modelLoading: Promise<NsfwModel> | null = null;
let runtimeLoading: Promise<NsfwRuntime> | null = null;

export interface NsfwResult {
  isNsfw: boolean;
  confidence: number;
  categories: Record<string, number>;
}

const NSFW_THRESHOLD = 0.8;
const NSFW_ASSET_ROOT = "/vendor/nsfwjs";
const NSFW_RUNTIME_SCRIPTS = [
  `${NSFW_ASSET_ROOT}/tf.min.js`,
  `${NSFW_ASSET_ROOT}/model.min.js`,
  `${NSFW_ASSET_ROOT}/group1-shard1of1.min.js`,
  `${NSFW_ASSET_ROOT}/nsfwjs.min.js`,
];

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existingScript?.dataset.loaded === "true") {
      resolve();
      return;
    }

    const script = existingScript || document.createElement("script");
    const onLoad = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    const onError = () =>
      reject(new Error(`Failed to load NSFW scanner asset: ${src}`));

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });

    if (!existingScript) {
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

async function loadRuntime(): Promise<NsfwRuntime> {
  if (typeof window === "undefined") {
    throw new Error("The NSFW scanner is only available in the browser");
  }
  if (window.nsfwjs) return window.nsfwjs;
  if (runtimeLoading) return runtimeLoading;

  runtimeLoading = (async () => {
    for (const src of NSFW_RUNTIME_SCRIPTS) {
      await loadScript(src);
    }

    if (!window.nsfwjs) {
      throw new Error("The NSFW scanner runtime did not initialize");
    }
    return window.nsfwjs;
  })();

  try {
    return await runtimeLoading;
  } catch (error) {
    runtimeLoading = null;
    throw error;
  }
}

export async function loadModel(): Promise<NsfwModel> {
  if (model) return model;
  if (modelLoading) return modelLoading;

  modelLoading = loadRuntime().then((runtime) => runtime.load("MobileNetV2"));

  try {
    model = await modelLoading;
    return model;
  } finally {
    modelLoading = null;
  }
}

export async function scanImage(file: File): Promise<NsfwResult> {
  const m = await loadModel();

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Could not create canvas context");
  }

  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const predictions = await m.classify(canvas);
  const categories: Record<string, number> = {};
  let maxNsfwScore = 0;

  for (const prediction of predictions) {
    categories[prediction.className] = prediction.probability;
    if (prediction.className === "Porn" || prediction.className === "Hentai") {
      maxNsfwScore = Math.max(maxNsfwScore, prediction.probability);
    }
  }

  return {
    isNsfw: maxNsfwScore >= NSFW_THRESHOLD,
    confidence: maxNsfwScore,
    categories,
  };
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}
