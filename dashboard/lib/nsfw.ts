import * as nsfwjs from 'nsfwjs';

let model: nsfwjs.NSFWJS | null = null;
let modelLoading: Promise<nsfwjs.NSFWJS> | null = null;

export interface NsfwResult {
  isNsfw: boolean;
  confidence: number;
  categories: Record<string, number>;
}

const NSFW_THRESHOLD = 0.8;

export async function loadModel(): Promise<nsfwjs.NSFWJS> {
  if (model) return model;
  if (modelLoading) return modelLoading;

  modelLoading = nsfwjs.load().then((m) => {
    model = m;
    modelLoading = null;
    return m;
  });

  return modelLoading;
}

export async function scanImage(file: File): Promise<NsfwResult> {
  const m = await loadModel();

  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context');
  ctx.drawImage(bitmap, 0, 0);

  // nsfwjs expects an HTMLImageElement or HTMLCanvasElement;
  // OffscreenCanvas works in modern browsers via transferToImageBitmap path.
  // Create a temporary canvas for compatibility.
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = bitmap.width;
  tempCanvas.height = bitmap.height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.drawImage(bitmap, 0, 0);

  const predictions = await m.classify(tempCanvas);
  bitmap.close();

  const categories: Record<string, number> = {};
  let maxNsfwScore = 0;

  for (const pred of predictions) {
    categories[pred.className] = pred.probability;
    // NSFWJS categories: Drawing, Hentai, Neutral, Porn, Sexy
    if (pred.className === 'Porn' || pred.className === 'Hentai') {
      maxNsfwScore = Math.max(maxNsfwScore, pred.probability);
    }
  }

  return {
    isNsfw: maxNsfwScore >= NSFW_THRESHOLD,
    confidence: maxNsfwScore,
    categories,
  };
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}
