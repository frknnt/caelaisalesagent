# Cael AI Sales Agent - Ilerleme Notlari

Bu dosya append-only'dir. Tamamlanan veya `BLOCKED` kalan uygulama task'lari icin yeni kayit her zaman dosyanin sonuna eklenir. Gecmis kayitlar yeniden yazilmaz, siralanmaz veya ozetlenerek silinmez.

Baslangic anindaki durum (2026-11-20): Henuz uygulama task'i baslatilmadi; `NEXT_TASK` `P0.1` olarak tanimlandi.

## Kayit sablonu

### YYYY-MM-DD - TASK_KODU - Task basligi

- Durum: `DONE` / `BLOCKED`
- Sure:
- Amac:
- Degisen dosyalar:
- Migration / schema:
- Env / secret / dependency:
- API / UI etkisi:
- Test komutlari ve sonuclari:
- Ekran / SQL / RLS kaniti:
- Denenemeyenler:
- Bilinen riskler / teknik borc:
- Geri alma yolu:
- NEXT_TASK:

### 2026-11-21 - P0.1 - Repo, UI tasarim sistemi ve CI

- Durum: `DONE`
- Sure: 2026-11-20 - 2026-11-21; tek uygulama oturumu (arac/indirme beklemeleri dahil)
- Amac: Next.js/TypeScript temelini, anti-slop UI sozlesmesini, erisilebilir prototipleri ve her degisiklikte calisan kalite kapilarini kurmak.
- Degisen dosyalar: `package.json`, `package-lock.json`, Next/TypeScript/Tailwind/ESLint/Prettier/Vitest/Playwright config'leri, `.github/workflows/ci.yml`, `app/`, `modules/`, `lib/`, `db/README.md`, `tests/`, `scripts/`, `README.md`, UI referansi ve `docs/evidence/P0.1/`.
- Migration / schema: Yok. P0.2 database, migration ve RLS kapsami P0.1'e cekilmedi.
- Env / secret / dependency: Secret yok. `.env.example` yalniz server-side `APP_BASE_URL` sozlesmesini tanimlar. Next 16.4.6, React 19.3.1, TypeScript 6.0.3, Tailwind 4.3.5, Vitest 5.1.1, Playwright 1.65.1, axe 4.14 ve Supabase CLI 3.2.0 dahil tum dogrudan paketler tam surume pinlendi. ESLint 9.39.5, Next plugin peer uyumlulugu nedeniyle pinlendi.
- API / UI etkisi: Landing shell, app shell, component galerisi, form durumlari, statik responsive inbox three-pane ve guvenli `/api/health` runtime endpoint'i eklendi. AI kimligi ve insan devri prototipte gorunurdur; gercek veri/agent davranisi yoktur.
- Test komutlari ve sonuclari: `npm ci` temiz kurulum PASS ve 0 vulnerability; `npm run test:failure-proof` kasitli bozuk testte exit 1 PASS; `npm run check` format + lint + typecheck + 9/9 unit + 8/8 no-slop + webpack production build PASS; `npm run test:e2e` production server'da 15/15 PASS; Supabase `--version` ve `--help` dogrulamalari PASS.
- Ekran / SQL / RLS kaniti: `docs/evidence/P0.1/screenshots/` altinda production 375/768/1024/1440 tam sayfa goruntuleri; dort rotada axe sifir ihlal; keyboard/focus, reduced-motion, 320px reflow, yuzde 200 metin, form loading/empty/validation/error/success ve three-pane testleri PASS. SQL/RLS yok; P0.2 kapsami.
- Denenemeyenler: Git metadata/remote olmadigi ve commit/push istenmedigi icin gercek GitHub Actions run'i, branch protection ve hosted CI yetkileri denenmedi. Production deploy, gercek Supabase proje linki ve local Supabase stack baslatma yapilmadi.
- Bilinen riskler / teknik borc: Next 16 varsayilan Turbopack Windows sandbox'inda aralikli child-process panic verdigi icin production build kararlilik adina resmi `--webpack` secenegine sabitlendi. ESLint 9 upstream tarafindan deprecated olarak isaretli; Next'in plugin zinciri ESLint 10 peer destegi verdiginde kontrollu upgrade gerekir. Statik prototip sonraki task davranislarini uygulamaz.
- Geri alma yolu: Yeni uygulama/config/test/evidence dosyalarini kaldirip roadmap P0.1 satirini onceki duruma almak yeterlidir; database veya hosted kaynak rollback'i yoktur. `.next` ve test raporlari yeniden uretilebilir build artefact'laridir.
- NEXT_TASK: `P0.2` - Supabase, tenant semasi ve RLS

