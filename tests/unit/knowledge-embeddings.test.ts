import { describe, expect, it, vi } from "vitest";

import {
  DeterministicTestEmbeddingProvider,
  EMBEDDING_DIMENSIONS,
  HttpEmbeddingProvider,
  createEmbeddingProvider,
} from "@/lib/knowledge/embeddings";

describe("embedding provider boundary", () => {
  it("uses a stable fixed-size provider only inside the test harness", async () => {
    const provider = createEmbeddingProvider({ CAEL_TEST_HARNESS: "enabled" });
    const [first, second] = await provider.embed([
      "refund policy",
      "refund policy",
    ]);
    expect(first).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(second).toEqual(first);
  });

  it("fails closed when production configuration is missing or insecure", () => {
    expect(() => createEmbeddingProvider({})).toThrow(
      "EMBEDDING_PROVIDER_UNAVAILABLE",
    );
    expect(() =>
      createEmbeddingProvider({
        EMBEDDING_PROVIDER_URL: "http://embedding.example.test/v1",
        EMBEDDING_PROVIDER_TOKEN: "secret",
        EMBEDDING_MODEL: "model",
      }),
    ).toThrow("EMBEDDING_PROVIDER_UNAVAILABLE");
  });

  it("validates every vector returned by the server-only hook", async () => {
    const valid = Array<number>(EMBEDDING_DIMENSIONS).fill(0.1);
    const request = vi.fn(async () => Response.json({ embeddings: [valid] }));
    const provider = new HttpEmbeddingProvider(
      "https://embedding.example.test/v1",
      "secret",
      "model-384",
      request,
    );
    await expect(provider.embed(["hello"])).resolves.toEqual([valid]);
    expect(request).toHaveBeenCalledWith(
      "https://embedding.example.test/v1",
      expect.objectContaining({ method: "POST" }),
    );

    const invalid = new HttpEmbeddingProvider(
      "https://embedding.example.test/v1",
      "secret",
      "model-384",
      vi.fn(async () => Response.json({ embeddings: [[1, 2, 3]] })),
    );
    await expect(invalid.embed(["hello"])).rejects.toMatchObject({
      code: "EMBEDDING_INVALID_RESPONSE",
    });
  });

  it("keeps the deterministic provider explicitly test-only", () => {
    expect(new DeterministicTestEmbeddingProvider().model).toContain("test");
  });
});
