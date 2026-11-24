# P0.3 Kanıt Özeti

## Teslim

- `@supabase/ssr@0.12.7` ve `@supabase/supabase-js@2.119.2` exact pinlendi.
- Next 16 `proxy.ts`, browser/server/admin client ayrımı ve cookie +
  `Cache-Control`/`Expires`/`Pragma` propagation eklendi.
- Password login, callback, logout, korumalı app shell, tenant switcher,
  unauthorized/loading/error/empty durumları eklendi.
- Owner/Admin/Editor/Sales/Viewer role matrix, live membership guard,
  session-aware RLS, invitation lifecycle ve last-owner koruması eklendi.
- URL, path, query, header, cookie ve body/client-state organization ID'leri
  ortak tenant guard'dan geçirildi.

## Veritabanı kanıtı

- P0.2 mevcut yerel DB üzerine `20261121193307_add_auth_rbac_context.sql`
  başarıyla uygulandı; eski `member` satırı `viewer` oldu.
- Ayrı `caelaisalesagent-p03-zero` projesi ve 65520-65529 portlarıyla boş DB
  kuruldu.
- İki migration ve güncel seed sıfır DB'de başarıyla çalıştı.
- 8 pgTAP dosyası, 86 assertion: PASS.
- Supabase security advisor: issue yok.
- Supabase performance advisor: issue yok.
- Üretilen `db/database.types.ts` şemayla eşleşiyor.

## Uygulama kanıtı

- TypeScript: PASS.
- ESLint: PASS.
- Vitest: 6 dosya, 22 test PASS.
- Next production build: PASS.
- Gerçek Chrome Playwright: 20/20 PASS.
- Browser kapsamı: password login, iki tenant switch,
  URL/query/header/cookie/body IDOR 403, viewer unauthorized, logout/revoked
  access, klavye/a11y, loading/form states, 320 px ve %200 metin.

## Dış ortam

Hosted Supabase projesi, production secret veya production deploy kullanılmadı.
Davet e-postası yerel Mailpit için yapılandırıldı; DB
kabul/replay/revoked/expired/wrong-user davranışı pgTAP ile doğrulandı.
