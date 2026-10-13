# Aura — Mobil Uygulama Eki (SPEC v1.0'a ek, M-serisi fazlar)

Tarih: 2026-10-13. Karar: ürün **iOS + Android native uygulama** (Expo / React Native) olarak lansman olur. Mevcut Next.js kod tabanı **sunucu (API), pazarlama sitesi, yasal sayfalar ve yönetim paneli** olarak kalır. Web uygulama ekranları (`app/(app)/*`) dondurulur; silinmez, lansman kapsamı dışıdır. Ana SPEC'in ürün kuralları (skor dürüstlüğü, kilitli değerler, fotoğraf saklamama, 18+, rızalar, katalog tabanlı rapor, yüz koruma kompoziti, aşağılayıcı dil yasağı) değişmeden geçerlidir; bu ek yalnız farkları tanımlar. Çelişkide öncelik: `CLAUDE.md` > bu ek > `docs/SPEC.md`.

## M1. Mimari

```text
aura/                       Next.js projesi (kök); mobile/ ayrı pnpm projesidir (kendi lockfile'ı,
│                           .npmrc: node-linker=hoisted + ignore-workspace — Expo/Metro gereği)
├─ app/, lib/, content/…    Next.js: API + web + admin (değişmez)
├─ mobile/                  Expo uygulaması (expo-router, TypeScript strict)
│  ├─ app/                  rotalar (M3)
│  ├─ src/{features,components,lib,native}/
│  ├─ assets/mediapipe/     face_landmarker.task (native paket kaynağı; depoya girmez, setup betiği indirir)
│  └─ app.config.ts, eas.json
└─ packages/ (yok)          paylaşım `@/` takma adıyla doğrudan kök `lib/` ve `content/`'ten yapılır
```

