import { createHash } from "node:crypto";

import { IngestionError, type EmbeddingProvider } from "./types";

export const EMBEDDING_DIMENSIONS = 384;

function assertEmbedding(value: unknown): number[] {
  if (
    !Array.isArray(value) ||
    value.length !== EMBEDDING_DIMENSIONS ||
    value.some((item) => typeof item !== "number" || !Number.isFinite(item))
  ) {
    throw new IngestionError("EMBEDDING_INVALID_RESPONSE", true);
  }
  return value;
}

export class HttpEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly endpoint: string,
    private readonly token: string,
    public readonly model: string,
    private readonly request: typeof fetch = fetch,
  ) {}

  async embed(inputs: string[]) {
    if (inputs.length === 0) return [];
    const response = await this.request(this.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        dimensions: EMBEDDING_DIMENSIONS,
        input: inputs,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok)
      throw new IngestionError("EMBEDDING_PROVIDER_ERROR", true);
    const result: unknown = await response.json();
    if (
      typeof result !== "object" ||
      result === null ||
      !("embeddings" in result) ||
      !Array.isArray(result.embeddings) ||
      result.embeddings.length !== inputs.length
    ) {
      throw new IngestionError("EMBEDDING_INVALID_RESPONSE", true);
    }
    return result.embeddings.map(assertEmbedding);
  }
}

/** Test-only local provider. Production must configure the server-side hook. */
export class DeterministicTestEmbeddingProvider implements EmbeddingProvider {
  readonly model = "cael-test-hash-384-v1";

  async embed(inputs: string[]) {
    return inputs.map((input) => {
      const vector = Array<number>(EMBEDDING_DIMENSIONS).fill(0);
      const tokens =
        input.toLocaleLowerCase("tr").match(/[\p{L}\p{N}]+/gu) ?? [];
      for (const token of tokens) {
        const digest = createHash("sha256").update(token).digest();
        const index = digest.readUInt16BE(0) % EMBEDDING_DIMENSIONS;
        vector[index] = (vector[index] ?? 0) + (digest[2]! % 2 === 0 ? 1 : -1);
      }
      const norm = Math.hypot(...vector) || 1;
      return vector.map((value) => value / norm);
    });
  }
}

export function createEmbeddingProvider(
  env: Readonly<Record<string, string | undefined>> = process.env,
): EmbeddingProvider {
  if (env.CAEL_TEST_HARNESS === "enabled")
    return new DeterministicTestEmbeddingProvider();
  const endpoint = env.EMBEDDING_PROVIDER_URL?.trim();
  const token = env.EMBEDDING_PROVIDER_TOKEN?.trim();
  const model = env.EMBEDDING_MODEL?.trim();
  if (!endpoint || !token || !model)
    throw new IngestionError("EMBEDDING_PROVIDER_UNAVAILABLE", true);
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new IngestionError("EMBEDDING_PROVIDER_UNAVAILABLE", true);
  }
  const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:"))
    throw new IngestionError("EMBEDDING_PROVIDER_UNAVAILABLE", true);
  return new HttpEmbeddingProvider(parsed.toString(), token, model);
}
