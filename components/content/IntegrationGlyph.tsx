import {
  CalendarClock,
  Database,
  LifeBuoy,
  Mail,
  MessageCircle,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

import type { IntegrationCategory } from "@/types/content";

const glyphs: Record<IntegrationCategory, LucideIcon> = {
  CRM: Database,
  Messaging: MessageCircle,
  Email: Mail,
  Calendar: CalendarClock,
  Commerce: ShoppingBag,
  Support: LifeBuoy,
};

interface IntegrationGlyphProps {
  category: IntegrationCategory;
  className?: string;
}

/** Neutral category mark. No third-party logos are reproduced. */
export function IntegrationGlyph({
  category,
  className,
}: IntegrationGlyphProps) {
  const Icon = glyphs[category];
  return <Icon aria-hidden="true" className={className} strokeWidth={2} />;
}
