import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import InboxError from "@/app/app/inbox/error";
import InboxLoading from "@/app/app/inbox/loading";

describe("P1.5 inbox route states", () => {
  afterEach(() => vi.restoreAllMocks());

  it("announces a busy loading state without relying on motion", () => {
    const { container } = render(<InboxLoading />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText("Loading conversation inbox")).toBeDefined();
  });

  it("shows a safe error and lets the operator retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reset = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <InboxError
        error={Object.assign(new Error("secret failure detail"), {
          digest: "safe-reference",
        })}
        reset={reset}
      />,
    );

    expect(screen.getByRole("alert")).toBeDefined();
    expect(container.textContent).not.toContain("secret failure detail");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
