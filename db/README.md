# Database sınırı

P0.2 tenant çekirdeği local-first Supabase/Postgres üzerinde kurulur. Kanonik
şema append-only migration dosyalarındadır; `db/database.types.ts` yalnız local
Postgres şemasından üretilen TypeScript sözleşmesidir.

## Tenant modeli

- `organizations`: tenant kökü ve ayrı public/internal adlar.
- `profiles`: `auth.users.id` ile bire bir kullanıcı profili; auth kimliği veya
  parola kopyalanmaz.
- `memberships`: kullanıcıyı organization'a `owner`, `admin` veya `member`
  rolüyle bağlayan authoritative yetki kaynağı.
- `sites`: organization kapsamlı web sitesi ve güvenli widget görünüm alanları.
- `domains`: organization + site composite foreign key'iyle tenant anahtarının
  başka siteye taşınmasını engelleyen normalize hostname kaydı. Yalnız
  `verification_method` dolu satır (veya süreli preview satırı) widget'ı açar;
  istemci doğrulama, wildcard, ortam ve süre alanlarını yazamaz.
- `site_keys`: siteye ve ortama bağlı public anahtar. Owner/admin RPC ile üretir
  ve iptal eder.
- `widget_sessions`: teknik widget oturumu (IP, kimlik, içerik yok). Yalnız
  service role fonksiyonları yazar, owner/admin okur.
- `private.widget_rate_counters`: rate limit sayaçları; hiçbir API rolü
  erişemez.

- `audit_events`: append-only denetim izi. Üyelik ve davet değişikliklerini
  trigger, satır değiştirmeyen olayları service role yazar; istemci yazamaz,
  kimse güncelleyip silemez. Yalnız owner/admin okur, metadata serbest metin
  kabul etmez.
- `llm_call_metrics`: sağlayıcı denemesi başına token, süre ve maliyet. Yalnız
  service role ekler, owner/admin okur; fatura defteri değildir.
- `knowledge_sources` / `knowledge_versions`: tenant + site kapsamlı kaynak ve
  immutable içerik sürümü; görünür durum `pending/processing/ready/failed`.
- `documents` / `chunks`: çıkarılan dokümanlar ve deterministic parçalar. Chunk
  PII türleri ile fiyat satırı numaralarını taşır.
- `ingestion_jobs`: idempotent PGMQ worker işi, attempt/progress/error code ve
  poison durumunu taşır; ham içerik taşımaz.

`knowledge-sources` Storage bucket'ı private, 25 MiB ve PDF/DOCX/TXT/CSV/XLSX
MIME allowlist'lidir. Obje yolu organization/site/content-hash ile başlar;
Storage RLS path tenant anahtarını canlı membership ve site FK'sine karşı
doğrular. Queue consumer ve retention RPC'leri yalnız `service_role` içindir.

Authorization `raw_user_meta_data` veya bayat kalabilen JWT organization
claim'lerinden değil, her sorguda canlı `memberships` tablosundan hesaplanır.
Public tablolarda RLS açıktır; grants önce tamamen geri alınır, sonra yalnız
gereken DML yetkileri geri verilir.

Anon hiçbir tenant tablosunu okuyamaz ve hiçbir public fonksiyonu çağıramaz.
P0.2 `get_widget_bootstrap` RPC'si P0.5'te kaldırıldı; widget uygulama
sunucusuyla konuşur, sunucu service role RPC'lerini (`widget_bootstrap`,
`widget_frame`, `create_widget_session`, `check_widget_session`) çağırır.

## Local çalışma

Docker Desktop veya Docker uyumlu bir runtime çalışırken:

```powershell
npm run db:start
npm run db:reset
npm run db:test
npm run db:types:check
npm run db:advisors
npm run db:stop
```

Windows'un varsayılan Supabase port aralığını ayırabildiği makinelerde çakışma
olmaması için local stack `65420-65429` aralığını kullanır. Hosted proje, access
token, database password veya production service-role anahtarı gerekmez.

Şema değişikliğinde yeni migration dosyasını yalnız CLI ile oluşturun:

```powershell
npx supabase migration new descriptive_name
```

Mevcut migration dosyalarını değiştirmeyin. Şema değiştikten ve local reset
başarılı olduktan sonra tipleri yenileyin:

```powershell
npm run db:types
npm run db:types:check
```

`db:types:check`, üretilmiş public şema ile repodaki type dosyasını
karşılaştırır ve drift varsa non-zero döner.
