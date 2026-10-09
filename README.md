# Aura

18+ kullanıcılar için Türkçe mobil web (PWA) AI görünüm analizi ve bakım koçu.
Spesifikasyon: [`docs/SPEC.md`](docs/SPEC.md) · Ajan kuralları: [`CLAUDE.md`](CLAUDE.md).

## Kurulum

```bash
pnpm install
cp .env.example .env.local   # değerleri doldur
pnpm dev
```

Gerekli servisler (Faz 0): Supabase projesi (anonim oturum açık, Google sağlayıcısı, OTP e-posta şablonunda `{{ .Token }}`),
Cloudflare Turnstile (Supabase Auth captcha ayarında aynı gizli anahtar). `NEXT_PUBLIC_TURNSTILE_SITE_KEY` boşsa
anonim oturum doğrulamasız açılır (yalnız yerel geliştirme; Supabase'de captcha kapalı olmalı).
Google ile hesap bağlama için Supabase panelinde "Allow manual linking" açık olmalı; yönlendirme adresi `/auth/callback`.

## Betikler

| Komut | Açıklama |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | Her commit öncesi |
| `pnpm test:e2e` | Playwright (önce `pnpm build`) |
| `pnpm test:ai` | AI güvenlik testleri, ücretli çağrı yapar (onay gerekir) |
| `pnpm db:types` | Supabase tip üretimi |
| `pnpm calibrate` · `pnpm fairness` | Skor kalibrasyonu ve adalet raporu (ücretli, onay gerekir) |

## Fazlar

SPEC Bölüm 19. Her faz ayrı dalda; çıkış kriteri sağlanınca `main`'e birleştirilir.
