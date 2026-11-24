import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import WorkspaceError from "@/app/app/error";
import PageError from "@/app/error";

const leaky = Object.assign(
  new Error("select failed for visitor@example.test with sb_secret_abc"),
  { digest: "3052117482" },
);

describe.each([
  ["public pages", PageError, "Something went wrong"],
  ["workspace", WorkspaceError, "Your workspace could not be loaded"],
])("error boundary for %s", (_name, Boundary, title) => {
  it("shows the reference and never the error message", () => {
    const { container } = render(<Boundary error={leaky} retry={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toContain(title);
    expect(screen.getByText("Error reference: 3052117482")).toBeDefined();
    expect(container.innerHTML).not.toMatch(/example\.test|sb_secret|select/);
  });

  it("moves focus to the heading and retries from the keyboard", async () => {
    const retry = vi.fn();
    const user = userEvent.setup();
    render(<Boundary error={leaky} retry={retry} />);
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { level: 1 }),
    );
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Try Again" }),
    );
    await user.keyboard("{Enter}");
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it.each([new Error("client error"), "a thrown string", null, { digest: 42 }])(
    "works without a digest: %s",
    (error) => {
      render(<Boundary error={error} retry={vi.fn()} />);
      expect(screen.queryByText(/Error reference/)).toBeNull();
      expect(
        screen.getByRole("link", { name: "Visit Support" }),
      ).toHaveProperty("pathname", "/support");
    },
  );
});
