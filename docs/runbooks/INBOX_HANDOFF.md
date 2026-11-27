# Inbox ve insan devri runbook'u

Bu runbook P1.5 insan devri, SLA bildirimi ve cift cevap korumasinin yerel veya
hosted ortamda isletilmesi icindir.

## Gerekli server env'leri

- `INBOX_NOTIFICATION_WORKER_TOKEN`: en az 32 rastgele byte degerinde worker
  Bearer token'i.
- `INBOX_EMAIL_WEBHOOK_URL`: localhost disinda HTTPS e-posta webhook'u.
- `INBOX_EMAIL_WEBHOOK_TOKEN`: en az 32 karakterlik webhook Bearer token'i.

Bu degerlerin hicbiri `NEXT_PUBLIC_*` olmamalidir. E-posta webhook'una
transcript, lead context veya tool history gonderilmez.

## Normal isletim

1. Hosting scheduler veya Supabase Cron'dan dakikada bir
   `POST /api/internal/inbox-notifications` cagir;
   `Authorization: Bearer <INBOX_NOTIFICATION_WORKER_TOKEN>` gonder.
2. `200 { claimed, delivered }` basaridir. `503 EMAIL_NOT_CONFIGURED`, outbox
   kayitlarini silmeden konfigurasyon eksigini bildirir. `401` token hatasidir.
3. Handoff bildirimleri devralma aninda; SLA reminder varsayilan 15 dakika icin
   planlanir. Ilk insan cevabi SLA reminder'ini gecersiz kilar.
4. Temsilci `/app/inbox` icinde konusmayi beklenen assignment version ile
   devralir. Conflict durumunda sayfayi yeniler; istegi korlemesine tekrarlamaz.

## Olay kontrolu

- Cift cevap suphelerinde conversation `handoff_state`, pending/complete bot
  message durumlari ve `audit_events` icindeki takeover/release/reply
  aksiyonlari birlikte incelenir.
- Iki temsilci sahip gorunuyorsa istemci cache'ine degil DB `assigned_to` ve
  `assignment_version` degerlerine guvenilir.
- Sorumlusuz kuyruk icin `handoff_state=human`, `assigned_to IS NULL` ve
  `handoff_reason=agent_requested` beklenir.
- E-posta sorunu konusma devrini geri almaz. Outbox `attempt_count`,
  `last_error`, `delivered_at` alanlariyla incelenir; secret veya tam e-posta
  govdesi loglanmaz.

## Guvenli durdurma ve geri alma

Worker scheduler'i durdurmak yalniz e-posta teslimini durdurur; outbox korunur.
Webhook env'ini kaldirmak fail-closed `503` verir. Inbox'i acil kapatmak icin
uygulama rotasi erisimi kapatilir; uygulanmis migration dosyalari degistirilmez.
Veritabani davranisi gerekiyorsa yeni append-only migration ile RPC grant'leri
geri cekilir.
