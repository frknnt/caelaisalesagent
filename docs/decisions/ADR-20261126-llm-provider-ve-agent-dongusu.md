# ADR-20261126: LLM provider bağımsızlığı, bütçe ve tool sözleşmesi

- Durum: Kabul edildi
- Tarih: 2026-11-26
- Task: P1.3

## Bağlam

Agent çekirdeği sağlayıcı değişince iş mantığına dokunulmadan çalışmalı;
maliyet, zaman aşımı, refusal ve tool çağrıları deterministik sunucu
kurallarından geçmeli. P0.4 `LlmPort` ve `callLlmGuarded` sınırını kurdu.

## Karar

1. **Provider bağımsızlığı.** İş mantığı yalnız `lib/llm/port.ts` tiplerini
   (mesaj, tool spec, tool call, completion) bilir. Sağlayıcı ve model
   `LLM_PROVIDER`/`LLM_MODEL` env'inden okunur (`readLlmConfig`), adı kayıtlı
   bir adapter fabrikasına eşlenir (`createLlmPort`). Kayıtsız ad hata verir;
   sessiz fake'e düşülmez. Adapter'ın bildirdiği provider/model config ile
   eşleşmezse hata verilir.
2. **Gerçek sağlayıcı adapter'ı bu task'ta yazılmadı.** Resmi SDK dependency'si
   ve ücretli doğrulama (`npm run test:paid`) kullanıcı onayı gerektirir. İlk
   gerçek adapter yalnız `LlmPort`'u uygulayan yeni bir dosya + registry kaydı
   olarak eklenir; döngü değişmez (testte iki farklı adapter/model ile aynı tur
   sonucu kanıtlandı).
3. **Dayanıklılık.** `callLlmResilient` yalnız geçici hataları (timeout,
   rate_limited, unavailable) üstel bekleme ya da sağlayıcı `retryAfter` ile
   tekrar dener; refusal, invalid_output ve bütçe kesin sonuçtur. Process başına
   provider+model circuit breaker ardışık geçici hatalarda açılır ve sağlayıcıya
   gitmeden handoff döner.
4. **Bütçe ve acil durdurma.** Sıra: `LLM_EMERGENCY_STOP` → günlük harcama okuma
   → her adımda `min(perCall, kalanGünlük)` tavanı. Günlük harcama mevcut
   `llm_call_metrics` tablosundan (gerçek, `is_simulated=false` maliyet, UTC
   gün) okunur; yeni migration yok. Okuma hatası, fiyat yokluğu veya tükenmiş
   bütçe sağlayıcı çağrısı yapmadan güvenli handoff döner. Varsayılan günlük
   bütçe 0 (fail closed).
5. **Prompt ve güvenilmez veri.** System prompt sürümlüdür
   (`SYSTEM_PROMPT_VERSION`) ve yalnız operatör kurallarını içerir. Ziyaretçi
   mesajı ve ziyaretçiden türeyen özet user rolünde `<visitor_message>` /
   `<conversation_summary>` etiketleriyle veri olarak sarılır; içindeki etiket
   yazımları ve kontrol karakterleri nötrlenir. Mesaj penceresi tur ve karakter
   sınırıyla en yeni turları tutar, ziyaretçi turuyla başlar.
6. **Tool sözleşmesi.** Tool şeması JSON Schema alt kümesidir
   (`additionalProperties: false`, sınırlı string/integer/boolean). Model yalnız
   önerir; sunucu adı (bu turda sunulmuş mu) ve argümanları doğrular. Geçersiz
   çağrı çalıştırılmaz, modele hata kodu bir kez geri verilir, tekrarında
   handoff. Tenant/site her zaman sunucu bağlamından gelir. Yan etkili tool'lar
   tur kabul edilmiş bir yanıtla bitince `executeOnce` ile (anahtar: tur +
   argüman özeti) en fazla bir kez çalışır; tur refusal/timeout/bütçe ile
   biterse hiç çalışmaz. Adım sınırı sonsuz döngüyü engeller.
7. **Gözlem.** Her deneme `llm_call_metrics`'e token/maliyet/gecikme ile yazılır
   (P0.4 yolu); log'lar mesaj metni içermez.

## Sonuçlar

- Günlük bütçe toplamı satır okuyarak yapılır; yüksek hacimde P3.3
  `usage_ledger` ile değiştirilmeli.
- Circuit breaker process-local'dir; çok instance'ta instance başına çalışır.
- Özetin LLM ile üretilmesi ve kalıcı session hafızası P1.4 kapsamıdır.
