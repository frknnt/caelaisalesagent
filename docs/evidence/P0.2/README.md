# P0.2 kanıt özeti

P0.2, organization/site tenant çekirdeğini local Supabase/Postgres üzerinde
kurar ve izolasyonu grants + RLS + pgTAP ile kanıtlar.

## Sonuç

- Supabase CLI: `3.2.0`, tam sürüme pinli ve komut hedefleri `--help` ile
  doğrulandı.
- Migration: CLI ile üretilen `20261121165737_create_tenant_core.sql`,
  append-only ilk tenant migration'ı.
- Şema: `organizations`, `profiles`, `memberships`, `sites`, `domains`.
- RLS: beş public tablonun tamamında açık.
- Grants: anon için tenant tablolarında sıfır; authenticated için yalnız
  policy-scoped minimum DML.
- Public bootstrap: hostname parametreli RPC, yalnız `site_id`, `site_name`,
  `widget_title`, `locale` döndürüyor.
- Database testleri: 7 dosya, 72 assertion, PASS.
- Advisors: security ve performance, warn seviyesinde sıfır bulgu.
- Generated types: local public şemayla eşleşiyor.
- Sıfır DB: ayrı boş local stack ilk açılışta migration + seed uyguladı ve 72
  assertion PASS verdi.
- Upgrade: ayrı migration'sız local baseline'da migration history önce boş,
  `migration up` sonrası local/remote version eşit.
- Uygulama kapıları: format, lint, typecheck, 9 unit, UI contract ve production
  webpack build PASS.

Hosted Supabase projesi, access token, database password, production secret,
commit, push veya deploy kullanılmadı.

Detaylı kanıtlar:

- [`DATABASE_TESTS.md`](DATABASE_TESTS.md)
- [`MIGRATION_AND_TYPES.md`](MIGRATION_AND_TYPES.md)
- [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md)
