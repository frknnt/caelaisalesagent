# ADR-20261124: Test harness, sahte servisler ve observability sınırı

- Durum: Kabul edildi
- Task: P0.4
- Tarih: 2026-11-24

## Bağlam

P0.4 bütün çekirdek akışların gerçek LLM, e-posta veya CRM olmadan test
edilmesini ister ve "login -> agent -> preview" browser smoke'unu zorunlu tutar.
Repository'de agent ve preview ekranı yoktur: agent döngüsü P1.3, preview
P1.6'dır. Audit ve metrik tabloları ise P2.7, P3.2, P3.3 ve P3.4'ün üzerine
kurulacağı, sonradan değiştirmesi pahalı sınırlardır.

## Karar

1. **Harness normal build'de yoktur.** `/app/test-harness` ve `/preview`
   dosyaları `.e2e.tsx` uzantılıdır. `next.config.ts` bu uzantıyı yalnız build
   sırasında `CAEL_TEST_HARNESS=enabled` ise route sayar. Normal build'de route
   da kod da üretilmez; runtime env değişkeni onu açamaz.
2. **İkinci kapı runtime'dadır.** Harness build'i bile yalnız
   `CAEL_TEST_HARNESS=enabled`, `VERCEL` yok, `APP_BASE_URL` ve Supabase adresi
   loopback ise açılır; aksi halde 404 döner. Sayfalar ve action ayrıca canlı
   oturum ve membership ister.
3. **Harness P1.6 ekranı değildir.** Sabit senaryolu sahte modeli çalıştırır.
   P1.6 gerçek ekranı getirince kaldırılabilir veya o ekranın testine taşınır.
4. **Port'lar minimaldir.** `LlmPort`, `WebhookPort`, `CrmPort`, `CalendarPort`
   yalnız çağıranın güvenebileceği sözleşmeyi tanımlar. Sahteler `lib/testing`
   altındadır; ESLint production kodunun bunları import etmesini reddeder.
5. **LLM çağrısı tek korumalı yoldan geçer** (`callLlmGuarded`). Bütçe en kötü
   durumla çağrıdan önce hesaplanır; fiyat bilinmiyorsa çağrı yapılmaz. Süre
   sınırı abort sinyaline değil yarışa dayanır: geç gelen yanıt atılır. Timeout,
   refusal, rate limit, kesinti, bütçe ve geçersiz çıktı yan etkisiz
   handoff'tur. Yan etki yalnız zamanında gelen geçerli yanıttan sonra bir kez
   çalışır. Otomatik retry yoktur; P1.3/P2.7 kararıdır.
6. **Idempotency anahtarı tenant + işlem + anahtar üçlüsüdür.** Aynı anahtar
   farklı içerikle gelirse `conflict` olur. Başarısız çalışma anahtarı bırakır,
   tekrar deneme aynı anahtarı taşır. Bellek içi store yalnız test içindir;
   kalıcı ve atomik store P2.7'dedir.
7. **`audit_events` append-only'dir.** Üyelik ve davet değişiklikleri aynı
   transaction'da trigger ile, satır değiştirmeyen olaylar (ör. reddedilen
   istek) server tarafında service role ile yazılır. `authenticated` yazamaz;
   `service_role` yalnız ekleyebilir, zamanı ve kimliği seçemez, satırı
   değiştiremez ve silemez. Aktör parametreden değil doğrulanmış oturumdan
   okunur. Okuma yalnız owner/admin'dir.
8. **Audit metadata'sı serbest metin taşımaz.** Check constraint yalnız kod,
   kimlik, sayı ve boolean kabul eder; e-posta, telefon, cümle, iç içe değer ve
   kişisel/gizli anahtar adlarını reddeder. Aynı kural TypeScript'te de vardır.
9. **`organizations` silinince audit kaybolmaz** (`on delete restrict`). Tenant
   silme ve saklama süresi P3.4'ün açık işidir.
