import type { LlmToolSpec } from "@/lib/llm/port";

/**
 * Tool contract. The model only proposes a call; the server validates the
 * arguments against the schema, checks the tool was offered this turn and
 * decides whether and when it runs. Side-effecting tools run after the turn
 * succeeds, once per idempotency key (see `runAgentTurn`).
 */
export type PropertySchema =
  | {
      type: "string";
      maxLength: number;
      minLength?: number;
      enum?: readonly string[];
    }
  | { type: "integer"; minimum: number; maximum: number }
  | { type: "boolean" };

export interface ToolSchema {
  type: "object";
  properties: Readonly<Record<string, PropertySchema>>;
  required: readonly string[];
  additionalProperties: false;
}

export interface ToolContext {
  organizationId: string;
  siteId: string;
  turnId: string;
}

export interface AgentTool {
  name: string;
  description: string;
  schema: ToolSchema;
  /** True when running it changes something outside the turn. */
  sideEffect: boolean;
  /** Result must be JSON-serialisable and free of secrets. */
  execute(
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<unknown>;
}

export type ToolValidation =
  | { ok: true; args: Record<string, unknown> }
  | { ok: false; error: "unknown_tool" | "invalid_arguments"; detail: string };

const TOOL_NAME = /^[a-z][a-z0-9_]{0,63}$/;

function validateValue(schema: PropertySchema, value: unknown) {
  switch (schema.type) {
    case "string":
      return (
        typeof value === "string" &&
        value.length <= schema.maxLength &&
        value.length >= (schema.minLength ?? 0) &&
        (!schema.enum || schema.enum.includes(value))
      );
    case "integer":
      return (
        typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value >= schema.minimum &&
        value <= schema.maximum
      );
    case "boolean":
      return typeof value === "boolean";
  }
}

export function validateToolArguments(
  tool: AgentTool,
  args: unknown,
): ToolValidation {
  if (args === null || typeof args !== "object" || Array.isArray(args))
    return { ok: false, error: "invalid_arguments", detail: "not_an_object" };
  const record = args as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!Object.hasOwn(tool.schema.properties, key))
      return {
        ok: false,
        error: "invalid_arguments",
        detail: `unexpected:${key}`,
      };
  }
  for (const key of tool.schema.required) {
    if (!Object.hasOwn(record, key))
      return {
        ok: false,
        error: "invalid_arguments",
        detail: `missing:${key}`,
      };
  }
  for (const [key, value] of Object.entries(record)) {
    const property = tool.schema.properties[key];
    if (!property || !validateValue(property, value))
      return {
        ok: false,
        error: "invalid_arguments",
        detail: `invalid:${key}`,
      };
  }
  return { ok: true, args: record };
}

export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>();

  constructor(tools: readonly AgentTool[]) {
    for (const tool of tools) {
      if (!TOOL_NAME.test(tool.name) || this.tools.has(tool.name))
        throw new Error("TOOL_DEFINITION_INVALID");
      this.tools.set(tool.name, tool);
    }
  }

  get(name: string) {
    return this.tools.get(name);
  }

  names() {
    return [...this.tools.keys()];
  }

  specs(): LlmToolSpec[] {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.schema as unknown as Record<string, unknown>,
    }));
  }

  validate(name: string, args: unknown): ToolValidation {
    const tool = this.tools.get(name);
    if (!tool)
      return { ok: false, error: "unknown_tool", detail: "not_offered" };
    return validateToolArguments(tool, args);
  }
}
