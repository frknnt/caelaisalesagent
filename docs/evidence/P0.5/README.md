# P0.5 Kanıt Özeti

Tarih: 2026-11-24. Kararlar ve tehdit modeli:
[`ADR-20261124`](../../decisions/ADR-20261124-widget-embed-domain-kilidi-ve-public-session.md).
Kurulum ve olay adımları:
[`runbook`](../../runbooks/WIDGET_KURULUM_VE_ANAHTAR.md). Commit, push, deploy,
hosted Supabase, gerçek DNS, production secret ve ücretli API kullanılmadı.

## Teslimler

| PDF teslimi                                            | Karşılığı                                                                                                 |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Domain-scoped public site key; wildcard ve preview     | `site_keys`, `domains` (`verification_method`, `allow_subdomains`, `environment`), `lib/widget/origin.ts` |
| Async script + izole iframe/container + theme token    | `widget/loader.ts` (shadow root), `/widget/v1/frame`, `sites.widget_accent_color/position`                |
| Signed bootstrap/session token ve rate limit           | `lib/widget/tokens.ts`, `widget_sessions`, `private.widget_rate_counters`                                 |
| CSP, CORS, clickjacking, bot/spam ve abuse kontrolleri | `frame-document.ts`, `handlers.ts`, `next.config.ts`                                                      |

## Zorunlu testler

| Test                                  | Kanıt                                                                                                                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Yanlış domainde widget açılmıyor      | `domain-lock.spec.ts`: yabancı, benzer adlı, alt, doğrulanmamış ve başka müşterinin hostu; preview ve wildcard sınırları; `widget_runtime_test.sql`                                                          |
| Key kopyalama ve origin spoof         | Başka sayfa bootstrap'ı okuyamaz, çalınmış canlı biletle bile frame'leyemez; süresi geçmiş, bozuk, başka amaçlı, başka origin'li, tekrar token 401. Tarayıcı dışı istemcinin Origin uydurabildiği de testtir |
| Mobil/desktop performans              | Aşağıda                                                                                                                                                                                                      |
| Script hata verse ana site bozulmuyor | `host-page.spec.ts`: kapalı sunucu, 403/429/500, yönlendirme, boş/bozuk/yanlış yanıt, asılı kalan script ve bootstrap, eksik/bozuk tarayıcı API'leri, sitenin CSP'si, üç kez yükleme, düşmanca CSS           |

## Komutlar ve sonuçlar (son hal)

| Komut                                                             | Sonuç                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------ |
| `CAEL_NEXT_DIST_DIR=.next-check npm run check`                    | PASS: format, lint, typecheck, 473/473 unit+component, build |
| `npm run test:failure-proof -- --e2e`                             | PASS                                                         |
| `npm run test:e2e` (ayrı boş stack, iki build, gerçek Chrome)     | PASS 166/166                                                 |
| `supabase test db`, sıfır DB                                      | PASS 12 dosya, 299 assertion                                 |
| `supabase test db`, upgrade (3 migration + eski seed, sonra `up`) | PASS 299; kullanıcı/üyelik/site/domain sayıları aynı         |
| Ana yerel DB `migration up`                                       | PASS; satır sayıları aynı (4/2/3/2/2)                        |
| `npm run db:types:check`                                          | PASS                                                         |
| `npm run db:advisors` (security + performance)                    | `No issues found`                                            |
| Kaynak mutasyonları (TypeScript)                                  | 45/45 yakalandı                                              |
| SQL mutasyonları                                                  | 11/12 yakalandı, 1 eşdeğer (aşağıda)                         |

Hayatta kalan SQL mutasyonu: `is_widget_host_allowed` içindeki ortam koşulunu
silmek. Davranışı değiştirmiyor; `domains_preview_rules` kısıtı preview
satırının doğrulanmasını ve production satırının süreli olmasını zaten
yasaklıyor. Koşul ikinci savunma olarak duruyor.

## Performans

Ölçüm: müşteri sayfasında, her tekrarda soğuk tarayıcı bağlamı. Önünde gecikme,
bant genişliği ve HTTPS kurulumunu (3 gidiş-dönüş: ad çözme, TCP, TLS 1.3)
uygulayan bir TCP proxy vardır. Tıklama launcher'ın çizildiği anda, öncesinde
hover olmadan yapılır (en kötü durum). 25 tekrar, ms:

