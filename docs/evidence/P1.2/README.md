# P1.2 kanıt özeti

## Kapsam

- pgvector + FTS + RRF hybrid search
- organization/site/RLS + approved/current/fresh filtreleri
- source id/title/URL/page/snippet citation sözleşmesi
- draft/approved/disabled yaşam döngüsü
- freshness, stale uyarısı, due recrawl ve manual reindex
- kanıt yok/provider yok/çelişki durumunda güvenli fallback ve handoff

## Database kanıtı

- Ayrı boş local stack ilk açılışta 10 append-only migration ve güncel seed'i
  uyguladı.
- 15 pgTAP dosyası, 370 assertion: PASS.
- P1.2 özel dosyası 31 assertion: lexical ve semantic kollar, aynı tenant içi
  site filtresi, cross-tenant sıfır sonuç, draft/disabled/stale dışlama,
  citation, lifecycle allow/deny, manual reindex ve due recrawl: PASS.
- Security advisor: `No issues found`.
- Performance advisor: `No issues found`.
- Local/remote migration history 10/10 eşleşti.

## Uygulama ve tarayıcı kanıtı

- `npm run check`: format, lint, typecheck, 492 unit/component test ve
  production webpack build: PASS.
- İlk sandbox koşusunda ağ-izolasyon testinin kendi loopback bağlantısı OS
  `EACCES` aldı; aynı test sandbox dışında dış ağ preload guard açıkken 6/6,
  ardından tam kapıda 492/492 geçti. Beklenti değiştirilmedi.
- İlk tam `npm run test:e2e`: iki production build ve gerçek Chrome'da 168/168
  PASS. Yeni çoklu viewport kanıtı eklendikten sonraki 169 testlik koşuda 168
  test geçti; P1.2 dahil tüm işlevsel testler yeşildi. Bağımsız mevcut mobil
  widget performans ölçümü p95 1010 ms ile 1000 ms eşiğini bir koşuda 10 ms
  aştı; beklenti değiştirilmeden aynı test yeniden ölçüldü ve p95 960 ms ile
  PASS oldu.
- Knowledge ekranı empty, error, pending, ready, fresh, approved, disabled,
  draft, retry, keyboard ve 320px overflow durumlarını geçti.
- `screenshots/` altında approved/fresh yönetim yüzeyi 320, 375, 768, 1024 ve
  1440 px tam sayfa kanıtları bulunur.

## Denenmeyen

- Gerçek ücretli embedding API çağrısı, hosted Supabase, production scheduler,
  production deploy, gerçek domain recrawl ve dağıtık yük testi yapılmadı.
- Gerçek provider/model recall ve çelişki eval'i P4.2 release gate'inde ayrıca
  ölçülmelidir.
