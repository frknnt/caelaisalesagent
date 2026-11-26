# P1.4 kanıtları

Tarih: 2026-11-26. LLM: `demo` adapter (ağ yok, maliyet yok, yalnız onaylı
kaynak metni). Gerçek/ücretli sağlayıcı çağrısı yok. E2E ve sıfır DB ayrı geçici
stack'te (`caelaisalesagent-p14`, 655xx portlar, sonra silindi).

## Ön düzeltme (P1.3'ten kalan E2E giriş hatası)

- Yeniden üretim: ana stack'te (65421) `owner-a@example.test` şifreli giriş
  `500 Database error querying schema`.
- Kök neden: E2E, `E2E_SUPABASE_WORKDIR` verilmeyince ana yerel stack'i
  kullanır; o stack eski bir seed'le doldurulmuştu (4 kullanıcı,
  `confirmation_token`, `recovery_token`, `email_change*` NULL, şifre ve
  identity yok). GoTrue NULL string kolonu okuyamıyor.
- Düzeltme: ana DB'ye yalnız NULL kolonları `''` yapan idempotent UPDATE (4
  satır) ve eksik `auth.identities` (4 satır, `on conflict do nothing`); veri
  silinmedi. Ana DB'de 500 kalktı (artık 400: o kullanıcıların şifresi yok).
  `supabase/seed.sql` güncellemesine `phone_change`/`phone_change_token`
  eklendi. `scripts/run-e2e.mjs` build'den önce seed kullanıcısıyla giriş dener;
  eski seed'li stack'te gerçek nedenle durur ve README'deki ayrı stack yolunu
  söyler. CI taze stack kullandığı için etkilenmez. Testler gevşetilmedi.

## Zorunlu test eşlemesi

| Zorunlu test                   | Kanıt                                                                                                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Refresh / reconnect            | E2E `a visitor gets a sourced, streamed answer and keeps it across a refresh`, `a dropped answer is found again, and a failed send can be sent again`; unit `a refresh (new session, same key) returns the conversation`; pgTAP resume |
| Aynı mesaj iki kez             | pgTAP `widget_conversations_test` (in_progress, duplicate, geç işçi üzerine yazamaz, tek mesaj/tek cevap); unit `the same message twice ...`, `a resend while the reply is still being written ...`; E2E `a second Enter ...`          |
| Klavye / screen reader / mobil | E2E `works with the keyboard alone` (sekme sırası, Shift+Enter, Enter), mobil modal odak tuzağı, `aria-live` duyurusu, axe; 375/1440 ekranları; P0.5 320-1440 düzen testleri yeni arayüzle yeşil                                       |
| Uzun konuşmada summary         | unit `folds turns that leave the window into a summary the model gets as data`, `keeps the newest lines ...`; pgTAP özet yalnız ileri gider                                                                                            |

Diğer teslimler: streaming (unit SSE sırası + port seviyesinde zaman aşımı
sonrası parça kesme), retry (failed/terk edilmiş cevap yeniden claim, 5 deneme
sınırı), feedback (yalnız kendi cevabı), suggested prompts, consent-aware memory
(2 saat / consent ile 180 gün; consent geçmişi purpose+version+source), spam (30
sn tekrar), mesaj limiti (oturum 12/dk, site 600/dk, konuşma 100), attachment
yer tutucu ve sunucu reddi, error UX (429/503/çevrimdışı + tekrar gönder + insan
yolu).

## Kapılar (Demo kapısı)

| Komut                                                                  | Sonuç                                                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `CAEL_NEXT_DIST_DIR=.next-check npm run check`                         | PASS: format, lint, typecheck, 29 dosya / 537 unit+component, production build       |
| Sıfır DB (`supabase db reset --workdir <p14>`) + `supabase test db`    | PASS: 12 migration + seed; 16 dosya / 422 pgTAP (`pgtap-zero-db.txt`)                |
| `supabase db advisors` security + performance `--fail-on warn`         | PASS: `No issues found` (ikisi)                                                      |
| Upgrade: ana yerel DB'ye `supabase migration up`                       | PASS: 2 yeni migration; org/site/domain sayıları aynı; `npm run db:types:check` PASS |
| `E2E_SUPABASE_WORKDIR=<p14> npm run test:e2e` (tam, iki build, Chrome) | PASS 177/177 (`e2e-related.txt`)                                                     |
| `npm run test:failure-proof -- --e2e`                                  | PASS                                                                                 |

İlk tam koşu 3 hata verdi ve kök nedenleriyle düzeltildi: P1.3 config
varsayılanı `fake-model-1` üretim bundle'ına giriyordu (varsayılan artık
`unconfigured`, yine fail-closed); P0.5 testindeki "P1.4 öncesi sohbet/storage
yok" beklentisi P1.4 sözleşmesine (etiketli mesaj kutusu; frame'de yalnız
`cael.visitor` sessionStorage anahtarı, localStorage ve cookie yok) güncellendi;
İngilizce öneri metni "talk to a person" ifadesini tekrar ettiği için değişti.
Önceki ilgili koşuda bulunan iki gerçek hata da düzeltildi: P1.2
`retrieve_approved_knowledge` service role'a hiç sonuç dönmüyordu (yeni
migration), %200 metinde mesaj satırı taşıyordu (CSS).

## Ekranlar

`screenshots/chat-{loading,empty,answered,error}-{375,1440}.png`. 375 px cevap
ekranı elle incelendi: kaynak adı, geri bildirim, insan yolu ve hafıza seçeneği
görünür, yatay taşma yok.

## Denenemeyenler

Gerçek LLM sağlayıcısı ve `test:paid` (adapter + kullanıcı onayı gerekir);
hosted Supabase, gerçek domain/HTTPS, Safari/Firefox/gerçek telefon, gerçek
ekran okuyucu (yalnız ARIA ve axe); `db:check` (`db:reset` ana yerel veriyi
siler); mutasyon ve tekrarlı performans ölçümü (yalın profil).
