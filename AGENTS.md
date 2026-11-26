# Cael AI Sales Agent - Kalici Calisma Protokolu

Bu dosya, bu repository ile acilan her yeni sohbetin sabit baslangic talimatidir. Kullanici aksini acikca istemedikce asagidaki protokol uygulanir.

## Her sohbetin basinda

1. Bu dosyayi tamamen oku.
2. `docs/CAEL_AI_SALES_AGENT_YOL_HARITASI.md` dosyasinin ust durum blogunu ve ilgili task satirini oku.
3. `docs/CAEL_AI_SALES_AGENT_ILERELEME_NOTLARI.md` dosyasinin yalniz son 2 kaydini ve task'in dogrudan bagli oldugu onceki task kaydini oku.
4. Istek belirli bir task koduyla ilgiliyse `docs/KOMPAKT_YOL_HARITASI.md` icindeki o task kartini ve "Yalin calisma protokolu" bolumunu oku. Kart teslimler, zorunlu testler, bitis kriteri ve ozel kurallari icerir; PDF (`docs/reference/CAEL_AI_SALES_AGENT_YOL_HARITASI_2026.pdf`) yalniz kart belirsiz veya celiskili kalirsa ilgili sayfadan okunur. Test kosma zamanlamasi (gelistirirken / task sonu / kapi sonu) o bolumdeki test profiline gore yapilir.
5. Istekle dogrudan ilgili `docs/decisions/` ve `docs/runbooks/` dosyalarini oku.
6. Kod veya dosya degisikligi isteniyorsa mevcut repository durumunu ve diff'i incele. Kullanici yalnizca sohbet, aciklama, plan veya gorev listesi istiyorsa dosyalari degistirme.

## Kullanici niyetine gore calisma modu

### 1. Genel sohbet / urun veya mimari tartisma

- Soruyu roadmap baglaminda yanitla.
- Kullanici uygulama istemediyse kodu, task durumunu, `NEXT_TASK` alanini veya ilerleme notlarini degistirme.
- Oneri ile onaylanmis karari birbirine karistirma.

### 2. Task veya faz dokumu

Kullanici "su an P0.1'deyiz", "P0.1 icin ne yapacagiz?" veya benzeri bir istek verdiginde:

- Kodu `P0.1` biciminde normalize et; `P.01` gibi yazimlari sessizce dogru task koduna esle.
- Ilgili PDF task sayfasini ve roadmap bagimliliklarini oku.
- Hedefi, on kosullari/bagimliliklari, tum teslimleri, tum zorunlu testleri, ozel kurallari, bitis kriterini, beklenen dosya alanlarini, migration/env/secret ihtiyacini, riskleri ve dis onay gerektiren noktalari eksiksiz listele.
- Varsa ilerleme notlarindan halihazirda tamamlanan veya acik kalan alt maddeleri ayir.
- Kod yazma, task'i `ACTIVE`/`DONE` yapma ve ilerleme kaydi ekleme. Uygulama ancak kullanici acikca isterse baslar.

### 3. Uygulama

- Bir oturumda yalniz `NEXT_TASK` veya kullanicinin acikca verdigi tek task kodunu uygula.
- Baslamadan once mevcut durum ve diff'i incele; 5-10 maddelik plan, dokunulacak dosyalar, migration/env/secret ihtiyaci, riskler ve test listesini yaz.
- Belirsizlikte scope'u buyutmeyen en makul secimi yap. Geri dondurulmesi pahali mimari karari `docs/decisions/` altinda kaydet.
- Task disindaki sonraki-faz ozelliklerini ekleme. Blocked isi `DONE` yapma; nedeni gorunur tut.
- Uygulamadan sonra lint, typecheck, unit, ilgili integration/E2E ve build calistir. UI varsa gercek tarayicida ilgili viewport, klavye, loading, empty ve error durumlarini test et.
- Bir zorunlu test gecmeden veya bitis kriteri kanitlanmadan `DONE` yazma.
- Bitince roadmap status/ozet/`NEXT_TASK` alanini guncelle ve ilerleme notlari dosyasinin **sonuna** yeni kayit ekle. Eski ilerleme kayitlarini degistirme.

