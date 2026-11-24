import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendHarnessMessage } from "@/app/app/test-harness/actions";
import { PreviewConsole } from "@/app/app/test-harness/PreviewConsole";
import type { HarnessTurnResult } from "@/app/app/test-harness/run-turn";

vi.mock("@/app/app/test-harness/actions", () => ({
  sendHarnessMessage: vi.fn(),
}));

const send = vi.mocked(sendHarnessMessage);

const completed: HarnessTurnResult = {
  outcome: "completed",
  answer: { text: "Scripted answer.", source: "Fixture source" },
  requestId: "f0000000-0000-4000-8000-000000000001",
  latencyMs: 400,
  inputTokens: 3,
  outputTokens: 20,
  costMicros: 103,
  webhookDeliveries: 1,
};

const timedOut: HarnessTurnResult = {
  ...completed,
  outcome: "timeout",
  answer: null,
  inputTokens: null,
  outputTokens: null,
  costMicros: null,
  webhookDeliveries: 0,
};

function setup() {
  const user = userEvent.setup();
  render(<PreviewConsole />);
  return {
    user,
    log: screen.getByRole("log", { name: "Conversation" }),
    message: screen.getByLabelText<HTMLTextAreaElement>("Message"),
    sendButton: screen.getByRole<HTMLButtonElement>("button", { name: "Send" }),
    personButton: screen.getByRole<HTMLButtonElement>("button", {
      name: "Talk to a Person",
    }),
  };
}

beforeEach(() => {
  send.mockReset();
});

describe("test preview", () => {
  it("starts empty, names itself an AI agent and offers a person", () => {
    const { log, personButton } = setup();
    expect(log.textContent).toContain("an AI agent");
    expect(log.textContent).toContain("No messages yet.");
    expect(personButton.disabled).toBe(false);
  });

  it("shows the pending state, then the answer with its source", async () => {
    let finish: (result: HarnessTurnResult) => void = () => {};
    send.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { user, log, message, sendButton } = setup();

    await user.type(message, "Hello");
    await user.click(sendButton);
    expect(screen.getByRole("status").textContent).toBe(
      "The agent is writing…",
    );
    expect(sendButton.disabled).toBe(true);
    expect(log.getAttribute("aria-busy")).toBe("true");

    finish(completed);
    await waitFor(() => expect(log.textContent).toContain("Scripted answer."));
    expect(log.textContent).toContain("Fixture source");
    expect(message.value).toBe("");
    const lastTurn = screen.getByRole("region", { name: "Last turn" });
    expect(within(lastTurn).getByText("103")).toBeDefined();
    expect(send).toHaveBeenCalledWith({
      turnId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      message: "Hello",
      scenario: "answer",
    });
  });

  it("keeps the same turn when Send is pressed twice", async () => {
    let finish: (result: HarnessTurnResult) => void = () => {};
    send.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { user, log, message, sendButton } = setup();
    await user.type(message, "Hello");
    await user.dblClick(sendButton);
    expect(send).toHaveBeenCalledTimes(1);
    // React entangles async transitions: an open one would stall later tests.
    finish(completed);
    await waitFor(() => expect(log.getAttribute("aria-busy")).toBe("false"));
  });

  it("offers a person instead of model text when the model fails", async () => {
    send.mockResolvedValue(timedOut);
    const { user, log, message, sendButton } = setup();
    await user.selectOptions(
      screen.getByLabelText("Scripted model behavior"),
      "Model timeout",
    );
    await user.type(message, "Hello");
    await user.click(sendButton);

    await waitFor(() =>
      expect(log.textContent).toContain("A person can help you."),
    );
    const lastTurn = screen.getByRole("region", { name: "Last turn" });
    expect(within(lastTurn).getByText("timeout")).toBeDefined();
    expect(within(lastTurn).getAllByText("Unknown")).toHaveLength(3);
  });

  it("explains an empty message next to the field", async () => {
    const { user, message, sendButton } = setup();
    await user.click(sendButton);
    expect(message.getAttribute("aria-invalid")).toBe("true");
    const description = document.getElementById(
      message.getAttribute("aria-describedby") ?? "",
    );
    expect(description?.textContent).toBe("Write a message first.");
    expect(send).not.toHaveBeenCalled();
  });

  it("goes silent after a handoff, even for an answer already on its way", async () => {
    let finish: (result: HarnessTurnResult) => void = () => {};
    send.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { user, log, message, sendButton, personButton } = setup();
    await user.type(message, "Hello");
    await user.click(sendButton);
    await user.click(personButton);
    finish(completed);

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "A person has the conversation. The AI agent will not reply.",
      ),
    );
    expect(document.activeElement).toBe(screen.getByRole("status"));
    await waitFor(() => expect(log.getAttribute("aria-busy")).toBe("false"));
    expect(log.textContent).not.toContain("Scripted answer.");
    expect(message.disabled).toBe(true);
    expect(personButton.disabled).toBe(true);
  });
});
