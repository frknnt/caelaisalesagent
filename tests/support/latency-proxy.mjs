import net from "node:net";

/**
 * TCP proxy with the delays of a real network: connection setup (DNS, TCP and
 * TLS 1.3 round trips), one-way latency per direction and limited bandwidth.
 * It sits outside the browser, so every process of the page is slowed alike.
 * Loopback to loopback only.
 */
export function startLatencyProxy({
  listenPort,
  targetPort,
  roundTripMs,
  setupRoundTrips,
  downKbps,
  upKbps,
}) {
  const oneWay = roundTripMs / 2;

  /**
   * Each chunk arrives after latency and transmission time. One queue and one
   * timer: timers that end in the same millisecond may fire in any order.
   */
  const shape = (kbps, write, end) => {
    const queue = [];
    let linkFreeAt = 0;
    let timer = null;
    const run = () => {
      timer = null;
      while (queue.length > 0 && queue[0].at <= performance.now()) {
        queue.shift().deliver();
      }
      if (queue.length > 0) {
        timer = setTimeout(run, Math.max(1, queue[0].at - performance.now()));
      }
    };
    const schedule = (bytes, deliver) => {
      const transmission = kbps ? (bytes * 8) / kbps : 0;
      linkFreeAt = Math.max(performance.now(), linkFreeAt) + transmission;
      queue.push({ at: linkFreeAt + oneWay, deliver });
      timer ??= setTimeout(run, Math.max(1, oneWay + transmission));
    };
    return {
      push: (chunk) => schedule(chunk.length, () => write(chunk)),
      finish: () => schedule(0, end),
    };
  };

  const sockets = new Set();
  const server = net.createServer((client) => {
    sockets.add(client);
    client.setNoDelay(true);
    client.pause();
    client.on("error", () => client.destroy());
    client.on("close", () => sockets.delete(client));
    setTimeout(() => {
      const upstream = net.connect(targetPort, "127.0.0.1");
      sockets.add(upstream);
      upstream.setNoDelay(true);
      upstream.on("error", () => client.destroy());
      upstream.on("close", () => sockets.delete(upstream));
      const up = shape(
        upKbps,
        (chunk) => upstream.writable && upstream.write(chunk),
        () => upstream.end(),
      );
      const down = shape(
        downKbps,
        (chunk) => client.writable && client.write(chunk),
        () => client.end(),
      );
      client.on("data", up.push);
      client.on("end", up.finish);
      upstream.on("data", down.push);
      upstream.on("end", down.finish);
      client.resume();
    }, setupRoundTrips * roundTripMs);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(listenPort, "127.0.0.1", () =>
      resolve(
        () =>
          new Promise((closed) => {
            for (const socket of sockets) socket.destroy();
            server.close(closed);
          }),
      ),
    );
  });
}
