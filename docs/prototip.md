# Yerel prototip (ana motor) — 3 komut

Gereken: Node 22 + pnpm, Supabase projesi (ref + access token), Gemini API anahtarı. Turnstile, ödeme, Sentry, PostHog, Resend boş kalır; kod bunları atlar.

```bash
git clone https://github.com/easyegitim/aura && cd aura && pnpm install
SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> GEMINI_API_KEY=... pnpm dev:bootstrap   # migration + anonim giriş + anahtarlar → .env.local
pnpm dev                                                                       # http://localhost:3000
```

Akış: Analizini başlat → yaş → rızalar → anket → /tara (kamera veya galeri) → skor (ücretsiz: teaser) → plan → rutin → deneme.

Tam skor/rapor/deneme için son kullanıcıyı premium yap (ödeme kurmadan); `--unlimited latest` eklersen analiz (haftada 1), deneme (7 günde 10) ve rapor yenileme limitleri de kalkar (test hesabı):

```bash
SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> pnpm dev:bootstrap --premium latest --unlimited latest
```

Kamera yalnız `localhost` veya HTTPS'te açılır; telefonda denemek için `pnpm dev --hostname 0.0.0.0` yerine Vercel preview kullan (aynı 4 ortam değişkeni).

Not: `dev:bootstrap` 22 Ekim 2026'da `spmplpgeeakucihumnzi` projesine karşı çalıştırıldı: 7 migration uygulandı, 14 tabloda RLS açık, 4 cron işi, `reserve_*` fonksiyonları yerinde, anonim giriş açık; `/api/health`, anonim oturum, `/api/analyses`, `/api/tryon/status`, `/api/billing/status` 200 döndü. Betik bir adımda başarısız olursa elle yapılacak adımı yazar.
