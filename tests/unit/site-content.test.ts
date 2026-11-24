import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { guides, posts } from "@/data/articles";
import { homeFaq, pricingFaq, supportFaq } from "@/data/faq";
import { footerGroups } from "@/data/footer";
import { integrations, marqueeRows, stackNames } from "@/data/integrations";
import { isActiveRoute, primaryNavigation, routes } from "@/data/navigation";
import { pricingPlans, pricingRows } from "@/data/pricing";

const root = process.cwd();

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// Test harness pages are not part of the shipped site. A shipped page that
// linked to one would still fail here, because no page.tsx exists for it.
const sources = ["app", "components", "data"]
  .flatMap((directory) => walk(join(root, directory)))
  .filter((path) => /(?<!\.e2e)\.(ts|tsx)$/.test(path))
  .map((path) => ({ path, text: readFileSync(path, "utf8") }));

function routeExists(href: string) {
  const path = href.split(/[?#]/)[0] ?? "";
  if (path === "/") return existsSync(join(root, "app/page.tsx"));
  if (existsSync(join(root, "app", path, "page.tsx"))) return true;
  const blog = /^\/blog\/([\w-]+)$/.exec(path)?.[1];
  if (blog) return posts.some((post) => post.slug === blog);
  const guide = /^\/resources\/([\w-]+)$/.exec(path)?.[1];
  return guide ? guides.some((item) => item.slug === guide) : false;
}

describe("site links", () => {
  const hrefs = sources.flatMap(({ path, text }) =>
    [...text.matchAll(/(?:href=|href: )"(\/[^"]*)"/g)].map((match) => ({
      path,
      href: match[1] ?? "",
    })),
  );

  it("finds links to check", () => {
    expect(hrefs.length).toBeGreaterThan(20);
  });

  it.each(hrefs)("$href resolves to a page", ({ href }) => {
    expect(routeExists(href)).toBe(true);
  });

  it.each(Object.values(routes))("%s resolves to a page", (href) => {
    expect(routeExists(href)).toBe(true);
  });

  it("uses real routes instead of hashes in navigation", () => {
    const links = [
      ...primaryNavigation,
      ...footerGroups.flatMap((group) => group.links),
    ];
    expect(links.filter((link) => link.href.includes("#"))).toEqual([]);
  });

  it("marks nested routes active without matching home everywhere", () => {
    expect(isActiveRoute("/", "/")).toBe(true);
    expect(isActiveRoute("/blog/post", "/blog")).toBe(true);
    expect(isActiveRoute("/blog", "/")).toBe(false);
    expect(isActiveRoute("/blogger", "/blog")).toBe(false);
  });
});

describe("site content", () => {
  it("contains no wording left over from the visual reference", () => {
    const offending = sources.filter(({ text }) =>
      /pinvpn|\bvpn\b|lorem ipsum|coming soon/i.test(text),
    );
    expect(offending.map(({ path }) => path)).toEqual([]);
  });

  it("claims no certifications", () => {
    const offending = sources.filter(({ text }) =>
      /SOC ?2|HIPAA|ISO ?27001|AES-256|GDPR[- ](?:compliant|certified)/i.test(
        text,
      ),
    );
    expect(offending.map(({ path }) => path)).toEqual([]);
  });

  it("resolves every named tool to an integration record", () => {
    const names = new Set(integrations.map((item) => item.name));
    const used = [...marqueeRows.flat(), ...stackNames];
    expect(used.filter((name) => !names.has(name))).toEqual([]);
  });

  it("fills every plan column in the comparison table", () => {
    for (const row of pricingRows) {
      for (const plan of pricingPlans) {
        expect(row.values[plan.id], `${row.label}/${plan.id}`).toBeTruthy();
      }
    }
  });

  it("keeps ids and slugs unique", () => {
    for (const list of [homeFaq, pricingFaq, supportFaq]) {
      expect(new Set(list.map((item) => item.id)).size).toBe(list.length);
    }
    const slugs = [...guides, ...posts].map((article) => article.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
