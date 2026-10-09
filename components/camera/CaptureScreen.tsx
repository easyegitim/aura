"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { SelfieCamera, type CaptureResult } from "@/components/camera/SelfieCamera";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * /tara ekranı (F05). Faz 6'da çekim sonucu GeometryResult + 768 px JPEG ile POST /api/analyses'e gider;
 * şimdilik yalnız kalite ölçümleri gösterilir. Görüntü ve noktalar bellekte kalır, hiçbir yere gönderilmez.
 */
export function CaptureScreen() {
  const t = useTranslations("camera.captured");
  const [result, setResult] = useState<CaptureResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!result || !canvas) return;
    canvas.width = result.image.width;
    canvas.height = result.image.height;
    canvas.getContext("2d")?.drawImage(result.image.bitmap, 0, 0);
    return () => {
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
          <p className="text-xs text-muted-foreground">{t("nextPhase")}</p>
          <Button variant="outline" className="w-full" onClick={() => setResult(null)}>
            {t("retake")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
