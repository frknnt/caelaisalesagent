# P1.3 kanıtları

Tarih: 2026-11-26. Tüm testler fake provider ile; gerçek/ücretli LLM çağrısı
yok.

| Zorunlu test                           | Test (`tests/unit/agent-loop.test.ts`)                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt injection                       | `agent turn: prompt injection` (2 test): ziyaretçi metni system prompt'a girmez, sarma etiketi nötrlenir, enjekte edilen tool çalışmaz |
| Tool hallucination + invalid schema    | `agent turn: tool hallucination and invalid schema` (8 test): bilinmeyen tool, 5 geçersiz argüman türü, geçerli tool, adım sınırı      |
| Timeout / refusal                      | `agent turn: timeout and refusal` (4 test): timeout retry + handoff, refusal retry yok, rate limit toparlanma, circuit breaker         |
| Budget aşılınca LLM çağrılmıyor        | `agent turn: budget and emergency stop` (5 test): tükenmiş/yetersiz bütçe, okunamayan harcama, emergency stop → `port.calls` boş       |
| Model değişimi iş mantığına dokunmuyor | `provider independence` (3 test): iki farklı adapter+model ile aynı tur sonucu, kayıtsız provider reddi, env fail-closed               |
| Yan etki + idempotency                 | `side effects are deferred and idempotent` (2 test)                                                                                    |

Ayrıntılı çıktı: `unit-agent-loop.txt` (43/43 PASS; P0.4 guarded-call testleri
dahil).

Migration yok; pgTAP kapsamı değişmedi. UI yok; ekran görüntüsü gerekmedi.

## Task sonu kapilari (yalin protokol)

- `CAEL_NEXT_DIST_DIR=.next-check npm run check`: PASS, 518/518 + build.
- Sifir DB gecici stack (`caelaisalesagent-p13`, 655xx portlar, sonra silindi):
  15 dosya / 370 pgTAP PASS.
- Smoke `npm run test:e2e -- --no-build --project=standard-build`: 4/5 PASS.
  Giris gerektiren tek test ana yerel stack'teki GoTrue hatasiyla dustu: seed
  kullanicilarinda `confirmation_token` NULL. Cozum `db:reset` (yerel veriyi
  siler, kullanici onayi gerekir). P1.3 auth/DB/route degistirmedi.
