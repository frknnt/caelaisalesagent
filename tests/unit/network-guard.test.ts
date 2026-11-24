import { spawnSync } from "node:child_process";
import dgram from "node:dgram";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

// Reserved by RFC 2606 and RFC 5737. Never reachable, even without the guard.
const host = "egress-probe.invalid";
const address = "192.0.2.1";
const blocked = expect.objectContaining({ code: "NETWORK_BLOCKED" });

function errorOf(emitter: NodeJS.EventEmitter) {
  return new Promise<unknown>((resolve) => emitter.once("error", resolve));
}

describe("network guard in the test process", () => {
  it.each([
    `https://${host}`,
    `http://${address}`,
    "http://127.0.0.1:65421/rest/v1/",
  ])("blocks fetch to %s", async (url) => {
    await expect(fetch(url)).rejects.toMatchObject({ cause: blocked });
  });

  it("blocks http, https, tcp and tls clients", async () => {
    const clients = [
      http.get({ host: address, port: 80 }),
      https.get({ host: address, port: 443 }),
      net.connect(80, address),
      net.connect({ host, port: 80 }),
      tls.connect({ host: address, port: 443 }),
    ];
    // Listeners are attached before the first error can be emitted.
    const errors = await Promise.all(clients.map(errorOf));
    expect(errors).toEqual(clients.map(() => blocked));
  });

  it("blocks name resolution and udp", async () => {
    await expect(dns.promises.lookup(host)).rejects.toEqual(blocked);
    await expect(dns.promises.resolve(host)).rejects.toEqual(blocked);
    await new Promise<void>((resolve) => {
      dns.lookup(host, (error) => {
        expect(error).toEqual(blocked);
        resolve();
      });
    });
    const socket = dgram.createSocket("udp4");
    expect(() => socket.send("x", 53, address)).toThrow("NETWORK_BLOCKED");
    socket.close();
  });
});

describe("egress block preloaded into the E2E server", () => {
  it("refuses outside hosts and leaves loopback open", () => {
    const preload = pathToFileURL(
      path.resolve("tests/support/block-egress.mjs"),
    ).href;
    const script = `
      import http from "node:http";
      const reason = (url) => fetch(url).then(
        (response) => response.status,
        (error) => error.cause?.code ?? error.code,
      );
      const server = http.createServer((_, response) => response.end());
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const local = await reason("http://127.0.0.1:" + server.address().port);
      const outside = await reason("http://${address}");
      const named = await reason("https://${host}");
      server.close();
      console.log(JSON.stringify({ local, outside, named }));
    `;
    const result = spawnSync(
      process.execPath,
      ["--import", preload, "--input-type=module", "--eval", script],
      { encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } },
    );
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({
      local: 200,
      outside: "NETWORK_BLOCKED",
      named: "NETWORK_BLOCKED",
    });
  });
});
