# UI yeniden tasarım kanıtı (2026-11-21)

Bu klasör bir roadmap task'ı değildir; roadmap durumu, `NEXT_TASK` ve ilerleme
notları bu çalışma kapsamında değiştirilmedi.

## Ne doğrulandı, nerede

Çalışma, repository'de Node bağımlılıkları kurulamayan bir ortamda yapıldı.
Gerçek Next.js build'i, Supabase'li oturum ve proje Playwright suite'i **bu
ortamda koşmadı**. Bunun yerine değişen TSX dosyaları React 19 + esbuild ile
render edildi (Next `Link`, `usePathname`, auth guard ve server action'lar
stub'landı; CSS = Tailwind preflight + `app/globals.css`) ve gerçek Chrome'da
test edildi.

`preview-screenshots/` bu önizleme render'ının çıktısıdır; production
screenshot'ı değildir. Production screenshot'ları `npm run test:e2e` ile
`screenshots/` klasörüne yazılır.

| Kontrol                                                      | Sonuç                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------- |
| `npm run check:no-slop` (script doğrudan Node ile)           | 8/8 PASS                                                  |
| `tsc` strict + `exactOptionalPropertyTypes` (stub tiplerle)  | 0 hata, kullanılmayan import yok                          |
| Yatay taşma 375/768/1024/1440, 4 rota                        | 0 px                                                      |
| 320 px reflow (`/`, `/app`, `/app/inbox`, `/app/components`) | 0 px                                                      |
| Yüzde 200 metin (1024/1280)                                  | 0 px taşma, kırpılan içerik yok                           |
| Tek `h1`                                                     | Tüm rotalarda 1                                           |
| 14 px altı görünür metin                                     | Yok                                                       |
| Axe (axe-core, kritik/ciddi)                                 | 0 (yalnız harness'ta `<title>` yok; Next metadata üretir) |
| Skip link → `main` → ilk CTA klavye sırası                   | PASS                                                      |
| Inbox sekmeleri: ok tuşları, Home/End, boş filtre çıkışı     | PASS                                                      |
| Mobilde konuşma seçince odak başlığa taşınır                 | PASS                                                      |
| Mobilde insan devri yüzeyi görünür                           | PASS                                                      |
| Form: hata özeti odak, `aria-describedby`, loading, success  | PASS                                                      |
| `prefers-reduced-motion: reduce`                             | Geçişler ≤ 0.001 ms                                       |
| 375 px'de 44×44 altı dokunma hedefi                          | Yok                                                       |

## Sizin makinenizde koşulması gerekenler

```bash
npm run check          # format + lint + typecheck + unit + no-slop + build
npm run test:e2e       # gerçek Chrome, production server, Supabase local
```

Prettier bu ortamda 3.8.1 ile ve Tailwind sınıf sıralama eklentisi olmadan
çalıştı; `format:check` küçük bir fark bulursa `npm run format` yeterlidir.

---

# Landing yeniden tasarımı: slop temizliği (2026-11-22)

Bu da bir roadmap task'ı değildir; roadmap, `NEXT_TASK` ve ilerleme notları
değişmedi. Commit/push yapılmadı.

Kapsam: `/` landing ve paylaşılan token/hareket katmanı. `/app`, `/app/inbox`,
`/app/components` ve `/login` yeniden tasarlanmadı; yalnız token değişikliğinden
etkilendiler ve regresyon görüntüleri alındı.

## Klasörler

- `before-2026-11-22/`: eski landing, tasteskill inspector çıktısı
  (1440/768/390; fold + sayfa kolajları).
- `after-2026-11-22/`: production build, hero demosu bittikten sonra tam sayfa:
  `landing-{1440,1024,768,390,320}.png`, `landing-{1440,390}-reduced.png`
  (reduced motion) ve regresyon için `login-*`, `app-*`, `app-inbox-*`,
  `app-components-*` (1440 ve 390).
- `screenshots/`: `npm run test:e2e` responsive testinin yazdığı production
  görüntüleri.

## Yön

- Product: Web sitelerine eklenen, AI olduğunu söyleyen, onaylı kaynaktan yanıt
  veren ve emin olmadığında satış ekibine devreden agent.
- Character: dürüst, açıkça söyleyen, devretmeyi bilen.
- World: satış masasındaki devir-teslim defteri; sıcak beyaz kâğıt, mürekkep
  siyahı, tek sinyal turuncusu.
- Moments: hero'da bir kez akan canlı sohbet; tek koyu "ürün arayüzü" bölümü.
- Signature: kaynak işareti; kaynaklı ifadenin altı çizili ve kaynak çipine
  bağlı (hover/odakta aksan rengine döner).

## Test sonuçları (bu makinede, gerçek Chrome)

| Kontrol                                                                     | Sonuç                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check` (format, lint, typecheck, unit, no-slop, build)             | PASS; unit 46/46, no-slop 8/8                                                                                                                                                                                                                              |
| `npm run test:e2e` (production server + ayrı sıfır-DB Supabase stack 655xx) | 45/45 PASS (auth setup dahil)                                                                                                                                                                                                                              |
| Yeni `tests/e2e/landing.spec.ts`                                            | hero oynatma + tekrar oynat, reduced-motion son hal, kaynak çipi açıklaması, sekmeler (ok/Home/End, otomatik dönmez), devir adımlayıcısı, accordion klavye, mobil menü (Esc + odak dönüşü, link kapatır), %200 metin, tek h1, 14 px altı görünür metin yok |
| Yatay taşma 1440/1024/768/390/320                                           | 0 px                                                                                                                                                                                                                                                       |
| impeccable `detect` (landing dosyaları)                                     | 0 bulgu                                                                                                                                                                                                                                                    |
| tasteskill `lint` (landing dosyaları)                                       | 0 FAIL, 0 WARN (gerekçeli `taste-skill-ignore` satırları aşağıda)                                                                                                                                                                                          |
| tasteskill `inspect`                                                        | hero başlığı her genişlikte 2 satır; kalan uyarılar aşağıda savunuldu                                                                                                                                                                                      |

## Skill kullanımı

- **unslop:** önce denetim (aşağıda), 5 satırlık yön, ardından sırasıyla spacing
  → color → icons → copy → type → layout → details → visuals → motion.
- **impeccable:** `context` → `PRODUCT.md` (init) → `concept-seed`
  (`seed:12a07e1f6e6e8e6a`; brief yönü sabitlediği için çekilen challenger'lar
  declined, kalan disiplin: "durum renk değil işaret biçimiyle yazılır") →
  surface brief (`.impeccable/surfaces/app-page-tsx.md`) → `craft-floor` → build
  → `detect` → `critique` (iki izole alt-ajan: A tasarım incelemesi, B
  detector + tarayıcı kanıtı) → düzeltmeler → `DESIGN.md` +
  `.impeccable/design.json`. Görsel üretim aracı olmadığı için code-led.
  Documenter rolü ayrı alt-ajan yerine bu oturumda yürütüldü.
- **ui-ux-pro-max:** `--design-system` iki sorgu; önerilen glassmorphism, Plus
  Jakarta Sans / Space Grotesk ve mavi/mor paletler brief ve `check:no-slop` ile
  çeliştiği için reddedildi. Alınanlar: "AI-Native UI" (akan metin, sade
  chrome), "Product Demo" deseni (oynat kontrolü, reduced-motion'da son hal),
  Next.js `next/font` self-host. `--persist` çalıştırılmadı. `pro-rules` listesi
  (ikon tutarlılığı 1.5 stroke, 44 px hedef, kontrast, odak sırası) geçildi.
- **tasteskill:** before/after `inspect` + `lint`; `draw.mjs` üç yön dağıttı,
  üçü de sabitlenmiş asimetrik hero ile çeliştiği için `product-performs`
  seçildi. Yön sayfasının koyu ortalanmış hero, Libre Franklin 700, FAQ indeksi
  ve "8+ hareketli öğe" maddeleri prompt lehine uygulanmadı.
- **transitions.dev:** `npx skills add Jakubantalik/transitions.dev`
  (`.claude/skills/transitions-dev`); yalnız ücretsiz efektler, CSS olarak
  uyarlandı.

## Slop denetimi ve nasıl kapandı

| Bulgu (eski)                                               | Kapanış                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| Her bölümde büyük harf aralıklı yeşil eyebrow (`.eyebrow`) | Landing'den tamamen kaldırıldı                                |
| 700 ağırlık, -0.03em sıkışık başlıklar                     | 400/500; hiyerarşi boyut ve renkle                            |
| h1 1440 ve 390'da 3 satır                                  | "Kaynak gösterir, insana devreder"; her genişlikte 2 satır    |
| `Inter` tanımlı ama yüklenmiyor                            | Schibsted Grotesk, `next/font` self-host                      |
| Aynı "başlık solda / paragraf sağda" şablonu 7 kez         | Her bölüm farklı kompozisyon                                  |
| Eşit 4'lü ikon kartları (`.trust-grid`)                    | Geniş kural listesi + tek yapışkan ürün parçası               |
| "Geliştirmede / Çalışıyor" rozet yağmuru                   | Sessiz metin + biçim işareti (dolu nokta / halka)             |
| "Örnek içerik" açıklaması 4+ yerde, turuncu pill           | Her çerçevenin içinde tek sessiz etiket + footer'da tek satır |
| 01–04 numaralandırma                                       | Kullanıcı kontrollü sekmeler; sıra konumla                    |
| Durgun gölge (`.preview-frame`)                            | Gölge yok; ton basamağı                                       |
| 39 hairline + 5 çerçeveli kutu                             | Çizgi yalnız tablo, accordion ve `[data-ui]` parçalarda       |
| Nav'da kutulu "Giriş yap" butonu                           | Sessiz metin linki                                            |
| Hero'da yarışan iki buton + pill + not                     | Bir birincil buton + bir metin linki + tek satır not          |
| Mobil tablo caption'ı 4 satır                              | Caption `visually-hidden`; satırlar tanım bloğu               |
| Sayfada 1 hareketli öğe                                    | Hero'da bir kez oynayan demo + amaçlı mikro etkileşimler      |

## Hareket (transitions.dev → yer)

| Efekt                     | Yer                                                 | Uyarlama                                                                   |
| ------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------- |
| texts-reveal              | Hero metni, yüklemede bir kez                       | blur yok; 12 px yükselme + opacity, 60 ms stagger                          |
| thinking-states           | Hero demo durum satırı                              | shimmer yok (gradient yasak); yalnız opacity/translate                     |
| streaming-text            | Hero demo yanıtı                                    | blur yok; kelime kelime opacity                                            |
| banner-stacking           | Hero devir bandı; koyu bölümdeki durum adımlayıcısı | transform + opacity                                                        |
| tabs-sliding              | "Nasıl çalışır" göstergesi                          | width animasyonu yok; translate + scaleX, satır kırılınca da izler         |
| accordion                 | Güvenlik listesi                                    | native `<details>`; yükseklik animasyonu yok, chevron scaleY + içerik fade |
| tooltip-open-close        | Kaynak çipi                                         | 80 ms gecikmeli giriş, anında çıkış; genişlik animasyonu yok               |
| menu-dropdown + icon-swap | Mobil menü                                          | `@starting-style` ile giriş; Menu/X ikon değişimi                          |
| learn-more-hover          | Metin linkleri                                      | chevron 2 px kayar, kolları oka açılır                                     |

Tek easing `cubic-bezier(0.2, 0, 0, 1)`, üç süre (120 / 200 / 320 ms).
Reduced-motion'da demo son haliyle gelir, "Tekrar oynat" gizlenir.

## Critique sonuçları (impeccable, iki izole alt-ajan)

- A (tasarım): 22/32 (Nielsen; 7 ve 10 n/a). Uygulananlar: CTA'nın davetle
  erişimi dürüstçe söylemesi; hero ve kapanışta aynı etiket/hedef; durum
  adımlayıcısında mevcut adımın biçimle ayrılması; turuncunun uyarı rengi olarak
  kullanılmaması; koyu bölümdeki ölü alan; hero'daki 1 px banner kenarı;
  kapanışın ton alanı üzerinde bitmesi. Reddedilenler: Güven ve Güvenlik
  bölümlerini birleştirmek, koyu bölümü açığa çevirmek (ikisi de prompt'ta
  açıkça istendi).
- B (kanıt): axe 0 ihlal (1440, 390, açık mobil menü); taşma yok; 14 px altı
  metin yok. Düzeltilen kusurlar: mobilde 40 px replay butonu → 44 px; açık
  menüde Tab ile arkadaki sayfaya geçiş → `main`/footer `inert`; menü linkinden
  sonra odağın `body`'ye düşmesi → hedef bölüme odak; summary adlarında ayırıcı;
  detector'ın `nested-cards` bulgusu (`.frag-action`). "Öndeki banner metni
  örtülü" bulgusu `elementFromPoint` ile yanlış alarm olarak doğrulandı.
- Son URL taraması (`impeccable detect`): 0 bulgu.

## Savunulan tasteskill uyarıları

- `hairline` (accordion): prompt 6–10% mürekkep hairline'ı açıkça istiyor; satır
  ayrımı accordion'un okunurluğu için korunuyor.
- `no-real-pictures` / `no-footage`: prompt görsel olarak yalnız Cael'in kendi
  arayüzünü istiyor; entegrasyon/logo/fotoğraf yok.
- `font-not-dealt`: dealt Libre Franklin 700, prompt'un 400/500 kuralıyla
  çelişiyor; Schibsted Grotesk seçildi.
- `palette-cream`: `#f4f1ef` / `#f3efec` düşük kromalı sıcak taş; zemin
  `#fcfbfb` neredeyse beyaz. SCRYPT paleti prompt'ta sabitlendi.
- `off-centre` (32 / 49 px): ölçüm 17 px'lik pencere kaydırma çubuğunu sayıyor;
  içerik `clientWidth`'e göre iki yanda 32 px.

## Metin değişiklikleri

- h1: "Kaynağını gösteren, insana devreden AI satış agentı." → "Kaynak gösterir,
  insana devreder" (lede'de "Cael, sitenize eklenen bir AI satış agentıdır").
- Bölüm başlıkları sıkılaştırıldı: "Sınırlar arayüzde yazılı", "Sorudan
  temsilciye dört adım", "Ekip, agentın ne yaptığını görür", "İlk yanıt agentta,
  karar temsilcide", "Danışmanlık ağırlıklı satış için", "Sınırları kendiniz
  görün".
- Durum notu: "Erken sürüm, davetle erişim: …"; kapanış: "Erişim şimdilik
  davetle. …".
- Yeni örnek içerik (çerçeve içinde, "Örnek içerik" etiketli): kampanya sorusuna
  kaynaksız yanıt, randevu sorusunda devir, temsilci "Deniz" mesajı, kaynak onay
  listesi. Yeni ürün iddiası, müşteri, fiyat veya metrik yok.

## Test güncellemeleri (bilinçli, gevşetme yok)

- `tests/setup.ts`: Vitest `globals` kapalı olduğundan Testing Library'nin
  otomatik `cleanup`'ı çalışmıyordu (inbox testi değişiklik geri alınınca da
  düşüyordu); açık `afterEach(cleanup)` eklendi.
- `tests/unit/contrast.test.ts`: yeni token hex'leri; AA eşikleri aynı.
- `tests/e2e/accessibility.spec.ts`: axe yerleşmiş sayfada koşar (landing demosu
  ve giriş animasyonları bittikten sonra; animasyon ortası kareler yarı opak
  renk ölçüyordu). Aynı etiketli iki CTA olduğu için klavye testi ilk (hero)
  linki `.first()` ile hedefler.
- `tests/e2e/responsive.spec.ts`: inbox grid'i, akışlı içerik görünür olduktan
  sonra ölçülür.
- E2E üç ardışık koşuda 45/45.

## Çalıştırılamayan / sınırlı kontroller

- ideabot.com: sertifika hatası (`ERR_CERT_AUTHORITY_INVALID`); incelenmedi.
- Analytics Platform ikinci videosu tasarımcının portfolyo vitrini çıktı.
- Gerçek ekran okuyucu (NVDA/VoiceOver) turu yapılmadı; erişilebilir adlar ve
  axe ile doğrulandı.
- Safari/Firefox'ta `@starting-style` ve `@media (scripting)` denenmedi
  (Chrome'da doğrulandı; desteklemeyen tarayıcıda menü animasyonsuz açılır, demo
  son haliyle görünür).
- E2E, committed config'in beklediği 655xx portlarında geçici ayrı bir sıfır-DB
  Supabase stack'i ile koştu; ana DB resetlenmedi.
