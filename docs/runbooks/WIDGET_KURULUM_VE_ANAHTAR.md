# Widget kurulumu, anahtar rotasyonu ve olay adımları

Kararlar ve tehdit modeli:
[`ADR-20261124-widget-embed-domain-kilidi-ve-public-session.md`](../decisions/ADR-20261124-widget-embed-domain-kilidi-ve-public-session.md).
Panel ekranı yoktur (P1.6 / P3.5). Aşağıdaki çağrılar giriş yapmış kullanıcının
kendi oturumuyla yapılır; service role anahtarı elle kullanılmaz.

## Sunucu ayarı

| Değişken                  | Değer                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| `APP_BASE_URL`            | Uygulamanın public origin'i (HTTPS). Token issuer'ıdır.                                          |
| `WIDGET_TOKEN_SECRETS`    | `kid:base64url` listesi, yenisi önce, virgülle. Her biri en az 32 bayt.                          |
| `WIDGET_CLIENT_IP_HEADER` | Platformun **ezdiği** istemci IP başlığı (ör. `x-real-ip`). İstemcinin yazabildiği başlık olmaz. |

Yeni gizli değer üretmek:

```powershell
node -e "console.log('k1:' + require('node:crypto').randomBytes(32).toString('base64url'))"
```

Değer yalnız sunucu ortam değişkenine yazılır; repoya, loga veya sohbete
yazılmaz. Eksik veya geçersizse widget uçları 503 döner, müşteri sayfasında
hiçbir şey görünmez.

## Bir siteyi açmak

1. **Domain ekle** (owner, admin veya editor): `domains` satırı; yalnız
   `organization_id`, `site_id`, `hostname`, `is_primary` yazılabilir.
2. **DNS kaydı**: satırın `verification_token` değeriyle
   `_cael-challenge.<hostname>` TXT = `cael-site-verification=<token>`.
3. **Doğrula** (owner, admin): `POST /api/domains/<domainId>/verification`.
   `422 DOMAIN_CHALLENGE_NOT_FOUND` = kayıt henüz görünmüyor.
   `409 DOMAIN_ALREADY_VERIFIED` = ad başka bir sitede doğrulanmış; destek
   konusu.
4. **Anahtar üret** (owner, admin):
   `rpc('create_site_key', { p_site_id, p_environment: 'production' })`.
5. **Müşteri sayfasına ekle**:

```html
<script
  async
  crossorigin="anonymous"
  src="https://APP_ORIGIN/widget/v1/loader.js"
  data-site-key="cael_pk_..."
></script>
```

`crossorigin="anonymous"` aynı bağlantının yeniden kullanılmasını sağlar.
Sitenin CSP'si varsa `script-src`, `connect-src` ve `frame-src` içine
`https://APP_ORIGIN` eklenir.

`www` ayrı bir hosttur. Bütün birinci seviye alt adlar için (owner, admin):
`POST /api/domains/<domainId>/subdomains` gövde `{"allow": true}`. Public suffix
(`vercel.app`, `com.tr`, ...) reddedilir.

## Preview

Varsayılan kapalıdır. Owner/admin:

1. `rpc('add_preview_domain', { p_site_id, p_hostname, p_expires_at })` — tam
   ad, en fazla 30 gün.
2. `rpc('create_site_key', { p_site_id, p_environment: 'preview', p_expires_at })`.

Preview anahtarı yalnız preview hostlarında, production anahtarı yalnız
production hostlarında çalışır. Yerelde `http://<ad>.localhost:<port>` yalnız
uygulamanın kendisi loopback'teyken kabul edilir.

## Rotasyon

- **Site anahtarı**: yenisini üret → siteyi güncelle →
  `rpc('revoke_site_key', { p_key_id })`. İptal, açık oturumları da kapatır.
- **İmza anahtarı**: `k2:...,k1:...` → deploy → 30 dakika bekle (en uzun oturum)
  → `k1` çıkar → deploy.

## Olay adımları

| Olay                             | Adım                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| Anahtar başka yerde kullanılıyor | Domain kilidi tarayıcıda zaten kapatır. Tarayıcı dışı yük varsa anahtarı iptal et           |
| İmza anahtarı sızdı              | `WIDGET_TOKEN_SECRETS` değerini tamamen değiştir: bütün token'lar anında geçersiz           |
| Bir site kötüye kullanılıyor     | `sites.is_active = false`: widget o sitede bir sonraki istekte kapanır                      |
| Domain el değiştirdi             | Satırı sil; oturumlar bir sonraki istekte kapanır                                           |
| Loader bozuk yayınlandı          | Geri al; müşteri tarayıcıları en geç 5 dakika + 1 saat (stale-while-revalidate) içinde alır |
| Widget hiçbir yerde görünmüyor   | Log'da `widget.misconfigured` ve `problem` alanı; sonra `widget.bootstrap_denied` `reason`  |

Log'larda anahtar, host, IP veya token yoktur; `requestId` ile eşleştirilir.
Retention: `select * from public.purge_widget_runtime()` (service role); henüz
zamanlanmadı (P3.4).
