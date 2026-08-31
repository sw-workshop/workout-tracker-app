import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkoutRecord } from "./types";

import {
  buildWorkoutRecordFromForm,
  createForm,
  createFormFromWorkoutRecord,
} from "./recordForm";

const now = new Date("2026-08-23T08:00:00.000Z");
const baseRecord: WorkoutRecord = {
  id: "record_existing",
  date: "2026-08-22",
  exerciseName: "スクワット",
  exerciseType: "weighted",
  topSet: {
    successWeightKg: 140,
    failedWeightKg: null,
  },
  sets: [
    { setNumber: 1, weightKg: 100, reps: 5 },
    { setNumber: 2, weightKg: 90, reps: 8 },
  ],
  note: "深さよし",
  createdAt: "2026-08-22T08:00:00.000Z",
  updatedAt: "2026-08-22T08:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildWorkoutRecordFromForm", () => {
  it("builds a workout record from complete form rows and ignores empty rows", () => {
    const form = createForm("2026-08-23");
    form.exerciseName = "ベンチプレス";
    form.topSuccessWeightKg = "120";
    form.topFailedWeightKg = "125";
    form.sets = [
      { id: "set-1", weightKg: "90", reps: "8" },
      { id: "set-2", weightKg: "", reps: "" },
      { id: "set-3", weightKg: "", reps: "" },
    ];
    form.note = "重かった";

    const result = buildWorkoutRecordFromForm(form, now);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.record).toMatchObject({
      date: "2026-08-23",
      exerciseName: "ベンチプレス",
      exerciseType: "weighted",
      topSet: {
        successWeightKg: 120,
        failedWeightKg: 125,
      },
      sets: [{ setNumber: 1, weightKg: 90, reps: 8 }],
      note: "重かった",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    expect(result.record.id).toMatch(/^record_/);
  });

  it("uses the previous set weight when a later row omits weight", () => {
    const form = createForm("2026-08-23");
    form.exerciseName = "スクワット";
    form.sets = [
      { id: "set-1", weightKg: "100", reps: "5" },
      { id: "set-2", weightKg: "", reps: "4" },
      { id: "set-3", weightKg: "90", reps: "6" },
    ];

    const result = buildWorkoutRecordFromForm(form, now);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.record.sets).toEqual([
      { setNumber: 1, weightKg: 100, reps: 5 },
      { setNumber: 2, weightKg: 100, reps: 4 },
      { setNumber: 3, weightKg: 90, reps: 6 },
    ]);
  });

  it("rejects a set row that has weight but no reps", () => {
    const form = createForm("2026-08-23");
    form.exerciseName = "デッドリフト";
    form.sets = [{ id: "set-1", weightKg: "140", reps: "" }];

    const result = buildWorkoutRecordFromForm(form, now);

    expect(result).toEqual({
      ok: false,
      error: "1セット目のrepsを入力してください。",
    });
  });

  it("rejects a first set row that has reps but no weight", () => {
    const form = createForm("2026-08-23");
    form.exerciseName = "デッドリフト";
    form.sets = [{ id: "set-1", weightKg: "", reps: "3" }];

    const result = buildWorkoutRecordFromForm(form, now);

    expect(result).toEqual({
      ok: false,
      error: "1セット目の重量は0より大きい数値で入力してください。",
    });
  });

  it("rejects empty set rows only", () => {
    const form = createForm("2026-08-23");
    form.exerciseName = "ショルダープレス";

    const result = buildWorkoutRecordFromForm(form, now);

    expect(result).toEqual({
      ok: false,
      error: "セット内容を1件以上入力してください。",
    });
  });

  it("rejects unfinished weight values on save", () => {
    const form = createForm("2026-08-23");
    form.exerciseName = "ラットプルダウン";
    form.sets = [{ id: "set-1", weightKg: "60.", reps: "10" }];

    const result = buildWorkoutRecordFromForm(form, now);

    expect(result).toEqual({
      ok: false,
      error: "1セット目の重量は0より大きい数値で入力してください。",
    });
  });

  it("builds a UUID based record id when randomUUID is not available", () => {
    vi.stubGlobal("crypto", {
      getRandomValues(values: Uint8Array) {
        values.fill(1);
        return values;
      },
    });
    const form = createForm("2026-08-23");
    form.exerciseName = "ベンチプレス";
    form.sets = [{ id: "set-1", weightKg: "90", reps: "8" }];

    const result = buildWorkoutRecordFromForm(form, now);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.record.id).toMatch(
      /^record_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe("createFormFromWorkoutRecord", () => {
  it("fills a form with existing workout record values", () => {
    const form = createFormFromWorkoutRecord(baseRecord);

    expect(form).toEqual({
      date: "2026-08-22",
      exerciseName: "スクワット",
      topSuccessWeightKg: "140",
      topFailedWeightKg: "",
      sets: [
        { id: "set-1", weightKg: "100", reps: "5" },
        { id: "set-2", weightKg: "90", reps: "8" },
        { id: "set-3", weightKg: "", reps: "" },
      ],
      note: "深さよし",
    });
  });

  it("keeps all existing set rows when the record has more than three sets", () => {
    const form = createFormFromWorkoutRecord({
      ...baseRecord,
      sets: [
        { setNumber: 1, weightKg: 100, reps: 5 },
        { setNumber: 2, weightKg: 95, reps: 5 },
        { setNumber: 3, weightKg: 90, reps: 5 },
        { setNumber: 4, weightKg: 85, reps: 8 },
      ],
    });

    expect(form.sets).toHaveLength(4);
  });
});

describe("buildWorkoutRecordFromForm with base record", () => {
  it("updates a workout record while keeping its id and createdAt", () => {
    const form = createFormFromWorkoutRecord(baseRecord);
    form.exerciseName = "フロントスクワット";
    form.sets = [{ id: "set-1", weightKg: "80", reps: "6" }];

    const result = buildWorkoutRecordFromForm(form, now, baseRecord);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.record).toMatchObject({
      id: "record_existing",
      exerciseName: "フロントスクワット",
      sets: [{ setNumber: 1, weightKg: 80, reps: 6 }],
      createdAt: "2026-08-22T08:00:00.000Z",
      updatedAt: now.toISOString(),
    });
  });
});