| Profil                             | Ölçü                                             | min | medyan |  p75 |  p95 |  max |
| ---------------------------------- | ------------------------------------------------ | --: | -----: | ---: | ---: | ---: |
| Masaüstü (40 ms, 10 Mbit/s)        | script isteği → launcher çizildi ve tıklanabilir | 269 |    296 |  300 |  311 |  318 |
|                                    | tıklama → AI bilgisi ve insan yolu görünür       | 218 |    241 |  253 |  265 |  272 |
|                                    | tıklama → oturum kabul edildi                    | 301 |    334 |  342 |  349 |  355 |
| Mobil (150 ms, 1,6 Mbit/s, CPU 4x) | script isteği → launcher çizildi ve tıklanabilir | 866 |    879 |  888 |  901 |  926 |
|                                    | tıklama → AI bilgisi ve insan yolu görünür       | 754 |    790 |  804 |  856 |  867 |
|                                    | tıklama → oturum kabul edildi                    | 963 |    999 | 1017 | 1062 | 1087 |

"Kullanılabilir" ilk iki ölçüdür (kullanıcı onayı, 2026-11-24); ikisi de bütün
tekrarlarda 1 sn altındadır. Oturumun kabulü yavaş mobilde 1 sn'yi az geçer ve
kapı değildir. Toplam (script → açık panel) mobilde 1 sn'nin üzerindedir. Ham
veri: `widget-performance-*.json`. Boyut: loader ~3,3 KB, frame ~2 KB (gzip).

Sınır: ölçüm yereldir. Veritabanı gecikmesi, CDN, gerçek TLS, gerçek telefon ve
müşteri sayfasının kendi yükü yoktur; ağ modeldir.

## Arayüz

Beş durum (kapalı, loading, empty, error, expired) × 320/375/768/1024/1440:
taşma 0, 14 px altı metin yok, 44 px altı hedef yok, axe (WCAG 2.2 AA +
best-practice) 0 ihlal. Klavye sırası, Esc, odak dönüşü, telefonda odak tuzağı,
reduced motion, forced colors, %200 zoom ve metin PASS. `screenshots/`.

## Bulunan ve düzeltilen

- `AbortController` yoksa gizli eleman sayfada kalıyordu (E2E buldu).
- Frame'in `main`/`header`/`footer` landmark'ları müşteri sayfasınınkilerle
  çakışıyordu (axe buldu).
- P0.2'den: istemci `verified_at` yazabiliyordu; anon RPC domain sorgulatıyordu.
  P0.2 pgTAP'ının bu iki yetkiyi bekleyen satırları red bekleyecek şekilde
  **sıkılaştırıldı** (`domains_rls`, `widget_bootstrap`, `schema_contract`).
- Regex içeren bir test dosyası bash heredoc'ta bozuldu; Prettier yakaladı, Edit
  aracıyla düzeltildi. Matcher satırı değişmedi (`proxy-matcher` 25/25).

## Son audit (PDF s.46)

| Soru                                    | Cevap                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Bitiş kriteri sağlandı mı?              | Evet, yukarıdaki tanımla                                                                                                  |
| Tenant/RLS allow ve deny                | Evet: beş rol, anon, outsider, ölü oturum, çapraz tenant. Storage/vector/queue bu task'ta yok                             |
| Secret, PII, consent, retention, audit  | Secret yalnız server; IP ham tutulmaz; consent toplanmaz; retention fonksiyonu var, zamanlanmadı; domain/anahtar audit'li |
| LLM yan etkisi                          | LLM yok                                                                                                                   |
| UI klavye, mobil, loading, empty, error | Evet                                                                                                                      |
| Sıfır DB ve upgrade                     | Evet                                                                                                                      |
| Progress, roadmap, NEXT_TASK            | Evet                                                                                                                      |
| Denenemeyenler yazıldı mı?              | Aşağıda                                                                                                                   |

## Denenemeyenler

- Gerçek domain, DNS TXT kaydı, HTTPS, CDN, hosted Supabase, gerçek platform IP
  başlığı. DNS doğrulaması sahte çözücüyle test edildi.
- Çoklu instance ile eşzamanlı rate limit yükü (sayaç tek SQL upsert'idir; yük
  testi yapılmadı).
- Hazırlanan SQL mutasyonlarının kalanı ve loader/frame'in tarayıcı mutasyonları
  (süre nedeniyle kapsam daraltıldı).
- Safari, Firefox, gerçek telefon, gerçek ekran okuyucu, GitHub Actions.
- `db:check` (`db:reset` yerel veriyi siler; kapılar ayrı ayrı koştu).
