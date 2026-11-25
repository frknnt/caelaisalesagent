# Knowledge ingestion runbook

## Güvenlik sınırı

- `INGESTION_WORKER_TOKEN`: en az 32 rastgele byte; browser'a verilmez.
- `INGESTION_MALWARE_SCANNER_URL` ve `INGESTION_MALWARE_SCANNER_TOKEN`:
  server-only scanner hook. Hook JSON `{ "status": "clean" }` veya
  `{ "status": "infected" }` döndürür.
- Queue mesajı yalnız UUID taşır. Log'a source metni, URL query'si, dosya adı,
  PII, fiyat satırı veya scanner cevabı yazılmaz.

## Worker çalıştırma

Scheduler aşağıdaki ucu kısa aralıklarla çağırır. Her çağrı en çok bir mesaj
işler; backlog için kontrollü paralel consumer kullanılabilir.

```text
POST /api/internal/ingestion
Authorization: Bearer <INGESTION_WORKER_TOKEN>
```

`{"processed":false}` görünür mesaj olmadığını belirtir. `true` ise job `ready`,
retry için `pending` veya kalıcı hata için `failed` olmuştur.

## Retention

Günde en az bir kez:

```text
POST /api/internal/ingestion/retention
Authorization: Bearer <INGESTION_WORKER_TOKEN>
```

Yanıt `claimed` ve Storage'dan gerçekten silinip işaretlenen `deleted`
sayılarını verir. Silme hatası satırı 15 dakika sonra tekrar claim edilebilir.

## Güvenli retry ve poison

1. UI'da yalnız `failed` job için **Retry safely** kullanılır.
2. Aynı job `attempt_count=0`, `pending`, progress 0 olur; source/version
   çoğalmaz.
3. Retryable worker hatası exponential delay ile yeniden queue edilir.
4. `max_attempts` aşılmış mesaj `POISON_MESSAGE` ile failed olur ve archive
   edilir. Önce error code, scanner/crawl/storage sağlığı ve allowlist
   incelenir; kör tekrar yapılmaz.

## Olay kontrolü

```sql
select id, source_id, status, progress, attempt_count, max_attempts,
       last_error_code, updated_at
from public.ingestion_jobs
where status in ('pending', 'processing', 'failed')
order by updated_at;
```

Ham içeriği veya `chunks.content` alanını olay kaydına kopyalamayın. Tenant
izolasyon şüphesinde worker token'ını döndürün, worker endpoint'ini kapatın,
Storage RLS/grant ve source/job tenant anahtarlarını allow+deny pgTAP ile
yeniden doğrulayın.
