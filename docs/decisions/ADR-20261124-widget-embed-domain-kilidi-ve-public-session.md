# ADR-20261124: Widget embed, domain kilidi ve public session

- Durum: Kabul edildi
- Task: P0.5
- Tarih: 2026-11-24
- Değiştirdiği karar: `ADR-20261121-tenant-domain-ve-public-bootstrap` madde 4
  (hostname global unique) ve madde 6 (anon bootstrap RPC'si)

## Bağlam

Cael müşterinin sitesine tek script ile eklenir. Public anahtar herkesçe
okunabilir; `Origin`, `Referer` ve hostname istemcinin söylediğidir. P0.2,
domain doğrulama, origin kilidi, rate limit ve public session'ı bu task'a
bırakmıştı. P0.2'den kalan iki gerçek açık vardı:

- `anon`, `get_widget_bootstrap(hostname)` ile herhangi bir domain'in Cael
  müşterisi olup olmadığını sınırsız sorabiliyordu.
- `authenticated` (Editor dahil) `domains.verified_at` değerini kendisi
  yazabiliyordu; yani domain kilidi istemcinin elindeydi.

## Karar

### Akış

1. Müşteri sayfası `async` bir script yükler (`/widget/v1/loader.js`,
   `data-site-key`). Script kendi elemanını (`cael-widget`, shadow root) gizli
   ekler ve `POST /api/widget/v1/bootstrap` çağırır. İzin gelmezse eleman
   silinir; ekranda hiçbir şey görünmez.
2. Sunucu tek bir service-role RPC'sinde anahtarı, hostu, siteyi ve rate limit'i
   denetler. İzinliyse iki kısa ömürlü imzalı değer döner: `frame` bileti ve tek
   kullanımlık `bootstrap` token'ı.
3. Ziyaretçi açınca iframe `GET /widget/v1/frame?t=<bilet>` yüklenir. Yanıtın
   `frame-ancestors` değeri yalnız biletteki tek origin'dir.
4. Loader token'ı `postMessage` ile yalnız bizim origin'e verir. Frame, mesajın
   penceresini ve origin'ini denetler, token'ı aynı origin'den
   `POST /api/widget/v1/session` ile oturuma çevirir.
5. Oturum token'ı yalnız frame'in belleğindedir: cookie, `localStorage` veya
   URL'de yoktur. Üçüncü taraf cookie'ye bağımlılık yoktur.

### Anahtarlar

6. `site_keys` satırı bir siteye ve bir ortama (`production` / `preview`)
   bağlıdır. Anahtar gizli değildir; kimlik doğrulamaz, site seçer. Yalnız
   owner/admin RPC ile üretir ve iptal eder; tablo doğrudan yazılamaz. Ortam
   başına en fazla 5 etkin anahtar vardır; rotasyon = yenisini üret, siteyi
   güncelle, eskisini iptal et. İptal açık oturumları da bir sonraki istekte
   kapatır.

### Domain, wildcard ve preview politikası

7. Yalnız `verification_method` dolu satır sayılır. Bu alanı istemci yazamaz:
   `dns_txt` sunucunun `_cael-challenge.<host>` TXT kaydını görmesiyle,
   `operator` yalnız service role veya veritabanı sahibiyle elle yazılır. P0.5
   öncesinden kalan `verified_at` değerleri silinmedi ama kanıt sayılmaz; o
   hostlar yeniden doğrulanana kadar kapalıdır.
8. Kanıtsız hostname artık global unique değildir; doğrulanmış hostname'dir.
   Aksi halde "bu ad alınmış" hatası müşteri listesi sızdırır ve bir tenant
   başkasının adını işgal edebilirdi. Challenge satır başına rastgeledir; bir
   tenant'ın TXT kaydı diğerini doğrulamaz.
9. Wildcard literal değildir: doğrulanmış bir satırın `allow_subdomains`
   bayrağıdır, yalnız **bir** etiket kapsar, varsayılan kapalıdır. Sunucu public
   suffix listesini (ICANN + private, `tldts`) denetler: `com`, `com.tr`,
   `vercel.app`, `github.io`, `myshopify.com` açılamaz. Bilinmeyen suffix de
   reddedilir. Ayrıca DNS kanıtı şarttır; kimse `vercel.app` için TXT yazamaz.
10. Preview hostu ayrı bir ortamdır: yalnız owner/admin ekler, tam addır,
    wildcard olmaz, en fazla 30 gün yaşar ve yalnız süreli bir preview
    anahtarıyla açılır. Preview anahtarı üretilmedikçe preview kapalıdır. DNS
    kanıtı istenmez çünkü paylaşılan preview suffix'inde kimse DNS'i yönetmez;
    bu yüzden hiçbir production hostu preview anahtarıyla açılmaz.
11. Origin, tarayıcının serileştirdiği biçimle birebir olmalıdır; HTTPS ve
    varsayılan port şarttır. `*.localhost` yalnız uygulamanın kendisi
    loopback'te çalışıyorsa kabul edilir.

### Token'lar

12. Biçim `cw1.<kid>.<payload>.<HMAC-SHA256>`. Algoritma alanı yoktur. Her amaç
    (`frame`, `bootstrap`, `session`) HKDF ile ayrı anahtar kullanır; bir amaç
    diğerinin yerine geçemez. `iss` uygulamanın kendi origin'idir. Payload
    yalnız id, origin ve zaman taşır; organizasyon, site adı, IP veya kişi
    verisi taşımaz.
13. Süreler: bilet ve bootstrap 120 sn, oturum 30 dk. Bootstrap tek
    kullanımlıktır (`widget_sessions.bootstrap_id` unique). İmza yetmez: her
    oturum isteği veritabanında anahtarı, hostu, siteyi ve oturum satırını canlı
    denetler (`requireWidgetSession`; P1.4 bunu kullanır).
14. `WIDGET_TOKEN_SECRETS` = `kid:base64url` listesi, yenisi önce. İlk anahtar
    imzalar, kalanlar yalnız doğrular; eski anahtar 30 dk sonra çıkarılabilir.
    En az 32 bayt. Eksik veya tek hatalı giriş varsa widget kapalıdır (503).

### Rate limit ve gizlilik

15. Sayaçlar Postgres'tedir (sabit pencere, tek upsert), bu yüzden bütün
    instance'larda aynıdır. İstemci önce kendi kotasını öder; tek istemci
    sitenin kotasını tüketemez. Sınırlar SQL'dedir: bootstrap istemci 240/dk,
    istemci+site 60/dk, site 6000/dk; oturum istemci+site 30/10 dk, site
    1200/dk; frame istemci 240/dk; oturum isteği 120/dk.
16. IP ham saklanmaz ve loglanmaz. IPv4 adresi veya IPv6 /64 ağı, UTC günü ve
    gizli anahtarla HMAC'lenir; ertesi gün ilişkisizdir. Sayaç satırı pencere
    bitince, sonraki yeni pencere açılırken silinir. `widget_sessions` IP, user
    agent veya kimlik taşımaz; 30 gün tutulur (`purge_widget_runtime`, zamanlama
    P3.4).
17. IP, `WIDGET_CLIENT_IP_HEADER` ile adı verilen ve platformun ezdiği başlıktan
    okunur; birden çok değer varsa en sondaki (en yakın proxy'nin eklediği).
    Loopback dışında bu ayar yoksa widget kapalıdır.

### Frame, CSP ve sayfa koruması

18. Frame kendi HTML'idir (Next layout'u değil): hash'li inline script/style,
    `default-src 'none'`. Server render edilir; AI kimliği ve insan yolu script
    çalışmadan da görünür. Panel dahil diğer bütün yollar
    `frame-ancestors 'none'` ve `X-Frame-Options: DENY` ile hiçbir yerde
    frame'lenemez.
19. Widget yolları proxy'de panel oturumuna dokunmaz (cookie okunmaz,
    yenilenmez).
