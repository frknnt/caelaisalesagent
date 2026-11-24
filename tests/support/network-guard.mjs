import dgram from "node:dgram";
import dns from "node:dns";
import net from "node:net";

/**
 * Blocks outbound network access in this process. Every Node client (fetch,
 * http, https, tls, ws) ends in net.Socket#connect, so that is the choke
 * point; dns and dgram are closed as well.
 */
export class NetworkBlockedError extends Error {
  constructor(target) {
    super(`NETWORK_BLOCKED ${target}`);
    this.name = "NetworkBlockedError";
    this.code = "NETWORK_BLOCKED";
  }
}

const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Host of a connect call, or null for a local pipe or unix socket. */
function connectTarget(args) {
  const [first, second] = Array.isArray(args[0]) ? args[0] : args;
  if (first !== null && typeof first === "object") {
    if (first.path) return null;
    return first.host ?? "localhost";
  }
  if (typeof first === "number" || /^\d+$/.test(String(first))) {
    return typeof second === "string" ? second : "localhost";
  }
  return null;
}

let restoreCurrent = null;

export function installNetworkGuard({
  allowLoopback = false,
  onBlocked = () => {},
} = {}) {
  restoreCurrent?.();

  const originalConnect = net.Socket.prototype.connect;
  const originalSend = dgram.Socket.prototype.send;
  const isAllowed = (host) => allowLoopback && loopbackHosts.has(host);
  const block = (target) => {
    onBlocked(target);
    return new NetworkBlockedError(target);
  };

  net.Socket.prototype.connect = function connect(...args) {
    const host = connectTarget(args);
    if (host === null || isAllowed(host)) {
      return originalConnect.apply(this, args);
    }
    const error = block(host);
    process.nextTick(() => this.destroy(error));
    return this;
  };

  dgram.Socket.prototype.send = function send() {
    throw block("udp");
  };

  const restoreDns = [
    [dns, "lookup", true],
    [dns, "resolve", true],
    [dns.promises, "lookup", false],
    [dns.promises, "resolve", false],
  ].map(([target, method, usesCallback]) => {
    const original = target[method];
    target[method] = (host, ...args) => {
      if (isAllowed(host)) return original.call(target, host, ...args);
      const error = block(host);
      const callback = args.at(-1);
      if (!usesCallback) return Promise.reject(error);
      process.nextTick(() => callback(error));
    };
    return () => {
      target[method] = original;
    };
  });

  restoreCurrent = () => {
    net.Socket.prototype.connect = originalConnect;
    dgram.Socket.prototype.send = originalSend;
    restoreDns.forEach((restore) => restore());
    restoreCurrent = null;
  };
  return restoreCurrent;
}
