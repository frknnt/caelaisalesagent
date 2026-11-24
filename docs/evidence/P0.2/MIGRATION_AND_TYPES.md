# Migration ve generated type kanıtı

## CLI sözleşmesi

Kurulu ve pinli sürüm:

```text
supabase 3.2.0
```

Gerçek `--help` çıktıları şu hedefleri doğruladı:

- `supabase init`: Local only.
- `supabase migration new`: Local only.
- `supabase test db`: Local by default.
- `supabase db reset`: Local by default.
- `supabase db advisors`: Local by default.
- `supabase gen types`: Local by default.

Hosted hedef için açık `--remote` gerekir. Bu task'ta kullanılmadı.

Migration dosyası elle adlandırılmadı; şu komutla oluşturuldu:

```powershell
npx supabase migration new create_tenant_core
```

CLI çıktısı:

```text
Migration created:
supabase/migrations/20261121165737_create_tenant_core.sql
```

## Mevcut DB upgrade

Mevcut ana local database silinmedi. Ayrı project ID ve `65320-65329` local port
aralığında migration'sız Supabase platform baseline'ı başlatıldı. Kanonik
migration daha sonra eklendi.

Önce:

```json
{ "local": "20261121165737", "remote": "" }
```

Komut ve sonuç:

```text
supabase migration up
Applying migration 20261121165737_create_tenant_core.sql...
```

Sonra:

```json
{ "local": "20261121165737", "remote": "20261121165737" }
```

Bu, Supabase platform şeması zaten bulunan bir local database'e append-only
tenant migration'ının uygulanabildiğini kanıtlar.

## Generated types

`db/database.types.ts`, local public şemadan
`supabase gen types typescript --schema public` ile üretildi.
`npm run db:types:check`, CLI çıktısını repodaki dosyayla karşılaştırır ve
drift'te non-zero döner.

Final sonuç:

```text
Database types match the local public schema.
```
