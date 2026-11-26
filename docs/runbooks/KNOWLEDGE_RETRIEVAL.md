# Knowledge retrieval ve freshness runbook

## Production yapılandırması

- `EMBEDDING_PROVIDER_URL`: HTTPS server-side hook.
- `EMBEDDING_PROVIDER_TOKEN`: browser'a, log'a veya queue mesajına çıkmayan
  bearer token.
- `EMBEDDING_MODEL`: 384 boyut döndüren pinli model kimliği.
- `INGESTION_WORKER_TOKEN`: ingestion, retention ve recrawl endpoint'leri için
  en az 32 byte server-only token.

Embedding hook isteği:

```json
{"model":"model-id","dimensions":384,"input":["chunk text"]}
```

Yanıt aynı sırada ve her biri 384 finite sayı olan vektörleri taşır:

```json
{"embeddings":[[0.01,0.02]]}
```

Eksik boyut, NaN, satır sayısı farkı, timeout veya 4xx/5xx retryable ve
fail-closed'dur. Test hash provider'ını production'da açmayın.

## Yayın akışı

1. Kaynak ingestion'dan sonra `ready`, `fresh`, fakat `draft` görünür.
2. İnsan kaynak içeriğini ve citation hedefini kontrol eder.
3. **Approve** yalnız fresh/ready kaynakta çalışır.
4. Yanlış veya eski kaynakta **Disable** anında retrieval'ı kapatır.
5. Disabled kaynağı yeniden yayınlamak için önce **Move to draft**, sonra
   düzeltme/reindex ve **Approve** uygulanır.

## Recrawl ve manual reindex

Scheduler kısa aralıkla aşağıdaki ucu çağırır:

```text
POST /api/internal/ingestion/recrawl
Authorization: Bearer <INGESTION_WORKER_TOKEN>
```

Yanıt `{"queued":N}` döndürür. Ardından normal ingestion worker kuyruğu
işler. Manual **Reindex now** yalnız site/URL kaynağında aynı güvenli kuyruğu
kullanır. Aktif job varken ikinci reindex reddedilir.

Reindex boyunca kaynak `pending` ve retrieval dışıdır. Job `ready` olduğunda
yeni version atomik current olur; `freshness_checked_at`, `fresh_until`,
`last_crawled_at` ve `next_recrawl_at` güncellenir.

## Stale ve retrieval olayı

```sql
select id, organization_id, site_id, name, publication_status, status,
       freshness_checked_at, fresh_until, next_recrawl_at,
       latest_error_code
from public.knowledge_sources
where publication_status = 'approved'
  and (status <> 'ready' or fresh_until is null or fresh_until <= now())
order by fresh_until nulls first;
```

Stale kaynağı elle SQL ile fresh veya approved yapmayın. Crawler/provider
sağlığını düzeltin, manual reindex çalıştırın, yeni citation'ları doğrulayın.

## Güvenlik kontrolü

- Retrieval sonucunda organization/site başka tenant/site değerini içeremez.
- `draft`, `disabled`, `stale`, `failed`, `pending` ve eski version sonucu sıfır
  olmalıdır.
- Her supported cevapta source id, title, URL veya page ve snippet bulunmalıdır.
- Kaynak yoksa veya provider erişilemiyorsa citation boş, handoff açık olmalıdır.
- Çelişkili kaynaklarda agent birini seçmemeli; iki citation'ı taşıyıp insan
  doğrulaması istemelidir.
