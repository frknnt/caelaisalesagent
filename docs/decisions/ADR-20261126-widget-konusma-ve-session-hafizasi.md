# ADR-20261126: Widget konuşması ve session hafızası

- Durum: Kabul edildi
- Task: P1.4
- Tarih: 2026-11-26
- Genişlettiği karar:
  `ADR-20261124-widget-embed-domain-kilidi-ve-public-session` madde 5 ve 24
  (frame'de storage yok; konuşma P1.4)

## Bağlam

P0.5 30 dakikalık teknik `widget_sessions` oturumunu kurdu; konuşma, mesaj ve
anonim kimlik P1.4'e kaldı. P1.3 agent döngüsü (`runAgentTurn`) hazır ama gerçek
LLM adapter'ı yok. Gereken: refresh/reconnect sonrası konuşmanın devamı, aynı
mesajın iki kez gönderilmesinde tek mesaj/tek cevap, consent'e bağlı hafıza,
uzun konuşmada özet ve kaynaklı cevap veren çalışan demo.

## Karar

1. **Tablolar** (migration `20261126101225_p1_4_widget_conversations.sql`):
   `visitor_identities` (anonim kimlik; tarayıcı sırrının yalnız SHA-256'sı),
   `visitor_consents` (append-only: purpose, text version, zaman, source),
   `visitor_sessions` (her `widget_sessions` satırını tek ziyaretçiye bağlar;
   `widget_sessions` değişmedi), `conversations` (sayaç, özet), `messages`.
   Yazma yalnız service-role `security definer` fonksiyonlarıyla; organizasyon
   üyeleri konuşma/mesaj/consent/visitor_session okur (P1.5 inbox), kimlik
   tablosunu (hash) hiç okumaz. anon hiçbir şey okumaz.
2. **Anonim kimlik:** Frame 32 baytlık rastgele bir ziyaretçi anahtarı üretir
   (`fresh`) ve varsa eskisini (`key`) yollar; sunucu ikisini de hash'ler. Eski
   anahtar son 2 saatte aktif ziyaretçiyi (refresh, reconnect, süresi dolan
   oturum) veya aktif hafıza izni olan ziyaretçiyi (180 gün) bulursa devam eder;
   yoksa yeni anonim ziyaretçi açılır. Aynı teknik oturum tek kez bağlanır;
   tekrar çağrı aynı sonucu verir.
3. **Frame storage (P0.5 madde 5'in daraltılması):** Session token hâlâ yalnız
   bellekte. Ziyaretçi anahtarı token değildir (yalnız kendi konuşmasını bulur,
   yetki vermez) ve frame'in kendi, müşteri sayfasına kapalı, bölümlenmiş
   storage'ında durur: varsayılan `sessionStorage` (sekme kapanınca biter),
   `localStorage` yalnız hafıza izni varken. İzin geri alınınca `localStorage`
   silinir. Loader (müşteri sayfası) storage kullanmaz; birim testi bunu ve
   frame'de tek erişim noktası/tek anahtarı denetler.
4. **Idempotency:** Tarayıcı her mesaja bir `clientMessageId` (UUID) verir.
   `(conversation_id, client_message_id)` ve `messages.reply_to` unique.
   `widget_post_message` mesajı yazar ve tek cevabı `pending` olarak claim eder.
   Aynı id tekrar gelirse: cevap bitmişse `duplicate` (saklı cevap döner),
   sürüyorsa `in_progress` (202, frame konuşmayı yoklar), `failed` veya 90 sn
   terk edilmişse yeniden claim (en çok 5 deneme). `widget_complete_reply`
   yalnız `pending` cevabı değiştirir; geç kalan ikinci işçi cevabın üstüne
   yazamaz. Agent `turnId` olarak cevap id'sini alır; yan etkili tool'lar
   gelecekte aynı anahtarla tek çalışır.
5. **Streaming:** `LlmRequest.onTextDelta` port seviyesinde opsiyoneldir.
   Guarded çağrı, deneme bitince (zaman aşımı dahil) parçaları iletmeyi keser.
   `POST /api/widget/v1/messages` SSE döner: `accepted`, `delta` (yalnız
   gösterim), `reply` (otoriter metin + kaynaklar) veya `error`. Frame son metni
   `reply` ile değiştirir; ekran okuyucuya yalnız bitmiş cevap
   `aria-live=polite` bölgeden bir kez okunur.
6. **Hafıza ve özet:** Agent penceresi 12 tur / 12.000 karakterdir. Pencereden
   düşen turlar deterministik olarak (`lib/agent/summary.ts`, model çağrısı ve
   maliyet yok) `conversations.summary`'ye katlanır; `summarized_through` yalnız
   ileri gider. Özet ziyaretçi kaynaklıdır ve prompt'a her zaman güvenilmez veri
   olarak sarılı girer. Consent yoksa 2 saat sonra hafıza yoktur.
7. **Spam ve limit (SQL):** Mesaj 1-1000 karakter; oturum başına 12/dk, site
   başına 600/dk; aynı metin 30 sn içinde yeni id ile = `spam`; konuşma başına
   100 ziyaretçi mesajı. Ek dosya alanı reddedilir
   (`WIDGET_ATTACHMENTS_UNSUPPORTED`); arayüzde yalnız "yakında" açıklamalı bir
   yer tutucu düğme vardır.
8. **Demo sağlayıcı:** `LLM_PROVIDER=demo` (`lib/llm/adapters/demo.ts`) bir dil
   modeli değildir: önce `search_knowledge` çağırır, sonra yalnız aracın
   döndürdüğü metni (onaylı kaynak veya aracın güvenli "bilmiyorum" metni)
   akıtır, ilk cevapta yapay zekâ olduğunu söyler. `isSimulated=true`, fiyatı
   0'dır; bütçeye sayılmaz. Gerçek sağlayıcı `agent-runtime.ts` içindeki adapter
   listesine eklenir; agent döngüsü değişmez. Kayıtlı olmayan sağlayıcı, eksik
   fiyat veya emergency stop'ta sabit handoff metni döner.
9. **Kaynak gösterimi:** Agent sonucu salt-okunur tool çıktılarını taşır
   (`toolOutputs`); cevap kaynakları `search_knowledge` çıktısından alınır, en
   çok 5, yalnız `sourceId/title/url` ve yalnız `http(s)` URL.

## Alternatifler

- `widget_sessions`'ı genişletip ziyaretçi alanları eklemek reddedildi: teknik
  oturum 30 dk ve tek kullanımlık bootstrap'a bağlı; ziyaretçi ondan uzun yaşar.
- Ziyaretçi anahtarını cookie'de tutmak reddedildi: üçüncü taraf cookie'ye
  bağımlılık ve P0.5'in "panel cookie'sine dokunma" kuralı.
- Özeti LLM ile üretmek şimdilik reddedildi: maliyet, yan etki ve gerçek
  sağlayıcı yokluğu. Gerçek sağlayıcı gelince ayrı, bütçeli bir `summary` amacı
  olarak eklenebilir.
- WebSocket reddedildi: tek yönlü akış için SSE yeterli ve Node runtime'da ek
  altyapı istemez.

## Riskler

- Tarayıcı dışı istemci (P0.5 tehdit modeli) oturum alıp mesaj atabilir; rate
  limit, mesaj limiti ve bütçe sınırlar. Bot tespiti P4.3.
- Bölümlenmiş storage'ı engelleyen tarayıcıda refresh sonrası konuşma devam
  etmez (yeni anonim ziyaretçi); işlev bozulmaz.
- Retention zamanlanmadı (P3.4); konuşmalar silinene kadar tenant DB'de durur.
- Akış sırasında bağlantı koparsa cevap yine saklanır; frame 22 sn yoklar.
- `docs/CAEL_AI_SALES_AGENT_UI_REFERANS.md` yok; P0.5 widget görsel dili
  korundu.

## Geri alma yolu

Uygulama: `app/api/widget/v1/{visitor,conversation,messages,feedback}`,
`lib/widget/{conversation*,agent-runtime,supabase-conversation-store}.ts`,
`lib/llm/adapters/demo.ts` kaldırılır, frame P0.5 haline döner. Veritabanı: yeni
append-only migration fonksiyon grant'lerini kapatır; tablolar okunur kalır.
Acil kapatma: `LLM_EMERGENCY_STOP=on` (cevaplar handoff metni olur).