20. Loader hiçbir global bırakmaz, hata fırlatmaz, `innerHTML` kullanmaz,
    constructable stylesheet kullanır (sıkı CSP ve Trusted Types altında
    çalışır).
21. Tema token'ı iki değerdir: `#rrggbb` vurgu rengi ve konum. Üzerindeki yazı
    rengi siyah/beyazdan hesaplanır; her renkte en az 4.5:1'dir. İnsan yolu
    `sites.handoff_url` (yalnız https) linkidir; yoksa metindir.
22. Kaynak `widget/`, çıktı `lib/widget/generated/assets.ts`. Çıktı repoda
    durur; birim testi kaynakla eşleşmesini denetler (`db/database.types.ts` ile
    aynı yaklaşım).

### Performans tanımı

23. "Kullanılabilir" iki ölçüdür ve ikisi de 1 sn altındadır (kullanıcı kararı,
    2026-11-24): script isteği -> launcher çizildi ve tıklanabilir; tıklama ->
    panelde AI bilgisi ve insan yolu görünür. Oturumun sunucuca kabulü ayrıca
    raporlanır, kapı değildir: yavaş mobilde soğuk bağlantı ve anında tıklamada
    1 sn'yi az geçer. Hover/odak frame'i önceden yükler; dokunmatikte boşta ön
    yükleme sayfa başına ek istek getirdiği için alınmadı.

### Kapsam

24. `widget_sessions` teknik erişim oturumudur. `visitor_sessions`, konuşma,
    mesaj ve anonim kimlik P1.4'tür. Anahtar/domain yönetim ekranı yoktur; RPC,
    iki API ucu ve runbook vardır. Ekran P1.6/P3.5 işidir.