### 2026-11-21 - P0.2 - Supabase, tenant semasi ve RLS

- Durum: `DONE`
- Sure: 2026-11-21; tek uygulama oturumu (Docker image ve local stack beklemeleri dahil)
- Amac: Organization/site tenant cekirdegini Supabase/Postgres katmaninda kurmak; izolasyonu minimum grants, RLS ve otomatik allow/deny testleriyle kanitlamak.
- Degisen dosyalar: `supabase/config.toml`, CLI ile olusturulan `supabase/migrations/20261121165737_create_tenant_core.sql`, `supabase/seed.sql`, `supabase/tests/database/` altinda 7 pgTAP dosyasi, `db/database.types.ts`, `db/README.md`, `scripts/check-database-types.mjs`, `package.json`, `.github/workflows/ci.yml`, `README.md`, tenant/bootstrap ADR'i ve `docs/evidence/P0.2/`.
- Migration / schema: Append-only ilk tenant migration'i `organizations`, `profiles`, `memberships`, `sites`, `domains`, composite tenant FK'leri, uniqueness/check constraint'leri, FK/RLS indeksleri, private authorization yardimcilari, auth-user profil trigger'i, public bootstrap RPC'si, explicit grants ve butun public tablolarda RLS olusturdu. Deterministik seed Tenant A, Tenant B, iki A kullanicisi, B owner, uye olmayan kullanici, site ve domain fixture'larini kurdu.
- Env / secret / dependency: Yeni dependency veya env yok. Supabase CLI `3.2.0` pinli kaldi. Hosted access token, database password, production service-role veya baska secret kullanilmadi. Local stack Windows port rezervasyonuna takilmamasi icin `65420-65429` araligina alindi.
- API / UI etkisi: UI degismedi. Data API'de anon tenant tablolarina erisemez; yalniz hostname'e gore `site_id`, `site_name`, `widget_title`, `locale` donduren `get_widget_bootstrap` RPC'sini calistirabilir. Auth session/RBAC uygulama context'i P0.3'e, domain lock/public session P0.5'e birakildi.
- Test komutlari ve sonuclari: Final bos ayri stack ilk acilista migration + seed PASS ve 7 dosya/72 pgTAP assertion PASS; migration'siz ayri baseline'da `migration up` PASS ve history local/remote eslesti; `npm run db:test` 72/72 PASS; `npm run db:types:check` PASS; security ve performance `db advisors --level warn --fail-on warn` iki kez `No issues found`; `npm run check` format + lint + typecheck + 9/9 unit + 8/8 UI contract + webpack production build PASS.
- Ekran / SQL / RLS kaniti: `docs/evidence/P0.2/` zero/upgrade migration ciktisini, tablo bazli allow/deny senaryolarini, UPDATE `SELECT + USING + WITH CHECK + RETURNING` kanitini, grant matrisini, type drift ve advisor sonuclarini icerir. Secret taramasinda committed local/production key bulunmadi.
- Denenemeyenler: Git metadata/remote olmadigi ve commit/push istenmedigi icin gercek GitHub Actions database job run'i denenmedi. Hosted Supabase link/push, production migration ve gercek secret kullanimi yapilmadi. Ana local `db:reset` destructive onay katmani tarafindan reddedildi; ayni zero-DB kriteri mevcut veriyi silmeden ayri bos local stack'te final migration + seed + 72 test ile kanitlandi.
- Bilinen riskler / teknik borc: Public bootstrap domain sahipligini veya origin'i kanitlamaz; domain lock, rate limit ve public session P0.5 bitmeden production widget guvenligi tamamlanmis sayilmaz. Private security-definer lookup sabit bos `search_path`, dar EXECUTE grant, pgTAP ve advisors ile sinirlidir. Gecici test stack'leri normal backup ile durduruldu; source temp klasorleri temizlendi.
- Geri alma yolu: Hosted kaynaga uygulanmadi. Local stack durdurulup yeniden olusturulabilir; source rollback'i P0.2 dosyalarini kaldirmaktir. Herhangi bir paylasilan DB'ye uygulandiktan sonra gecmis migration degistirilmez, append-only duzeltme migration'i yazilir.
- NEXT_TASK: `P0.3` - Auth, RBAC ve tenant context

