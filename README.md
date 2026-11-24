# Cael AI Sales Agent

Cael, web siteleri için kaynaklı yanıt, açık AI kimliği ve görünür insan devri
üzerine kurulan bağımsız bir web-first SaaS ürünüdür. Repository P0.1 uygulama
temelini, P0.2 local Supabase tenant şemasını, P0.3 auth/RBAC katmanını, P0.4
test ile gözlemlenebilirlik temelini ve P0.5 site widget'ı kabuğunu içerir.

## Ön koşullar

- Node.js `>=20 <26` (CI: `24.15.0`)
- npm `11.x`
- Component testleri için Node `^22.22.2` veya `^24.15.0` (jsdom sınırı)
- Yalnız local Supabase stack veya E2E çalıştırılacaksa Docker uyumlu container
  runtime; E2E için ayrıca kurulu Google Chrome

Gerçek Supabase projesi, secret, ücretli API veya production hesabı gerekmez.

## Frontend durumu

Public site Next.js App Router ile sıfırdan kuruldu (İngilizce, açık tema):
`app/` rotaları, `components/` (layout, ui, home, product, motion, forms,
content), `data/` içerik modülleri ve `types/`. Rotalar, hareket yaklaşımı ve
test kanıtı `docs/evidence/MARKETING-SITE/README.md` dosyasındadır.

`/app` yalnız giriş sonrası minimal bir iniş sayfasıdır; ürün arayüzü ayrı
task'tır.

## Temiz kurulum

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Aktif server endpoint'leri:

- `/api/health`: server-side env sözleşmesi kontrolü
- `/api/tenant-context`: doğrulanmış tenant bağlamı
- `/api/organizations/[organizationId]/context`: organizasyon bağlamı
- `/auth/callback`: Supabase auth callback'i
- `/widget/v1/loader.js`, `/widget/v1/frame`,
  `/api/widget/v1/{bootstrap,session}`: site widget'ı
- `/api/domains/[domainId]/{verification,subdomains}`: owner/admin domain
  doğrulama ve alt alan adı

Kanonik task durumu
[`docs/CAEL_AI_SALES_AGENT_YOL_HARITASI.md`](docs/CAEL_AI_SALES_AGENT_YOL_HARITASI.md)
dosyasındadır.

## Ortam değişkeni sözleşmesi

`APP_BASE_URL` yalnız server tarafında kullanılan public origin bilgisidir ve
secret değildir. Development/test ortamında eksikse `http://localhost:3000`
kullanılır. Production runtime'da eksik veya geçersizse `/api/health`, secret ya
da sistem ayrıntısı sızdırmadan `503` ve kararlı bir hata kodu döndürür. Build
sırasında gerçek production env zorunlu değildir.

`LEAD_INTAKE_WEBHOOK_URL` opsiyoneldir ve yalnız server tarafında okunur.
İletişim ve "Start Free" formlarını JSON olarak bu HTTPS adresine gönderir.
Boşsa form hiçbir şey göndermez ve bunu kullanıcıya söyler. `APP_BASE_URL`
production build'inde de tanımlı olmalıdır; canonical ve sosyal görsel adresleri
statik sayfalara build sırasında yazılır.

`WIDGET_TOKEN_SECRETS` (imza anahtarları) ve `WIDGET_CLIENT_IP_HEADER` yalnız
server tarafındadır. Eksik veya geçersizse widget uçları 503 döner ve müşteri
sayfasında hiçbir şey görünmez.

Browser'a service role, erişim tokenı veya başka bir secret veren
`NEXT_PUBLIC_*` değişkeni eklemeyin.