- **Paylaşılan kod:** babel `module-resolver` ile `@/` → depo kökü; Metro `watchFolders` kökü izler, `blockList` Next dosyalarını dışlar. `mobile/` yalnız saf modülleri içe aktarır: `lib/config/*`, `lib/consent.ts`, `lib/questionnaire.ts`, `lib/face/{types,indices,pose,quality,metrics,faceShape,hairline}.ts`, `lib/score/present.ts` (tipler), `lib/coach/{bodyRules,eligibility,catalog}.ts`, `lib/tryon/{align,mask,composite}.ts`, `lib/routine/streak.ts`, `lib/account/consents.ts`, `lib/api/errors.ts` (tipler), `lib/analytics.ts` (olay adları), `content/*`, `messages/tr.json`. `"server-only"` içeren veya `next`, `react-dom`, DOM API kullanan hiçbir modül mobilden içe aktarılmaz (ESLint `no-restricted-imports` ile zorlanır).
- **Sunucu:** mevcut `/api/*` uçları aynen kullanılır. Oturum: Supabase JS istemcisi (`expo-secure-store` ile token saklama), istekler `Authorization: Bearer <access_token>` ile gider; `withGuard` çerez yerine bearer'ı da kabul eder (M2).
- **Ortam değişkenleri:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`. Gizli anahtar mobil pakete girmez (RevenueCat public SDK anahtarları gizli değildir).

## M2. Kimlik ve oturum

- Anonim oturum: `supabase.auth.signInAnonymously()`. Turnstile web bileşeni native'de yok; **captcha token WebView içindeki Turnstile widget'ından** alınır (`react-native-webview`). AÇIK: Supabase'in mobil için captcha'yı kapatma + IP sınırı alternatifi (güvenlik > kolaylık; varsayılan WebView Turnstile).
- Hesap bağlama: e-posta OTP (mevcut `updateUser` + `verifyOtp` akışı), Google (`expo-auth-session` + `signInWithIdToken`) ve **Sign in with Apple** (`expo-apple-authentication`; Apple 4.8 gereği Google varsa zorunlu).
- Sunucu `withGuard`: `Authorization: Bearer` başlığı varsa onunla, yoksa çerezle kullanıcıyı çözer. Başka değişiklik yok; RLS aynı.

## M3. Ekranlar (expo-router)

Alt sekmeler: **Analiz · Plan · Dene · Rutin · İlerleme**; Hesap sağ üstte. Yol haritası web ile birebir:

| Mobil rota | Web karşılığı | Fark |
| --- | --- | --- |
| `/(onboarding)/yas`, `/izinler`, `/anket` | `/baslangic/*` | Aynı metinler (`messages/tr.json`) |
| `/(tabs)/analiz`, `/analiz/[id]` | aynı | Paylaşım kartı native paylaşım sayfası |
| `/(tabs)/plan`, `/plan/[analysisId]` | aynı | — |
| `/(tabs)/dene` | `/dene` | Kompozit Skia ile cihazda |
| `/(tabs)/rutin`, `/(tabs)/ilerleme` | aynı | İlerleme fotoğrafları uygulama sanal alanında |
| `/tara` | `/tara` | Native kamera (vision-camera) + MediaPipe |
| `/premium` | `/premium` | RevenueCat paywall; fatura formu yok (mağaza faturalar) |
| `/hesap`, `/silme` | aynı | "Hesabımı sil" mağaza zorunluluğu (Apple 5.1.1(v)) |
| `/uzman` | aynı | Flag kapalıyken sekmede görünmez |
| Yasal metinler | `/yasal/[slug]` | Uygulama içinde WebView ile web sayfası açılır |

Pazarlama, fiyatlar, yasal, admin: yalnız web.

## M4. Kamera ve yüz hattı

- `react-native-vision-camera` **4.x** (react-native-mediapipe 0.6 ile uyumlu sürüm; 5.x değil) + `react-native-worklets-core` + `react-native-mediapipe` (Face Landmarker, 478 nokta, native iOS/Android).
- Çıktı web ile **aynı `GeometryResult` (`geo-v1`)**; `lib/face/{quality,pose,metrics,faceShape}.ts` değişmeden kullanılır. Poz: paket dönüşüm matrisi veriyorsa `eulerFromMatrix`, vermiyorsa landmark tabanlı tahmin (`lib/face/pose.ts`'e eklenir, birim testli).
- Saç çizgisi: react-native-mediapipe görüntü bölütleme (selfie segmenter) içermez. **M4'te `hairlineFound=false`** ile ilerlenir (SPEC 7.6 zaten bu durumu tanımlar: üst üçte bir `null`); **M8'de** özel Expo modülü ile segmenter eklenir.
- Görüntü: `expo-image-manipulator` ile 1280 px uzun kenar → kalite kapısı → 768 px kare kırpma (`lib/face/crop.ts` saf matematiği; piksel işlemi native) → JPEG base64 → `POST /api/analyses` (aynı sözleşme: `image` + `geometry`, 478 nokta gitmez).
- Galeriden yükleme: `expo-image-picker`; aynı kalite kapısından geçer.
- Model dosyası: `face_landmarker.task` native paket kaynağı olarak gömülür (iOS bundle, Android assets); depoya konmaz, `pnpm mobile:setup` indirir.

## M5. Sanal deneme

- `POST /api/tryon` aynen. Sonuç görseli cihazda `@shopify/react-native-skia` ile piksel dizisine açılır; `lib/tryon/{align,mask,composite}.ts` (Uint8/Float32 dizileri üzerinde saf) aynen çalışır; sonuç Skia ile JPEG'e kodlanır. Kimlik sapması kontrolü ve kota iadesi (`/api/tryon/[id]/drift`) aynı.

## M6. Ödeme (RevenueCat) — SPEC 15.4'ün ayrıntısı

- Ürünler: `aura_weekly`, `aura_monthly`, `aura_yearly` (otomatik yenilenen), `aura_week_pass` (yenilenmeyen, flag). Entitlement: `premium`. Fiyatlar mağaza kademelerinden; `lib/config/plans.ts`'teki TRY fiyatlar yalnız web içindir.
- Uygulama: `react-native-purchases`; `logIn(supabaseUserId)`; satın alma sonucu **premium açmaz**. Yetki yalnız sunucuda: RevenueCat webhook'u `POST /api/billing/revenuecat` (Authorization başlığı ile doğrulanır) → `subscriptions` (`provider='revenuecat'`, plan, status, `current_period_end`, `cancel_at_period_end`) → `isPremium()` aynı. İstemci `GET /api/billing/status` ile okur; webhook gecikmesinde sunucu RevenueCat REST (`GET /v1/subscribers/{id}`) ile doğrular.
- Mağaza kuralları: uygulama içinden web ödemesine link yok; iptal mağaza aboneliklerinden (uygulama "Aboneliği yönet" ile mağaza sayfasını açar). Geri yükleme (`restorePurchases`) zorunlu. Fatura: mağaza keser; mesafeli satış/ön bilgilendirme metinleri yine gösterilir.
- Web abonelikleri (`provider='iyzico'`) aynı tabloda kalır; kullanıcının hangi kanalda olursa olsun tek `premium` durumu vardır.

## M7. Yerel veri ve gizlilik

- İlerleme fotoğrafları: `expo-file-system` `documentDirectory/progress/` (uygulama sanal alanı; iCloud/Google yedeğinden hariç tutma denenir; ayar notu kullanıcıya gösterilir). Hiçbir ağa çıkmaz; hesap silmede klasör silinir.
- Analitik: `posthog-react-native` yalnız rıza sonrası (`analytics_cookies` karşılığı "analitik izni"); otomatik yakalama ve oturum kaydı kapalı; aynı olay adları ve `sanitizeProps`.
- Hata: `@sentry/react-native` aynı `beforeSend` temizliği, PII kapalı.
- Gizlilik testi (CLAUDE.md zorunlu): mobil için **ağ trafiği proxy ile** izlenir (Detox/Maestro + mitmproxy); görsel yalnız `/api/analyses` ve `/api/tryon`'a gider.

## M8. Mağaza uyumluluğu

- Yaş derecelendirmesi 17+/18+; açılışta yaş kapısı korunur.
- Apple gizlilik manifestosu (`PrivacyInfo.xcprivacy`): kamera, fotoğraf; yüz tanıma yok, takip yok (ATT istenmez).
- Google Play Data safety: fotoğraf "geçici işleme, saklanmaz"; yüz verisi türetilmiş geometri.
- Hesap silme uygulama içinde (var). "Sağlık iddiası yok" ve nötr dil kuralları mağaza metinlerinde de geçerli.
- Google girişi varsa Sign in with Apple zorunlu (M2).

## M9. Fazlar ve çıkış kriterleri

| Faz | Kapsam | Çıkış kriteri |
| --- | --- | --- |
| M0 | Workspace, Expo iskeleti, paylaşılan kod takma adı, CI (typecheck/lint/jest) | `pnpm --filter mobile typecheck && lint && test` geçer; paylaşılan saf modüller mobilden derlenir |
| M1 | Tema, gezinme, metinler, açılış, oturum (anonim + WebView Turnstile), bearer destekli `withGuard` | Cihazda anonim oturum açılır; API 401/200 doğru |
| M2 | Yaş, rızalar, anket (paylaşılan şema) | Web ile aynı kayıtlar oluşur; 18 altı engellenir |
| M3 | Kamera + MediaPipe + kalite kapısı + geometri + `POST /api/analyses` + sonuç/teaser ekranları | Gerçek cihazda analiz < 10 sn; `GeometryResult` web ile aynı; kilitli değer yok |
| M4 | RevenueCat paywall + webhook + hesap bağlama (OTP, Google, Apple) | Sandbox satın alma → webhook → premium; istemci sonucu tek başına açmaz |
| M5 | Koç raporu, rutin, ilerleme, paylaşım | Rapor/rutin web ile aynı veri; fotoğraflar sanal alanda |
| M6 | Sanal deneme (Skia kompozit) | Drift ≤ %3; kota iadesi |
| M7 | Hesap (rızalar, export, silme), analitik, Sentry, gizlilik proxy testi | Gizlilik testi geçer |
| M8 | Segmenter modülü (saç çizgisi), Uzman Ağı, mağaza gönderimi (EAS), TestFlight/kapalı test | İnceleme onayı |

Her faz CLAUDE.md "Görev sonu raporu" biçimiyle biter. Cihazda çalıştırma ve mağaza hesapları (Apple Developer, Google Play Console, EAS) insan gerektirir; ajan derleme/typecheck/test ve Expo export ile sınırlıdır.

## M10. Açık kararlar

- [ ] Mobil captcha: WebView Turnstile (varsayılan) mı, captcha kapalı + Supabase oran sınırı mı?
- [ ] `week_pass` mağazada yenilenmeyen ürün olarak sunulacak mı?
- [ ] Mağaza fiyat kademeleri (TRY) ve Apple Small Business (%15) başvurusu.
- [ ] Web uygulama ekranları lansmanda tamamen kapatılacak mı (yalnız pazarlama + yasal) yoksa "web'den de kullan" kalacak mı?

## M11. Ortam notları (ajan)

- Bu ortamda `api.expo.dev` ve `docs.expo.dev` ağ politikasında kapalı: `expo install` sürüm çözümlemesi çalışmaz; sürümler `node_modules/expo/bundledNativeModules.json`'dan alınır ve `pnpm add` ile kurulur. Expo belgeleri doğrulanamadığında API adı tahmin edilmez; paketin kendi tip tanımları okunur.
- Doğrulama zinciri: `pnpm mobile:typecheck && pnpm mobile:lint && pnpm mobile:test && pnpm mobile:export` (Metro paketi üretir; cihaz gerekmez).
