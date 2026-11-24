/**
 * The few words a visitor reads before P1.6 makes them editable. The language
 * follows the site's own locale, never the panel's.
 */
export interface WidgetCopy {
  lang: string;
  open: string;
  close: string;
  aiTag: string;
  disclosure: string;
  person: string;
  personFallback: string;
  loading: string;
  ready: string;
  failed: string;
  retry: string;
  expired: string;
  restart: string;
  unavailable: string;
}

const copies: Record<"tr" | "en", WidgetCopy> = {
  tr: {
    lang: "tr",
    open: "Asistanı aç",
    close: "Kapat",
    aiTag: "Yapay zekâ",
    disclosure:
      "Ben bir yapay zekâ asistanıyım, insan değilim. İstediğiniz zaman bir kişiyle görüşebilirsiniz.",
    person: "Bir kişiyle görüş",
    personFallback:
      "Bir kişiyle görüşmek için bu sitenin iletişim bilgilerini kullanabilirsiniz.",
    loading: "Bağlanıyor…",
    ready: "Mesajlaşma henüz açık değil.",
    failed: "Bağlantı kurulamadı.",
    retry: "Tekrar dene",
    expired: "Oturumun süresi doldu.",
    restart: "Yeniden başlat",
    unavailable: "Bu asistan burada kullanılamıyor.",
  },
  en: {
    lang: "en",
    open: "Open the assistant",
    close: "Close",
    aiTag: "AI",
    disclosure:
      "I am an AI assistant, not a person. You can talk to a person at any time.",
    person: "Talk to a person",
    personFallback:
      "To talk to a person, use the contact details on this website.",
    loading: "Connecting…",
    ready: "Messaging is not open yet.",
    failed: "Could not connect.",
    retry: "Try again",
    expired: "Your session has ended.",
    restart: "Start again",
    unavailable: "This assistant is not available here.",
  },
};

export function widgetCopy(locale: string): WidgetCopy {
  return locale.toLowerCase().startsWith("tr") ? copies.tr : copies.en;
}
