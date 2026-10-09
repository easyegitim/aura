import { describe, expect, it } from "vitest";
import { AnalysisInput, decodeJpeg } from "@/lib/api/analysesInput";

const jpegBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
const geometry = {
  version: "geo-v1",
  quality: { yaw: 1, pitch: 2, roll: 0, brightness: 120, sharpness: 90, passed: true },
  metrics: { lengthRatio: 1.4, jawRatio: 0.84, foreheadRatio: 0.9, fwhr: 1.9, canthalTiltDeg: 3, lowerToMiddle: 1.2, thirds: { upper: null, middle: 0.45, lower: 0.55 }, hairlineFound: false },
  faceShape: { primary: "oval", confidence: 0.8 },
  capturedAt: "2026-10-09T10:00:00Z",
};

describe("AnalysisInput (SPEC 14)", () => {
  it("geçerli gövde", () => {
    expect(AnalysisInput.safeParse({ clientRequestId: crypto.randomUUID(), geometry, image: jpegBytes.toString("base64") }).success).toBe(true);
  });
  it("478 noktalık dizi kabul edilmez (şemada alan yok, metrikler zorunlu)", () => {
    const bad = { ...geometry, metrics: undefined, landmarks: new Array(478).fill([0.1, 0.2]) };
    expect(AnalysisInput.safeParse({ clientRequestId: crypto.randomUUID(), geometry: bad, image: jpegBytes.toString("base64") }).success).toBe(false);
  });
  it("clientRequestId uuid olmalı", () => {
    expect(AnalysisInput.safeParse({ clientRequestId: "abc", geometry, image: jpegBytes.toString("base64") }).success).toBe(false);
  });
});

describe("decodeJpeg (SPEC 16.4: boyut sınırı ve FF D8 imzası)", () => {
  it("JPEG imzası olmayan veri reddedilir", () => {
    expect(decodeJpeg(Buffer.from("PNG....", "utf8").toString("base64"))).toEqual({ error: "BAD_INPUT" });
    expect(decodeJpeg(Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64"))).toEqual({ error: "BAD_INPUT" });
  });
  it("600 KB üstü reddedilir", () => {
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(600 * 1024, 0)]);
    expect(decodeJpeg(big.toString("base64"))).toEqual({ error: "IMAGE_TOO_LARGE" });
  });
  it("geçerli JPEG baytlarını döndürür", () => {
    const r = decodeJpeg(jpegBytes.toString("base64"));
    expect("bytes" in r && r.bytes.length).toBe(jpegBytes.length);
  });
});
