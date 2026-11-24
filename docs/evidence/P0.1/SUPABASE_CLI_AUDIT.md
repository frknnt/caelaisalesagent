# P0.1 Supabase CLI v3 Dogrulamasi

Tarih: 2026-11-20

Pinli proje dependency'si: `supabase@3.2.0`

## Gercek komut kaniti

- `npx supabase --version` -> `3.2.0`
- `npx supabase init --help` -> `TARGET Local only.`
- `npx supabase start --help` -> `TARGET Local only.` ve local container
  servisleri.
- `npx supabase db --help` -> db alt komutlari `[local or remote]` olarak
  etiketli.
- `npx supabase db push --help` -> `Local by default. Pass --remote...`.
- Global `--yes` aciklamasi -> hosted degisikliklerde prompt onayi;
  non-interactive calismada acik `--yes`/shell onayi gerektirir.

P0.1 kapsaminda `supabase init`, `start`, `login`, `link` veya remote komut
calistirilmadi. Schema, migration, RLS, hosted proje, token veya secret
olusturulmadi.

## Resmi kaynak dogrulamasi

- [Local Development & CLI](https://supabase.com/docs/guides/local-development):
  proje dependency'si `npx supabase`; `start` icin Docker uyumlu runtime; local
  stack public ağa acilmaz.
- [CLI Getting Started](https://supabase.com/docs/guides/local-development/cli/getting-started):
  `init` yalniz local dosyalari olusturur, login veya hosted baglanti yapmaz.
- [Local and hosted projects](https://supabase.com/docs/guides/local-development/local-and-hosted-projects):
  v3 hedef etiketleri ve acik `--remote` davranisi.
- [CLI changelog](https://supabase.com/changelog?tags=cli): 2026-11-04 v3
  breaking change; database komutlari local varsayilan, hosted degisiklikler
  onayli.

Makinede Docker 29.9.2 mevcuttur; local stack P0.2 schema/RLS kapsamindan once
baslatilmadi.
