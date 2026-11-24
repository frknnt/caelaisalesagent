import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import GlobalError from "@/app/global-error";

it("replaces the document without showing the error message", async () => {
  const retry = vi.fn();
  const user = userEvent.setup();
  render(<GlobalError error={new Error("secret detail")} retry={retry} />, {
    container: document,
  });
  expect(document.documentElement.lang).toBe("en");
  expect(document.title).toBe("Something went wrong");
  expect(screen.getByRole("alert").textContent).not.toContain("secret detail");
  await user.tab();
  await user.keyboard("{Enter}");
  expect(retry).toHaveBeenCalledTimes(1);
});
