# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Primary: B2B, danışmanlık ağırlıklı satış yapan ekipler ve site sahipleri
  (ajans/danışmanlık, B2B üretici, eğitim). Sitelerine gelen ziyaretçi
  sorularına hızlı ve doğru yanıt vermek, satışa dönen konuşmayı bağlamıyla
  temsilciye almak isterler.
- İkincil: satış temsilcileri. Inbox'ta agentın ne söylediğini, neye dayandığını
  ve konuşmanın kimde olduğunu görürler.

## Product Purpose

Cael, web sitelerine eklenen bağımsız bir AI satış agentı SaaS'ıdır. Ziyaretçiye
AI olduğunu söyler, yalnız onaylı kaynaklardan yanıt verir ve emin olmadığında
ya da konuşma satışa döndüğünde konuşmayı bağlamıyla insana devreder. Başarı:
ziyaretçi doğru ve kaynaklı yanıt alır, ticari karar ekipte kalır.

## Positioning

Üç mekanizma birlikte: görünür AI kimliği, her yanıtta onaylı kaynak, her zaman
açık insan devri (temsilci devralınca agent susar). Fiyat, iskonto, stok,
randevu uygunluğu veya ödeme sonucu modelden değil yetkili sistemden gelir.

## Operating Context

- Ziyaretçi sitedeki widget'ta yazar; temsilci Inbox'ta devralır.
- Kaynaklar: onaylı sayfa ve dokümanlar. Ziyaretçi mesajı ve yüklenen içerik
  güvenilmez veridir, talimat sayılmaz.
- Roller: Owner, Admin, Editor, Sales, Viewer; tenant/site izolasyonu.

## Capabilities and Constraints

- Çalışıyor (2026-11): çalışma alanı, SSR auth, beş rol, davet, tenant
  izolasyonu (RLS), sunucuda kalan gizli anahtarlar.
- Geliştirmede: agent, site widget'ı, canlı insan devri, kaynak politikası
  uygulaması, izin kaydı. Bunlar çalışıyormuş gibi gösterilmez.
- Consent yoksa pazarlama izni verilmez; amaç, metin sürümü, zaman ve kaynak
  kaydedilir.
- Arayüz dili Türkçe.

## Brand Commitments

- Ad: Cael. Markası Embedra'dan bağımsızdır.
- Ses: açık, ölçülü, abartısız; ünlem ve hype kelime yok.
- Örnek içerik her zaman örnek olarak işaretlenir.

## Evidence on Hand

- Gerçek müşteri, testimonial, logo, fiyat, metrik veya kullanıcı sayısı YOK;
  uydurulmaz.
- Gösterilebilir tek görsel malzeme Cael'in kendi arayüzüdür (kodla, örnek
  Türkçe veriyle).

## Product Principles

1. Model ticari gerçek uydurmaz; yetkili sistem belirler.
2. AI kimliği ve kaynak her zaman görünür.
3. İnsana devir her zaman mümkündür; devralınca agent susar.
4. Durum dürüst gösterilir: geliştirmede olan şey geliştirmede yazılır.

## Accessibility & Inclusion

WCAG 2.2 AA: tek h1, 14 px altı görünür metin yok, 44×44 hedef, 320 px reflow,
%200 metin, klavye sırası (skip link → main → ilk CTA), axe kritik/ciddi 0,
`prefers-reduced-motion` desteği.
