# ADR-20261121: Auth, beş rollü RBAC ve tenant context sınırı

- Durum: Kabul edildi
- Task: P0.3
- Tarih: 2026-11-21

## Bağlam

P0.2 şeması `owner`, `admin`, `member` rollerini ve RLS tabanlı tenant
izolasyonunu kurdu. P0.3; SSR cookie oturumunu, beş rolü, davet yaşam döngüsünü
ve istemciden gelen tenant kimliklerine güvenmeyen ortak authorization sınırını
gerektirir.

## Karar

1. Eski `member` satırları append-only migration içinde en düşük ayrıcalıklı
   `viewer` rolüne dönüştürülür.
2. Rol sırası `owner`, `admin`, `editor`, `sales`, `viewer` olur. Owner tüm
   üyelik rollerini yönetebilir. Admin yalnız `editor`, `sales`, `viewer` davet
   eder ve bu rolleri yönetir. Kullanıcı kendi rolünü değiştiremez; son owner
   düşürülemez veya silinemez.
3. Membership insert/update/delete yetkisi authenticated tablolardan kaldırılır;
   değişiklikler sabit `search_path` kullanan, actor ve target rolünü yeniden
   okuyan RPC'lerden geçer.
4. SSR sunucusu `getSession()` sonucuna güvenmez. Proxy yenileme sınırında
   `getClaims()`, authorization guard'ında Auth sunucusuna doğrulama yapan
   `getUser()` ve canlı DB membership sorgusu kullanılır.
5. Her RLS membership kontrolü JWT içindeki `session_id` değerinin
   `auth.sessions` tablosunda kullanıcıya ait, mevcut ve süresi geçmemiş
   olmasını gerektirir. Böylece refresh veya access token istemci durumundan
   bağımsız olarak revoked/expired session DB erişimini kaybeder.
6. Aktif tenant, yalnız canlı membership listesinden seçilir ve HttpOnly
   `cael-active-organization` cookie'sine yazılır. URL, path, query, header,
   cookie, body veya client-state ile gelen organization ID ortak guard'da aktif
   üyelikle karşılaştırılır.
7. Davetler tek kullanımlı, süreli ve iptal edilebilir DB kayıtlarıdır. Kabul,
   oturum JWT'sindeki doğrulanmış e-posta ile davet e-postasının eşleşmesini
   gerektirir. E-posta gönderimi server-only admin client ile yapılır; gönderim
   başarısızsa DB daveti revoke edilir.
8. Service/secret key yalnız `server-only` modülde okunur; browser yalnız
   publishable key alır.

## Sonuçlar

- Yetki değişiklikleri ve session revoke işlemleri yeni token beklemeden RLS
  sınırında etkili olur.
- Auth sorgularında `auth.sessions` kontrolünün küçük bir maliyeti vardır;
  `sessions_pkey` ve membership indeksleri bu yolu destekler.
- Invite e-postası ile DB kaydı iki ayrı sistemdir. Uygulama başarısız e-postada
  daveti revoke ederek güvenli, tekrar denenebilir duruma döner.
- Owner transferi ayrı bir ürün akışı olarak ileride eklenebilir; P0.3'te
  yanlışlıkla son owner kaybı engellenir.

## Geri alma

Migration append-only olduğu için eski dosya değiştirilmez. Geri alma yeni bir
migration ile RPC grant'lerini kapatır ve UI auth uçlarını devre dışı bırakır;
beş rollü veriyi üç role daraltmak veri kaybı riski taşıdığı için otomatik
rollback yapılmaz.