### 2026-11-21 - P0.3 - Auth, RBAC ve tenant context

- Durum: `DONE`
- Sure: 2026-11-21; tek uygulama oturumu (local Auth, zero/upgrade DB ve gercek Chrome testleri dahil)
- Amac: Supabase SSR cookie auth, Owner/Admin/Editor/Sales/Viewer RBAC, canli session/membership temelli tenant context, davet yasam dongusu ve istemci tenant kimliklerine karsi IDOR sinirini kurmak.
- Degisen dosyalar: Exact auth dependency'leri ve lockfile, `.env.example`, `lib/supabase/`, `lib/auth/`, Next 16 `proxy.ts`, login/callback/invite/unauthorized ve korumali app route'lari, app shell/tenant switcher/UI durumlari, Playwright/Vitest testleri, DB tipleri, ADR ve `docs/evidence/P0.3/`.
- Migration / schema: CLI ile olusturulan append-only `20261121193307_add_auth_rbac_context.sql`; eski `member` -> `viewer`, bes rol constraint'i, `organization_invitations`, aktif `auth.sessions` kontrolu, context/invite/role/remove/revoke RPC'leri, editor content RLS'i, membership direct DML revoke ve exact grants. P0.2 migration'i degistirilmedi.
- Env / secret / dependency: `NEXT_PUBLIC_SUPABASE_URL`, browser-safe `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ve yalniz server-side `SUPABASE_SECRET_KEY` sozlesmesi eklendi. `@supabase/ssr@0.12.7`, `@supabase/supabase-js@2.119.2`, `server-only@0.0.1` exact pinlendi. Production secret kullanilmadi veya browser'a cikmadi; local Mailpit etkinlestirildi.
- API / UI etkisi: Password login/logout/callback, korumali app, iki tenant switch, owner/admin invite UI, davet kabul sayfasi, loading/empty/error/unauthorized durumlari eklendi. `/api/tenant-context` ve path endpoint'i URL/query/header/cookie/body-client-state tenant ID'lerini canli aktif membership'e karsi dogrular; hata sozlesmesi deterministik 401/403'tur.
- Test komutlari ve sonuclari: P0.2 mevcut DB'ye `migration up` PASS; ayri 65520-65529 zero-DB stack'te iki migration + seed PASS; 8 dosya/86 pgTAP PASS; security/performance advisors `No issues found`; `npm run db:types:check` PASS; `npm run check` format + lint + typecheck + 22/22 unit + 8/8 UI contract + production build PASS; `npm run test:e2e` gercek Chrome'da 20/20 PASS.
- Ekran / SQL / RLS kaniti: `docs/evidence/P0.3/README.md`; allow/deny role matrisi, wrong-user/replay/revoked/expired invite, role degisimi, direct DML deny, last-owner yolu, expired/revoked session deny ve capraz tenant testleri. Browser'da login, switch, viewer 403, bes IDOR tasiyicisi, logout revoke, axe/klavye, 320px ve yuzde 200 metin PASS.
- Denenemeyenler: Hosted Supabase link/push, production SMTP, production deploy ve gercek dis e-posta teslimi kullanici talimati/secret olmadigi icin denenmedi. Invite DB kabul davranisi ve yerel Mailpit konfigurasyonu test edildi; hosted deliverability dis onay gerektirir. Git metadata/remote olmadigi ve commit/push istenmedigi icin commit veya CI remote run yapilmadi.
- Bilinen riskler / teknik borc: Invite DB kaydi ve Auth e-postasi iki sistemdir; e-posta hatasinda davet revoke edilir fakat retry UX'i ileride gelistirilebilir. Owner transferi P0.3 disinda tutuldu; self-role ve last-owner korumalari guvenli default saglar. Public widget domain lock P0.5 tamamlanmadan production widget guvenligi tamamlanmis sayilmaz.
- Geri alma yolu: Hosted kaynaga uygulanmadi. Auth route/UI ve P0.3 RPC grant'leri yeni append-only migration ile kapatilabilir; bes rolden uc role veri kayipsiz otomatik rollback edilmez. Local test stack normal backup ile durduruldu, task'a ait gecici dosyalar silindi.
- NEXT_TASK: `P0.4` - Test, sahte servisler ve observability

### 2026-11-24 - P0.4 - Test, sahte servisler ve observability

- Durum: `DONE`
- Sure: 2026-11-24; tek uygulama oturumu (Docker'in acilmasini bekleme dahil)
- Amac: Gercek LLM, e-posta veya CRM'e cikmadan cekirdek akislari test edilebilir yapmak; log, trace, audit ve maliyet/sure/token metrik temelini kurmak.
- Degisen dosyalar: Yeni `lib/observability/`, `lib/llm/`, `lib/connectors/`, `lib/testing/`, `lib/auth/audit-denial.ts`, `components/feedback/ErrorFallback.tsx`, `app/app/error.tsx`, `app/global-error.tsx`, `app/app/test-harness/`, `instrumentation.ts`, `tests/{setup,support,component,e2e}/`, yeni unit testleri, `playwright.config.ts`, `playwright.failure.config.ts`, `vitest.paid.config.mts`, `tsconfig.isolated.json`, `scripts/{build,e2e-environment,e2e-server,run-e2e,run-paid-tests}.mjs`. Degisen: `package.json`, `package-lock.json`, `next.config.ts`, `proxy.ts`, `app/error.tsx`, uc API route, `lib/auth/actions.ts` (yalniz login log'u), `vitest.config.mts`, `vitest.failure.config.mts`, `eslint.config.mjs`, `scripts/{clean-next,prove-ci-failure}.mjs`, `tests/unit/site-content.test.ts` (harness sayfalari site link taramasinin disinda), `.github/workflows/ci.yml`, `.gitignore`, `.prettierignore`, `.env.example`, `db/database.types.ts`, `README.md`, `db/README.md`, `docs/decisions/`, `docs/evidence/P0.4/`.
- Migration / schema: CLI ile olusturulan append-only `20261124112948_add_audit_and_llm_metrics.sql`. `audit_events`: uyelik ve davet degisiklikleri trigger ile, satir degistirmeyen olaylar service role ile yazilir; istemci yazamaz, hicbir API rolu guncelleyip silemez, zaman ve kimlik DB'den gelir, metadata serbest metin kabul etmez, yalniz owner/admin okur. `llm_call_metrics`: saglayici denemesi basina token, sure, maliyet (mikro-USD), fiyat surumu, `is_simulated`; bilinmeyen deger `null`. RLS + grants birlikte. Eski migration'lar degismedi. `usage_ledger` (P3.3), `events` (P3.2) ve gercek connector'lar (P2.7) eklenmedi.
- Env / secret / dependency: `CAEL_TEST_HARNESS` ve `CAEL_NEXT_DIST_DIR` yalniz test/kontrol build'i icindir; `CAEL_PAID_API_TESTS` yalniz elle calistirilan ucretli test onayidir. Yeni secret yok. Dev dependency tam surum: `@playwright/test 1.65.1`, `@axe-core/playwright 4.14.0`, `@testing-library/react 16.3.3`, `@testing-library/dom 10.4.2`, `@testing-library/user-event 14.6.13`, `jsdom 31.0.1`.
- API / UI etkisi: Her yanit sunucunun urettigi `x-request-id` tasir; API hata govdesine `requestId` eklendi (401/403 kodlari ayni). Tenant reddi denetim izine yazilir. Panel ve kok hata ekranlari sunucu log'uyla eslesen referans gosterir. `/app/test-harness` ve `/preview` yalniz test build'inde vardir; normal build'de route ve kod uretilmez. Bu yuzey gercek P1.6 agent/preview ekrani DEGILDIR; sabit senaryolu sahte model calistirir. Yeni gorunur metin mevcut `/app` ve `/login` diliyle (Ingilizce) ve asgari tutuldu. Public site tasarimi degismedi.
- Test komutlari ve sonuclari: `CAEL_NEXT_DIST_DIR=.next-check npm run check` PASS (format, lint, typecheck, 242/242 unit+component, production build); `--network none` container'da `npm test` PASS 242/242; `npm run test:failure-proof -- --e2e` PASS (exit 1 + JUnit + trace + ekran goruntusu); `npm run test:e2e` gercek Chrome, iki production build, ayri bos stack PASS 59/59; 12/12 kaynak mutasyonu yakalandi.
- Ekran / SQL / RLS kaniti: `docs/evidence/P0.4/`. Sifir DB ve upgrade (ilk iki migration + seed, sonra `migration up`) stack'lerinde ayri ayri 10 dosya/162 pgTAP PASS; security/performance advisors `No issues found`; `db:types:check` PASS; ana local DB'ye `migration up` veri kaybi olmadan uygulandi. Harness 7 durum x 320/375/768/1024/1440: tasma, 14 px alti metin, 44 px alti hedef ve axe ihlali yok; klavye, loading, empty, error PASS. Normal build'de harness 404 ve build ciktisinda harness kodu yok.
- Denenemeyenler: Gercek GitHub Actions kosusu (repository Git degil; `sudo unshare --net` adimi yerine yerelde ag'i kapali container kullanildi). Ucretli API, hosted Supabase, gercek CRM/takvim/webhook, production deploy. `db:check` kosulmadi (`db:reset` yerel veriyi siler; ayni kapilar ayri ayri kostu). Ana local DB'de tam pgTAP gecmez: seed'i P0.2 doneminden kalma, P0.3 testleri de ayni nedenle duser; reset kullanici onayi ister. Safari, Firefox, gercek telefon ve ekran okuyucu.
- Bilinen riskler / teknik borc: `docs/CAEL_AI_SALES_AGENT_UI_REFERANS.md` yok; mevcut `/app` gorsel dili kullanildi. Panel dili karari acik (`PRODUCT.md` Turkce der). Production'da `console.error/warn` metni kasitli olarak dusurulur; cunku Next.js yakalanmis hatayi ziyaretci metniyle birlikte log'a yaziyordu (ilk E2E kosusu gosterdi). Trigger satirlarinda request id yoktur (istemci basligi guvenilmez). Idempotency store bellek icidir; kalici store P2.7. Istemci tarafi hatalari sunucuya raporlanmaz. `organizations` silme, audit satiri varken engellenir; tenant silme/saklama P3.4. jsdom Node `^22.22.2` veya `^24.15.0` ister; `package.json` engines araligi daha genis. Her build Google Fonts'u indirir (onceki davranis).
- Kapsam disi bulunanlar (duzeltilmedi): enjekte edilen yuzde 200 yazi boyutunda public header tasiyor (gercek tarayici ayariyla denenmedi); `POST /api/tenant-context` JSON `null` govdesinde 500 doner; `db/README.md` rol listesi ve README "Kapsam siniri" metni eski; Auth sunucusu kapaliyken login "parola eslesmiyor" der; `/api/health` hata metni Turkce; `supabase migration new` stdin acikken bekler (`< /dev/null` gerekir).
- Geri alma yolu: Hosted kaynaga uygulanmadi. Uygulama tarafinda yeni dosyalar kaldirilir, `proxy.ts`, API route'lari, `app/error.tsx` ve config'ler onceki hallerine doner. DB tarafinda yeni append-only migration trigger'lari kaldirir; tablolar okunur kalir. Olusturulan gecici stack, volume ve build dizinleri silindi.
- NEXT_TASK: `P0.5` - Embed script, domain kilidi ve public session

### 2026-11-24 - P0.4 - Hata duzeltme: proxy matcher kacis karakteri

- Durum: `DONE` (duzeltme suresince roadmap'te P0.4 `ACTIVE` tutuldu)
- Sure: 2026-11-24; ayni gun, P0.4 kaydindan sonra orkestrator dogrulamasinda bulundu
- Amac: P0.4'te `proxy.ts` matcher'inda olusan gerilemeyi test ile yeniden uretip duzeltmek.
- Kok neden: `proxy.ts` bash heredoc ile yazilirken `\\.` `\.` oldu; JS string'inde bu yalniz `.` oldugundan nokta "herhangi bir karakter" sayildi ve `/app/xpng` ile `/api/foosvg` gibi noktasiz yollar proxy'yi (login yonlendirmesi ve sunucu request id'si) atladi.
- Degisen dosyalar: `proxy.ts` (yalniz matcher satiri; P0.4 oncesi satirla bire bir ayni, statik literal), yeni `tests/unit/proxy-matcher.test.ts`, `tests/e2e/standard/harness-closed.spec.ts` (bir test), roadmap.
- Migration / schema: Yok.
- Env / secret / dependency: Yok.
- API / UI etkisi: Noktasiz yollar yeniden proxy'den gecer; istemcinin `x-request-id` degeri ezilir, korumali yol login'e yonlenir. Gercek statik dosyalar proxy disinda kalir.
- Test komutlari ve sonuclari: Once yeni test bozuk kodda 7 hata verdi; duzeltmeden sonra 25/25 PASS (Next'in kendi matcher derleyicisi ile allow + deny). `CAEL_NEXT_DIST_DIR=.next-check npm run check` PASS (format, lint, typecheck, 267/267 unit+component, production build). `npm run test:e2e` gercek Chrome, iki production build, ayri bos stack PASS 60/60; yeni test `/app/xpng` -> login, `/api/foosvg` -> sunucu request id'si, `/icon.svg` -> proxy disi.
- Ekran / SQL / RLS kaniti: UI, schema ve RLS degismedi. Kacis taramasi: TypeScript ayristiricisi ile 201 dosya, 79 regex ve 5527 string; gecersiz kacis 0. Tarayici bozuk satiri ayri bir dosyada yakaladi. Regex iceren P0.4 dosyalari ve yeni migration ayrica satir satir okundu; baska bozulma yok.
- Denenemeyenler: Gercek GitHub Actions kosusu (repository Git degil).
- Bilinen riskler / teknik borc: Kacis taramasi tek seferlik script'ti; repository'ye kalici lint kurali eklenmedi. P0.4'un ilk kaydindaki "her yanit sunucunun urettigi x-request-id tasir" iddiasi bu duzeltmeye kadar noktasiz yollar icin dogru degildi; yerel gelistirme disinda hicbir ortama cikmadi.
- Geri alma yolu: `proxy.ts` matcher satiri ve iki test degisikligi geri alinir.
- NEXT_TASK: `P0.5` - Embed script, domain kilidi ve public session

### 2026-11-24 - P0.5 - Embed script, domain kilidi ve public session

- Durum: `DONE`
- Sure: 2026-11-24; tek uygulama oturumu (kullanici bir kez durdurdu, kisa yoldan devam onayi verdi)
- Amac: Her musterinin sitesine tek script ile, yalniz izinli domainlerde calisan, ana siteyi bozmayan widget kabugu ve kisa omurlu public session kurmak.
- Degisen dosyalar: Yeni `widget/`, `lib/widget/`, `lib/auth/same-origin.ts`, `lib/testing/fake-widget-store.ts`, `app/widget/v1/`, `app/api/widget/v1/`, `app/api/domains/[domainId]/`, `scripts/{build-widget,widget-assets}.mjs`, `tests/unit/{widget-*,proxy-widget}.test.ts`, `tests/e2e/widget/`, `tests/support/{widget-host,latency-proxy}.mjs`, `supabase/tests/database/{site_keys,widget_runtime}_test.sql`, ADR, runbook, `docs/evidence/P0.5/`. Degisen: `proxy.ts` (matcher'a dokunulmadi), `next.config.ts`, `package.json`, `package-lock.json`, `playwright.config.ts`, `scripts/e2e-environment.*`, `tests/e2e/support.ts`, `supabase/seed.sql`, uc pgTAP dosyasi, `db/database.types.ts`, `.env.example`, `README.md`, `db/README.md`, `docs/{decisions,runbooks}/README.md`.
- Migration / schema: CLI ile olusturulan append-only `20261124124228_widget_embed_and_sessions.sql`. `site_keys`, `widget_sessions`, `private.widget_rate_counters`; `domains`'e ortam, alt alan adi, dogrulama ve sure alanlari; `sites`'a tema ve `handoff_url`. P0.2'nin anon RPC'si kaldirildi; istemci artik `verified_at` ve benzeri kilit alanlarini yazamaz; hostname yalniz dogrulaninca global unique. Anahtar ve domain degisiklikleri audit'lenir. RLS + grants birlikte. Eski migration'lar degismedi.
- Env / secret / dependency: `WIDGET_TOKEN_SECRETS` ve `WIDGET_CLIENT_IP_HEADER` (yalniz server; eksikse widget kapali). `tldts 7.5.5` (public suffix) ve dev `rolldown 1.2.19` (widget derlemesi); ikisi de lockfile'da vardi, tam surume pinlendi.
- API / UI etkisi: `/widget/v1/{loader.js,frame}`, `/api/widget/v1/{bootstrap,session}`, `/api/domains/[domainId]/{verification,subdomains}`; RPC: `create_site_key`, `revoke_site_key`, `add_preview_domain`. Widget kabugu AI kimligini ve insan yolunu gosterir, sohbet yok (P1.4); metin site locale'inden (tr/en) ve asgari. Widget frame'i disinda hicbir yol frame'lenemez. Yonetim ekrani yok (P1.6/P3.5). Public site tasarimi degismedi.
- Test komutlari ve sonuclari: `CAEL_NEXT_DIST_DIR=.next-check npm run check` PASS (473/473 unit+component, build); `npm run test:e2e` ayri bos stack, iki build, gercek Chrome PASS 166/166; `npm run test:failure-proof -- --e2e` PASS; TypeScript mutasyonu 45/45, SQL mutasyonu 11/12 (kalan esdeger mutant, kanitta aciklandi).
- Ekran / SQL / RLS kaniti: `docs/evidence/P0.5/`. Sifir DB ve upgrade stack'inde 12 dosya/299 pgTAP PASS; advisors `No issues found`; `db:types:check` PASS; ana yerel DB'ye veri kaybi olmadan `migration up`. Performans (25 tekrar, p95): masaustu launcher 311 ms, panel 265 ms; yavas mobil launcher 901 ms, panel 856 ms. Bes durum x 320/375/768/1024/1440: tasma, kucuk metin/hedef ve axe ihlali yok.
- Denenemeyenler: Gercek domain, DNS, HTTPS, CDN, hosted Supabase ve platform IP basligi; coklu instance yuk testi; kalan SQL mutasyonlari ve tarayici mutasyonlari (kullanici talebiyle kapsam daraltildi); Safari, Firefox, gercek telefon, ekran okuyucu, GitHub Actions; `db:check` (`db:reset` yerel veriyi siler).
- Bilinen riskler / teknik borc: Tarayici disi istemci Origin uydurabilir; domain kilidi kimlik kaniti degildir, yalniz tek kullanimlik token, 30 dk oturum, rate limit ve anlik iptalle sinirlidir (ADR tehdit modeli). Yavas mobilde anlik tiklamada oturum kabulu p95 1062 ms (kullanici onayiyla kapi degil). Dagitik saldirgan bir sitenin kotasini doldurabilir; edge limiti gerekir. Frame uygulama origin'inde; ayri widget origin'i P4.4'te degerlendirilmeli. Domain dogrulamasi tek seferlik; retention fonksiyonu zamanlanmadi (P3.4). P0.5 oncesi dogrulanmis domainler yeniden dogrulanana kadar kapali. `docs/CAEL_AI_SALES_AGENT_UI_REFERANS.md` yok; panel dili karari acik.
- Kapsam disi bulunanlar (dokunulmadi): `app/icon.svg` bu oturum sirasinda baska bir kaynak tarafindan degistirildi; `supabase_db_caelaisalesagent-{e2e,p03-zero,upgrade-proof,zero-proof}` volume'lari onceki oturumlardan kalma.
- Geri alma yolu: Hosted kaynaga uygulanmadi. Yeni dosyalar kaldirilir, `proxy.ts` ve `next.config.ts` onceki hallerine doner; DB tarafinda yeni append-only migration RPC grant'lerini kapatir. Acil kapatma: `WIDGET_TOKEN_SECRETS` bosaltilir. Bu oturumun gecici stack, volume ve build dizinleri silindi.
- NEXT_TASK: `P1.1` - Bilgi kaynaklari ve ingestion kuyrugu
