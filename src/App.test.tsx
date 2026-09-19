/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render as renderReact,
  screen,
  within,
} from "@testing-library/react";
import type { ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkoutRecord } from "./types";

import { App } from "./App";
import { WorkoutSheet } from "./WorkoutSheet";
import { formatDateLabel, formatMonthTitle, formatStorageDate } from "./dateUtils";

function todayKey(): string {
  return formatStorageDate(new Date());
}

// Existing record workflows start with the selected day's list open.
function render(element: ReactElement) {
  const result = renderReact(element);
  const selectedDay = result.container.querySelector('.day-cell[aria-pressed="true"]');
  if (selectedDay) fireEvent.click(selectedDay);
  return result;
}

function dateWithOffset(dayOffset: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);

  return date;
}

function createRecord(record: Partial<WorkoutRecord>): WorkoutRecord {
  return {
    id: "record_test",
    date: todayKey(),
    exerciseName: "ベンチプレス",
    exerciseType: "weighted",
    topSet: {
      successWeightKg: 120,
      failedWeightKg: null,
    },
    sets: [{ setNumber: 1, weightKg: 90, reps: 8 }],
    note: "",
    createdAt: "2026-08-29T09:00:00.000Z",
    updatedAt: "2026-08-29T09:00:00.000Z",
    ...record,
  };
}

function saveRecords(records: WorkoutRecord[]): void {
  window.localStorage.setItem("workout-tracker.records", JSON.stringify(records));
}

function loadRecords(): WorkoutRecord[] {
  const text = window.localStorage.getItem("workout-tracker.records");
  return text === null ? [] : (JSON.parse(text) as WorkoutRecord[]);
}

function selectedDayPanel(): HTMLElement {
  return screen.getByRole("region", { name: "選択日の記録" });
}

function calendarPanel(): HTMLElement {
  return screen.getByRole("region", { name: /のカレンダー/ });
}

function swipeCalendar({
  from = [200, 100],
  to,
  complete = true,
}: {
  from?: [number, number];
  to: [number, number];
  complete?: boolean;
}) {
  const calendar = calendarPanel();
  const viewport = calendar.querySelector<HTMLElement>(".month-viewport")!;
  vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
    width: 320,
    height: 600,
    top: 0,
    right: 320,
    bottom: 600,
    left: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  fireEvent.pointerDown(viewport, {
    pointerId: 1,
    button: 0,
    clientX: from[0],
    clientY: from[1],
  });
  fireEvent.pointerMove(viewport, {
    pointerId: 1,
    button: 0,
    clientX: to[0],
    clientY: to[1],
  });
  fireEvent.pointerUp(viewport, {
    pointerId: 1,
    button: 0,
    clientX: to[0],
    clientY: to[1],
  });
  const track = calendar.querySelector<HTMLElement>(".month-track")!;
  if (complete && track.classList.contains("is-animating")) {
    fireEvent.transitionEnd(track, { propertyName: "transform" });
  }
}

function saveButton(): HTMLElement {
  return screen.getByRole("button", { name: "保存" });
}

function saveAction(): HTMLElement {
  return screen.getByRole("group", { name: "保存アクション" });
}

function recordAction(): HTMLElement {
  return screen.getByRole("group", { name: "記録操作" });
}

