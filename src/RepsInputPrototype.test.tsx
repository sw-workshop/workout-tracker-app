/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { RepsInputPrototype } from "./RepsInputPrototype";

afterEach(cleanup);

describe("RepsInputPrototype", () => {
  it("compares the stepper without confirming an untouched suggestion", async () => {
    const user = userEvent.setup();
    render(<RepsInputPrototype />);

    expect(screen.getByText("合計 15 reps")).toBeInTheDocument();
    expect(screen.getByLabelText("3セット目のreps")).toHaveValue("");
    expect(screen.getByLabelText("3セット目のreps")).toHaveAttribute("placeholder", "7");

    await user.click(screen.getByRole("button", { name: "3セット目のrepsを減らす" }));

    expect(screen.getByLabelText("3セット目のreps")).toHaveValue("6");
    expect(screen.getByText("合計 21 reps")).toBeInTheDocument();
  });

  it("keeps a wheel suggestion unconfirmed until the user accepts it", async () => {
    const user = userEvent.setup();
    render(<RepsInputPrototype />);

    await user.click(screen.getByRole("button", { name: "ホイール" }));
    await user.click(screen.getByRole("button", { name: "3セット目のrepsを選択" }));

    const picker = screen.getByRole("dialog", { name: "3セット目のrepsを選択" });
    expect(within(picker).getByRole("button", { name: "7" })).toHaveClass("selected");

    await user.click(within(picker).getByRole("button", { name: "キャンセル" }));
    expect(screen.getByText("合計 15 reps")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "3セット目のrepsを選択" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "3セット目のrepsを選択" })).getByRole(
        "button",
        { name: "決定" },
      ),
    );

    expect(screen.getByText("合計 22 reps")).toBeInTheDocument();
  });

  it("applies the existing reps constraints to stepper direct input", () => {
    render(<RepsInputPrototype />);

    const input = screen.getByLabelText("1セット目のreps");
    fireEvent.change(input, { target: { value: "01" } });
    expect(input).toHaveValue("8");

    fireEvent.change(input, { target: { value: "1" } });
    expect(input).toHaveValue("1");

    fireEvent.change(input, { target: { value: "999" } });
    expect(input).toHaveValue("999");

    fireEvent.change(input, { target: { value: "1000" } });
    expect(input).toHaveValue("999");
  });

  it("applies the existing reps constraints to wheel direct input", async () => {
    const user = userEvent.setup();
    render(<RepsInputPrototype />);

    await user.click(screen.getByRole("button", { name: "ホイール" }));
    await user.click(screen.getByRole("button", { name: "1セット目のrepsを選択" }));
    await user.click(screen.getByRole("button", { name: "直接入力" }));

    const input = screen.getByLabelText("repsを直接入力");
    fireEvent.change(input, { target: { value: "01" } });
    expect(input).toHaveValue("8");

    fireEvent.change(input, { target: { value: "1" } });
    expect(input).toHaveValue("1");

    fireEvent.change(input, { target: { value: "999" } });
    expect(input).toHaveValue("999");

    fireEvent.change(input, { target: { value: "1000" } });
    expect(input).toHaveValue("999");
  });
});
