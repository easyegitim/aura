# Yerel prototip (ana motor) — 3 komut

Gereken: Node 22 + pnpm, Supabase projesi (ref + access token), Gemini API anahtarı. Turnstile, ödeme, Sentry, PostHog, Resend boş kalır; kod bunları atlar.

```bash
git clone https://github.com/easyegitim/aura && cd aura && pnpm install
SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> pnpm dev:bootstrap   # migration + anonim giriş + anahtarlar → .env.local
# .env.local içine GEMINI_API_KEY=... ekle
pnpm dev                                                                       # http://localhost:3000
```

Akış: Analizini başlat → yaş → rızalar → anket → /tara (kamera veya galeri) → skor (ücretsiz: teaser) → plan → rutin → deneme.

Tam skor/rapor/deneme için son kullanıcıyı premium yap (ödeme kurmadan):

```bash
SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> pnpm dev:bootstrap --premium latest
```

Kamera yalnız `localhost` veya HTTPS'te açılır; telefonda denemek için `pnpm dev --hostname 0.0.0.0` yerine Vercel preview kullan (aynı 4 ortam değişkeni).

Not: `dev:bootstrap` içindeki anonim giriş ve anahtar adımları Supabase Yönetim API'sini kullanır; bu ortamda doğrulanamadı. Başarısız olursa betik elle yapılacak adımı yazar (panelde 2 tıklama).
