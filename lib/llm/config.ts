import type { LlmPricing } from "@/lib/observability/llm-metrics";

import type { LlmPort } from "./port";

/**
 * Everything that varies between providers and models lives here and in the
 * adapter. Switching the model is an env change; switching the provider is a
 * new adapter registered under a name. The agent loop never sees either.
 */
export interface LlmConfig {
  provider: string;
  model: string;
  timeoutMs: number;
  maxAttempts: number;
  perCallMaxCostMicros: number;
  /** Per organization and UTC day. Zero blocks every call. */
  dailyBudgetMicros: number;
  /** Operator kill switch: no LLM call is made while it is on. */
  emergencyStop: boolean;
  /** Null when no price is configured; the budget gate then fails closed. */
  pricing: LlmPricing | null;
}

export type LlmConfigResult =
  | { ok: true; value: LlmConfig }
  | { ok: false; code: "LLM_CONFIG_INVALID"; field: string };

type Env = Readonly<Record<string, string | undefined>>;

const NAME = /^[a-z][a-z0-9_.-]{0,39}$/;
const MODEL = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,99}$/;

function integer(env: Env, key: string, fallback: number, max: number) {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= max ? value : null;
}

/** Reads server-only env. Invalid values fail closed instead of defaulting. */
export function readLlmConfig(env: Env): LlmConfigResult {
  // Unset means unconfigured: no adapter has this name, so every turn hands off.
  const provider = env.LLM_PROVIDER?.trim() || "unconfigured";
  const model = env.LLM_MODEL?.trim() || "unconfigured";
  if (!NAME.test(provider))
    return { ok: false, code: "LLM_CONFIG_INVALID", field: "LLM_PROVIDER" };
  if (!MODEL.test(model))
    return { ok: false, code: "LLM_CONFIG_INVALID", field: "LLM_MODEL" };

  const numbers = {
    LLM_TIMEOUT_MS: integer(env, "LLM_TIMEOUT_MS", 20_000, 120_000),
    LLM_MAX_ATTEMPTS: integer(env, "LLM_MAX_ATTEMPTS", 2, 5),
    LLM_PER_CALL_MAX_COST_MICROS: integer(
      env,
      "LLM_PER_CALL_MAX_COST_MICROS",
      50_000,
      10_000_000,
    ),
    LLM_DAILY_BUDGET_MICROS: integer(
      env,
      "LLM_DAILY_BUDGET_MICROS",
      0,
      1_000_000_000_000,
    ),
    LLM_PRICE_INPUT_MICROS_PER_MILLION: integer(
      env,
      "LLM_PRICE_INPUT_MICROS_PER_MILLION",
      -1,
      1_000_000_000,
    ),
    LLM_PRICE_OUTPUT_MICROS_PER_MILLION: integer(
      env,
      "LLM_PRICE_OUTPUT_MICROS_PER_MILLION",
      -1,
      1_000_000_000,
    ),
    LLM_PRICE_CACHED_INPUT_MICROS_PER_MILLION: integer(
      env,
      "LLM_PRICE_CACHED_INPUT_MICROS_PER_MILLION",
      -1,
      1_000_000_000,
    ),
  };
  for (const [field, value] of Object.entries(numbers)) {
    if (value === null) return { ok: false, code: "LLM_CONFIG_INVALID", field };
  }
  const n = numbers as Record<keyof typeof numbers, number>;
  if (n.LLM_TIMEOUT_MS < 100 || n.LLM_MAX_ATTEMPTS < 1)
    return { ok: false, code: "LLM_CONFIG_INVALID", field: "LLM_TIMEOUT_MS" };

  const version = env.LLM_PRICING_VERSION?.trim();
  const prices = [
    n.LLM_PRICE_INPUT_MICROS_PER_MILLION,
    n.LLM_PRICE_OUTPUT_MICROS_PER_MILLION,
    n.LLM_PRICE_CACHED_INPUT_MICROS_PER_MILLION,
  ];
  const pricing: LlmPricing | null =
    version &&
    /^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/.test(version) &&
    prices.every((price) => price >= 0)
      ? {
          version,
          inputMicrosPerMillion: n.LLM_PRICE_INPUT_MICROS_PER_MILLION,
          outputMicrosPerMillion: n.LLM_PRICE_OUTPUT_MICROS_PER_MILLION,
          cachedInputMicrosPerMillion:
            n.LLM_PRICE_CACHED_INPUT_MICROS_PER_MILLION,
        }
      : null;

  const stop = env.LLM_EMERGENCY_STOP?.trim().toLowerCase();
  return {
    ok: true,
    value: {
      provider,
      model,
      timeoutMs: n.LLM_TIMEOUT_MS,
      maxAttempts: n.LLM_MAX_ATTEMPTS,
      perCallMaxCostMicros: n.LLM_PER_CALL_MAX_COST_MICROS,
      dailyBudgetMicros: n.LLM_DAILY_BUDGET_MICROS,
      // Anything but an explicit "off" keeps the switch on once it is set.
      emergencyStop:
        stop !== undefined &&
        stop !== "" &&
        stop !== "off" &&
        stop !== "false" &&
        stop !== "0",
      pricing,
    },
  };
}

export type LlmAdapterFactory = (config: LlmConfig) => LlmPort;

/** Adapters register by provider name. Unknown names are an error, not a fake. */
export function createLlmPort(
  config: LlmConfig,
  adapters: Readonly<Record<string, LlmAdapterFactory>>,
): LlmPort {
  const factory = Object.hasOwn(adapters, config.provider)
    ? adapters[config.provider]
    : undefined;
  if (!factory) throw new Error("LLM_PROVIDER_NOT_REGISTERED");
  const port = factory(config);
  if (port.provider !== config.provider || port.model !== config.model)
    throw new Error("LLM_ADAPTER_MISMATCH");
  return port;
}
