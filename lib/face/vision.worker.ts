// Web Worker: Face Landmarker + Image Segmenter (SPEC 7.1). Görüntü ve noktalar hiçbir yere gönderilmez/loglanmaz.
import { FaceLandmarker, FilesetResolver, ImageSegmenter, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { SEG_CLASS, type BlendshapeScores, type FrameAnalysis, type Point, type SegmentationResult } from "./types";

export type WorkerRequest =
  | { type: "init"; id: number; basePath: string }
  | { type: "detectVideo"; id: number; bitmap: ImageBitmap; timestamp: number }
  | { type: "detectImage"; id: number; bitmap: ImageBitmap }
  | { type: "segment"; id: number; bitmap: ImageBitmap }
  | { type: "close"; id: number };

export type InitResult = { delegate: "GPU" | "CPU" };

export type WorkerResponse =
  | { id: number; ok: true; result: InitResult | FrameAnalysis | SegmentationResult | null }
  | { id: number; ok: false; error: string };

let landmarker: FaceLandmarker | null = null;
let landmarkerMode: "VIDEO" | "IMAGE" = "VIDEO";
let segmenter: ImageSegmenter | null = null;
let segmenterInit: Promise<void> | null = null;
let delegate: "GPU" | "CPU" = "GPU";
let frameCounter = 0;
let lastHairVisible: boolean | null = null;
let lastVideoTimestamp = -1;

const statsCanvas = new OffscreenCanvas(256, 256);

/** Klasik worker'da importScripts çalışır; modül worker'da TypeError fırlatır. Yükleyici buna göre seçilir. */
function isModuleWorker(): boolean {
  const scope = globalThis as { importScripts?: (...urls: string[]) => void };
  if (typeof scope.importScripts !== "function") return true;
  try {
    scope.importScripts("data:text/javascript,");
    return false;
  } catch {
    return true;
  }
}

async function init(basePath: string): Promise<InitResult> {
  const vision = await FilesetResolver.forVisionTasks(`${basePath}/wasm`, isModuleWorker());
  const modelAssetPath = `${basePath}/face_landmarker.task`;
  const common = {
    runningMode: "VIDEO" as const,
    numFaces: 2,
    minFaceDetectionConfidence: 0.6,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  };
  try {
    landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath, delegate: "GPU" },
      canvas: new OffscreenCanvas(1, 1),
      ...common,
    });
    delegate = "GPU";
  } catch {
    landmarker = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath, delegate: "CPU" }, ...common });
    delegate = "CPU";
  }
  landmarkerMode = "VIDEO";

  // Segmenter arka planda (16 MB); hazır olana kadar hairVisible = null.
  segmenterInit = (async () => {
    const segPath = `${basePath}/selfie_multiclass_256x256.tflite`;
    try {
      segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath: segPath, delegate },
        ...(delegate === "GPU" ? { canvas: new OffscreenCanvas(1, 1) } : {}),
        runningMode: "IMAGE",
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      });
    } catch {
      segmenter = null;
    }
  })();

  return { delegate };
}

async function ensureMode(mode: "VIDEO" | "IMAGE") {
  if (!landmarker) throw new Error("not_initialized");
  if (landmarkerMode !== mode) {
    await landmarker.setOptions({ runningMode: mode });
    landmarkerMode = mode;
    lastVideoTimestamp = -1;
  }
}

function pickBlendshapes(res: FaceLandmarkerResult): BlendshapeScores | null {
  const cats = res.faceBlendshapes?.[0]?.categories;
  if (!cats) return null;
  const get = (name: string) => cats.find((c) => c.categoryName === name)?.score ?? 0;
  return {
    eyeBlinkLeft: get("eyeBlinkLeft"),
    eyeBlinkRight: get("eyeBlinkRight"),
    mouthSmileLeft: get("mouthSmileLeft"),
    mouthSmileRight: get("mouthSmileRight"),
    jawOpen: get("jawOpen"),
  };
}

/** Yüz kutusu (normalize). */
function box(landmarks: Point[]) {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** Parlaklık, sol/sağ yanak dengesi ve Laplace varyansı; 256 px'e küçültülmüş kopyada hesaplanır. */
function pixelStats(bitmap: ImageBitmap, landmarks: Point[]) {
  const ctx = statsCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { brightness: null, brightnessBalance: null, sharpness: null };
  const b = box(landmarks);
  const S = 256;
  ctx.drawImage(bitmap, 0, 0, S, S);
  const x0 = Math.max(0, Math.floor(b.minX * S)), y0 = Math.max(0, Math.floor(b.minY * S));
  const x1 = Math.min(S, Math.ceil(b.maxX * S)), y1 = Math.min(S, Math.ceil(b.maxY * S));
  const w = x1 - x0, h = y1 - y0;
  if (w < 8 || h < 8) return { brightness: null, brightnessBalance: null, sharpness: null };
  const img = ctx.getImageData(x0, y0, w, h).data;

  let sum = 0, leftSum = 0, rightSum = 0, leftN = 0, rightN = 0;
  const gray = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const g = 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2];
      gray[y * w + x] = g;
      sum += g;
      // yanaklar: dikeyde %40–70 bandı, yatayda dış %30'lar
      if (y > h * 0.4 && y < h * 0.7) {
        if (x < w * 0.3) { leftSum += g; leftN++; } else if (x > w * 0.7) { rightSum += g; rightN++; }
      }
    }
  }
  const brightness = sum / (w * h);
  const brightnessBalance = leftN && rightN ? Math.abs(leftSum / leftN - rightSum / rightN) : null;

  // 128×128 gri kırpımda Laplace varyansı (yeniden örnekleme: en yakın komşu)
  const L = 128;
  const lap: number[] = [];
  const sample = (x: number, y: number) => gray[Math.min(h - 1, Math.floor((y * h) / L)) * w + Math.min(w - 1, Math.floor((x * w) / L))];
  for (let y = 1; y < L - 1; y++) {
    for (let x = 1; x < L - 1; x++) {
      lap.push(sample(x - 1, y) + sample(x + 1, y) + sample(x, y - 1) + sample(x, y + 1) - 4 * sample(x, y));
    }
  }
  const mean = lap.reduce((a, v) => a + v, 0) / lap.length;
  const sharpness = lap.reduce((a, v) => a + (v - mean) ** 2, 0) / lap.length;
  return { brightness, brightnessBalance, sharpness };
}

