import { describe, expect, it } from "vitest";

import type { WorkoutRecord } from "./types";

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
});
