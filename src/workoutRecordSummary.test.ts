import { describe, expect, it } from "vitest";

import type { WorkoutRecord } from "./types";
import { buildDraftWorkoutRecord, createForm } from "./recordForm";

import {
  countWorkoutRecordTotalReps,
  formatReps,
  formatWeight,
  formatWorkoutRecordDate,
  summarizeWorkoutRecord,
} from "./workoutRecordSummary";

function createRecord(record: Partial<WorkoutRecord>): WorkoutRecord {
  return {
    id: "record_test",
    date: "2026-08-29",
    exerciseName: "ベンチプレス",
    exerciseType: "weighted",
    topSet: {
      successWeightKg: null,
      failedWeightKg: null,
    },
    sets: [],
    note: "",
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
    ...record,
  };
}

describe("summarizeWorkoutRecord", () => {
  it("shows incomplete draft strings without inferred weights or zero values", () => {
    const form = createForm("2026-10-24");
    form.exerciseName = "カール";
    const draft = buildDraftWorkoutRecord(form, new Date());
    expect(summarizeWorkoutRecord(draft)).toBe("セット未入力");
    draft.form.isUnilateral = true;
    draft.form.sets[0].weightKg = "10.";
    draft.form.sets[1].leftReps = "7";
    expect(summarizeWorkoutRecord(draft)).toBe(
      "1: 右 10.kg x 未入力, 左 未入力 x 未入力, 2: 右 未入力 x 未入力, 左 未入力 x 7 reps",
    );
  });
  it("shows top set and grouped set reps", () => {
    const record = createRecord({
      topSet: {
        successWeightKg: 120,
        failedWeightKg: 125,
      },
      sets: [
        { setNumber: 1, weightKg: 90, reps: 8 },
        { setNumber: 2, weightKg: 90, reps: 7 },
        { setNumber: 3, weightKg: 90, reps: 6 },
      ],
    });

    expect(summarizeWorkoutRecord(record)).toBe(
      "top 120kg / (125kg失敗) / 90kg x 8, 7, 6 reps",
    );
  });

  it("keeps separate set groups when weight changes", () => {
    const record = createRecord({
      sets: [
        { setNumber: 1, weightKg: 100, reps: 5 },
        { setNumber: 2, weightKg: 100, reps: 4 },
        { setNumber: 3, weightKg: 90, reps: 6 },
      ],
    });

    expect(summarizeWorkoutRecord(record)).toBe("100kg x 5, 4 reps, 90kg x 6 reps");
  });

  it("omits empty top set values", () => {
    const record = createRecord({
      sets: [{ setNumber: 1, weightKg: 45, reps: 8 }],
    });

    expect(summarizeWorkoutRecord(record)).toBe("45kg x 8 reps");
  });

  it("summarizes both sides of unilateral sets", () => {
    const record = createRecord({
      isUnilateral: true,
      sets: [
        {
          setNumber: 1,
          right: { weightKg: 10, reps: 10 },
          left: { weightKg: 10, reps: 9 },
        },
      ],
    });

    expect(summarizeWorkoutRecord(record)).toBe("1: 右 10kg x 10, 左 10kg x 9 reps");
  });
});

describe("record detail formatters", () => {
  it("formats a saved date for display", () => {
    expect(formatWorkoutRecordDate(createRecord({ date: "2026-08-29" }))).toBe(
      "2026年8月29日",
    );
  });

  it("formats nullable weight values", () => {
    expect(formatWeight(120)).toBe("120kg");
    expect(formatWeight(null)).toBe("未入力");
  });

  it("formats reps values", () => {
    expect(formatReps(8)).toBe("8 reps");
  });

  it("counts total reps", () => {
    const record = createRecord({
      sets: [
        { setNumber: 1, weightKg: 90, reps: 8 },
        { setNumber: 2, weightKg: 90, reps: 7 },
        { setNumber: 3, weightKg: 85, reps: 6 },
      ],
    });

    expect(countWorkoutRecordTotalReps(record)).toBe(21);
  });

  it("counts reps from both sides of unilateral sets", () => {
    const record = createRecord({
      isUnilateral: true,
      sets: [
        {
          setNumber: 1,
          right: { weightKg: 10, reps: 10 },
          left: { weightKg: 10, reps: 9 },
        },
      ],
    });

    expect(countWorkoutRecordTotalReps(record)).toBe(19);
  });
});
