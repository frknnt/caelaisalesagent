"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";

import { inputClass, TextAreaField } from "@/components/forms/Field";
import { MessageBubble } from "@/components/product/MessageBubble";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

import { sendHarnessMessage } from "./actions";
import type { HarnessTurnResult } from "./run-turn";
import { harnessScenarios } from "./scenarios";

interface Turn {
  id: string;
  message: string;
  result: HarnessTurnResult;
}

const shown = (value: number | null) => (value === null ? "Unknown" : value);

/** Message list, composer and evidence of the last turn. */
export function PreviewConsole() {
  const [turns, setTurns] = useState<readonly Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [scenario, setScenario] = useState<string>("answer");
  const [error, setError] = useState<string>();
  const [handedOver, setHandedOver] = useState(false);
  const [pending, startTransition] = useTransition();
  const statusRef = useRef<HTMLParagraphElement>(null);
  // Read after the await: a person may take over while the agent is writing.
  const handedOverRef = useRef(false);
  const last = turns.at(-1)?.result;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || handedOver) return;
    const message = draft.trim();
    if (message === "") {
      setError("Write a message first.");
      return;
    }
    setError(undefined);
    const id = crypto.randomUUID();
    startTransition(async () => {
      const result = await sendHarnessMessage({
        turnId: id,
        message,
        scenario,
      });
      if (handedOverRef.current) return;
      startTransition(() => {
        setTurns((current) => [...current, { id, message, result }]);
        setDraft("");
      });
    });
  };

  const handOver = () => {
    handedOverRef.current = true;
    setHandedOver(true);
    statusRef.current?.focus();
  };

  return (
    <>
      <div
        role="log"
        aria-label="Conversation"
        aria-busy={pending}
        className="mt-6 space-y-3"
      >
        <MessageBubble from="agent">
          Hi, I’m Cael, an AI agent. You can ask for a person at any time.
        </MessageBubble>
        {turns.length === 0 && !pending ? (
          <p className="text-body">No messages yet.</p>
        ) : null}
        {turns.map((turn) => (
          <div key={turn.id} className="space-y-3">
            <MessageBubble from="visitor">{turn.message}</MessageBubble>
            {turn.result.answer ? (
              <MessageBubble from="agent" source={turn.result.answer.source}>
                {turn.result.answer.text}
              </MessageBubble>
            ) : (
              <MessageBubble from="agent">
                I can’t answer that reliably right now. A person can help you.
              </MessageBubble>
            )}
          </div>
        ))}
      </div>

      <p
        ref={statusRef}
        role="status"
        tabIndex={-1}
        className="text-body mt-4 min-h-6 outline-none"
      >
        {handedOver
          ? "A person has the conversation. The AI agent will not reply."
          : pending
            ? "The agent is writing…"
            : ""}
      </p>

      <form onSubmit={submit} noValidate className="mt-4 space-y-5">
        <TextAreaField
          id="message"
          name="message"
          label="Message"
          rows={3}
          maxLength={2000}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          error={error}
          disabled={handedOver}
        />
        <div>
          <label htmlFor="scenario" className="font-medium">
            Scripted model behavior
          </label>
          <select
            id="scenario"
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
            disabled={handedOver}
            className={cn(inputClass, "mt-2 min-h-13")}
          >
            {harnessScenarios.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col flex-wrap gap-3 sm:flex-row">
          <Button type="submit" size="lg" disabled={pending || handedOver}>
            {pending ? "Sending…" : "Send"}
          </Button>
          <Button
            variant="soft"
            size="lg"
            onClick={handOver}
            disabled={handedOver}
          >
            Talk to a Person
          </Button>
        </div>
      </form>

      {last ? (
        <section aria-labelledby="last-turn" className="mt-8">
          <h2 id="last-turn" className="text-xl font-medium">
            Last turn
          </h2>
          <dl className="divide-line mt-3 divide-y">
            {(
              [
                ["Outcome", last.outcome],
                ["Webhook deliveries", last.webhookDeliveries],
                ["Latency (ms)", last.latencyMs],
                ["Input tokens", shown(last.inputTokens)],
                ["Output tokens", shown(last.outputTokens)],
                ["Simulated cost (micro-USD)", shown(last.costMicros)],
                ["Request id", last.requestId],
              ] as const
            ).map(([term, detail]) => (
              <div
                key={term}
                className="flex flex-wrap justify-between gap-x-4 py-3"
              >
                <dt className="text-body">{term}</dt>
                <dd className="font-semibold">{detail}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </>
  );
}
