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
  chat: ChatCopy;
}

/** Words of the conversation itself. Sent to the frame as data, never as markup. */
export interface ChatCopy {
  messages: string;
  you: string;
  assistant: string;
  inputLabel: string;
  placeholder: string;
  send: string;
  attach: string;
  attachSoon: string;
  typing: string;
  sources: string;
  helpful: string;
  notHelpful: string;
  thanks: string;
  retrySend: string;
  handoff: string;
  memory: string;
  memoryHint: string;
  memoryOn: string;
  memoryOff: string;
  prompts: string[];
  errors: {
    rate: string;
    repeated: string;
    limit: string;
    invalid: string;
    failed: string;
    offline: string;
  };
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
    ready: "Size nasıl yardımcı olabilirim?",
    failed: "Bağlantı kurulamadı.",
    retry: "Tekrar dene",
    expired: "Oturumun süresi doldu.",
    restart: "Yeniden başlat",
    unavailable: "Bu asistan burada kullanılamıyor.",
    chat: {
      messages: "Mesajlar",
      you: "Siz",
      assistant: "Asistan",
      inputLabel: "Mesajınız",
      placeholder: "Sorunuzu yazın…",
      send: "Gönder",
      attach: "Dosya ekle",
      attachSoon: "Dosya ekleme bu sürümde henüz yok.",
      typing: "Yazıyor…",
      sources: "Kaynaklar",
      helpful: "Faydalı",
      notHelpful: "Faydalı değil",
      thanks: "Geri bildiriminiz için teşekkürler.",
      retrySend: "Tekrar gönder",
      handoff: "Bu konuda bir kişiyle görüşmeniz daha iyi olur.",
      memory: "Bu cihazda konuşmamı hatırla",
      memoryHint:
        "İşaretlerseniz bu sitedeki konuşmanız sonraki ziyaretinizde kaldığı yerden devam eder. İstediğiniz an kaldırabilirsiniz.",
      memoryOn: "Konuşmanız bu cihazda hatırlanacak.",
      memoryOff: "Konuşmanız sonraki ziyarette hatırlanmayacak.",
      prompts: [
        "Hangi hizmetleri sunuyorsunuz?",
        "Teslimat ne kadar sürüyor?",
        "Bir temsilciyle konuşabilir miyim?",
      ],
      errors: {
        rate: "Çok hızlı mesaj gönderdiniz. Biraz bekleyip tekrar deneyin.",
        repeated: "Bu mesajı az önce gönderdiniz.",
        limit:
          "Bu konuşma mesaj sınırına ulaştı. Devam etmek için bir kişiyle görüşebilirsiniz.",
        invalid: "Mesaj boş olamaz ve en fazla 1000 karakter olabilir.",
        failed: "Yanıt alınamadı.",
        offline: "Bağlantı koptu.",
      },
    },
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
    ready: "How can I help you?",
    failed: "Could not connect.",
    retry: "Try again",
    expired: "Your session has ended.",
    restart: "Start again",
    unavailable: "This assistant is not available here.",
    chat: {
      messages: "Messages",
      you: "You",
      assistant: "Assistant",
      inputLabel: "Your message",
      placeholder: "Type your question…",
      send: "Send",
      attach: "Attach a file",
      attachSoon: "Attaching files is not available yet.",
      typing: "Typing…",
      sources: "Sources",
      helpful: "Helpful",
      notHelpful: "Not helpful",
      thanks: "Thank you for your feedback.",
      retrySend: "Send again",
      handoff: "A person can help you better with this.",
      memory: "Remember my conversation on this device",
      memoryHint:
        "If you tick this, your conversation on this site continues on your next visit. You can untick it at any time.",
      memoryOn: "Your conversation will be remembered on this device.",
      memoryOff: "Your conversation will not be remembered next time.",
      prompts: [
        "What services do you offer?",
        "How long does delivery take?",
        "Can I speak with someone from your team?",
      ],
      errors: {
        rate: "You sent messages too quickly. Wait a moment and try again.",
        repeated: "You just sent this message.",
        limit:
          "This conversation reached its message limit. You can talk to a person to continue.",
        invalid:
          "A message cannot be empty and can have at most 1000 characters.",
        failed: "No answer could be given.",
        offline: "The connection was lost.",
      },
    },
  },
};

export function widgetCopy(locale: string): WidgetCopy {
  return locale.toLowerCase().startsWith("tr") ? copies.tr : copies.en;
}
