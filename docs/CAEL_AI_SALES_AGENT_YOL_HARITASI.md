# Cael AI Sales Agent - Canli Yol Haritasi

Bu dosya task durumlarinin, `NEXT_TASK` alaninin ve degismez uygulama kurallarinin canli kaynagidir. Ayrintili task spesifikasyonlari `docs/reference/CAEL_AI_SALES_AGENT_YOL_HARITASI_2026.pdf` icindedir. Bir task'in teslimleri, zorunlu testleri, bitis kriteri ve ozel kurallari PDF'deki ilgili sayfa tamamen okunmadan o task icin "eksiksiz kapsam" verilemez.

## Mevcut durum

- Aktif task: `P1.1`
- NEXT_TASK: `P1.1`
- Son tamamlanan task: `P0.5`
- Release kapisi: Guvenli temel / Faz 0
- Baslangic tarihi: 2026-11-20

## Urun siniri

Kapsam yalniz Cael'in bagimsiz, web-first AI Sales Agent SaaS urunudur. Embedra markasi, bayi hiyerarsisi, Embedra CRM dosyalari ve mevcut Meta entegrasyonlari kapsam disidir.

## Release kapilari

| Kapi | Hedef | Gerekli task'lar | Agresif solo sure |
|---|---|---|---|
| Demo | Siteye embed edilen kaynakli AI agent | P0.1-P0.5, P1.1-P1.4 | 10 is gunu |
| Pilot | Form/chat state, result, dossier, booking | P1.5-P2.7 | Toplam 6 hafta |
| Satilabilir SaaS | Tenant, billing, KVKK, onboarding, eval | P3.1-P4.2 | Toplam 10-12 hafta |
| Production | 10 site pilotu, runbook, restore | P4.3-P4.4 | 12+ hafta |
| Moat | Revenue loop, experiment, AI iyilestirme | P5.1-P5.4 | Ay 3-5 |
| Expansion | Meta, voice, e-ticaret, marketplace | P6.1-P6.3 | Ay 5-8 |

Sureler tam zamanli deneyimli tek gelistirici icin agresif tahmindir; garanti degildir.

## Kritik sira

1. P0.1 -> P0.2 -> P0.3 -> P0.4 -> P0.5
2. P1.1 -> P1.2 -> P1.3 -> P1.4
3. P1.5 -> P1.6
4. P2.1 -> P2.2 -> P2.3 -> P2.4
5. P2.5 -> P2.6 -> P2.7
6. P3.1 -> P3.2 -> P3.3 -> P3.4 -> P3.5
7. P4.1 -> P4.2 -> P4.3 -> P4.4
8. P5.1 -> P5.2 -> P5.3 -> P5.4
9. P6.1 -> P6.2 -> P6.3

Bir task blocked ise yalniz bagimliligi tamamlanmis baska bir task'a gecilebilir. Task kodu atlanmaz veya kanitsiz `DONE` yazilmaz. Ozellikle P2.3, P2.1/P2.2 olmadan; P5.2, P3.2/P5.1 olmadan; P6 kanallari P1 cekirdegi olmadan baslamaz.

## Durum degerleri

- `NOT STARTED`: Henuz baslanmadi.
- `ACTIVE`: Uzerinde calisilan tek task. Ayni anda yalniz bir task bu durumda olabilir.
- `BLOCKED`: Dis bagimlilik veya karar bekleniyor; nedeni yazilir.
- `DONE`: Bitis kriteri ve test kaniti saglandi.
- `DEFERRED`: Silinmedi; sonraki release'e bilincli tasindi.

## Task tablosu

