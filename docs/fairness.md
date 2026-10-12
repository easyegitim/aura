# Adalet (önyargı) raporu — durum

**Henüz çalıştırılmadı.** `pnpm fairness` ücretli Gemini çağrısı yapar ve rızalı test seti (50–100 yetişkin; ten tonu Fitzpatrick I–VI, cinsiyet, sakal, gözlük, başörtüsü dengeli) ister. Fotoğraflar yalnız şifreli yerel diskte durur (SPEC 8.8); depoya konmaz.

Bu dosya betik çalıştığında üzerine yazılır. Uydurma sonuç yazılmaz.

## Nasıl çalıştırılır (insan onayıyla)

1. Şifreli diskte klasör: 768 px kare JPEG'ler (`lib/face/crop.ts` çıktısı), dosya adlarında kişi kimliği yok.
2. `manifest.json`:
   ```json
   { "dir": "/Volumes/sifreli/aura-fairness", "items": [ { "file": "0001.jpg", "groups": { "skinTone": "IV", "gender": "f", "beard": "no", "glasses": "no", "headCovering": "yes" } } ] }
   ```
3. `GEMINI_API_KEY=... pnpm fairness /Volumes/sifreli/aura-fairness/manifest.json --calls 3`
4. Çıktı tabloda bir boyut "⛔" ise yayın durur; prompt (`lib/ai/prompts/score.v1.ts`) veya kalibrasyon (`lib/score/calibration.ts`) düzeltilip tekrar çalıştırılır.
5. Her prompt/model değişikliğinde tekrar (SPEC 8.8, 20.1).

Ölçüm mantığı `lib/score/fairness.ts` içinde ve birim testlidir (`tests/unit/fairness.test.ts`).
