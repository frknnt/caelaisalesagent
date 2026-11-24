import type { FooterGroup } from "@/types/site";

export const footerDescription =
  "Cael AI Sales Agent helps teams engage, qualify, and convert more opportunities with intelligent sales automation.";

export const footerGroups: FooterGroup[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Integrations", href: "/integrations" },
      { label: "Security", href: "/security" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/resources/documentation" },
      { label: "Blog", href: "/blog" },
      { label: "Customer Stories", href: "/customer-stories" },
      { label: "Support", href: "/support" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Careers", href: "/careers" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
];
