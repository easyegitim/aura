# aura-segmenter (yerel Expo modülü)

SPEC-MOBILE M8: MediaPipe **Image Segmenter** (`selfie_multiclass_256x256.tflite`) ile çekilen selfie'nin kategori maskesini üretir; `lib/face/hairline.ts` bu maskeden saç çizgisini bulur.

- JS: `segmentImage(path, model)` → `{ width, height, maskBase64 }`; `isSegmenterAvailable` native modül yoksa `false` (Expo Go, Jest).
- iOS: `MediaPipeTasksVision 0.10.12` (react-native-mediapipe ile aynı sürüm). Android: `tasks-vision 0.10.14` (Gradle tek sürüme çözer).
- Model dosyası depoda değildir: `pnpm --dir mobile setup` indirir; `plugins/withMediapipeModels.js` native pakete kopyalar.
- Görüntü yalnız bellekte işlenir; maske dışında hiçbir veri dönmez, loglanmaz.

Doğrulama (cihaz gerektirir): `/tara` sonrası inceleme ekranında "Üst üçte bir" değeri doluysa segmenter çalışıyor demektir.
