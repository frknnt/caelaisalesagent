# ADR: Inbox, insan devri ve canli takip

- Tarih: 2026-11-27
- Durum: Kabul edildi
- Task: P1.5

## Baglam

Temsilci bir konusmayi devralirken botun devam eden veya gec kalan cevabinin
yayinlanmasi cift cevap uretir. Ayni konusmayi iki temsilcinin eszamanli
devralmasi, sorumlusuz agent devri ve e-posta servisindeki gecici hata da veri
tabanindan bagimsiz UI kontrolleriyle guvenli cozulmez. Inbox ayrica transcript,
arac gecmisi ve lead baglamini tenant disina sizdirmadan gostermelidir.

## Karar

- Konusmanin tek otoritesi Postgres'teki `handoff_state`, `assigned_to` ve
  `assignment_version` alanlaridir. Devralma, geri verme ve kapatma
  `SECURITY DEFINER` RPC'leriyle ve beklenen surum kontroluyle atomiktir.
- Devralma bekleyen bot yanitlarini iptal eder. `widget_complete_reply` yalniz
  konusma halen bot kontrolundeyse sonucu tamamlar; agent calisirken devralma
  olursa uygulama da son bot metnini ziyaretciye yayinlamaz.
- Temsilci mesaji yalniz acik, insan kontrolundeki ve kendisine atanmis
  konusmaya yazilabilir. Owner/admin geri verme ve kapatma icin operasyonel
  yetkiye sahiptir; Viewer inbox'i yonetemez.
- Agent riskli sonuc urettiginde konusma `agent_requested` nedeni ile sorumlusuz
  insan kuyruguna duser. Bu, uygun temsilci yokken guvenli fallback'tir.
- Handoff ve SLA e-postasi ayni veritabani islemi icinde transactional outbox'a
  yazilir. Ayri, token-korumali worker HTTPS webhook'una yalniz alici, sablon
  kodu ve conversation UUID gonderir; transcript gondermez.
- Arac gecmisinde yalniz arac adi, sonuc ve PII icermeyen yapisal ozet tutulur.
  Lead context servis tarafli RPC ile eklenir. Tum yeni tablolarda RLS ve
  minimum grants birlikte uygulanir.
- Inbox gorunur sekmede 10 saniyede bir server state'ini yeniler; kullanici
  input, textarea veya select duzenlerken yenileme yapmaz.

## Alternatifler

- Yalniz istemci state'iyle botu susturmak reddedildi: gec worker ve ikinci
  temsilci sunucu otoritesini asabilir.
- Kilitsiz `last write wins` assignment reddedildi: iki temsilciyi ayni anda
  basarili gosterir.
- E-postayi transaction icinde dogrudan gondermek reddedildi: dis servis hatasi
  devralma islemini bozabilir veya transaction retry'sinde cift e-posta
  uretebilir.
- Ilk surumde Supabase Realtime subscription yerine kontrollu polling secildi:
  yetki ve server-rendered filtre semantigi tek yerde kalir. Daha dusuk gecikme
  gerektiginde ayni DB otoritesi korunarak Realtime eklenebilir.

## Sonuclar ve riskler

Atama yarislari deterministik hata verir, gec bot cevabi yazilmaz ve tum kritik
gecisler audit event uretir. E-posta saglayicisi yokken devralma calismaya devam
eder ve outbox kaydi bekler. Polling anlik degildir ve ilk surum inbox sorgusu
en yeni 100 konusmayla sinirlidir; hacim arttiginda cursor pagination gerekir.

## Geri alma

Hosted ortama uygulanmadi. UI/worker kaldirilabilir. Uygulanmis veritabaninda
eski migration degistirilmez; yeni append-only migration ile inbox RPC execute
grant'leri kapatilir ve widget bot-only moda alinabilir. Acil e-posta durdurma
icin worker veya webhook env'i kaldirilir; outbox verisi korunur.