10. **`llm_call_metrics` sağlayıcı denemesi başına bir satırdır.** Token, süre,
    maliyet (mikro-USD) ve fiyat sürümü tutar. Bilinmeyen değer `null`'dır,
    sıfır değildir. `is_simulated` sahte çağrıyı ayırır. Bu operasyonel
    telemetridir; faturalama defteri (`usage_ledger`, P3.3) ve funnel olayları
    (`events`, P3.2) değildir. Serbest metin kolonu yoktur.
11. **Log'lar JSON satırıdır ve içerik taşımaz.** Boşluk içeren her metin,
    kişisel/gizli anahtarlar, e-posta, telefon, kart ve token benzeri değerler
    yazılmadan önce çıkarılır. Hata mesajı ve stack metni loglanmaz; tip, kod,
    digest ve çağrı yerleri loglanır. Next.js yakalanmış hataları tam mesajıyla
    kendisi yazdığı için production'da `console.error` ve `console.warn` da
    structured, mesajsız satıra çevrilir (`console-guard.ts`). Bedeli: framework
    uyarılarının metni production'da görünmez; teşhis digest ve çağrı yerleriyle
    yapılır.
12. **Request id her zaman sunucunundur.** Proxy istemcinin `x-request-id`
    değerini ezer; geçerli W3C `traceparent` yeni span ile sürdürülür.
13. **Testler ağsızdır.** Vitest her worker'da tüm soketleri (loopback dahil)
    kapatır; CI aynı testleri ağ arayüzü olmayan bir namespace'te koşar. E2E
    sunucusu ve tarayıcısı loopback dışına çıkamaz; çıkma denemesi koşuyu
    düşürür.
14. **Ücretli testler** yalnız `npm run test:paid -- --confirm-paid-calls` ve
    `CAEL_PAID_API_TESTS` onay cümlesi birlikteyken başlar; CI'da her zaman
    reddedilir.

## Alternatifler

- Harness'i yalnız runtime env ile kapatmak reddedildi: kod production
  bundle'ına girer ve yanlış bir env değeri onu açar.
- Harness'i `next dev` ile koşmak reddedildi: production davranışı (error
  boundary, digest, hata gizleme) test edilmez ve geliştiricinin `.next`
  dizinini ezer.
- Audit'i istemcinin çağırdığı bir RPC ile yazmak reddedildi: istemci olay
  uydurabilir.
- Audit değişmezliğini trigger ile dayatmak yerine grant kullanıldı: saklama
  süresi işi (P3.4) ayrı bir owner fonksiyonu ile yazılabilir kalır.
- OpenTelemetry SDK'sı eklenmedi: W3C trace biçimi korunduğu için sonradan
  eklenebilir; şimdilik bağımlılık ve dış hedef gerektirmez.

## Sonuçlar ve riskler

- Trigger satırlarında request id yoktur: PostgREST isteğinin başlıklarını
  istemci seçebildiği için bunlara güvenilmez. Korelasyon aktör ve zamanladır.
- Redaction yapısaldır; boşluksuz tek kelimelik bir ad biçim olarak koddan ayırt
  edilemez. Bu yüzden log alanlarına kullanıcı metni verilmez.
- İstemci tarafında oluşan hatalar sunucuya raporlanmaz; public bir hata ucu
  rate limit gerektirir (P0.5 sonrası).
- İki E2E build'i CI süresini uzatır.
- Her build Google Fonts'u indirir (P0.4 öncesi davranış); test koşuları değil
  build adımı ağ ister.

## Geri alma yolu

Uygulama tarafı: `lib/{observability,llm,connectors,testing}`, `app/app/`
altındaki harness, `instrumentation.ts` ve ilgili testler kaldırılır; `proxy.ts`
ve API route'ları önceki hallerine döner. Veritabanı tarafı append-only yeni bir
migration ister: trigger'lar kaldırılır, tablolar okunur halde bırakılır.
