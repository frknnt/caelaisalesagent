# P1.5 kanit ozeti

Tarih: 2026-11-27

## Zorunlu davranis eslemesi

- Temsilci yazinca bot susar: takeover pending bot cevabini iptal eder;
  `widget_complete_reply` insan kontrolunde sonucu kabul etmez; gec agent sonucu
  route katmaninda yayinlanmaz.
- Iki temsilci concurrency: `assignment_version` optimistic lock; ikinci/stale
  takeover reddedilir.
- Sorumlusuz fallback: agent handoff'u `assigned_to=null` ve `agent_requested`
  nedeni ile kuyruga alir.
- Audit: takeover, release, close ve insan reply gecisleri `audit_events` yazar.
- Baglam: transcript, guvenli tool history ve lead context inbox'ta birlikte
  gorunur; notlar ve okuma cursor'u tenant RLS altindadir.

## Sonuclar

- `CAEL_NEXT_DIST_DIR=.next-check npm run check`: PASS; format, lint, typecheck,
  543/543 unit+component ve production build.
- Sifir DB stack: 17 pgTAP dosyasi, 458/458 PASS; P1.5 dosyasi 36/36 PASS.
- Supabase security ve performance advisor: `No issues found`.
- `npm run db:types:check`: PASS.
- P1.5 Playwright: 3/3 PASS; takeover, reply, note, bota geri verme, transcript
  arama, 375/1440, loading/empty/error ve axe.
- Mevcut standard-build smoke: 5/5 PASS.

Ekranlar: `screenshots/inbox-375.png`, `screenshots/inbox-1440.png` ve
`screenshots/inbox-empty-375.png`.

## Denenemeyenler

Gercek e-posta saglayicisi, production scheduler, hosted Supabase, production
deploy, gercek telefon/Safari ve gercek ekran okuyucu denenmedi. Webhook ve
worker kontrati unit/pgTAP ile, UI ise Chromium + axe ile dogrulandi. UI
referans dosyasi repository'de yoktu; mevcut app tasarim dili ve task
erisilebilirlik kurallari kullanildi.
