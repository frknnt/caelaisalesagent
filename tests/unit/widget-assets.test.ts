import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import * as assets from "@/lib/widget/generated/assets";
import { GET } from "@/app/widget/v1/loader.js/route";

import {
  assetsPath,
  generateWidgetAssets,
} from "../../scripts/widget-assets.mjs";

const hash = (text: string) =>
  `sha256-${createHash("sha256").update(text, "utf8").digest("base64")}`;

describe("widget assets", () => {
  it("match their source (run `npm run widget:build` when this fails)", async () => {
    const normalize = (text: string) => text.replaceAll("\r\n", "\n");
    expect(normalize(readFileSync(assetsPath, "utf8"))).toBe(
      normalize(await generateWidgetAssets()),
    );
  });

  it("have hashes that match their own bytes", () => {
    expect(assets.frameScriptHash).toBe(hash(assets.frameScript));
    expect(assets.frameStyleHash).toBe(hash(assets.frameStyle));
  });

  it("stay small enough for a slow phone", () => {
    expect(gzipSync(assets.loaderScript).length).toBeLessThan(6 * 1024);
    expect(
      gzipSync(assets.frameScript + assets.frameStyle).length,
    ).toBeLessThan(6 * 1024);
  });

  it("load nothing else and use no cookie, storage or markup sink", () => {
    for (const code of [assets.loaderScript, assets.frameScript]) {
      for (const banned of [
        "document.cookie",
        "localStorage",
        "sessionStorage",
        "indexedDB",
        "innerHTML",
        "insertAdjacentHTML",
        "document.write",
        "eval(",
        "new Function",
        "import(",
      ]) {
        expect(code, banned).not.toContain(banned);
      }
      expect(code.match(/https?:\/\/(?!www\.w3\.org)[\w.]+/g)).toBeNull();
    }
    expect(assets.frameStyle).not.toMatch(/url\(|@import/);
  });

  it("name every state by text, not by color alone", () => {
    for (const state of ["loading", "ready", "failed", "expired"]) {
      expect(assets.frameScript).toContain(state);
    }
  });
});

describe("loader route", () => {
  const request = (headers: Record<string, string> = {}) =>
    new Request("https://app.cael.example/widget/v1/loader.js", { headers });

  it("is public, cacheable for minutes and never credentialed", async () => {
    const response = GET(request());
    expect(response.headers.get("content-type")).toBe(
      "text/javascript; charset=utf-8",
    );
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
    expect(response.headers.get("cache-control")).toContain("max-age=300");
    expect(await response.text()).toBe(assets.loaderScript);
  });

  it("answers an unchanged copy without a body", async () => {
    const response = GET(request({ "if-none-match": assets.loaderEtag }));
    expect(response.status).toBe(304);
    expect(await response.text()).toBe("");
  });
});