/** Segmenter saç sınıfı yüz kutusunun hemen üstünde var mı? */
function hairAboveFace(bitmap: ImageBitmap, landmarks: Point[]): boolean | null {
  if (!segmenter) return null;
  const res = segmenter.segment(bitmap);
  try {
    const mask = res.categoryMask;
    if (!mask) return null;
    const data = mask.getAsUint8Array();
    const mw = mask.width, mh = mask.height;
    const b = box(landmarks);
    const faceH = b.maxY - b.minY;
    const y0 = Math.max(0, Math.floor((b.minY - faceH * 0.35) * mh)), y1 = Math.max(0, Math.floor(b.minY * mh));
    const x0 = Math.max(0, Math.floor(b.minX * mw)), x1 = Math.min(mw, Math.ceil(b.maxX * mw));
    let hair = 0, total = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { total++; if (data[y * mw + x] === SEG_CLASS.hair) hair++; }
    return total > 0 ? hair / total >= 0.05 : null;
  } finally {
    res.close();
  }
}

function toAnalysis(res: FaceLandmarkerResult, bitmap: ImageBitmap, timestamp: number, withHair: boolean): FrameAnalysis {
  const faces = res.faceLandmarks.length;
  const landmarks = faces === 1 ? res.faceLandmarks[0].map((p) => ({ x: p.x, y: p.y, z: p.z })) : null;
  const matrixData = res.facialTransformationMatrixes?.[0]?.data;
  const stats = landmarks ? pixelStats(bitmap, landmarks) : { brightness: null, brightnessBalance: null, sharpness: null };
  let hairVisible: boolean | null = lastHairVisible;
  if (landmarks && withHair) {
    hairVisible = hairAboveFace(bitmap, landmarks);
    lastHairVisible = hairVisible;
  }
  return {
    width: bitmap.width,
    height: bitmap.height,
    faces,
    landmarks,
    blendshapes: faces === 1 ? pickBlendshapes(res) : null,
    matrix: faces === 1 && matrixData ? Array.from(matrixData) : null,
    ...stats,
    hairVisible: landmarks ? hairVisible : null,
    timestamp,
  };
}

async function detectVideo(bitmap: ImageBitmap, timestamp: number): Promise<FrameAnalysis> {
  await ensureMode("VIDEO");
  // MediaPipe zaman damgasının kesin artması gerekir.
  const ts = timestamp <= lastVideoTimestamp ? lastVideoTimestamp + 1 : timestamp;
  lastVideoTimestamp = ts;
  const res = landmarker!.detectForVideo(bitmap, ts);
  frameCounter++;
  return toAnalysis(res, bitmap, ts, frameCounter % 5 === 0);
}

async function detectImage(bitmap: ImageBitmap): Promise<FrameAnalysis> {
  await ensureMode("IMAGE");
  if (segmenterInit) await segmenterInit;
  const res = landmarker!.detect(bitmap);
  return toAnalysis(res, bitmap, performance.now(), true);
}

async function segment(bitmap: ImageBitmap): Promise<SegmentationResult | null> {
  if (segmenterInit) await segmenterInit;
  if (!segmenter) return null;
  const res = segmenter.segment(bitmap);
  try {
    const mask = res.categoryMask;
    if (!mask) return null;
    return { width: mask.width, height: mask.height, mask: new Uint8Array(mask.getAsUint8Array()) };
  } finally {
    res.close();
  }
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  const reply = (r: WorkerResponse, transfer: Transferable[] = []) => postMessage(r, { transfer });
  try {
    switch (msg.type) {
      case "init":
        reply({ id: msg.id, ok: true, result: await init(msg.basePath) });
        break;
      case "detectVideo":
        try {
          reply({ id: msg.id, ok: true, result: await detectVideo(msg.bitmap, msg.timestamp) });
        } finally {
          msg.bitmap.close();
        }
        break;
      case "detectImage":
        try {
          reply({ id: msg.id, ok: true, result: await detectImage(msg.bitmap) });
        } finally {
          msg.bitmap.close();
        }
        break;
      case "segment":
        try {
          const r = await segment(msg.bitmap);
          reply({ id: msg.id, ok: true, result: r }, r ? [r.mask.buffer] : []);
        } finally {
          msg.bitmap.close();
        }
        break;
      case "close":
        landmarker?.close();
        segmenter?.close();
        landmarker = null;
        segmenter = null;
        reply({ id: msg.id, ok: true, result: null });
        break;
    }
  } catch (err) {
    reply({ id: msg.id, ok: false, error: err instanceof Error ? err.message : "worker_error" });
  }
};