| Kod | Faz | Baslik | Durum | PDF sayfa | NEXT / Ozet |
|---|---|---|---|---:|---|
| P0.1 | F0 - Temel | Repo, UI tasarim sistemi ve CI | DONE | 9 | 2026-11-21; temiz kurulum, kalite kapilari ve 15 production browser testi yesil |
| P0.2 | F0 - Temel | Supabase, tenant semasi ve RLS | DONE | 10 | 2026-11-21; zero/upgrade migration, 72 pgTAP testi ve iki advisor kontrolu yesil |
| P0.3 | F0 - Temel | Auth, RBAC ve tenant context | DONE | 11 | 2026-11-21; SSR auth, beş rol, session-aware RLS, invite ve IDOR koruması yeşil |
| P0.4 | F0 - Temel | Test, sahte servisler ve observability | DONE | 12 | 2026-11-24; agsiz 267 unit+component, 162 pgTAP ve 60 E2E testi yesil, hata kaniti ve append-only audit/metrik semasi kuruldu |
| P0.5 | F0 - Temel | Embed script, domain kilidi ve public session | DONE | 13 | 2026-11-24; izinli sitede widget 1 sn altinda kullanilabilir, baska domain ve gecersiz token reddedilir; 473 unit+component, 299 pgTAP ve 166 E2E testi yesil |
| P1.1 | F1 - Agent | Bilgi kaynaklari ve ingestion kuyrugu | ACTIVE | 14 | Uygulama ve zorunlu kanit kapilari calisiyor |
| P1.2 | F1 - Agent | Retrieval, kaynak gosterme ve freshness | NOT STARTED | 15 | - |
| P1.3 | F1 - Agent | LLM provider adaptoru ve agent dongusu | NOT STARTED | 16 | - |
| P1.4 | F1 - Agent | Widget konusmasi ve session hafizasi | NOT STARTED | 17 | - |
| P1.5 | F1 - Agent | Inbox, insan devri ve canli takip | NOT STARTED | 18 | - |
| P1.6 | F1 - Agent | Agent ayarlari, preview ve versioning | NOT STARTED | 19 | - |
| P2.1 | F2 - Conversion Studio | Conversion schema ve form editor | NOT STARTED | 20 | - |
| P2.2 | F2 - Conversion Studio | Dort renderer: chat, inline, modal, standalone | NOT STARTED | 21 | - |
| P2.3 | F2 - Conversion Studio | Shared state ve progressive prefill | NOT STARTED | 22 | - |
| P2.4 | F2 - Conversion Studio | Sayfa, UTM ve proaktif tetikleyiciler | NOT STARTED | 23 | - |
| P2.5 | F2 - Conversion Studio | Instant Result template sistemi | NOT STARTED | 24 | - |
| P2.6 | F2 - Conversion Studio | Qualification, Lead Dossier ve Action Router | NOT STARTED | 25 | - |
| P2.7 | F2 - Conversion Studio | Randevu, webhook ve ilk CRM connector | NOT STARTED | 26 | - |
| P3.1 | F3 - SaaS | Ajans workspace, multi-client ve white-label | NOT STARTED | 27 | - |
| P3.2 | F3 - SaaS | Event modeli, funnel ve rapor | NOT STARTED | 28 | - |
| P3.3 | F3 - SaaS | Plan, kota, usage ve billing | NOT STARTED | 29 | - |
| P3.4 | F3 - SaaS | KVKK, guvenlik, retention ve veri haklari | NOT STARTED | 30 | - |
| P3.5 | F3 - SaaS | Onboarding, template pack, a11y ve performans | NOT STARTED | 31 | - |
| P4.1 | F4 - Kalite | Golge mod ve insan duzeltme dongusu | NOT STARTED | 32 | - |
| P4.2 | F4 - Kalite | Eval set, adversarial test ve release gate | NOT STARTED | 33 | - |
| P4.3 | F4 - Kalite | 10 site pilotu ve donusum dogrulamasi | NOT STARTED | 34 | - |
| P4.4 | F4 - Kalite | Production launch, backup ve support runbook | NOT STARTED | 35 | - |
| P5.1 | F5 - Moat | CRM outcome, won/lost ve revenue sync | NOT STARTED | 36 | - |
| P5.2 | F5 - Moat | Experiment engine ve question-level CRO | NOT STARTED | 37 | - |
| P5.3 | F5 - Moat | Insan onayli iyilestirme ve prompt-to-form | NOT STARTED | 38 | - |
| P5.4 | F5 - Moat | Knowledge conflict ve otomatik yeniden egitim | NOT STARTED | 39 | - |
| P6.1 | F6 - Genisleme | WhatsApp ve Instagram kanal adaptorleri | NOT STARTED | 40 | - |
| P6.2 | F6 - Genisleme | Voice/phone ve e-ticaret aksiyonlari | NOT STARTED | 41 | - |
| P6.3 | F6 - Genisleme | Advanced flow canvas ve template marketplace | NOT STARTED | 42 | - |

## Degismez kurallar

`AGENTS.md` icindeki "Degismez urun ve kod kurallari" her task icin baglayicidir. Buna ek olarak:

- Bir oturumda yalniz bir task kodu uygulanir.
- Test kaniti olmadan task `DONE` olmaz.
- Roadmap satirinda `DONE` icin tarih ve tek cumle kanit yazilir; ayrinti ilerleme dosyasinin sonuna eklenir.
- `BLOCKED` ve `DEFERRED` satirlari silinmez.
- Sonraki-faz ozelligi kuyruktan silinmez; dogru release kapisinda gorunur kalir.
- Gercek ucretli API, production deploy, commit, push ve destructive islem kullanicinin acik talimatini gerektirir.

## Durum guncelleme protokolu

1. Uygulama baslarken yalniz secili task `ACTIVE` yapilir.
2. Zorunlu test ve bitis kriterleri kanitlaninca satir `DONE` olur; tarih ve tek cumle kanit eklenir.
3. Ayrintili kayit `docs/CAEL_AI_SALES_AGENT_ILERELEME_NOTLARI.md` dosyasinin sonuna eklenir.
4. Bagimliligi tamamlanmis siradaki tek task `NEXT_TASK` yapilir.
5. Task dis nedenle tamamlanamiyorsa `BLOCKED` yazilir ve neden hem tabloda hem ilerleme notunda belirtilir.

## Dosya adi notu

PDF'nin P0.1 sayfasinda bir yerde `docs/CAEL_AI_AGENT_YOL_HARITASI.md` kisaltilmis adi gecmektedir. Repository'deki kanonik dosya adi `docs/CAEL_AI_SALES_AGENT_YOL_HARITASI.md` olarak sabitlenmistir.
