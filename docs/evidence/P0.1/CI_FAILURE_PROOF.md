# P0.1 CI Failure Kaniti

Tarih: 2026-11-20

Komut: `npm run test:failure-proof`

Akis:

1. `vitest.failure.config.mts`, normal unit suite'inden ayri
   `tests/fixtures/intentional-failure.test.ts` dosyasini calistirdi.
2. Beklenti bilerek bozuk oldugu icin Vitest `exit code 1` dondurdu.
3. Kanit wrapper'i non-zero cikisi gordu ve
   `PASS: The intentionally broken test returned exit code 1.` yazdi.

Bu, test runner ve CI'daki `npm test` adiminin bozuk beklentiyi basarili
saymadigini dogrular. Normal `npm test` kasitli fixture'i kapsamaz; gercek unit
suite'i 9/9 PASS'tir.

Uzak GitHub Actions kosusu commit/push talep edilmedigi icin tetiklenmedi.
