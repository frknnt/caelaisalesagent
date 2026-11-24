# RLS, grants ve advisor kanıtı

## RLS ve authorization

RLS açık public tablolar:

1. `organizations`
2. `profiles`
3. `memberships`
4. `sites`
5. `domains`

Policy'ler açık `TO authenticated` hedefiyle birlikte canlı membership/role
predicate'i kullanır. `TO authenticated` tek başına yetkilendirme sayılmaz.
`raw_user_meta_data` yalnız profil display name başlangıcı için kullanılır;
authorization kararında kullanılmaz.

UPDATE policy'leri hem `USING` hem `WITH CHECK` içerir. Cross-tenant tenant-key
mutation testleri `42501` veya sıfır `RETURNING` satırıyla reddedilir; hedef
satırın değişmediği ayrıca doğrulanır.

## Grants

- `anon`: beş tenant tablosunda hiçbir table grant yok.
- `authenticated`:
  - organizations: SELECT, UPDATE
  - profiles: SELECT, UPDATE
  - memberships: SELECT, INSERT, UPDATE, DELETE
  - sites: SELECT, INSERT, UPDATE, DELETE
  - domains: SELECT, INSERT, UPDATE, DELETE
- TRUNCATE, REFERENCES ve TRIGGER gibi geniş yetkiler client rollerine verilmez.
- `service_role` yalnız server-side sözleşmedir; browser env, source veya log'a
  eklenmedi.

Default privileges `public` tabloları, sequence'leri ve fonksiyonları için
explicit revoke ile daraltılır. `api.auto_expose_new_tables = false` olarak
ayarlanır.

## Public bootstrap

Anon tablo SELECT alamaz. `public.get_widget_bootstrap(hostname)` public
security-invoker wrapper'dır. RLS bypass gereken lookup, exposed olmayan
`private` şemada, sabit boş `search_path` kullanan dar security-definer
fonksiyonudur. Yalnız şu güvenli alanlar döner:

- `site_id`
- `site_name`
- `widget_title`
- `locale`

Organization internal name, membership, profile, domain listesi ve başka site
satırları dönmez. Domain lock ve public session P0.5 kapsamındadır.

## Advisors ve secret taraması

Komutlar:

```powershell
supabase db advisors --type security --level warn --fail-on warn
supabase db advisors --type performance --level warn --fail-on warn
```

İki sonuç da:

```text
No issues found
```

Repo taramasında `sb_secret_`, committed service-role key veya local JWT secret
eşleşmesi bulunmadı.
