import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

import { chromium, type Browser } from "@playwright/test";

import {
  e2eServers,
  hostUrl,
  readLocalSupabase,
  root,
  serverEnvironment,
} from "../../../scripts/e2e-environment.mjs";
import { startLatencyProxy } from "../../support/latency-proxy.mjs";
import { expect, test } from "./widget-support";

// What is measured, on the customer's page, with a cold browser every time:
//   launcher  script request starts -> the launcher is drawn and takes a click
//   shown     click -> the AI disclosure and the way to a person are on screen
//   session   click -> the server has accepted the session (reported only)
// The click comes in the very frame the launcher appears, without a hover
// before it: faster than anyone can, so the worst case.
// The network is a proxy in front of the production build: latency, bandwidth
// and the connection setup of HTTPS. Every connection is new, as on a first
// visit. WIDGET_PERF_RUNS raises the number of runs for the evidence.
const runs = Number(process.env.WIDGET_PERF_RUNS ?? "5");
const proxyPort = 3213;
const serverPort = 3214;
const proxyUrl = `http://127.0.0.1:${proxyPort}`;
const budgetMs = 1000;

const profiles = {
  // 40 ms and 10 Mbit/s: the desktop preset of Lighthouse.
  desktop: {
    network: { roundTripMs: 40, downKbps: 10_240, upKbps: 10_240 },
    cpu: 1,
    viewport: { width: 1440, height: 900 },
    mobile: false,
  },
  // 150 ms, 1.6 Mbit/s and a four times slower processor: its mobile preset.
  mobile: {
    network: { roundTripMs: 150, downKbps: 1_638, upKbps: 750 },
    cpu: 4,
    viewport: { width: 390, height: 844 },
    mobile: true,
  },
};

interface Sample {
  launcher: number;
  shown: number;
  session: number;
}

function summary(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const at = (share: number) =>
    Math.round(sorted[Math.ceil(sorted.length * share) - 1] ?? 0);
  return {
    runs: sorted.length,
    min: at(1 / sorted.length),
    median: at(0.5),
    p75: at(0.75),
    p95: at(0.95),
    max: at(1),
  };
}

