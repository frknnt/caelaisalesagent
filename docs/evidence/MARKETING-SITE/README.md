# Public site kanıtı (2026-11-24)

Bu bir roadmap task'ı değildir; roadmap, `NEXT_TASK` ve ilerleme notları
değiştirilmedi. Migration yok. Commit/push/deploy yapılmadı.

## Kararlar

- Dil: `PRODUCT.md` "Arayüz dili Türkçe" der; kullanıcının son açık talebi
  İngilizce site olduğu için public site İngilizcedir. `PRODUCT.md`
  değiştirilmedi.
- Görsel kaynak: iki referans ekran görüntüsü. design-taste-frontend ve
  impeccable eyebrow, gradient metin, pill nav ve kart gölgelerini yasaklar;
  referans ve brief bunları açıkça istediği için uygulandı. impeccable `detect`
  tek bulgusu (hero "Revenue" gradient'i) bu yüzden bırakıldı.
- ui-ux-pro-max arama script'i Python gerektirir ve makinede Python yok; kural
  dosyaları (`quick-reference.md`, `motion.csv`) doğrudan okundu.
- Uydurma yok: fiyat, müşteri, metrik, sertifika, logo yok. Entegrasyonlar
  roadmap durumuyla listelenir (`Planned` / `Considering`). Güvenlik ve
  dokümantasyon sayfaları neyin hazır, neyin geliştirmede olduğunu yazar.
- Mockup'lar ürün kurallarını gösterir: AI kimliği, onaylı kaynak, insan devri,
  devirde susan agent, bilinmeyen bütçenin bilinmeyen kalması. Footer "Product
  visuals use example data." der.
- `/app`: login'in mevcut hedefi. Frontend sıfırlandığı için 404 olurdu; minimal
  korumalı sayfa eklendi.

## Yeni bağımlılık ve env

`gsap 3.15.1`, `@gsap/react 2.1.2`, `lucide-react 1.79.0`, dev:
`tailwindcss 4.3.5`, `@tailwindcss/postcss 4.3.5` (hepsi tam sürüm).
`LEAD_INTAKE_WEBHOOK_URL` opsiyonel, yalnız server.

## Koşulan kontroller

| Kontrol                                                                  | Sonuç                                      |
| ------------------------------------------------------------------------ | ------------------------------------------ |
| `npm run check` (format, lint, typecheck, unit, build)                   | PASS; 83/83 unit                           |
| 18 rota × 320/375/768/1024/1440/1920, production server, gerçek Chrome   | 108/108 sorunsuz                           |
| ↳ yatay taşma, konsol, tek h1, başlık sırası, 14 px altı metin, 44 px    | 0 bulgu                                    |
| ↳ axe 4.14.1 (wcag2a/aa, 21aa, 22aa, best-practice)                      | 0 ihlal                                    |
| Etkileşim akışları (menü, FAQ, sekmeler, formlar, filtre, 404, metadata) | 46/46 PASS                                 |
| İç link taraması                                                         | 31 URL, 0 kırık                            |
| Rota değişiminden sonra gizli kalan içerik                               | 0                                          |
| Reduced motion                                                           | GSAP inline hareketi yok, gizli içerik yok |
| JavaScript kapalı                                                        | İçerik görünür                             |
| CLS (1440 / 375, local)                                                  | 0.0024 / 0.0016                            |

Tarayıcı script'leri geçici klasörde koştu; repository'ye E2E eklenmedi.

## Denenemeyenler

- Gerçek Supabase oturumu: Docker çalışmıyordu. Login formu yapılandırma yok,
  hatalı giriş ve `/app` yönlendirmesi için denendi; başarılı giriş denenmedi.
- Auth sunucusu kapalıyken mevcut `login` action'ı "email ve parola eşleşmiyor"
  mesajına düşer (bu çalışmadan önceki davranış).
- Safari, Firefox, gerçek telefon ve gerçek ekran okuyucu denenmedi.

## Geri alma

`app/` içindeki sayfa dosyaları, `components/`, `data/`, `types/`,
`lib/{cn,gsap}.ts`, `lib/site`, `lib/leads`, `postcss.config.mjs`,
`.claude/launch.json`, iki yeni unit test ve `lib/env.ts` sonundaki
`readLeadIntakeUrl` kaldırılır; bağımlılıklar `npm uninstall` ile geri alınır.
