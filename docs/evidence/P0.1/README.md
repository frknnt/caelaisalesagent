# P0.1 Kanit Ozeti

Tarih: 2026-11-21

Bu dizin P0.1 - Repo, UI tasarim sistemi ve CI task'inin yeniden uretilebilir
kanitlarini tutar.

- `ACCESSIBILITY_AUDIT.md`: browser, axe, responsive, focus, motion, form ve env
  kanitlari.
- `AI_SLOP_AUDIT.md`: UI referansindaki sekiz yasak icin ayri PASS/FAIL kaydi.
- `CI_FAILURE_PROOF.md`: kasitli bozuk testin non-zero cikis kaniti.
- `SUPABASE_CLI_AUDIT.md`: pinli CLI v3, resmi dokuman ve gercek `--help`
  dogrulamasi.
- `screenshots/`: production server'dan 375, 768, 1024 ve 1440 px tam sayfa
  goruntuleri.

Uzak GitHub Actions kosusu yapilmadi; repository bu calisma basinda Git
metadata'si icermiyordu ve commit/push kullanici tarafindan istenmedi.
Workflow'un ayni komutlari yerelde temiz lockfile kurulumu sonrasinda
calistirildi.