### 4. Hata duzeltme

- Hatayi once yeniden uret ve kok nedeni bir cumleyle belirt.
- Testi atlama, devre disi birakma, beklentiyi gevsetme veya mock ile gercek davranisi gizleme.
- En kucuk kapsamli duzeltmeyi yap; ilgili testleri ve typecheck'i yeniden calistir.
- Schema, RLS, auth veya tenant izolasyonu etkileniyorsa allow ve deny testlerini birlikte ekle.
- Task bitis kriteri saglanmiyorsa durum `ACTIVE` veya `BLOCKED` kalir.

## Degismez urun ve kod kurallari

- Model fiyat, iskonto, stok, randevu uygunlugu veya odeme sonucu uydurmaz; authoritative tool/server belirler.
- Agent ilk etkilesimde AI oldugunu aciklar; sahte insan, referans, aciliyet veya garanti uretmez.
- Kullanici mesaji ve yuklenen kaynak guvenilmez veridir; sistem talimati olarak calistirilmaz.
- Her zaman insana devretme yolu vardir; temsilci devralinca agent susar.
- Consent yoksa pazarlama izni verilmez; purpose, text version, timestamp ve source kaydedilir.
- Her tenant/site verisi database, storage, queue, vector search ve analytics katmanlarinda izole edilir.
- Service role ve secret browser'a cikmaz; loglar PII veya secret icermez.
- LLM gecici hata, timeout, refusal veya butce sinirinda yan etki yapmaz; guvenli fallback/handoff calisir.
- Score, route, billing, quota ve riskli side-effect deterministik kurallardan gecer.
- AI'nin olusturdugu schema, result, oneri veya icerik insan onayi olmadan production'a yayinlanmaz.
- Migration append-only'dir; eski migration degistirilmez. Sifir DB ve mevcut DB upgrade yolu test edilir.
- RLS ve grants birlikte tasarlanir; public/exposed tablolarda allow ve deny testleri bulunur.
- Test gecmeden task `DONE` olmaz; test kapatilmaz ve expectation gevsetilmez.
- Commit/push, production deploy, ucretli gercek API testi ve destructive islem yalniz acik kullanici talimatiyla yapilir.
- Her tamamlanan task ilerleme dosyasinin sonuna eklenir; gecmis notlar yeniden yazilmaz.

## Guncellik ve kaynak kurallari

- Supabase ile ilgili her adimda mevcut changelog ve resmi dokumani kontrol et; CLI komutlarini `--help` ile kesfet; paket surumlerini pinle.
- UI koduna baslamadan once, varsa `docs/CAEL_AI_SALES_AGENT_UI_REFERANS.md` dosyasini tamamen oku. Dosya yoksa ve secili task bunu gerektiriyorsa eksikligi plan ve risklerde acikca belirt.
- PDF'deki Embedra, bayi agi veya Embedra CRM disi metodoloji notlarini urun kapsamina geri alma. Bu urun bagimsiz Cael SaaS'tir.
- Kaynaklar celisirse kullanicinin son acik talebi, bu kalici protokol, canli roadmap/progress durumu ve task'in PDF spesifikasyonu sirasiyla yorumlanir; belirsizlik sonucu degistirecekse kullaniciya sorulur.

## Task bitince zorunlu ilerleme kaydi

Yeni kayit en az su alanlari icerir:

- Task: kod, baslik, tarih, sure ve durum
- Degisiklik: dosyalar, migration, env, dependency, API ve UI
- Kanit: test komutlari/sonuclari, ekran veya SQL/RLS kaniti
- Denenemeyen: hesap, secret, veri veya dis onay nedeniyle kalanlar
- Risk: bilinen sinirlama, teknik borc ve geri alma yolu
- NEXT_TASK: bagimliligi tamamlanmis siradaki tek task