describe("App", () => {
  it("opens and closes the sheet only after selecting a day or Today", async () => {
    const user = userEvent.setup();
    renderReact(<App />);
    expect(
      screen.queryByRole("region", { name: "選択日の記録" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /今日/ }));
    expect(selectedDayPanel()).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "一覧を閉じる" }));
    expect(
      screen.queryByRole("region", { name: "選択日の記録" }),
    ).not.toBeInTheDocument();
    await user.click(within(calendarPanel()).getByRole("button", { name: "15" }));
    expect(selectedDayPanel()).toBeInTheDocument();
    swipeCalendar({ to: [100, 105] });
    expect(
      screen.queryByRole("region", { name: "選択日の記録" }),
    ).not.toBeInTheDocument();
  });

  it("moves between months with horizontal swipes and has no month buttons", () => {
    renderReact(<App />);
    const initialTitle = screen.getByRole("heading", { level: 1 }).textContent;
    expect(screen.queryByRole("button", { name: "前の月" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "次の月" })).not.toBeInTheDocument();
    swipeCalendar({ to: [100, 105], complete: false });
    expect(calendarPanel().querySelectorAll(".month-grid")).toHaveLength(3);
    expect(calendarPanel().querySelector(".month-viewport")).toHaveAttribute(
      "data-transition",
      "next",
    );
    expect(calendarPanel().querySelector(".month-track")).toHaveClass("is-animating");
    expect(
      calendarPanel().querySelector<HTMLElement>(".calendar-week-track")!.style.transform,
    ).toBe(calendarPanel().querySelector<HTMLElement>(".month-track")!.style.transform);
    fireEvent.transitionEnd(calendarPanel().querySelector(".month-track")!, {
      propertyName: "transform",
    });
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveTextContent(
      initialTitle!,
    );
    swipeCalendar({ from: [100, 100], to: [200, 105], complete: false });
    expect(calendarPanel().querySelector(".month-viewport")).toHaveAttribute(
      "data-transition",
      "previous",
    );
    fireEvent.transitionEnd(calendarPanel().querySelector(".month-track")!, {
      propertyName: "transform",
    });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(initialTitle!);
  });

  it("keeps calendar focus while moving repeatedly with arrow keys", async () => {
    const user = userEvent.setup();
    renderReact(<App />);
    const calendar = calendarPanel();
    calendar.focus();
    expect(calendar).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowLeft}");
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      formatMonthTitle(nextMonth),
    );
    expect(calendarPanel()).toHaveFocus();
  });

  it("cancels a pending swipe transition when Today resets the calendar", () => {
    vi.useFakeTimers();
    renderReact(<App />);
    const initialTitle = screen.getByRole("heading", { level: 1 }).textContent!;
    swipeCalendar({ to: [100, 105], complete: false });
    expect(calendarPanel().querySelector(".month-track")).toHaveClass("is-animating");
    fireEvent.click(screen.getByRole("button", { name: /今日/ }));
    vi.advanceTimersByTime(500);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(initialTitle);
    vi.useRealTimers();
  });

  it("ignores short, vertical, edge, and cancelled calendar gestures", () => {
    renderReact(<App />);
    const title = screen.getByRole("heading", { level: 1 }).textContent!;
    swipeCalendar({ to: [160, 102] });
    swipeCalendar({ to: [130, 190] });
    swipeCalendar({ from: [10, 100], to: [100, 100] });
    const viewport = calendarPanel().querySelector<HTMLElement>(".month-viewport")!;
    fireEvent.pointerDown(viewport, {
      pointerId: 2,
      button: 0,
      clientX: 200,
      clientY: 100,
    });
    fireEvent.pointerCancel(viewport, { pointerId: 2 });
    fireEvent.pointerUp(viewport, {
      pointerId: 2,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
  });

  it("does not select a day after a swipe or react to gestures on the sheet", () => {
    render(<App />);
    const selectedDate = within(selectedDayPanel()).getByRole("heading").textContent;
    const sheet = selectedDayPanel();
    fireEvent.pointerDown(sheet, {
      pointerId: 3,
      button: 0,
      clientX: 200,
      clientY: 700,
    });
    fireEvent.pointerUp(sheet, {
      pointerId: 3,
      button: 0,
      clientX: 100,
      clientY: 700,
    });
    expect(within(selectedDayPanel()).getByRole("heading")).toHaveTextContent(
      selectedDate!,
    );
    swipeCalendar({ to: [100, 105] });
    expect(
      screen.queryByRole("region", { name: "選択日の記録" }),
    ).not.toBeInTheDocument();
  });

  it("colors Saturday and Sunday dates separately", () => {
    renderReact(<App />);
    const cells = within(calendarPanel()).getAllByRole("button");
    expect(cells.some((cell) => cell.classList.contains("saturday"))).toBe(true);
    expect(cells.some((cell) => cell.classList.contains("sunday"))).toBe(true);
  });

  it("allows keyboard resizing within bounds", () => {
    renderReact(
      <WorkoutSheet heading={<h2>記録</h2>} onClose={() => {}}>
        記録一覧
      </WorkoutSheet>,
    );
    const handle = screen.getByRole("slider", { name: "一覧の高さ" });
    fireEvent.keyDown(handle, { key: "End" });
    expect(handle).toHaveAttribute("aria-valuenow", handle.getAttribute("aria-valuemax"));
    fireEvent.keyDown(handle, { key: "Home" });
    expect(handle).toHaveAttribute("aria-valuenow", handle.getAttribute("aria-valuemin"));
  });

  it("keeps calendar clearance in sync with sheet height and removes it on close", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    const calendar = container.querySelector<HTMLElement>(".calendar-app")!;
    const handle = screen.getByRole("slider", { name: "一覧の高さ" });
    const expectClearance = () => {
      expect(calendar.style.getPropertyValue("--workout-sheet-height")).toBe(
        `${handle.getAttribute("aria-valuenow")}px`,
      );
    };
    expectClearance();
    fireEvent.keyDown(handle, { key: "End" });
    expectClearance();
    fireEvent.keyDown(handle, { key: "Home" });
    expectClearance();
    const close = screen.getByRole("button", { name: "一覧を閉じる" });
    expect(within(close.parentElement!).getByRole("heading")).toHaveTextContent(
      formatDateLabel(new Date()),
    );
    await user.click(close);
    expect(calendar.style.getPropertyValue("--workout-sheet-height")).toBe("");
  });

  it("sizes the sheet to its content, caps automatic height, and permits expansion", () => {
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(120);
    const contentHeight = vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockReturnValue(100);
    renderReact(
      <WorkoutSheet heading={<h2>記録</h2>} onClose={() => {}}>
        記録一覧
      </WorkoutSheet>,
    );
    const handle = screen.getByRole("slider", { name: "一覧の高さ" });
    expect(handle).toHaveAttribute("aria-valuenow", "222");
    contentHeight.mockReturnValue(900);
    fireEvent(window, new Event("resize"));
    expect(handle).toHaveAttribute("aria-valuenow", "480");
    fireEvent.keyDown(handle, { key: "End" });
    expect(handle).toHaveAttribute("aria-valuenow", "710");
    contentHeight.mockReturnValue(100);
    fireEvent(window, new Event("resize"));
    expect(handle).toHaveAttribute("aria-valuenow", "710");
  });
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows records loaded from localStorage on the calendar", async () => {
    saveRecords([createRecord({ exerciseName: "ベンチプレス" })]);

    render(<App />);

    expect(await within(calendarPanel()).findByText("ベンチプレス")).toBeInTheDocument();
  });

  it("restores the selected day and visible month after remounting", async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    swipeCalendar({ from: [100, 100], to: [200, 105] });
    const month = within(calendarPanel()).getByRole("button", {
      name: "15",
    });
    await user.click(month);
    const selected = within(selectedDayPanel()).getByRole("heading").textContent;
    first.unmount();
    render(<App />);
    expect(within(selectedDayPanel()).getByRole("heading").textContent).toBe(selected);
  });

  it("restores edit sessions as saved record details without draft values", async () => {
    const user = userEvent.setup();
    saveRecords([createRecord({ exerciseName: "スクワット" })]);
    const first = render(<App />);
    await user.click(
      await within(selectedDayPanel()).findByRole("button", { name: /スクワット/ }),
    );
    await user.click(screen.getByRole("button", { name: "編集" }));
    await user.type(screen.getByLabelText("メモ"), "unsaved draft");
    first.unmount();
    render(<App />);
    expect(await screen.findByRole("region", { name: "記録詳細" })).toBeInTheDocument();
    expect(screen.queryByText("unsaved draft")).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem("workout-tracker.view-state")).not.toContain(
      "unsaved draft",
    );
  });

  it.each([
    "broken",
    JSON.stringify({ version: 2 }),
    JSON.stringify({
      version: 1,
      selectedDate: "2026-02-30",
      visibleMonth: "2026-02-01",
      recordId: null,
    }),
    JSON.stringify({
      version: 1,
      selectedDate: "2020-02-15",
      visibleMonth: "2020-02-01",
      recordId: "record_missing",
    }),
  ])("falls back from invalid or missing view state: %s", async (state) => {
    window.sessionStorage.setItem("workout-tracker.view-state", state);
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: formatDateLabel(new Date()) }),
    ).toBeInTheDocument();
  });

  it("keeps the app usable when session storage throws", async () => {
    const user = userEvent.setup();
    const getItem = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
      this: Storage,
      key,
    ) {
      if (this === window.sessionStorage) throw new Error("unavailable");
      return getItem.call(this, key);
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("unavailable");
    });
    render(<App />);
    await user.click(screen.getByRole("button", { name: /新しい記録を作成/ }));
    expect(screen.getByRole("region", { name: "記録追加フォーム" })).toBeInTheDocument();
  });

  it("shows selected-day records in saved order", async () => {
    saveRecords([
      createRecord({ id: "record_first", exerciseName: "ベンチプレス" }),
      createRecord({ id: "record_second", exerciseName: "スクワット" }),
    ]);

    render(<App />);

    await within(selectedDayPanel()).findByRole("button", { name: /ベンチプレス/ });
    const recordButtons = within(selectedDayPanel()).getAllByRole("button", {
      name: /ベンチプレス|スクワット/,
    });
    expect(recordButtons.map((button) => button.textContent)).toEqual([
      "ベンチプレスtop 120kg / 90kg x 8 reps",
      "スクワットtop 120kg / 90kg x 8 reps",
    ]);
  });

  it("updates the calendar and selected-day list after saving a record", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /新しい記録を作成/ }));
    await user.type(screen.getByLabelText("種目名"), "ラットプルダウン");
    await user.type(screen.getAllByLabelText("重量")[0], "60");
    await user.type(screen.getAllByLabelText("reps")[0], "10");
    await user.click(saveButton());

    expect(
      await within(calendarPanel()).findByText("ラットプルダウン"),
    ).toBeInTheDocument();
    expect(
      within(selectedDayPanel()).getByRole("button", { name: /ラットプルダウン/ }),
    ).toBeInTheDocument();
    expect(within(selectedDayPanel()).getByText("60kg x 10 reps")).toBeInTheDocument();
    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(
      true,
    );
  });

  it("saves, displays, and reopens a unilateral workout", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /新しい記録を作成/ }));
    await user.type(screen.getByLabelText("種目名"), "ダンベルアームカール");
    await user.click(screen.getByRole("checkbox", { name: "片側種目" }));
    await user.type(screen.getAllByLabelText("重量")[0], "10");
    await user.type(screen.getAllByLabelText("reps")[0], "10");
    await user.type(screen.getByLabelText("1セット目（左）の重量"), "10");
    await user.type(screen.getByLabelText("1セット目（左）のreps"), "9");

    expect(screen.getByText("合計 19 reps")).toBeInTheDocument();
    await user.click(saveButton());

    expect(loadRecords()[0]).toMatchObject({
      isUnilateral: true,
      sets: [
        {
          setNumber: 1,
          right: { weightKg: 10, reps: 10 },
          left: { weightKg: 10, reps: 9 },
        },
      ],
    });

    await user.click(
      within(selectedDayPanel()).getByRole("button", {
        name: /ダンベルアームカール/,
      }),
    );
    expect(screen.getByText("1 右")).toBeInTheDocument();
    expect(screen.getByText("1 左")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "編集" }));
    expect(screen.getByRole("checkbox", { name: "片側種目" })).toBeChecked();
    expect(screen.getByLabelText("1セット目（左）の重量")).toHaveValue("10");
    expect(screen.getByLabelText("1セット目（左）のreps")).toHaveValue("9");
  });

  it("shows field errors until both sides of a unilateral set are complete", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /新しい記録を作成/ }));
    await user.type(screen.getByLabelText("種目名"), "ダンベルアームカール");
    await user.click(screen.getByRole("checkbox", { name: "片側種目" }));
    await user.type(screen.getAllByLabelText("重量")[0], "10");
    await user.type(screen.getAllByLabelText("reps")[0], "10");
    await user.click(saveButton());

    expect(screen.getByLabelText("1セット目（左）の重量")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("1セット目（左）のreps")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(loadRecords()).toEqual([]);
  });

  it("ignores left-only rows after switching back to bilateral mode", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /新しい記録を作成/ }));
    await user.type(screen.getByLabelText("種目名"), "ダンベルアームカール");
    const unilateralToggle = screen.getByRole("checkbox", { name: "片側種目" });
    await user.click(unilateralToggle);
    await user.type(screen.getAllByLabelText("重量")[0], "10");
    await user.type(screen.getAllByLabelText("reps")[0], "10");
    await user.type(screen.getByLabelText("2セット目（左）の重量"), "8");
    await user.type(screen.getByLabelText("2セット目（左）のreps"), "7");
    await user.click(unilateralToggle);
    await user.click(saveButton());

    expect(loadRecords()[0]).toMatchObject({
      sets: [{ setNumber: 1, weightKg: 10, reps: 10 }],
    });
    expect(loadRecords()[0]).not.toHaveProperty("isUnilateral");
  });

  it("prefers the current right values for left suggestions and stepper", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /新しい記録を作成/ }));
    await user.click(screen.getByRole("checkbox", { name: "片側種目" }));
    await user.type(screen.getAllByLabelText("重量")[0], "10");
    await user.type(screen.getAllByLabelText("reps")[0], "7");
    await user.type(screen.getByLabelText("1セット目（左）の重量"), "8");
    await user.type(screen.getByLabelText("1セット目（左）のreps"), "6");
    await user.type(screen.getAllByLabelText("重量")[1], "12");
    await user.type(screen.getAllByLabelText("reps")[1], "10");

    const secondLeftWeight = screen.getByLabelText("2セット目（左）の重量");
    const secondLeftReps = screen.getByLabelText("2セット目（左）のreps");
    expect(secondLeftWeight).toHaveAttribute("placeholder", "12");
    expect(secondLeftReps).toHaveAttribute("placeholder", "10");

    await user.click(
      screen.getByRole("button", { name: "2セット目（左）のrepsを増やす" }),
    );
    expect(secondLeftReps).toHaveValue("11");
  });

  it("shows an error when saving fails unexpectedly", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage write failed");
    });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /新しい記録を作成/ }));
    await user.type(screen.getByLabelText("種目名"), "ラットプルダウン");
    await user.type(screen.getAllByLabelText("重量")[0], "60");
    await user.type(screen.getAllByLabelText("reps")[0], "10");
    await user.click(saveButton());

    expect(
      await screen.findByText(
        "保存中にエラーが発生しました。画面を再読み込みしてもう一度お試しください。",
      ),
    ).toBeInTheDocument();
  });

  it("adds a set row when randomUUID is not available", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("crypto", {});
    render(<App />);

    await user.click(screen.getByRole("button", { name: /新しい記録を作成/ }));
    await user.click(screen.getByRole("button", { name: "+ セットを追加" }));

    expect(screen.getAllByLabelText("重量")).toHaveLength(4);
    expect(screen.getAllByLabelText("reps")).toHaveLength(4);
  });

  it("disables the delete set button when only one set row remains", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /新しい記録を作成/ }));
    await user.click(screen.getByRole("button", { name: "3セット目を削除" }));
    await user.click(screen.getByRole("button", { name: "2セット目を削除" }));

    expect(screen.getByRole("button", { name: "1セット目を削除" })).toBeDisabled();
  });

  it("uses the previous confirmed reps as a suggestion and stepper base", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /新しい記録を作成/ }));
    const repsInputs = screen.getAllByLabelText("reps");

    expect(repsInputs[0]).toHaveAttribute("placeholder", "8");
    await user.type(repsInputs[0], "7");
    expect(repsInputs[1]).toHaveValue("");
    expect(repsInputs[1]).toHaveAttribute("placeholder", "7");
    expect(screen.getByText("合計 7 reps")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "2セット目のrepsを増やす" }));
    expect(repsInputs[1]).toHaveValue("8");
    expect(screen.getByText("合計 15 reps")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "3セット目のrepsを減らす" }));
    expect(repsInputs[2]).toHaveValue("7");
    expect(screen.getByText("合計 22 reps")).toBeInTheDocument();
  });

  it("keeps reps stepper values within the existing limits", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /新しい記録を作成/ }));
    const firstReps = screen.getAllByLabelText("reps")[0];

    await user.type(firstReps, "1");
    await user.click(screen.getByRole("button", { name: "1セット目のrepsを減らす" }));
    expect(firstReps).toHaveValue("1");

    await user.clear(firstReps);
    await user.type(firstReps, "999");
    await user.click(screen.getByRole("button", { name: "1セット目のrepsを増やす" }));
    expect(firstReps).toHaveValue("999");
  });

  it("does not save an untouched reps suggestion", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /新しい記録を作成/ }));
    await user.type(screen.getByLabelText("種目名"), "ベンチプレス");
    await user.type(screen.getAllByLabelText("重量")[0], "60");
    await user.type(screen.getAllByLabelText("reps")[0], "8");

    expect(screen.getAllByLabelText("reps")[1]).toHaveAttribute("placeholder", "8");
    await user.click(saveButton());

    expect(loadRecords()[0]?.sets).toEqual([{ setNumber: 1, weightKg: 60, reps: 8 }]);
  });

  it("shows required marks and field-level errors after save is attempted", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /新しい記録を作成/ }));
    const addForm = screen.getByRole("region", { name: "記録追加フォーム" });
    await user.clear(within(addForm).getByLabelText("日付"));
    await user.click(saveButton());

    expect(within(addForm).getAllByText("*")).toHaveLength(3);
    expect(within(addForm).getByText("日付を入力してください。")).toBeInTheDocument();
    expect(within(addForm).getByText("種目名を入力してください。")).toBeInTheDocument();
    expect(
      within(addForm).getByText("セット内容を1件以上入力してください。"),
    ).toBeInTheDocument();
    expect(within(addForm).getByLabelText("日付")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(within(addForm).getByLabelText("種目名")).toHaveClass("invalid-input");
  });

  it("shows a persistent save action on new and edit forms", async () => {
    const user = userEvent.setup();
    saveRecords([createRecord({ exerciseName: "スクワット" })]);
    render(<App />);

    await user.click(screen.getByRole("button", { name: /新しい記録を作成/ }));

    expect(saveAction()).toBeInTheDocument();
    expect(within(saveAction()).getByRole("button", { name: "保存" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /戻る/ }));
    await user.click(
      await within(selectedDayPanel()).findByRole("button", { name: /スクワット/ }),
    );
    await user.click(screen.getByRole("button", { name: "編集" }));

    expect(saveAction()).toBeInTheDocument();
    expect(within(saveAction()).getByRole("button", { name: "保存" })).toBeEnabled();
  });

  it("keeps a changed new-record form when discarding is cancelled", async () => {
    const user = userEvent.setup();
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    render(<App />);

    await user.click(screen.getByRole("button", { name: /新しい記録を作成/ }));
    await user.type(screen.getByLabelText("種目名"), "スクワット");
    await user.click(screen.getByRole("button", { name: /戻る/ }));

    expect(screen.getByRole("region", { name: "記録追加フォーム" })).toBeInTheDocument();
    expect(screen.getByLabelText("種目名")).toHaveValue("スクワット");

    await user.click(screen.getByRole("button", { name: /戻る/ }));

    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm).toHaveBeenCalledWith("未保存の変更があります。破棄して戻りますか？");
    expect(screen.getByRole("region", { name: /のカレンダー/ })).toBeInTheDocument();
  });

  it("returns from an unchanged form without a discard confirmation", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm");
    render(<App />);

    await user.click(screen.getByRole("button", { name: /新しい記録を作成/ }));
    await user.click(screen.getByRole("button", { name: /戻る/ }));

    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: /のカレンダー/ })).toBeInTheDocument();
  });

  it("protects changed forms from browser-level navigation", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /新しい記録を作成/ }));
    const cleanEvent = new Event("beforeunload", { cancelable: true });
    expect(window.dispatchEvent(cleanEvent)).toBe(true);

    const exerciseName = screen.getByLabelText("種目名");
    await user.type(exerciseName, "デッドリフト");
    const dirtyEvent = new Event("beforeunload", { cancelable: true });
    expect(window.dispatchEvent(dirtyEvent)).toBe(false);
    expect(dirtyEvent.defaultPrevented).toBe(true);

    await user.clear(exerciseName);
    const revertedEvent = new Event("beforeunload", { cancelable: true });
    expect(window.dispatchEvent(revertedEvent)).toBe(true);
  });

  it("shows set-row errors near the incomplete set inputs", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /新しい記録を作成/ }));
    await user.type(screen.getByLabelText("種目名"), "ベンチプレス");
    const firstSetReps = screen.getAllByLabelText("reps")[0];
    await user.type(screen.getAllByLabelText("重量")[0], "60");
    await user.click(saveButton());

    expect(screen.getByText("repsを入力してください。")).toBeInTheDocument();
    expect(firstSetReps).toHaveAttribute("aria-invalid", "true");
    expect(firstSetReps).toHaveClass("invalid-input");
  });

  it("opens the matching record detail from a selected-day card and returns to the same selected day", async () => {
    const user = userEvent.setup();
    const previousDay = dateWithOffset(-1);
    saveRecords([
      createRecord({
        id: "record_squat",
        date: formatStorageDate(previousDay),
        exerciseName: "スクワット",
        topSet: { successWeightKg: 140, failedWeightKg: 145 },
        sets: [
          { setNumber: 1, weightKg: 100, reps: 5 },
          { setNumber: 2, weightKg: 100, reps: 4 },
        ],
        note: "深さよし",
      }),
    ]);

    render(<App />);

    await user.click(
      await within(calendarPanel()).findByRole("button", { name: /スクワット/ }),
    );
    await user.click(
      await within(selectedDayPanel()).findByRole("button", { name: /スクワット/ }),
    );

    expect(screen.getByRole("heading", { name: "スクワット" })).toBeInTheDocument();
    expect(screen.getByText("140kg")).toBeInTheDocument();
    expect(screen.getByText("145kg")).toBeInTheDocument();
    expect(screen.getByText("合計 9 reps")).toBeInTheDocument();
    expect(screen.getByText("深さよし")).toBeInTheDocument();
    expect(
      within(recordAction())
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["編集", "記録を削除"]);

    await user.click(screen.getByRole("button", { name: /戻る/ }));

    expect(
      screen.getByRole("heading", { name: formatDateLabel(previousDay) }),
    ).toBeInTheDocument();
    expect(
      within(selectedDayPanel()).getByRole("button", { name: /スクワット/ }),
    ).toBeInTheDocument();
  });

  it("shows empty labels for detail values that were not entered", async () => {
    const user = userEvent.setup();
    saveRecords([
      createRecord({
        exerciseName: "ショルダープレス",
        topSet: { successWeightKg: null, failedWeightKg: null },
        note: "",
      }),
    ]);

    render(<App />);

    await user.click(
      await within(selectedDayPanel()).findByRole("button", {
        name: /ショルダープレス/,
      }),
    );

    expect(screen.getAllByText("未入力")).toHaveLength(3);
  });

  it("shows multiple sets and total reps in detail", async () => {
    const user = userEvent.setup();
    saveRecords([
      createRecord({
        exerciseName: "デッドリフト",
        sets: [
          { setNumber: 1, weightKg: 150, reps: 3 },
          { setNumber: 2, weightKg: 150, reps: 3 },
          { setNumber: 3, weightKg: 140, reps: 5 },
        ],
      }),
    ]);

    render(<App />);

    await user.click(
      await within(selectedDayPanel()).findByRole("button", { name: /デッドリフト/ }),
    );

    expect(screen.getByText("合計 11 reps")).toBeInTheDocument();
    expect(screen.getAllByText("150kg")).toHaveLength(2);
    expect(screen.getByText("140kg")).toBeInTheDocument();
    expect(screen.getByText("5 reps")).toBeInTheDocument();
  });

  it("opens an edit form with the selected record values", async () => {
    const user = userEvent.setup();
    saveRecords([
      createRecord({
        exerciseName: "スクワット",
        topSet: { successWeightKg: 140, failedWeightKg: 145 },
        sets: [
          { setNumber: 1, weightKg: 100, reps: 5 },
          { setNumber: 2, weightKg: 90, reps: 8 },
        ],
        note: "深さよし",
      }),
    ]);

    render(<App />);

    await user.click(
      await within(selectedDayPanel()).findByRole("button", { name: /スクワット/ }),
    );
    await user.click(screen.getByRole("button", { name: "編集" }));

    const editForm = screen.getByRole("region", { name: "記録編集フォーム" });
    expect(
      within(editForm).getByRole("heading", { name: "記録を編集" }),
    ).toBeInTheDocument();
    expect(within(editForm).getByLabelText("種目名")).toHaveValue("スクワット");
    expect(within(editForm).getByLabelText("成功重量")).toHaveValue("140");
    expect(within(editForm).getByLabelText("失敗重量")).toHaveValue("145");
    expect(within(editForm).getAllByLabelText("重量")[0]).toHaveValue("100");
    expect(within(editForm).getAllByLabelText("reps")[1]).toHaveValue("8");
    expect(
      within(editForm).getByRole("button", { name: "1セット目のrepsを減らす" }),
    ).toBeInTheDocument();
    expect(
      within(editForm).getByRole("button", { name: "1セット目のrepsを増やす" }),
    ).toBeInTheDocument();
    expect(within(editForm).getByLabelText("メモ")).toHaveValue("深さよし");
  });

  it("protects unsaved edits before returning to record details", async () => {
    const user = userEvent.setup();
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    saveRecords([createRecord({ exerciseName: "スクワット" })]);
    render(<App />);

    await user.click(
      await within(selectedDayPanel()).findByRole("button", { name: /スクワット/ }),
    );
    await user.click(screen.getByRole("button", { name: "編集" }));
    await user.clear(screen.getByLabelText("種目名"));
    await user.type(screen.getByLabelText("種目名"), "フロントスクワット");

    await user.click(screen.getByRole("button", { name: /戻る/ }));
    expect(screen.getByRole("region", { name: "記録編集フォーム" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /戻る/ }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("region", { name: "記録詳細" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "スクワット" })).toBeInTheDocument();
  });

  it("saves edited values and updates the calendar and selected-day list", async () => {
    const user = userEvent.setup();
    const editedDate = dateWithOffset(1);
    saveRecords([
      createRecord({
        id: "record_edit",
        exerciseName: "スクワット",
        createdAt: "2026-08-29T09:00:00.000Z",
        updatedAt: "2026-08-29T09:00:00.000Z",
      }),
    ]);

    render(<App />);

    await user.click(
      await within(selectedDayPanel()).findByRole("button", { name: /スクワット/ }),
    );
    await user.click(screen.getByRole("button", { name: "編集" }));

    const editForm = screen.getByRole("region", { name: "記録編集フォーム" });
    await user.clear(within(editForm).getByLabelText("日付"));
    await user.type(
      within(editForm).getByLabelText("日付"),
      formatStorageDate(editedDate),
    );
    await user.clear(within(editForm).getByLabelText("種目名"));
    await user.type(within(editForm).getByLabelText("種目名"), "フロントスクワット");
    const firstSetWeight = within(editForm).getAllByLabelText("重量")[0];
    const firstSetReps = within(editForm).getAllByLabelText("reps")[0];
    await user.clear(firstSetWeight);
    await user.type(firstSetWeight, "80");
    await user.clear(firstSetReps);
    await user.type(firstSetReps, "6");
    await user.click(saveButton());

    expect(
      screen.getByRole("heading", { name: formatDateLabel(editedDate) }),
    ).toBeInTheDocument();
    expect(
      await within(calendarPanel()).findByText("フロントスクワット"),
    ).toBeInTheDocument();
    expect(
      within(selectedDayPanel()).getByRole("button", { name: /フロントスクワット/ }),
    ).toBeInTheDocument();
    expect(within(selectedDayPanel()).getByText(/80kg x 6 reps/)).toBeInTheDocument();

    expect(loadRecords()).toEqual([
      expect.objectContaining({
        id: "record_edit",
        exerciseName: "フロントスクワット",
        createdAt: "2026-08-29T09:00:00.000Z",
        sets: [{ setNumber: 1, weightKg: 80, reps: 6 }],
      }),
    ]);
    expect(loadRecords()[0]?.updatedAt).not.toBe("2026-08-29T09:00:00.000Z");
  });

  it("deletes a record after confirmation", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    saveRecords([createRecord({ id: "record_delete", exerciseName: "スクワット" })]);

    render(<App />);

    await user.click(
      await within(selectedDayPanel()).findByRole("button", { name: /スクワット/ }),
    );
    await user.click(screen.getByRole("button", { name: "記録を削除" }));

    expect(confirm).toHaveBeenCalledWith("この記録を削除しますか？");
    expect(
      await within(selectedDayPanel()).findByText("この日の記録はまだありません。"),
    ).toBeInTheDocument();
    expect(loadRecords()).toEqual([]);
  });

  it("keeps a record when delete confirmation is cancelled", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    saveRecords([createRecord({ id: "record_keep", exerciseName: "スクワット" })]);

    render(<App />);

    await user.click(
      await within(selectedDayPanel()).findByRole("button", { name: /スクワット/ }),
    );
    await user.click(screen.getByRole("button", { name: "記録を削除" }));

    expect(screen.getByRole("heading", { name: "スクワット" })).toBeInTheDocument();
    expect(loadRecords()).toHaveLength(1);
  });
});
