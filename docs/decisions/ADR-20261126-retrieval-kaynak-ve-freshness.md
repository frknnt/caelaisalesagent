# ADR-20261126: Retrieval, kaynak ve freshness sınırı

- Durum: Kabul edildi
- Tarih: 2026-11-26
- Task: P1.2

## Bağlam

P1.1 kaynakları tenant/site kapsamlı chunk'lara dönüştürür, fakat bir chunk'ın
retrieval'a girmesi yayın onayı, güncellik, aktif sürüm ve citation sözleşmesi
olmadan güvenli değildir. Semantic arama sağlayıcısı yoksa lexical sonuçtan
sessizce cevap üretmek "hybrid search" iddiasını ve güvenli fallback'i bozar.

## Karar

1. Retrieval adayları SQL'de aynı anda organization, site, canlı RLS üyeliği,
   `approved`, `ready`, `current_version_id` ve `fresh_until > now()` ile
   filtrelenir. Uygulama katmanı bu sınırı gevşetemez.
2. Keyword kolu `simple` sözlüğüyle generated `tsvector` + GIN, semantic kolu
   384 boyutlu pgvector cosine + HNSW kullanır. İki sıralama Reciprocal Rank
   Fusion (`k=50`) ile birleştirilir.
3. Embedding modeli server-only HTTP adaptörüdür. Endpoint, token veya model
   eksik/bozuksa ingestion ve query fail-closed olur. Deterministik hash
   embedding yalnız `CAEL_TEST_HARNESS=enabled` iken kullanılabilir.
4. Kaynak yayın durumu ingestion durumundan ayrıdır: `draft`, `approved`,
   `disabled`. Yeni kaynak draft'tır; yalnız editor/admin/owner RPC ile fresh ve
   ready kaynağı onaylayabilir. Disabled kaynak aynı transaction'dan itibaren
   retrieval dışındadır.
5. Her retrieval sonucu source id, source title, URL, page reference, kısa
   snippet ve fresh-until taşır. PDF extraction sayfa bazında doküman üretir.
6. Freshness varsayılan 30 gündür. Başarılı ingestion atomik olarak yeni
   current version'ı ve freshness penceresini açar. URL/site için due recrawl
   server-only scheduler RPC'si ve owner/admin/editor manual reindex RPC'si
   vardır.
7. Reindex sırasında kaynak geçici olarak `pending` olur ve eski sürüm cevapta
   kullanılmaz. Bu bilinçli fail-closed downtime, stale veya değişmiş içeriği
   sunmaktan daha güvenlidir.
8. Kanıt yoksa, retrieval erişilemiyorsa veya yüksek ilgili farklı kaynaklarda
   çelişen atomik sayı/tarih/fiyat değerleri varsa cevap seçilmez; citation'lı
   fallback ve insan devri oluşur.

## Alternatifler

- Yalnız lexical arama reddedildi: hybrid teslimini ve anlam tabanlı recall'ı
  karşılamaz.
- Service-role ile tablo okuyup uygulamada tenant filtresi yapmak reddedildi:
  yanlış filtre tek sorguda veri sızdırabilir.
- Draft/stale sonucu düşük skorla tutmak reddedildi: düşük skor yayın onayı veya
  güncellik kanıtı değildir.
- Reindex boyunca eski sürümü sunmak ertelendi: blue/green source activation
  ek durum ve hata semantiği gerektirir; fail-closed mevcut task için daha
  güvenlidir.
- Provider yokken lexical-only cevap reddedildi: görünmez kalite düşüşü yerine
  güvenli fallback seçildi.

## Sonuçlar ve riskler

- Mevcut P1.1 kaynakları migration sonrası `draft` ve embedding'sizdir; yeniden
  ingest edilip insan tarafından onaylanmadan retrieval'a girmez.
- HNSW approximate recall ve 384 boyut seçimi gerçek provider/model üzerinde
  eval ile izlenmelidir; model değişimi reindex gerektirir.
- Deterministik çelişki kontrolü sayı/tarih/fiyat gibi atomik değerleri kapsar;
  dilsel tüm çelişkileri kanıtlamaz. P4.2 eval seti bunu genişletmelidir.
- Manual reindex şimdilik yalnız tekrar fetch edilebilen `site` ve `url`
  kaynakları içindir. Dosya/manual kaynağın yeni içeriği yeni ingestion olarak
  eklenir.

## Geri alma yolu

`EMBEDDING_PROVIDER_*` boşaltılırsa yeni ingestion ve retrieval güvenli
fallback'e döner. Recrawl endpoint'i worker token boşken 404 olur. Hosted DB'ye
uygulandıktan sonra function grant'leri ve lifecycle RPC'leri append-only
migration ile kapatılır; eski migration değiştirilmez. Veri kolonları okunur
bırakılır, HNSW/GIN indeksleri ayrı append-only migration ile kaldırılabilir.