async function measure(
  browser: Browser,
  key: string,
  profile: (typeof profiles)["desktop"],
): Promise<Sample> {
  const context = await browser.newContext({
    viewport: profile.viewport,
    isMobile: profile.mobile,
    hasTouch: profile.mobile,
    // An added header would force a CORS preflight that visitors do not have.
    extraHTTPHeaders: {},
  });
  try {
    const page = await context.newPage();
    const devtools = await context.newCDPSession(page);
    await devtools.send("Emulation.setCPUThrottlingRate", {
      rate: profile.cpu,
    });
    await page.addInitScript(() => {
      const state = window as unknown as {
        launcherAt: number;
        readyAt: number;
      };
      addEventListener("message", ({ data }) => {
        if (data?.cael !== 1 || data.type !== "ready") return;
        requestAnimationFrame(() => {
          state.readyAt = performance.now();
        });
      });
      const look = () => {
        const host = document.querySelector("cael-widget");
        const button = host?.shadowRoot?.querySelector("button.launcher");
        if (button) {
          const box = button.getBoundingClientRect();
          const hit = document.elementFromPoint(
            box.x + box.width / 2,
            box.y + box.height / 2,
          );
          if (box.width > 0 && hit === host) {
            // Drawn: the frame after this one has been presented.
            requestAnimationFrame(() => {
              state.launcherAt = performance.now();
            });
            return;
          }
        }
        requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    });
    await page.goto(
      `${hostUrl("shop-a")}/?${new URLSearchParams({ key, app: proxyUrl })}`,
    );
    await page.waitForFunction(
      () => (window as unknown as { launcherAt?: number }).launcherAt,
    );
    const launcherMs = await page.evaluate((loader) => {
      const entry = performance
        .getEntriesByType("resource")
        .find(({ name }) => name.startsWith(loader));
      return (
        (window as unknown as { launcherAt: number }).launcherAt -
        (entry?.startTime ?? Number.NaN)
      );
    }, `${proxyUrl}/widget/v1/loader.js`);

    const session = page.waitForEvent("requestfinished", (request) =>
      request.url().endsWith("/api/widget/v1/session"),
    );
    // A click without a hover before it, as on a phone.
    const clicked = await page.evaluate(() => {
      const button = document
        .querySelector("cael-widget")
        ?.shadowRoot?.querySelector<HTMLButtonElement>("button.launcher");
      button?.click();
      return { at: performance.now(), origin: performance.timeOrigin };
    });
    const inner = page.frameLocator("cael-widget iframe");
    await inner.locator('#state[data-state="ready"]').waitFor();
    // Both clocks are wall clocks of this machine: the end of the session
    // request, plus the two frames that draw its result.
    const request = await session;
    const { startTime, responseEnd } = request.timing();
    const readyAt = await page.evaluate(
      () => (window as unknown as { readyAt: number }).readyAt,
    );
    return {
      launcher: launcherMs,
      shown: readyAt + 17 - clicked.at,
      session: startTime + responseEnd + 33 - clicked.origin - clicked.at,
    };
  } finally {
    await context.close();
  }
}

test.describe("performance", () => {
  let stopServer = () => {};
  let browser: Browser;

  test.beforeAll(async () => {
    const server = spawn(
      process.execPath,
      [
        `${root}/node_modules/next/dist/bin/next`,
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(serverPort),
      ],
      {
        cwd: root,
        env: {
          ...serverEnvironment("standard", readLocalSupabase()),
          NODE_ENV: "production",
          APP_BASE_URL: proxyUrl,
          // One machine plays every visitor here, so there is no client limit.
          WIDGET_CLIENT_IP_HEADER: "",
        },
        stdio: "ignore",
      },
    );
    stopServer = () => void server.kill();
    await expect
      .poll(
        () =>
          fetch(`http://127.0.0.1:${serverPort}/api/health`)
            .then(({ status }) => status)
            .catch(() => 0),
        { timeout: 20_000 },
      )
      .toBe(200);
    browser = await chromium.launch({
      channel: "chrome",
      // One renderer process, so the processor limit covers the frame as well.
      args: [
        "--disable-site-isolation-trials",
        "--disable-features=IsolateOrigins,site-per-process,HttpsUpgrades,HttpsFirstBalancedModeAutoEnable",
      ],
    });
  });

  test.afterAll(async () => {
    await browser.close();
    stopServer();
  });

  test("the performance server runs the standard build", () => {
    expect(
      serverEnvironment("standard", readLocalSupabase()).CAEL_NEXT_DIST_DIR,
    ).toBe(e2eServers.standard.distDir);
  });

  for (const [name, profile] of Object.entries(profiles)) {
    test(`the widget is usable within a second on a ${name} profile`, async ({
      keys,
    }) => {
      test.setTimeout(60_000 + runs * 8_000);
      const stopProxy = await startLatencyProxy({
        listenPort: proxyPort,
        targetPort: serverPort,
        // Name lookup, TCP and TLS 1.3.
        setupRoundTrips: 3,
        ...profile.network,
      });
      const samples: Sample[] = [];
      try {
        // The first answer compiles routes and opens database connections.
        await measure(browser, keys.a, profile);
        for (let run = 0; run < runs; run += 1) {
          samples.push(await measure(browser, keys.a, profile));
        }
      } finally {
        await stopProxy();
      }
      const result = {
        profile: name,
        ...profile,
        setupRoundTrips: 3,
        launcher: summary(samples.map(({ launcher }) => launcher)),
        shown: summary(samples.map(({ shown }) => shown)),
        session: summary(samples.map(({ session }) => session)),
        samples,
      };
      mkdirSync("test-results", { recursive: true });
      writeFileSync(
        `test-results/widget-performance-${name}.json`,
        JSON.stringify(result, null, 2),
      );
      const { launcher, shown, session } = result;
      console.log(JSON.stringify({ name, launcher, shown, session }));
      expect(launcher.p95).toBeLessThan(budgetMs);
      expect(shown.p95).toBeLessThan(budgetMs);
    });
  }
});
