/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkoutRecord } from "./types";

import { App } from "./App";
import { formatDateLabel, formatStorageDate } from "./dateUtils";

function todayKey(): string {
  return formatStorageDate(new Date());
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

function saveButtons(): HTMLElement[] {
  return screen.getAllByRole("button", { name: "保存" });
}

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows records loaded from localStorage on the calendar", async () => {
    saveRecords([createRecord({ exerciseName: "ベンチプレス" })]);

    render(<App />);

    expect(await within(calendarPanel()).findByText("ベンチプレス")).toBeInTheDocument();
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
    await user.click(saveButtons()[1]);

    expect(
      await within(calendarPanel()).findByText("ラットプルダウン"),
    ).toBeInTheDocument();
    expect(
      within(selectedDayPanel()).getByRole("button", { name: /ラットプルダウン/ }),
    ).toBeInTheDocument();
    expect(within(selectedDayPanel()).getByText("60kg x 10 reps")).toBeInTheDocument();
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
    await user.click(saveButtons()[1]);

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

  it("shows required marks and field-level errors after save is attempted", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /新しい記録を作成/ }));
    const addForm = screen.getByRole("region", { name: "記録追加フォーム" });
    await user.clear(within(addForm).getByLabelText("日付"));
    await user.click(saveButtons()[1]);

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

  it("shows set-row errors near the incomplete set inputs", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /新しい記録を作成/ }));
    await user.type(screen.getByLabelText("種目名"), "ベンチプレス");
    const firstSetReps = screen.getAllByLabelText("reps")[0];
    await user.type(screen.getAllByLabelText("重量")[0], "60");
    await user.click(saveButtons()[1]);

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
    expect(within(editForm).getByLabelText("メモ")).toHaveValue("深さよし");
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
    await user.click(within(editForm).getAllByRole("button", { name: "保存" })[1]);

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