## Tehdit modeli

| Saldırı                                          | Sonuç                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Anahtarı başka siteye kopyalama                  | Tarayıcı gerçek `Origin`'i yollar: 403, CORS başlığı yok, ekranda hiçbir şey               |
| Sayfanın `Origin` uydurması                      | Tarayıcı izin vermez                                                                       |
| Bileti çalıp başka sayfada frame'leme            | `frame-ancestors` biletteki tek origin'dir; tarayıcı engeller                              |
| Başka sayfadan frame'e mesaj                     | Frame pencere ve origin denetler                                                           |
| Başka origin'li token                            | Frame'in gördüğü ebeveyn token'daki origin'le eşleşmeli                                    |
| Süresi geçmiş, bozuk, başka amaçlı, tekrar token | 401, hepsi aynı yanıt                                                                      |
| Domain/site/organizasyon listeleme               | Bütün redler aynı durum ve gövde; CSP tek origin; anon fonksiyonu yok                      |
| Panel clickjacking                               | Panel hiçbir yerde frame'lenemez                                                           |
| **Tarayıcı dışı istemcinin Origin uydurması**    | **Engellenmez.** Anahtar ve izinli origin herkesçe bilinir; `curl` geçerli oturum alabilir |

Son satırın anlamı: domain kilidi **tarayıcı içindeki** kötüye kullanımı
(başkasının sitesinde bizim widget'ımız) kapatır; ödeme gibi bir kimlik kanıtı
değildir. Tarayıcı dışı istemci yalnız tek kullanımlık token, 30 dakikalık
oturum, rate limit ve anında iptalle sınırlıdır. Bu yüzden oturum **hiçbir yetki
sayılmaz**: ziyaretçi verisi, maliyetli LLM çağrısı ve yan etki
P1.3/P1.4/P3.3'te kendi bütçe ve kota denetimlerinden geçmelidir. Bot tespiti
(ör. edge WAF, BotID) dış servistir; gereksinimi P4.3 pilotu gösterir.

Diğer kalan riskler:

- Dağıtık bir saldırgan bir sitenin 6000/dk kotasını doldurabilir; o sitede
  widget geçici olarak görünmez (ana site etkilenmez). Uygulama önünde edge
  limiti gerekir.
- Müşteri sayfasındaki XSS, kendi sayfasında widget token'ı alabilir; zaten
  kendi sayfasıdır.
- Sabit pencere, pencere sınırında en fazla iki kat patlamaya izin verir.
- Frame uygulamanın origin'indedir. Production'dan önce ayrı bir widget origin'i
  (ör. ayrı alt alan adı) değerlendirilmelidir (P4.4).
- Public suffix listesi paketle sabittir; yeni suffix bağımlılık güncellemesi
  ister.
- Domain doğrulaması tek seferliktir; el değiştiren domain elle iptal edilir.
  Doğrulanmış ad ikinci tenant'a otomatik geçmez.

## Alternatifler

- `get_widget_bootstrap` RPC'sini daraltıp tutmak reddedildi: anon RPC origin
  göremez ve rate limit uygulanamaz.
- Bütün izinli domainleri `frame-ancestors`'a yazmak reddedildi: anahtarı bilen
  herkes müşterinin domain listesini okurdu.
- Oturum token'ını URL'ye veya HTML'e koymak reddedildi: log, geçmiş ve
  önbellekte kalır.
- Token'ı IP'ye bağlamak reddedildi: mobil ağ ve IPv4/IPv6 geçişinde gerçek
  ziyaretçiyi düşürür.
- `jose`/JWT reddedildi: tek algoritmalı, 60 satırlık kendi biçimi algoritma
  karışıklığını ve bir bağımlılığı ortadan kaldırır.
- Bellek içi rate limit reddedildi: instance başına ayrı sayar. Redis
  reddedildi: yeni altyapı.
- DNS yerine HTTP dosyasıyla doğrulama reddedildi: sunucuyu müşterinin verdiği
  URL'ye istek atmaya zorlar (SSRF).
- React/Next sayfası olarak frame reddedildi: kök layout pazarlama sitesini ve
  ~100 KB runtime'ı getirir. Sözleşme bilet + `postMessage` olduğu için P1.4
  isterse içini değiştirebilir.

## Geri alma yolu

Uygulama: `lib/widget`, `widget`, `app/widget`, `app/api/{widget,domains}`,
`next.config.ts` başlıkları ve `proxy.ts` ayrımı kaldırılır. Veritabanı: yeni
append-only migration ile RPC grant'leri kapatılır; tablolar okunur kalır.
Anahtar olayında tek adım: `WIDGET_TOKEN_SECRETS` değerini değiştirmek bütün
token'ları anında geçersiz kılar; silmek widget'ı kapatır.
