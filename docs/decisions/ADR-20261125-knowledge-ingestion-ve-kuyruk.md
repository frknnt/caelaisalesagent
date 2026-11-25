# ADR-20261125: Knowledge ingestion ve kuyruk sınırı

- Durum: Kabul edildi
- Tarih: 2026-11-25
- Task: P1.1

## Bağlam

Site, URL, metin, SSS ve ham dosya aynı tenant-safe bilgi modeline girmeli;
dosya ve sayfa içeriği kuyruk, log veya başka tenant yüzeyinden sızmamalıdır.
Worker tekrar teslim, timeout ve poison message altında aynı sürümü iki kez
üretmemelidir. Crawl, müşteri tarafından verilen URL'yi sunucu ağına erişim
aracı haline getirmemelidir.

## Karar

1. Kaynak kimliği `organization + site + type + source_key`, sürüm kimliği
   `source + content_sha256` ile atomik unique olur. Aynı içerik ikinci source,
   version, job veya queue message oluşturmaz.
2. PGMQ basic queue yalnız server-side worker tarafından okunur. Mesaj yalnız
   `job_id`, `source_id`, `version_id` taşır; ham metin, URL içeriği, dosya adı,
   PII ve hata mesajı taşımaz.
3. Görünür tek durum sözleşmesi `pending/processing/ready/failed` ve 0-100
   progress'tir. Retry aynı job'ı sıfırlar; yeni kaynak/sürüm üretmez. Başarılı
   veya poison mesaj archive edilir.
4. Ham dosya private `knowledge-sources` bucket'ındadır. Yol
   `organization/site/content-hash/safe-name` biçimindedir; bucket 25 MiB ve beş
   MIME ile sınırlıdır. RLS hem membership/rolü hem path'teki site-tenant
   eşleşmesini doğrular.
5. Dosyanın extension, declared MIME ve magic signature'ı birlikte doğrulanır.
   Malware hook yoksa veya bozuk cevap verirse dosya fail-closed retry olur;
   `clean` olmadan extraction başlamaz. Ham dosya için varsayılan retention 30
   gündür; service-role batch object'i silip DB kaydını işaretler.
6. Crawl yalnız HTTPS ve seçili siteye ait doğrulanmış domain allowlist'inde
   çalışır. DNS sonucu private/link-local/loopback ise, redirect allowlist
   dışına çıkarsa veya page/depth/byte limitini aşarsa istek reddedilir.
   `robots.txt` disallow kuralları uygulanır.
7. Extracted chunk satırlarında email, telefon, kimlik, adres ve IBAN türleri
   ile fiyat içeren gerçek kaynak satır numaraları tutulur. Bu işaretler içerik
   yayınlama/onay kararı değildir.
8. Worker ve retention uçları en az 32 byte server-only bearer token ister.
   Secret browser'a, kuyruk mesajına veya log'a girmez.

## Alternatifler

- Queue payload'ına ham içerik koymak reddedildi: retry/monitoring yüzeyinde PII
  çoğaltır ve retention'ı parçalar.
- Browser'ın doğrudan pgmq çağırması reddedildi: consumer yetkisi ve poison
  yönetimi istemciye açılamaz.
- Public bucket veya signed URL tabanlı worker reddedildi: service worker'ın
  private Storage erişimi yeterlidir ve paylaşılabilir URL üretmez.
- Malware servisi yokken extraction'a devam etmek reddedildi: temiz olduğu
  kanıtlanmayan dosya parse edilmez.

## Sonuçlar ve riskler

- Worker pull-based olduğu için production scheduler/runner bu HTTP ucunu
  çağırmalıdır; hosted schedule P1.1 kapsamında kurulmadı.
- DNS kontrolü fetch öncesidir; production egress proxy/firewall ikinci savunma
  katmanı olarak yine gereklidir.
- Basit regex işaretleri false-positive/false-negative üretebilir; işaretler
  insan review sinyalidir, veri sınıflandırma garantisi değildir.
- DOCX/XLSX/PDF parser güncellemeleri dependency audit ve aynı fixture testleri
  geçmeden alınmamalıdır.

## Geri alma yolu

Worker token boş bırakılırsa ingestion ve retention uçları 404 ile kapanır.
Hosted DB'ye uygulandıktan sonra queue/function grant'leri append-only migration
ile kapatılır; mevcut source/version metadata okunur bırakılır. Storage
object'leri retention runbook'u ile silinir; eski migration değiştirilmez.
