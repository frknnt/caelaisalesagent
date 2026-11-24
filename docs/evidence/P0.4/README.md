# P0.4 Kanıt Özeti

Tarih: 2026-11-24. Kararlar:
[`ADR-20261124`](../../decisions/ADR-20261124-test-harness-ve-observability.md).
Commit, push, deploy, hosted Supabase, production secret ve ücretli API
kullanılmadı.

## Teslimler

| PDF teslimi                                      | Karşılığı                                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Vitest + Testing Library + Playwright            | `vitest.config.mts` (unit + component), `playwright.config.ts`, `tests/`               |
| Fake LLM, webhook/CRM/calendar, fixtures         | `lib/testing/`; port'lar `lib/llm/port.ts`, `lib/connectors/ports.ts`                  |
| Structured log, request/trace id, error boundary | `lib/observability/`, `proxy.ts`, `instrumentation.ts`, `app/{error,global-error}.tsx` |
| `audit_events`                                   | `20261124112948_add_audit_and_llm_metrics.sql`, trigger + service role                 |
| Maliyet/latency/token metrik şeması              | `llm_call_metrics`, `lib/observability/llm-metrics.ts`                                 |
| Özel kural: ücretli testler ayrı ve açık onaylı  | `npm run test:paid`; reddetme davranışı testli, hiçbir script veya CI adımı başlatmaz  |

## Zorunlu testler

| Test                                 | Kanıt                                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Ağ kapalıyken test suite             | `--network none` container: tek arayüz `lo`, dışarısı `ENETUNREACH`, 242/242. Ayrıca her worker'da soket/DNS/UDP engeli ve onun kendi testi |
| LLM timeout / refusal / rate limit   | `llm-guarded-call.test.ts`, `harness-turn.test.ts`, E2E `failures.spec.ts`: hepsi handoff, 0 webhook, model metni yok                       |
| Webhook duplicate / idempotency      | `idempotency.test.ts` (eşzamanlı, tekrar, çakışma, kayıp yanıt, tenant ayrımı); E2E "a duplicated webhook event is delivered once"          |
| Playwright smoke login→agent→preview | `smoke.spec.ts`, gerçek Chrome + production build + local Supabase                                                                          |

## Komutlar ve sonuçlar (son hal)

| Komut                                          | Sonuç                                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `CAEL_NEXT_DIST_DIR=.next-check npm run check` | PASS: format, lint, typecheck, 242/242 unit+component, production build |
| `npm test`, `--network none` container         | PASS 242/242                                                            |
| `npm run test:failure-proof -- --e2e`          | PASS: iki bozuk test exit 1; JUnit, trace.zip ve png bıraktı            |
| `npm run test:e2e` (ayrı boş stack, 655xx)     | PASS 59/59                                                              |
| `supabase test db` (sıfır DB)                  | PASS 10 dosya, 162 assertion                                            |
| `supabase test db` (upgrade stack)             | PASS 10 dosya, 162 assertion                                            |
| `npm run db:types:check`                       | PASS                                                                    |
| `npm run db:advisors` (security + performance) | `No issues found`                                                       |
| Kaynak mutasyonları (12)                       | 12/12 yakalandı                                                         |
| pgTAP mutasyonu (geniş RLS + delete grant)     | 8 assertion düştü; geri alınca PASS                                     |
| Kayıtlı dış bağlantıyla E2E                    | exit 1, `Blocked outbound connections`                                  |

`npm run db:check` koşulmadı: `db:reset` yerel veriyi siler. Aynı kapılar
yukarıda ayrı ayrı koştu.

## Veritabanı

- Sıfır DB: ayrı `caelaisalesagent-p04` stack'i üç migration ve seed'i uyguladı.
- Upgrade: ilk iki migration + seed bulunan ayrı stack'te (653xx)
  `migration up`; satır sayıları aynı (8 kullanıcı, 8 üyelik, 2 site), sonra 162
  assertion PASS.
- Ana local DB: `migration up` uygulandı; satır sayıları değişmedi (4 kullanıcı,
  2 organization, 3 üyelik, 2 site, 2 domain). Bu DB'nin seed'i P0.2 döneminden
  kalmadır (beş rol ve session satırları yok); bu yüzden P0.3 testleri gibi yeni
  testler de orada düşer. Reset kullanıcı onayı gerektirir.
- E2E sonrası ayrı stack: yalnız simüle metrik (`is_simulated` hepsi true);
  başarısız çağrılarda maliyet `null`; 20 `tenant.access_denied` kaydı.

## Harness'in kapalı olduğunun kanıtı

`tests/e2e/standard/harness-closed.spec.ts`, normal production build'i
runtime'da `CAEL_TEST_HARNESS=enabled` verilmiş halde çalıştırır: giriş yapmış
owner iki yolda da 404 alır; build çıktısında dört harness işaretinin hiçbiri
yoktur, aynı arama harness build'inde dördünü de bulur. `harness-gate.test.ts`
runtime kapısının 11 kapalı durumunu sınar.

## Hata kanıtı

Geliştirme sırasında düşen gerçek E2E testleri trace, ekran görüntüsü ve sunucu
log'u bıraktı. CI bunları hata halinde artefact olarak 7 gün saklar.

İlk E2E koşusu önemli bir açığı gösterdi: Next.js yakalanmış hatanın tam
mesajını (ziyaretçi e-postası ve telefonu dahil) sunucu log'una kendisi
yazıyordu ve ilk test yalnız structured satırlara bakıyordu. `console-guard.ts`
eklendi; test artık sunucunun yazdığı her şeyi denetliyor. Düzeltmeden sonraki
satır:

```json
{
  "level": "error",
  "event": "console.error",
  "service": "cael-web",
  "fields": {
    "errorType": "Error",
    "digest": "2148197977",
    "frames": [
      "eK:page.js:96",
      "process.processTicksAndRejections:task_queues:104"
    ]
  }
}
```

## Arayüz

Yedi durum (agent, empty, invalid, pending, answered, handoff, error) × 320,
375, 768, 1024, 1440: yatay taşma 0, 14 px altı metin yok, 44 px altı hedef yok,
axe (WCAG 2.2 AA + best-practice) 0 ihlal (pending hariç: geçici durum, axe
koşmadan biter). Klavye akışı, loading, %200 zoom ve %200 metin PASS. Görüntüler
`screenshots/`.

## Denenemeyenler

- Gerçek GitHub Actions koşusu (repository Git değil). `sudo unshare --net`
  adımı yerine yerelde `--network none` container kullanıldı; workflow'un
  kendisi çalıştırılmadı.
- Ücretli API, hosted Supabase, gerçek CRM/takvim/webhook.
- Safari, Firefox, gerçek telefon, gerçek ekran okuyucu.
- Tarayıcının kendi yazı boyutu ayarı (%200 metin enjekte edilen stille
  ölçüldü).
