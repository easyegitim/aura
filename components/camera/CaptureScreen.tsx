"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { SelfieCamera, type CaptureResult } from "@/components/camera/SelfieCamera";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VisionClient } from "@/lib/face/client";
import { findHairline } from "@/lib/face/hairline";
import { computeStableGeometry, toPixels, type GeometryFrame } from "@/lib/face/metrics";
import type { GeometryResult } from "@/lib/face/types";

/** Çekim sonrası cihazda geometri (F06): segmenter → saç çizgisi → 5 kare medyanı → GeometryResult. */
async function computeGeometry(result: CaptureResult): Promise<GeometryResult> {
  const seg = await VisionClient.get().segment(await createImageBitmap(result.image.bitmap));
  const hairline =
    seg && result.final.landmarks
      ? findHairline(toPixels(result.final.landmarks, result.final.width, result.final.height), result.final, seg).point
      : null;
  // Canlı karelerde saç çizgisi aranmaz (maliyet); son karenin saç çizgisi hepsine uygulanmaz, yalnız son kareye.
  const frames: GeometryFrame[] = [...result.recentFrames.map((f) => ({ frame: f, hairline: null })), { frame: result.final, hairline }];
  return computeStableGeometry(frames);
}

/**
 * /tara ekranı (F05). Faz 6'da çekim sonucu GeometryResult + 768 px JPEG ile POST /api/analyses'e gider;
 * şimdilik yalnız kalite ölçümleri gösterilir. Görüntü ve noktalar bellekte kalır, hiçbir yere gönderilmez.
 */
export function CaptureScreen() {
  const t = useTranslations("camera.captured");
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [geometry, setGeometry] = useState<GeometryResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tg = useTranslations("geometry");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!result || !canvas) return;
    canvas.width = result.image.width;
    canvas.height = result.image.height;
    canvas.getContext("2d")?.drawImage(result.image.bitmap, 0, 0);
    let cancelled = false;
    computeGeometry(result)
      .then((g) => {
        if (!cancelled) setGeometry(g);
      })
      .catch(() => {
        if (!cancelled) setGeometry(null);
      });
    return () => {
      cancelled = true;
      result.image.bitmap.close();
    };
  }, [result]);

  if (!result) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <SelfieCamera onCapture={setResult} />
      </div>
    );
  }

  const m = result.quality.measures;
  const fmt = (v: number | null, digits = 0) => (v === null ? "–" : v.toFixed(digits));
  const pct = (v: number | null) => (v === null ? "–" : `%${Math.round(v * 100)}`);
  const tiltLabel = (deg: number) => (deg > 2 ? tg("tilt.positive") : deg < -2 ? tg("tilt.negative") : tg("tilt.neutral"));

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("body")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <canvas ref={canvasRef} className="mx-auto max-h-[50dvh] w-auto rounded-lg" aria-label={t("previewAlt")} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{t("source")}</dt>
            <dd>{result.source === "camera" ? t("sourceCamera") : t("sourceGallery")}</dd>
            <dt className="text-muted-foreground">{t("pose")}</dt>
            <dd className="tabular-nums">
              {fmt(m.yaw)}° / {fmt(m.pitch)}° / {fmt(m.roll)}°
            </dd>
            <dt className="text-muted-foreground">{t("brightness")}</dt>
            <dd className="tabular-nums">{fmt(m.brightness)}</dd>
            <dt className="text-muted-foreground">{t("sharpness")}</dt>
            <dd className="tabular-nums">{fmt(m.sharpness)}</dd>
            <dt className="text-muted-foreground">{t("frames")}</dt>
            <dd className="tabular-nums">{result.recentFrames.length}</dd>
          </dl>
          {geometry ? (
            <section className="space-y-2 rounded-lg border p-3" aria-label={tg("title")}>
              <h3 className="text-sm font-medium">{tg("title")}</h3>
              <p className="text-sm">
                {tg("faceShape")}: <strong>{tg(`shapes.${geometry.faceShape.primary}`)}</strong>
                {geometry.faceShape.secondary ? ` (${tg("between", { other: tg(`shapes.${geometry.faceShape.secondary}`) })})` : null}
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">{tg("canthalTilt")}</dt>
                <dd>{tiltLabel(geometry.metrics.canthalTiltDeg)}</dd>
                <dt className="text-muted-foreground">{tg("jawRatio")}</dt>
                <dd className="tabular-nums">{geometry.metrics.jawRatio.toFixed(2)}</dd>
                <dt className="text-muted-foreground">{tg("fwhr")}</dt>
                <dd className="tabular-nums">{geometry.metrics.fwhr.toFixed(2)}</dd>
                <dt className="text-muted-foreground">{tg("thirds")}</dt>
                <dd className="tabular-nums">
                  {pct(geometry.metrics.thirds.upper)} / {pct(geometry.metrics.thirds.middle)} / {pct(geometry.metrics.thirds.lower)}
                </dd>
              </dl>
              <p className="text-xs text-muted-foreground">{tg("note")}</p>
            </section>
          ) : (
            <p className="text-xs text-muted-foreground">{tg("computing")}</p>
          )}
          <p className="text-xs text-muted-foreground">{t("nextPhase")}</p>
          <Button variant="outline" className="w-full" onClick={() => setResult(null)}>
            {t("retake")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