## Kalite komutları

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:failure-proof
npm run test:e2e
npm run build
```

`npm run check`, format, lint, typecheck, unit/component testleri ve production
build kapılarını sırayla çalıştırır. `npm run dev` açıkken build almak için
`CAEL_NEXT_DIST_DIR=.next-check` verin; çalışan sunucunun `.next` dizini
silinmez.

`npm run test:failure-proof`, kasıtlı bozuk fixture'ı ayrı config'le çalıştırır;
runner'ın non-zero döndürdüğünü ve JUnit raporunun hatayı anlattığını doğrular.
`-- --e2e` eklenince kurulu Chrome ile bozuk bir browser testi de koşar, trace
ve ekran görüntüsü bıraktığını denetler. Normal `npm test` bu fixture'ları
kapsamaz.

## Site widget'ı

Müşteri sayfasına tek `async` script eklenir. Yalnız doğrulanmış domainlerde
açılır; sunucu kapalıysa, reddederse veya sayfanın CSP'si engellerse ana site
etkilenmez. Sohbet henüz yoktur (P1.4): kabuk AI kimliğini ve insan yolunu
gösterir.

- Kaynak `widget/`; değişince `npm run widget:build`
  `lib/widget/generated/assets.ts` dosyasını üretir (birim testi farkı yakalar).
- Kurulum, rotasyon ve olay adımları:
  `docs/runbooks/WIDGET_KURULUM_VE_ANAHTAR.md`.
- Kararlar ve tehdit modeli:
  `docs/decisions/ADR-20261124-widget-embed-domain-kilidi-ve-public-session.md`.
- Performans ölçümü: `WIDGET_PERF_RUNS=25` ile
  `npm run test:e2e -- --no-build --project=widget performance`; sonuç
  `test-results/widget-performance-*.json`.

## Testler ve sahte servisler

- `tests/unit` (Node) ve `tests/component` (jsdom + Testing Library) her
  worker'da ağa kapalıdır; loopback da kapalıdır. CI aynı testleri ağ arayüzü
  olmayan bir namespace'te koşar.
- `lib/testing` sahte LLM, webhook, CRM ve takvimi, deterministik fixture'ları
  ve bellek içi sink'leri içerir. Production kodu bunları import edemez
  (ESLint).
- `npm run test:e2e` local Supabase'i bulur, iki ayrı production build alır
  (`.next-e2e` harness, `.next-e2e-standard` normal) ve 3210/3211 portlarında
  koşar. Widget testleri 3212 portunda ayrı origin'li (`*.localhost`) müşteri
  sayfaları açar. Sunucu ve tarayıcı loopback dışına çıkarsa koşu düşer. Ayrı
  bir stack için `E2E_SUPABASE_WORKDIR` verin. `-- --no-build` build'i atlar.
- `/app/test-harness` yalnız `CAEL_TEST_HARNESS=enabled` ile alınan build'de
  vardır; normal build'de route ve kod üretilmez. P1.6 ekranı değildir.
- Hata kanıtı: `test-results/` (JUnit, trace, ekran görüntüsü, sunucu log'u) ve
  `playwright-report/`. CI bunları yalnız hata halinde 7 gün saklar.

Gerçek ücretli API testleri hiçbir normal komutla başlamaz ve CI'da reddedilir.
Bir kişi iki ayrı onay vermelidir (P1.3'ten önce böyle bir test yoktur):

```powershell
$env:CAEL_PAID_API_TESTS = "I approve paid API calls"
npm run test:paid -- --confirm-paid-calls
```

## Gözlemlenebilirlik

- Her yanıt sunucunun ürettiği `x-request-id` değerini taşır; log satırları aynı
  id'yi ve W3C trace id'yi içerir. Log'lar JSON satırıdır, içerik taşımaz;
  production'da `console.error` ve `console.warn` çıktısı da mesajsız structured
  satıra çevrilir.
- Yakalanmamış sunucu hataları `request.error` olarak loglanır; error boundary
  ekranındaki "Error reference" log'daki `digest` ile eşleşir.
- `audit_events` ve `llm_call_metrics` tablolarını istemci yazamaz. Kararlar:
  `docs/decisions/ADR-20261124-test-harness-ve-observability.md`.

## Supabase CLI v3 ve local database

CLI proje dev dependency'si olarak tam sürüme pinlenir; komutlar
`npx supabase ...` biçiminde çalıştırılır. P0.2 yalnız local project ve
container stack kullanır; hosted login/link/push yoktur. Temel akış:

```powershell
npm run db:start
npm run db:check
npm run db:stop
```

`db:check`, sıfır database reset + deterministik seed, pgTAP testleri, generated
type drift ve security/performance advisor kapılarını çalıştırır. Detaylar
[`db/README.md`](db/README.md) içindedir. Resmî dokümana göre:

- `npx supabase init` yalnız local `supabase/config.toml` dosyasını oluşturur;
  login veya hosted proje bağlantısı yapmaz.
- `npx supabase start` bir container runtime ister.
- v3 database komutlarında varsayılan hedef local stack'tir; hosted hedef açık
  `--remote` ve riskli değişiklikte onay gerektirir.
- P0.2 hosted access tokenı, database password veya production secret kullanmaz.

Kaynaklar:

- [Supabase local development](https://supabase.com/docs/guides/local-development)
- [Supabase CLI kurulumu](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Local ve hosted hedefler](https://supabase.com/docs/guides/local-development/local-and-hosted-projects)
- [CLI v3 changelog](https://supabase.com/changelog?tags=cli)

## Klasörler

- `app/`: sayfalar, server route handler'ları ve test harness
- `widget/`: müşteri sayfasında çalışan loader ve frame kaynağı
- `lib/`: env, auth, Supabase, observability, LLM/connector port'ları ve
  sahteler
- `db/`: generated database type sözleşmesi ve local çalışma rehberi
- `supabase/`: local config, append-only migration, seed ve pgTAP RLS testleri
- `tests/`: unit, component ve E2E testleri, ağ engeli ve CI failure
  fixture'ları
- `docs/`: roadmap, kararlar, runbook'lar ve tarihsel task kanıtı

## Kapsam sınırı

Frontend rotaları ve daha önceki statik prototipler aktif kaynak ağacından
kaldırılmıştır. Gerçek inbox, agent loop, billing, CRM ve production deploy
yoktur. Commit/push ve deploy ayrı kullanıcı talimatı gerektirir.
