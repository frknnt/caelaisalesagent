# Database test kanıtı

## pgTAP

Komut:

```powershell
npm run db:test
```

Sonuç:

```text
00_schema_contract_test.sql .. ok
domains_rls_test.sql ......... ok
memberships_rls_test.sql ..... ok
organizations_rls_test.sql ... ok
profiles_rls_test.sql ........ ok
sites_rls_test.sql ........... ok
widget_bootstrap_test.sql .... ok
All tests successful.
Files=7, Tests=72
Result: PASS
```

Assertion'lar şunları birlikte kanıtlar:

- Tenant A, Tenant B satırlarını okuyamaz.
- Tenant A, Tenant B satırlarını güncelleyemez ve tenant anahtarını B'ye
  çeviremez.
- Aynı tenant içinde izinli SELECT/INSERT/UPDATE/DELETE gerçekten satır
  döndürür.
- İzinli UPDATE testleri `RETURNING` sonucunu doğrular; yalnız `lives_ok`
  kullanılmaz.
- Denied `USING` yolları sıfır satır döndürür ve hedef satırın değişmediği
  ayrıca okunur.
- Denied `WITH CHECK` ve missing-grant yolları `42501` doğrular.
- Anon yalnız widget bootstrap RPC'sini çalıştırabilir; organization, profile,
  membership, site ve domain tablolarını okuyamaz.
- Bütün public tablolarda RLS açıktır ve beklenen indeks/grant sözleşmesi
  vardır.

## Sıfır database

Final migration, seed ve testler ayrı project ID ve `65220-65229` local port
aralığındaki boş stack'e kopyalandı. İlk başlangıç çıktısı:

```text
Initialising schema...
Applying migration 20261121165737_create_tenant_core.sql...
Seeding data from supabase/seed.sql...
```

Aynı stack üzerinde 7 dosya / 72 assertion PASS verdi. Test stack'i hosted
projeye bağlanmadan normal `supabase stop` ile durduruldu; geçici source workdir
silindi.

## Uygulama kalite kapıları

`npm run check` sonucu:

- Prettier: PASS
- ESLint: PASS
- TypeScript: PASS
- Vitest: 3 dosya / 9 test PASS
- UI contract: 8/8 PASS
- Next.js 16.4.6 webpack production build: PASS

Sandbox içindeki ilk build `.next` altında Windows `EPERM mkdir` verdi. Aynı
kanonik komut normal filesystem erişimiyle yeniden çalıştırıldığında eksiksiz
PASS verdi; bu nedenle hata kod veya schema kaynaklı değildir.
