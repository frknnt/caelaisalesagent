export interface NavItem {
  label: string;
  href: string;
}

export interface FooterGroup {
  title: string;
  links: NavItem[];
}

export interface CallToAction {
  label: string;
  href: string;
}
