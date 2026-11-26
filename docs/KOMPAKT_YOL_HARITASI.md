# Cael AI Sales Agent - Kompakt Yol Haritasi

Bu dosya, PDF'deki (`docs/reference/CAEL_AI_SALES_AGENT_YOL_HARITASI_2026.pdf`)
task sayfalarinin kisaltilmis ve calisma icin yeterli halidir. Amac: her
oturumun PDF, uzun ilerleme gecmisi ve tum kalite kapilarini bastan
okumak/kosmak yerine az okuyup az kosarak ayni kaliteyi tutmasi.

- Task durumu ve `NEXT_TASK` icin tek canli kaynak hala
  `docs/CAEL_AI_SALES_AGENT_YOL_HARITASI.md`'dir. Bu dosyada durum tutulmaz.
- Task kapsamı icin bu dosyadaki satir yeterlidir. PDF yalniz bu dosya belirsiz
  veya celiskili kalirsa ilgili sayfa okunur.
- Degismez kurallar `AGENTS.md` icindedir; burada tekrarlanmaz.

## 1. Yalin calisma protokolu

### Okuma (oturum basinda, toplam az)

1. `AGENTS.md`
2. Canli roadmap'in ust durum blogu ve ilgili tablo satiri (dosyanin tamami
   degil)
3. Bu dosyada ilgili task blogu
4. Ilerleme notlarinin **yalniz son 2 kaydi** ve task'in dogrudan bagli oldugu
   onceki task kaydi
5. Yalniz task ile dogrudan ilgili ADR/runbook (adindan secilir)

### Test profili

