# ADR-20261121: Tenant, domain ve public bootstrap sınırı

- Durum: Kabul edildi
- Tarih: 2026-11-21
- Task: P0.2

## Bağlam

Tenant izolasyonu organization ve site seviyesinde database tarafından
uygulanmalıdır. Authenticated Postgres rolü tek başına yetki değildir. Anon
widget'ı başlatabilmeli, ancak organization özel alanlarını, üyelikleri,
profilleri, domain listesini veya diğer siteleri görememelidir. P0.5 domain
kilidi ve public session davranışını ayrıca kuracaktır.

## Karar

1. Bütün çekirdek kimlikler UUID'dir. `profiles.id`, `auth.users.id` ile bire
   birdir; parola veya auth identity kopyalanmaz.
2. Organization üyeliği ve rolü için tek authoritative kaynak `memberships`
   tablosudur. RLS, kullanıcı tarafından değiştirilebilen `raw_user_meta_data`
   veya bayat JWT organization claim'i kullanmaz.
3. Site ve domain satırları açık `organization_id` taşır. Domain'in
   `(organization_id, site_id)` composite foreign key'i site tenant anahtarını
   database seviyesinde doğrular.
4. Hostname lower-case, trim edilmiş ve global unique tutulur. Bir hostname aynı
   anda iki tenant'a atanamaz; bu domain routing belirsizliğini kaldırır.
5. Public tablolarda RLS + explicit grants birlikte uygulanır. Anon'a tablo
   grant'i verilmez.
6. Public bootstrap, hostname parametreli ve yalnız dört güvenli alan döndüren
   `public.get_widget_bootstrap` RPC'sidir. RLS bypass gereken lookup, sabit boş
   `search_path` kullanan `private` security-definer fonksiyonunda tutulur;
   public wrapper security-invoker'dır ve execute grant'i dardır.

## Alternatifler

- Anon'a `sites` veya `domains` SELECT vermek reddedildi: istemci filtresi RLS
  değildir ve diğer sitelerin listelenmesini engellemez.
- Organization bilgisini JWT `user_metadata` içine koymak reddedildi: kullanıcı
  tarafından değiştirilebilir ve üyelik iptalinde bayat kalabilir.
- Yalnız `site_id` foreign key'i kullanmak reddedildi: yanlış
  `organization_id` + `site_id` kombinasyonunu database constraint'i
  engellemezdi.
- Domain başına tenant içinde unique olmak reddedildi: global hostname routing
  iki tenant için belirsiz hale gelirdi.

## Sonuçlar ve riskler

- Üyelik iptali bir sonraki sorguda etkili olur; token refresh beklenmez.
- Security-definer fonksiyonu çok dar olsa da ayrı bir denetim yüzeyidir; sabit
  `search_path`, explicit execute grant, pgTAP ve advisor kontrolleri
  zorunludur.
- Bootstrap domain sahipliğini kanıtlamaz. Verification, origin/domain lock,
  rate limit ve public session P0.5'te eklenmeden production widget güvenliği
  tamamlanmış sayılmaz.

## Geri alma yolu

Production'a uygulanmadan önce ilk migration ve local volume kaldırılabilir.
Uygulandıktan sonra append-only düzeltme migration'ı gerekir; geçmiş migration
değiştirilmez. Bootstrap yüzeyi daha sonra versioned yeni RPC ile
değiştirilebilir.
