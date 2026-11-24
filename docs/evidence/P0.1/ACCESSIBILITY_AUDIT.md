# P0.1 Erisilebilirlik ve Browser Kaniti

Tarih: 2026-11-21

## Otomatik sonuc

Komut: `npm run test:e2e`

Sonuc: 15/15 test PASS, production Next.js server ve yerel Google Chrome ile.

- `/`, `/app`, `/app/components`, `/app/inbox`: axe 4.14 ile sifir tespit
  edilebilir ihlal.
- Skip link ilk `Tab` odağini alir, `Enter` ile `main` landmark'a gecer ve
  sonraki odak DOM/gorsel sirayi izler.
- `prefers-reduced-motion: reduce` altinda transition suresi minimuma iner.
- Form validation hata ozeti odaklanir; alan hatasi iliskilidir; loading butonu
  disabled + `aria-busy` olur; success durumu `aria-live` ile gorunur.
- Inbox 1440 px'de uc panel; daha dar ekranlarda mantiksal sirayla reflow olur.
- 320 CSS px'de yatay document tasmasi yoktur.
- 1280 px viewport'ta root metin %200 buyutuldugunda yatay document tasmasi
  yoktur.
- Production env eksikken `/api/health` gercek runtime'da secret sizdirmadan
  `503`, `APP_BASE_URL_MISSING` ve anlasilir mesaj dondurur.

## Kontrast

`tests/unit/contrast.test.ts`, ana govde, muted metin, primary buton ve danger
buton renk ciftlerini WCAG AA `4.5:1` alt sinirina karsi test eder. Axe taramasi
da render edilmis dort rotada renk kontrastini kontrol eder.

## Screenshot kaniti

Production server'dan tam sayfa goruntuleri:

- `screenshots/mobile-375.png`
- `screenshots/tablet-768.png`
- `screenshots/desktop-1024.png`
- `screenshots/wide-1440.png`

Dort goruntu gorsel olarak incelendi: tasma, kirpilma, ust uste binme, odak
gizleyen sticky yuzey veya development araci kalintisi yoktur.

## Durum kapsami

- Loading: galeride disabled + `aria-busy` buton ve form akisi.
- Empty: uygulama ana sayfasi ve component galerisi.
- Validation: inline alan hatasi + odaklanan hata ozeti.
- Error: semantik alert callout ve production env 503 fallback.
- Success: form dogrulama sonucu ve success callout.