| Ne zaman               | Ne kosulur                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Gelistirirken          | Yalniz degisen dosyanin unit testi (`npx vitest run <dosya>`) ve yeni pgTAP dosyasi                                   |
| Task sonunda (bir kez) | `CAEL_NEXT_DIST_DIR=.next-check npm run check` + sifir DB'de tum pgTAP + yalniz task'in E2E spec'leri ve mevcut smoke |
| Kapi sonunda (bir kez) | Tam `npm run test:e2e`, upgrade yolu (mevcut DB'ye migration up), `npm run test:failure-proof -- --e2e`               |

- Kapilar: **Demo** = P1.4 bitisi, **Pilot** = P2.7 bitisi, **SaaS** = P4.2
  bitisi, **Production** = P4.4 bitisi.
- Mutasyon testi, 25 tekrarli performans olcumu ve 5 viewport x tum durum
  matrisi varsayilan degildir. Yalniz task'in zorunlu testi bunu gerektirirse
  yapilir. UI kaniti: 375 ve 1440 px, ilgili loading/empty/error durumlari.
- Zorunlu testler atlanmaz, gevsetilmez. Yalin profil "neyin ne zaman
  kosulacagini" belirler, "neyin test edilecegini" azaltmaz.

### Kanit ve kayit

- `docs/evidence/<task>/README.md`: komutlar, sonuclar, denenemeyenler. Kisa
  tutulur.
- Ilerleme notu: AGENTS.md alanlari, her alan 1-3 satir.
- Gecici stack/volume/build dizinleri oturum sonunda silinir.

### Commit ve push (kullanicinin kalici talimati, 2026-11-26)

- Her sub session task'i bitirince kendi degistirdigi dosyalari commit edip
  `origin main`'e push eder. Baskasinin dosyasini commit'e katmaz.
- Commit mesaji: Turkce, kisa, net ve nokta ile biter. Ornek:
  `P1.4 widget konusmasi ve session hafizasi eklendi.`
- Commit'te hicbir Claude/AI ibaresi olmaz: `Co-Authored-By` satiri, "Generated
  with" notu veya benzeri eklenmez. Yazar ve committer yalniz `frknnt`.
- Push'tan once secret taramasi yapilir; `.env*` (`.env.example` haric) ve
  secret iceren dosya commit edilmez.
- Testi gecmeyen veya `BLOCKED` is commit edilebilir ama mesajda durum acikca
  yazilir; `DONE` yazilmaz.

### Bitis mesaji

Durum (DONE/ACTIVE/BLOCKED), kosulan komutlar ve sonuclari, denenemeyenler, yeni
`NEXT_TASK`.

## 2. Kalan sira

| Sira | Task             | Not                                                                            |
| ---- | ---------------- | ------------------------------------------------------------------------------ |
| 1    | P1.1 kapanis     | Kod var; zorunlu test kanitlari ve ilerleme kaydi eksik. Yeni ozellik yok.     |
| 2    | P1.3             | Uygulaniyor                                                                    |
| 3    | P1.4             | **Demo kapisi**                                                                |
| 4    | P1.5, P1.6       |                                                                                |
| 5    | P2.1, P2.2, P2.3 | P2.3 icin P2.1 + P2.2 sart                                                     |
| 6    | P2.4 - P2.7      | **Pilot kapisi** P2.7'de                                                       |
| 7    | P3.1 - P3.5      |                                                                                |
| 8    | P4.1, P4.2       | **SaaS kapisi** P4.2'de                                                        |
| 9    | P4.3, P4.4       | Gercek pilot ve production; dis hesap/onay gerekir. **Production kapisi**      |
| 10   | P5.1 - P5.4      | P5.2 icin P3.2 + P5.1 sart                                                     |
| 11   | P6.1 - P6.3      | P1 cekirdegi sart; P6.1 Meta hesabi ve hukuki hazirlik olmadan canliya alinmaz |

## 3. Task kartlari

Format: **Hedef** / Teslim / Test (zorunlu) / Bitis / Kural. PDF sayfasi
parantez icinde.

### Faz 1 - Agent

**P1.1 Bilgi kaynaklari ve ingestion kuyrugu (s14)**

- Hedef: Site, URL, manuel metin, SSS ve dosyalari tenant-safe bilgi kaynagina
  donustur.
- Teslim: knowledge_sources, documents, chunks, ingestion_jobs, versions; site
  crawl allowlist/robots/limit; PDF/DOCX/TXT/CSV/XLSX; private Storage,
  MIME/size validation, malware hook, retention; Supabase Queue/worker ile
  retry, idempotency, progress.
- Test: ayni kaynak iki kez -> duplicate yok; bozuk/sifreli dosya; tenant
  storage izolasyonu; job retry ve poison message.
- Bitis: kaynak durumu pending/processing/ready/failed gorunur; basarisiz is
  guvenle tekrar calisir.
- Kural: ham dosyadan cikan PII ve fiyat satirlari isaretlenir.

**P1.2 Retrieval, kaynak gosterme ve freshness (s15)** - DONE

**P1.3 LLM provider adaptoru ve agent dongusu (s16)**

- Hedef: Saglayicidan bagimsiz, arac kullanan, maliyet ve guvenlik kapili agent
  cekirdegi.
- Teslim: provider interface, model/env config, timeout/retry/circuit breaker;
  system prompt version, message window, summary, tool loop; structured tool
  schema + server validation + idempotency; token/cost/latency log, daily
  budget, emergency stop.
- Test: prompt injection; tool hallucination ve invalid schema; timeout/refusal;
  budget asilinca LLM cagrilmiyor.
- Bitis: fake provider testleri yesil; gercek model degisimi business logic'e
  dokunmadan yapilabiliyor.
- Kural: kullanici mesaji talimat degil guvenilmez veri olarak ayrilir.

**P1.4 Widget konusmasi ve session hafizasi (s17)** - Demo kapisi

- Hedef: Ziyaretcinin hizli, mobil ve erisilebilir konustugu temel deneyim.
- Teslim: visitor_sessions, conversations, messages, anonymous identity;
  streaming yanit, retry, feedback, suggested prompts; returning session icin
  consent-aware memory; spam, message limit, attachment placeholder, error UX.
- Test: refresh/reconnect; ayni mesaj iki kez; klavye/screen reader/mobil; uzun
  konusmada summary.
- Bitis: site sahibi script'i ekleyip kaynakli cevap veren calisan agent
  demosunu kullanabilir.

**P1.5 Inbox, insan devri ve canli takip (s18)**

- Hedef: Riskli veya sicak konusmayi tum baglamiyla satis ekibine devret.
- Teslim: conversation inbox, filtre, arama, unread, assignment; devral / bota
  geri ver / kapat / ic not; handoff reason, SLA reminder, e-posta bildirimi;
  transcript, tool history, lead context.
- Test: temsilci yazinca bot susuyor; iki temsilci concurrency; sorumlusuz
  konusma fallback; devralma audit log.
- Bitis: devir sonrasi cift cevap yok; satisci baglamiyla devralip geri
  verebilir.

**P1.6 Agent ayarlari, preview ve versioning (s19)**

- Hedef: Musterinin agent tonu, kapsami ve kaynaklarini guvenle yonetecegi
  panel.
- Teslim: agent name, tone, welcome, forbidden topics, handoff policy;
  draft/published version ve rollback; sandbox preview (gercek lead/event
  uretmez); model, cost limit, rate limit, emergency stop.
- Test: draft published agent'i etkilemiyor; rollback; Editor/Viewer yetkisi;
  preview data isolation.
- Bitis: yonetici yeni surumu test edip yayinlar; sorunda tek tik rollback.

### Faz 2 - Conversion

**P2.1 Conversion schema ve form editor (s20)**

- Hedef: Form, chat ve sonuc akisinin ortak veri sozlesmesi ve hizli editoru.
- Teslim: conversion_schemas, fields, options, validations, conditions, consent,
  success_action; alanlar text, textarea, email, phone, number, select, multi,
  date, file, consent; template-first editor (reorder, required, preview,
  version); server validation ve schema version/migration.
- Test: kosullu alan; file + consent; eski schema ile acik session;
  invalid/manipule client payload.
- Bitis: kod yazmadan cok adimli form olusturulup draft/publish/rollback
  yapilir.
- Kural: ilk surumde visual canvas yok; alan listesi + kosul paneli yeterli.

**P2.2 Dort renderer: chat, inline, modal, standalone (s21)**

- Hedef: Ayni schema dort yuzeyde ayni validation ve event modeliyle calisir.
- Teslim: chat form card; inline embed; modal/popover; standalone public URL +
  theme tokens.
- Test: ayni payload ve validation; responsive/a11y; theme isolation; yuzey
  bazli completion event.
- Bitis: schema her yuzeyde veri kaybi olmadan acilir; analytics yuzeyi ayirt
  eder.

**P2.3 Shared state ve progressive prefill (s22)** - P2.1 + P2.2 sart

- Hedef: Konusmada bilinen alanlari forma tasi, yalniz eksikleri sor, kritik
  degerleri dogrulat.
- Teslim: session field store + source + confidence; konusmadan structured
  extraction; form/chat iki yonlu sync; review ekrani, email/phone/budget/date
  icin onay.
- Test: yanlis extraction; dusuk confidence; kullanici cevabi degistiriyor; chat
  <-> form donusu.
- Bitis: ziyaretci ayni bilgiyi tekrar girmez; kritik alan onaysiz lead'e
  yazilmaz.

**P2.4 Sayfa, UTM ve proaktif tetikleyiciler (s23)**

- Hedef: Sayfa ve kampanya baglamiyla dogru akisi baslat.
- Teslim: page URL/title, referrer, UTM, campaign, custom context API; trigger
  page/dwell/scroll/return visit/exit intent; frequency cap, consent, quiet
  hours; context -> schema/result template mapping.
- Test: UTM spoof/minimization; cerez reddi; trigger spam; SPA route change.
- Bitis: baglama gore dogru CTA/form; ayni kullaniciya rahatsiz edici tekrar
  yok.

**P2.5 Instant Result template sistemi (s24)**

- Hedef: Iletisim bilgisinden once/hemen sonra kisisel ve guvenli mikro cikti.
- Teslim: result_templates, inputs, deterministic sections, AI narrative; ilk 3
  dikey: ajans/danismanlik, B2B uretici, egitim; assumption/source/disclaimer;
  download/share/email, PII minimization.
- Test: eksik veri; riskli saglik/hukuk/finans iddiasi engeli; kaynak ve
  varsayim; ayni girdide tutarli yapi.
- Bitis: en az uc calisan sablon demo edilir; her sonuc lead/session'a bagli.

**P2.6 Qualification, Lead Dossier ve Action Router (s25)**

- Hedef: Lead'i gerekceli siniflandir, hazir dosya ve dogru sonraki aksiyon
  uret.
- Teslim: rubric/criteria/weights/thresholds versioning; deterministik score +
  reason codes + evidence; dossier: need, budget, timeline, authority,
  objections, source, consent; route: human, booking, quote request, nurture,
  self-service.
- Test: ayni input ayni score; eksik kriter; LLM ozeti ile kanit ayrimi; route
  permission/idempotency.
- Bitis: her lead score, gerekce ve evidence tasir; satisci tek ekranda sonraki
  aksiyonu gorur.

**P2.7 Randevu, webhook ve ilk CRM connector (s26)** - Pilot kapisi

- Hedef: Nitelikli lead'i dis sisteme guvenilir aktar, sonucu kaydet.
- Teslim: calendar booking; signed webhook + retry/dead-letter; bir CRM
  connector veya generic CRM API; mapping, secret vault, run log, manual retry.
- Test: duplicate lead/appointment; expired token; webhook replay/signature;
  mapping failure ve retry.
- Bitis: lead, dossier ve kaynak tekil external id ile hedefe gider; hata
  panelden tekrar islenir.

### Faz 3 - SaaS

**P3.1 Ajans workspace, multi-client, white-label (s27)**

- Teslim: agency -> client -> site; template clone, brand kit inheritance,
  custom domain; client approval ve read-only rol; tenant-scoped
  connector/secret, portfolio dashboard.
- Test: client cross-access; clone sonrasi version ayrimi; white-label asset;
  agency/client permission matrix.
- Bitis: yeni musteri mevcut template ile <4 saatte kurulur; musteri yalniz
  kendi verisini gorur.

**P3.2 Event modeli, funnel ve rapor (s28)**

- Teslim: event taxonomy (view, open, message, field, form, result, lead, route,
  booking, handoff); session/lead/surface/campaign correlation; funnel, question
  drop-off, qualified rate, speed-to-lead; CSV export, aylik rapor.
- Test: duplicate event; ad blocker/offline; PII event payload yasagi;
  timezone/date range.
- Bitis: dashboard ayni lead yolunu sayfadan aksiyona izler; ham event ile rapor
  tutarli.

**P3.3 Plan, kota, usage ve billing (s29)**

- Teslim: plans, subscriptions, entitlements, usage_ledger; limitler agent,
  site, message, ingestion, storage, seat, connector; checkout/portal/webhook
  veya manual invoice mode; soft/hard limit, grace, admin override, usage alert.
- Test: webhook duplicate/out-of-order; plan dusurme; quota race; tenant bazli
  cost reconciliation.
- Bitis: her maliyetli aksiyon entitlement kontrolunden gecer; fatura olmasa da
  usage dogru olculur.

**P3.4 KVKK, guvenlik, retention, veri haklari (s30)**

- Teslim: versioned consent + purpose + timestamp; retention policy,
  anonymize/delete job; export/delete request akisi; secret encryption, audit
  log, signed URL, support access.
- Test: silme tum identity/channel kayitlarini kapsar; retention job idempotent;
  Storage RLS; loglarda secret/PII taramasi.
- Bitis: KVKK talepleri kanitli akisla tamamlanir; public privacy/AI disclosure
  sayfalari var.
- Kural: hukuki metinler "avukat kontrolu bekleyen taslak" olarak isaretlenir.

**P3.5 Onboarding, template pack, a11y, performans (s31)**

- Teslim: wizard site -> knowledge -> agent -> schema -> result -> route -> test
  -> publish; dort dikey template pack + demo data; WCAG widget/form QA;
  performance budget, lazy load, cache, mobil polish.
- Test: bos hesap ilk publish; template clone; Lighthouse/klavye/screen reader;
  yavas ag.
- Bitis: yeni musteri checklist ile yayina alinir; kritik adim atlanamaz;
  preview kaniti saklanir.

### Faz 4 - Kalite ve launch

**P4.1 Golge mod ve insan duzeltme dongusu (s32)**

- Teslim: site bazinda off/shadow/automatic; send / edit-send / reject; draft,
  final, edit diff, reason; yan etkili tool'lar onaydan once yalniz dry-run.
- Test: shadow musteriye mesaj gondermez; edit diff; tool dry-run; mode
  permission/audit.
- Bitis: 100+ pilot konusmada kabul/duzenleme/red orani raporlanir; yan etki
  onaysiz calismaz.

**P4.2 Eval set, adversarial test, release gate (s33)** - SaaS kapisi

- Teslim: anonim gercek + sentetik dataset; rubric
  source/correctness/tool/tone/qualification/safety; injection, PII,
  cross-tenant, jailbreak seti; model/cost/latency karsilastirma raporu.
- Test: deterministik kural testleri; LLM judge kalibrasyonu; regression
  threshold; gercek API maliyet on onayi.
- Bitis: kritik kural ihlali 0; kabul esigi ve rollback plani olmadan otomatik
  mod acilamaz.
- Dis onay: gercek API maliyeti kullanicidan onay ister.

**P4.3 10 site pilotu ve donusum dogrulamasi (s34)**

- Teslim: 10 site, 3-4 dikey, baseline form metrigi; haftalik review, issue
  taxonomy, owner; completion, qualified lead, booking, dossier usage, setup
  time; pilot consent ve feedback interview.
- Test: event dogrulugu; false lead/spam; sales feedback; incident response
  drill.
- Bitis: en az 4 ucretli devam niyeti, site basi kurulum <4 saat, kritik
  guvenlik olayi 0.
- Dis onay: gercek musteriler gerekir; kod ajani yalniz araclari ve raporu
  hazirlar.

**P4.4 Production launch, backup, support runbook (s35)** - Production kapisi

- Teslim: prod/staging ayrimi, backup/restore testi, migration runbook; SLO,
  status, alert, incident, rollback; support access, audit, escalation; release
  checklist, changelog, known limitations.
- Test: restore drill; zero-downtime migration; emergency stop; load/rate limit.
- Bitis: bir deploy, bir veri geri yukleme ve bir incident tatbikati kanitiyla
  production kapisi gecilir.
- Dis onay: hosted hesap, deploy ve secret'lar kullanicidan acik talimat ister.

### Faz 5 - Moat

**P5.1 CRM outcome, won/lost, revenue sync (s36)**

- Teslim: opportunities, stages, outcomes, lost_reasons, revenue; CRM
  pull/webhook + manual fallback; lead/session/schema/variant attribution;
  revenue, win rate, no-show, sales cycle raporu.
- Test: out-of-order stage; duplicate outcome; currency/timezone; manual/CRM
  conflict.
- Bitis: qualified lead ve revenue ayni akisa izlenir; veri gelmeyen musteri
  acikca gorunur.

**P5.2 Experiment engine, question-level CRO (s37)** - P3.2 + P5.1 sart

- Teslim: experiments, variants, assignment, exposure, conversion; sticky
  randomization, sample guard; birincil metrik qualified/revenue, ikincil
  completion/booking; pause/rollback, confidence notu.
- Test: bir kullanici tek varyant; event leakage; dusuk sample uyarisi;
  experiment version freeze.
- Bitis: yanlis kesinlik vermeden sonuc; kazanan insan onayiyla yayinlanir.

**P5.3 Insan onayli iyilestirme, prompt-to-form (s38)**

- Teslim: prompt -> draft schema, rubric, result template; analytics ->
  bottleneck/oneri; diff preview, risk flag, approve/publish; template quality
  eval, rollback.
- Test: uretilen invalid schema; riskli alan/consent; auto publish yok; oneri
  kaniti.
- Bitis: AI yalniz taslak uretir; yayin insan onayli, her degisiklik
  version/diff tasir.

**P5.4 Knowledge conflict ve otomatik yeniden egitim (s39)**

- Teslim: source freshness schedule; contradiction/unanswered/topic clustering;
  change review, impact preview; onayli recrawl/reindex + rollback.
- Test: yanlis conflict; silinmis sayfa; fiyat celiskisi; disabled source.
- Bitis: sistem bilgi boslugunu raporlar; onaysiz icerik production knowledge'a
  girmez.

### Faz 6 - Genisleme (P1 cekirdegi sart)

**P6.1 WhatsApp ve Instagram adaptorleri (s40)**

- Teslim: ChannelAdapter interface; identity, window/policy, webhook,
  delivery/read, media; unified inbox + kanala ozel cevap; Meta review/setup
  dokumani, channel mode.
- Test: signature/replay; 24 saat/policy; echo/duplicate; adapter contract.
- Bitis: web, WhatsApp, Instagram ayni lead/dossier'i paylasir; kanal farki
  yalniz adaptorde.
- Kural: sirket, Meta hesabi ve hukuki gereksinim hazir olmadan canliya alinmaz.

**P6.2 Voice/phone ve e-ticaret aksiyonlari (s41)**

- Teslim: voice session, transcript, consent, human transfer;
  katalog/arama/oneri tool; stok/fiyat server truth, cart/payment provider
  redirect; order status, verified identity.
- Test: voice latency/interruption; yanlis fiyat/stok; payment side effect;
  identity/access control.
- Bitis: model fiyat/odeme uydurmaz; yuksek riskli aksiyon dogrulanmis tool ve
  kullanici onayiyla calisir.

**P6.3 Advanced flow canvas ve template marketplace (s42)**

- Teslim: visual nodes message/field/condition/tool/result/route; draft
  validation, simulator, version diff; private/public template, clone, update
  bildirimi; partner attribution, review, malware/secret scan.
- Test: cycle/dead-end tespiti; template tenant leakage; broken connector;
  rollback.
- Bitis: canvas mevcut schema'yi bozmadan calisir; template guvenlik
  incelemesinden gecmeden yayinlanmaz.

## 4. Son audit (her task sonunda kisaca)

Bitis kriteri saglandi mi; tenant/RLS/storage/vector/queue izolasyonu allow+deny
ile test edildi mi; secret/PII/consent/retention/audit etkisi; LLM yan etkisi
server validation + idempotency arkasinda mi; UI
klavye/mobil/loading/empty/error; migration sifir DB'de (kapida upgrade'de)
calisiyor mu; roadmap + `NEXT_TASK` + ilerleme notu guncel mi; denenemeyen dis
servisler yazildi mi.
